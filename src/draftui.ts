import { S } from "./strings.js";
import { cleanName, ensureTxt } from "./files.js";
import { formatRelativeTime, previewOf, type DraftRecord } from "./drafts.js";

export interface OpenMenuHandlers {
  onFile(): void;
  onDraft(): void;
}

export function initOpenMenu(
  button: HTMLButtonElement,
  menu: HTMLElement,
  handlers: OpenMenuHandlers,
): { isOpen(): boolean } {
  const items = Array.from(menu.querySelectorAll<HTMLButtonElement>(".menu-item"));
  let open = false;

  function place(): void {
    menu.style.left = button.offsetLeft + "px";
    menu.style.top = button.offsetTop + button.offsetHeight + 2 + "px";
  }

  function show(focusFirst: boolean): void {
    place();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    open = true;
    if (focusFirst) items[0]?.focus();
  }

  function close(refocusButton: boolean): void {
    if (!open) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    open = false;
    if (refocusButton) button.focus({ preventScroll: true });
  }

  button.addEventListener("click", () => (open ? close(false) : show(false)));
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      show(true);
    }
  });

  menu.addEventListener("keydown", (event) => {
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === "Tab") {
      close(false);
    }
  });

  items[0]!.addEventListener("click", () => {
    close(false);
    handlers.onFile();
  });
  items[1]!.addEventListener("click", () => {
    close(false);
    handlers.onDraft();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!open) return;
    if (menu.contains(event.target as Node) || button.contains(event.target as Node)) return;
    close(false);
  });

  return { isOpen: () => open };
}

export function initDocName(
  button: HTMLButtonElement,
  input: HTMLInputElement,
  onCommit: (name: string) => void,
): { setName(name: string): void } {
  let value = "";
  let cancelled = false;

  function setName(name: string): void {
    value = name;
    button.textContent = name;
    button.setAttribute("aria-label", `${S.rename}: ${name}`);
  }

  function startEdit(): void {
    input.value = value;
    button.hidden = true;
    input.hidden = false;
    input.focus();
    const dot = value.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : value.length);
  }

  function endEdit(commit: boolean): void {
    input.hidden = true;
    button.hidden = false;
    if (commit) {
      const cleaned = cleanName(input.value);
      const finalName = cleaned ? ensureTxt(cleaned) : value;
      if (finalName !== value) {
        setName(finalName);
        onCommit(finalName);
      }
    }
    button.focus({ preventScroll: true });
  }

  button.addEventListener("click", startEdit);
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startEdit();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    const commit = !cancelled;
    cancelled = false;
    endEdit(commit);
  });

  return { setName };
}

export interface DraftsDialogDeps {
  list(): DraftRecord[];
  currentId(): string;
  onChoose(id: string): void;
  onDelete(id: string): void;
}

export function initDraftsDialog(
  dlg: HTMLDialogElement,
  listEl: HTMLUListElement,
  emptyEl: HTMLElement,
  closeButton: HTMLButtonElement,
  editor: HTMLElement,
  deps: DraftsDialogDeps,
): { open(): void } {
  function render(): void {
    const records = deps.list();
    listEl.textContent = "";
    emptyEl.hidden = records.length > 0;
    for (const record of records) {
      const li = document.createElement("li");
      li.className = "draft-row";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "draft-open";
      const name = document.createElement("span");
      name.className = "draft-name";
      name.textContent = record.name;
      const when = document.createElement("span");
      when.className = "draft-when";
      when.textContent = formatRelativeTime(record.updatedAt);
      const preview = document.createElement("span");
      preview.className = "draft-preview";
      preview.textContent = previewOf(record.text);
      open.append(name, when, preview);
      open.addEventListener("click", () => {
        dlg.close();
        deps.onChoose(record.id);
      });
      li.append(open);

      if (record.id !== deps.currentId()) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "draft-delete";
        del.textContent = "✕";
        del.setAttribute("aria-label", S.draftsDelete(record.name));
        del.addEventListener("click", () => {
          const rows = Array.from(listEl.querySelectorAll<HTMLLIElement>(".draft-row"));
          const index = rows.indexOf(li);
          deps.onDelete(record.id);
          render();
          const newRows = Array.from(listEl.querySelectorAll<HTMLLIElement>(".draft-row"));
          const target = newRows[index] ?? newRows[newRows.length - 1];
          const control = target?.querySelector<HTMLButtonElement>(".draft-delete, .draft-open");
          (control ?? closeButton).focus({ preventScroll: true });
        });
        li.append(del);
      }
      listEl.append(li);
    }
  }

  closeButton.addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => editor.focus({ preventScroll: true } as FocusOptions));

  return {
    open(): void {
      render();
      dlg.showModal();
      const first = listEl.querySelector<HTMLButtonElement>(".draft-open");
      (first ?? closeButton).focus({ preventScroll: true } as FocusOptions);
    },
  };
}
