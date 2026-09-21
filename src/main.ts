import "./styles.css";
import "./typography.css";

import { lineHeightOf, linesPerPage, mirrorText } from "./metrics.js";
import { clearCache, lineStarts, pagesOf } from "./paginate.js";
import { PrintDoc } from "./printdoc.js";
import * as files from "./files.js";
import * as drafts from "./drafts.js";
import { S } from "./strings.js";
import { promptSave, renderBreaks, say } from "./ui.js";
import { initDocName, initDraftsDialog, initOpenMenu } from "./draftui.js";
import { applySettings, DEFAULT_SETTINGS, initSettings } from "./settings.js";
import { readSettings, writeSettings } from "./storage.js";
import { initToolbar } from "./toolbar.js";
import { initHistory } from "./history.js";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing element: " + id);
  return el as T;
};

const ta = $<HTMLTextAreaElement>("ta");
ta.readOnly = true;
if (/Mac|iPhone|iPad|iPod/.test(navigator.platform)) $("tabhint").textContent = S.tabHintMac;
const bar = $("bar");
const sheet = $("sheet");
const mirror = $<HTMLPreElement>("mirror");
const breaks = $("breaks");
const printHost = $("printdoc");
const status = $("status");
const statusWord = $("statusWord");
const statusGlyph = status.querySelector<HTMLElement>(".gl")!;
const pagecount = $("pagecount");

const btnNew = $<HTMLButtonElement>("btnNew");
const btnOpen = $<HTMLButtonElement>("btnOpen");
const btnSave = $<HTMLButtonElement>("btnSave");
const btnSaveLabel = $("btnSaveLabel");
const btnSettings = $<HTMLButtonElement>("btnSettings");
const settingsDlg = $<HTMLDialogElement>("settingsDlg");
const downloadDlg = $<HTMLDialogElement>("downloadDlg");
const draftsDlg = $<HTMLDialogElement>("draftsDlg");
btnSaveLabel.textContent = files.canSaveToFile() ? S.save : S.download;

const dlg = $<HTMLDialogElement>("dlg");

const sayDlg = $<HTMLDialogElement>("say");
const sayBody = $("sayBody");
const sayOk = $<HTMLButtonElement>("sayOk");

const printDoc = new PrintDoc(printHost, mirror, () => ta.value);

let announcedPages = 0;
let announceTimer = 0;
let seeded = false;

function announcePages(pages: number): void {
  if (!seeded) {
    seeded = true;
    announcedPages = pages;
    return;
  }
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    if (pages === announcedPages) return;
    announcedPages = pages;
    pagecount.textContent = S.pageCount(pages);
  }, 300);
}

function layout(): void {
  const text = mirrorText(ta.value);
  const lineH = lineHeightOf(mirror);
  const lpp = linesPerPage(lineH);
  const pageH = lpp * lineH;
  const starts = lineStarts(mirror, text);
  const pages = pagesOf(starts, lpp);
  const narrow = ta.clientWidth < mirror.clientWidth;
  if (narrow) {
    const y = scrollY;
    ta.style.height = "0px";
    ta.style.height = ta.scrollHeight + "px";
    scrollTo(0, y);
  } else {
    ta.style.height = pages * pageH + "px";
  }
  renderBreaks(breaks, narrow ? 1 : pages, pageH);
  printDoc.schedule();
  announcePages(pages);
}

addEventListener("resize", layout);

const publishBarHeight = (): void => {
  document.documentElement.style.setProperty("--bar-h", bar.offsetHeight + "px");
};
publishBarHeight();
new ResizeObserver(publishBarHeight).observe(bar);

sheet.addEventListener("pointerdown", (e) => {
  if (e.target !== sheet) return;
  e.preventDefault();
  ta.focus();
});

let lastStatus = "";
let appReady = false;

const hasWriting = (): boolean => ta.value.trim().length > 0;

function refreshDirty(): void {
  const empty = !hasWriting();
  const pending = ta.value !== drafts.persistedText();
  const statusKey = JSON.stringify([pending, empty, drafts.currentName()]);
  if (statusKey !== lastStatus) {
    lastStatus = statusKey;
    const shown = !pending && !empty;
    statusGlyph.textContent = shown ? "✓" : "";
    statusWord.textContent = shown ? S.saved : "";
    status.dataset.empty = String(empty);
    status.dataset.state = pending ? "dirty" : "clean";
  }
  document.title = `${drafts.currentName()} — ${S.appName}`;
}

