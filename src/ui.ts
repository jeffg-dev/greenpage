import { MARGIN, PAGE_BODY_H } from "./metrics.js";
import { S } from "./strings.js";
import { cleanName } from "./files.js";

export function renderBreaks(host: HTMLElement, pages: number, pageH: number = PAGE_BODY_H): void {
  const want = Math.max(0, pages - 1);
  while (host.childElementCount > want) host.lastElementChild?.remove();
  for (let k = host.childElementCount; k < want; k++) {
    const rule = document.createElement("div");
    rule.className = "rule";
    host.append(rule);
  }
  for (let k = 1; k <= want; k++) {
    const rule = host.children[k - 1] as HTMLElement;
    const top = MARGIN + k * pageH;
    rule.style.top = top + "px";
  }
}

export interface SaveChoice {
  action: "draft" | "download";
  name: string;
}

export function promptSave(suggested: string, restoreFocusTo: HTMLElement): Promise<SaveChoice | null> {
  const dlg = document.getElementById("downloadDlg") as HTMLDialogElement;
  const form = document.getElementById("downloadForm") as HTMLFormElement;
  const input = document.getElementById("downloadName") as HTMLInputElement;
  const cancel = document.getElementById("downloadCancel") as HTMLButtonElement;
  const download = document.getElementById("downloadGo") as HTMLButtonElement;
  const saveDraft = document.getElementById("saveDraftGo") as HTMLButtonElement;
  const error = document.getElementById("downloadNameError")!;
  const complain = (message: string) => {
    input.setCustomValidity(message);
    input.setAttribute("aria-invalid", String(message !== ""));
    error.textContent = message;
  };
  const validate = (): boolean => {
    const problem = !input.value.trim() ? S.nameRequired : !cleanName(input.value) ? S.nameInvalid : "";
    if (problem) {
      complain(problem);
      input.reportValidity();
      return false;
    }
    return true;
  };
  return new Promise((resolve) => {
    let answer: SaveChoice | null = null;
    input.value = suggested;
    const untrap = trapTab(dlg, [input, cancel, saveDraft, download]);
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      if (!validate()) return;
      answer = { action: "download", name: input.value };
      dlg.close();
    };
    const onSaveDraft = () => {
      if (!validate()) return;
      answer = { action: "draft", name: input.value };
      dlg.close();
    };
    const onInput = () => complain("");
    const onCancel = () => dlg.close();
    const onClose = () => {
      untrap();
      form.removeEventListener("submit", onSubmit);
      saveDraft.removeEventListener("click", onSaveDraft);
      input.removeEventListener("input", onInput);
      cancel.removeEventListener("click", onCancel);
      dlg.removeEventListener("close", onClose);
      restoreFocusTo.focus({ preventScroll: true });
      resolve(answer);
    };
    complain("");
    form.addEventListener("submit", onSubmit);
    saveDraft.addEventListener("click", onSaveDraft);
    input.addEventListener("input", onInput);
    cancel.addEventListener("click", onCancel);
    dlg.addEventListener("close", onClose);
    dlg.showModal();
    input.focus();
    input.setSelectionRange(0, suggested.replace(/\.txt$/i, "").length);
  });
}

function trapTab(dlg: HTMLDialogElement, stops: HTMLElement[]): () => void {
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Tab" || e.isComposing) return;
    e.preventDefault();
    const i = stops.indexOf(document.activeElement as HTMLElement);
    const next =
      i < 0
        ? (e.shiftKey ? stops[stops.length - 1] : stops[0])
        : stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length];
    next?.focus({ focusVisible: true } as FocusOptions);
  };
  dlg.addEventListener("keydown", onKeydown);
  return () => dlg.removeEventListener("keydown", onKeydown);
}

export function say(
  dlg: HTMLDialogElement,
  body: HTMLElement,
  ok: HTMLButtonElement,
  message: string,
  restoreFocusTo: HTMLElement,
): void {
  body.textContent = message;
  const untrap = trapTab(dlg, [ok]);
  const onClose = () => {
    untrap();
    dlg.removeEventListener("close", onClose);
    ok.removeEventListener("click", onOk);
    restoreFocusTo.focus();
  };
  const onOk = () => dlg.close();
  ok.addEventListener("click", onOk);
  dlg.addEventListener("close", onClose);
  dlg.showModal();
  ok.focus({ focusVisible: true } as FocusOptions);
}