const docNameUI = initDocName($<HTMLButtonElement>("docName"), $<HTMLInputElement>("docNameInput"), (newName) => {
  drafts.rename(newName, ta.value);
  refreshDirty();
});

function syncDocName(): void {
  docNameUI.setName(drafts.currentName());
  refreshDirty();
}

let draftsWarned = false;
drafts.initDraftStorage(() => {
  if (draftsWarned) return;
  draftsWarned = true;
  tell(S.draftsStorageError);
});

ta.addEventListener("input", () => {
  refreshDirty();
  requestAnimationFrame(layout);
  drafts.scheduleAutosave(ta.value, refreshDirty);
});

addEventListener("pagehide", () => drafts.flush(ta.value));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") drafts.flush(ta.value);
});

const askingSomething = (): boolean =>
  dlg.open || sayDlg.open || settingsDlg.open || downloadDlg.open || draftsDlg.open || openMenuCtl.isOpen();
const toolbar = initToolbar($("toolbar"), ta, askingSomething);

sayOk.textContent = S.errOk;
$("sayTitle").textContent = S.errTitle;
$("newTab").textContent = " " + S.newTab;

const tell = (message: string): void => say(sayDlg, sayBody, sayOk, message, ta);

function loadDocument(text: string): void {
  ta.value = text;
  history.reset();
  layout();
  ta.setSelectionRange(0, 0);
  ta.focus();
  window.scrollTo(0, 0);
}

let fileBusy = false;
let documentChanges = 0;

function lockDocument(): () => void {
  documentChanges += 1;
  ta.readOnly = true;
  return () => {
    documentChanges -= 1;
    ta.readOnly = !appReady || documentChanges > 0;
  };
}

function beginFileAction(): boolean {
  if (!appReady || fileBusy || askingSomething()) return false;
  fileBusy = true;
  for (const button of [btnNew, btnOpen, btnSave, btnSettings]) button.disabled = true;
  toolbar.refresh();
  return true;
}

function endFileAction(): void {
  fileBusy = false;
  for (const button of [btnNew, btnOpen, btnSave, btnSettings]) button.disabled = false;
  toolbar.refresh();
}

btnNew.addEventListener("click", () => {
  void (async () => {
    if (fileBusy || !beginFileAction()) return;
    const unlock = lockDocument();
    try {
      files.forgetFile();
      const { text } = drafts.startNew(ta.value);
      loadDocument(text);
      syncDocName();
    } catch {
      tell(S.errNew);
    } finally {
      unlock();
      endFileAction();
    }
  })();
});

const openMenuCtl = initOpenMenu(btnOpen, $("openMenu"), {
  onFile: () => void doOpenFile(),
  onDraft: () => draftsDialog.open(),
});

const draftsDialog = initDraftsDialog(draftsDlg, $("draftsList"), $("draftsEmpty"), $<HTMLButtonElement>("draftsClose"), ta, {
  list: () => drafts.listDrafts(),
  currentId: () => drafts.currentId(),
  onChoose: (id) => {
    const result = drafts.switchTo(ta.value, id);
    if (!result) return;
    const unlock = lockDocument();
    files.forgetFile();
    loadDocument(result.text);
    syncDocName();
    unlock();
  },
  onDelete: (id) => drafts.removeDraft(id),
});

async function doOpenFile(): Promise<void> {
  if (fileBusy || !beginFileAction()) return;
  try {
    const opened = await files.open();
    if (!opened) {
      ta.focus();
      return;
    }
    await acceptOpened(opened);
  } catch {
    tell(S.errOpen);
  } finally {
    endFileAction();
  }
}

async function acceptOpened(opened: files.OpenedFile): Promise<void> {
  if (files.looksBinary(opened.text)) {
    tell(S.errNotText);
    return;
  }
  const unlock = lockDocument();
  try {
    files.adopt(opened);
    const { text } = drafts.adoptFile(ta.value, opened.name, opened.text);
    loadDocument(text);
    syncDocName();
  } finally {
    unlock();
  }
}

btnSave.addEventListener("click", () => {
  void doSave();
});

async function doSave(): Promise<void> {
  if (!beginFileAction()) return;
  const text = ta.value;
  try {
    const choice = await promptSave(drafts.currentName(), ta);
    if (!choice) return;
    const name = files.downloadName(choice.name);
    if (choice.action === "draft") {
      files.forgetFile();
      drafts.saveAs(name, text);
      ta.focus();
      syncDocName();
      return;
    }
    const saved = await files.save(text, name);
    ta.focus();
    if (saved === null) return;
    drafts.rename(saved, text);
    syncDocName();
  } catch {
    tell(S.errSave);
  } finally {
    endFileAction();
  }
}

addEventListener("beforeprint", () => printDoc.buildIfStale());
addEventListener("afterprint", () => ta.focus());

const isTextFile = (f: File): boolean => f.type === "text/plain" || /\.txt$/i.test(f.name);

addEventListener("dragover", (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
});

addEventListener("drop", (e) => {
  if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
  e.preventDefault();
  if (fileBusy || askingSomething()) return;
  const file = Array.from(e.dataTransfer.files).find(isTextFile);
  if (!file) {
    tell(S.errNotText);
    return;
  }
  void (async () => {
    if (fileBusy || !beginFileAction()) return;
    try {
      await acceptOpened(await files.readDropped(file));
    } catch {
      tell(S.errOpen);
    } finally {
      endFileAction();
    }
  })();
});

ta.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.isComposing) return;
  if (e.shiftKey) {
    e.preventDefault();
    toolbar.focus();
    return;
  }
  e.preventDefault();
  if (ta.readOnly) return;
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, "\t");
  } catch {
    ok = false;
  }
  if (!ok) {
    ta.setRangeText("\t", ta.selectionStart, ta.selectionEnd, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
  if (askingSomething()) return;
  const k = e.key.toLowerCase();
  if (k === "s") {
    e.preventDefault();
    void doSave();
  } else if (k === "o") {
    e.preventDefault();
    void doOpenFile();
  }
});

function refocusInPlace(yBefore: number, hBefore: number): void {
  const h = document.documentElement.scrollHeight;
  ta.focus({ preventScroll: true });
  window.scrollTo(0, hBefore > 0 ? Math.round(yBefore * (h / hBefore)) : yBefore);
}

const initialSettings = readSettings() ?? { ...DEFAULT_SETTINGS };
applySettings(initialSettings);
let settingsScroll = { y: 0, h: 0 };
let settingsStored = true;
const settings = initSettings(initialSettings, (value) => {
  applySettings(value);
  clearCache();
  layout();
  settingsStored = writeSettings(value);
}, () => {
  refocusInPlace(settingsScroll.y, settingsScroll.h);
  if (!settingsStored) tell(S.settingsStorageError);
});
btnSettings.addEventListener("click", () => {
  if (!appReady || fileBusy || askingSomething()) return;
  settingsScroll = { y: window.scrollY, h: document.documentElement.scrollHeight };
  settingsStored = true;
  settings.open();
});

const history = initHistory(ta);

async function boot(): Promise<void> {
  const { text } = drafts.boot();
  ta.value = text;
  history.reset();
  layout();
  syncDocName();
  void document.fonts.load('16px "Source Sans 3"').catch(() => {});
  try {
    await document.fonts.load('16px "Source Serif 4"');
  } catch {
  }
  clearCache();
  layout();
  printDoc.build();
  appReady = true;
  ta.readOnly = documentChanges > 0;
  ta.focus();
}

document.fonts.addEventListener("loadingdone", () => {
  clearCache();
  layout();
});

void boot();

(window as unknown as { __tpLineStarts?: () => number[] }).__tpLineStarts = () =>
  lineStarts(mirror, mirrorText(ta.value));

addEventListener("load", () => {
  if (!import.meta.env.PROD) return;
  try {
    void navigator.serviceWorker?.register("./sw.js", { updateViaCache: "all" }).catch(() => {
    });
  } catch {
  }
});
