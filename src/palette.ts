export interface Command {
  label: string;
  hint?: string;
  words?: string;
  run: () => void;
}

const wordsOf = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export function rank(commands: Command[], query: string): Command[] {
  const tokens = wordsOf(query);
  const hits = (text: string): boolean => {
    const words = wordsOf(text);
    return tokens.every((token) => words.some((word) => word.startsWith(token)));
  };
  return commands
    .filter((command) => hits(`${command.label} ${command.words ?? ""}`))
    .sort((a, b) => Number(!hits(a.label)) - Number(!hits(b.label)));
}

export function initPalette(
  dialog: HTMLDialogElement,
  input: HTMLInputElement,
  list: HTMLElement,
  editor: HTMLElement,
  commands: () => Command[],
): { open: () => void } {
  let all: Command[] = [];
  let shown: Command[] = [];
  let active = 0;
  let chosen: Command | undefined;

  function highlight(index: number): void {
    active = index;
    Array.from(list.children).forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
    const item = list.children[index];
    if (item) input.setAttribute("aria-activedescendant", item.id);
    else input.removeAttribute("aria-activedescendant");
    item?.scrollIntoView({ block: "nearest" });
  }

  function choose(index: number): void {
    const command = shown[index];
    if (!command) return;
    chosen = command;
    dialog.close();
  }

  function render(): void {
    shown = rank(all, input.value);
    list.replaceChildren(
      ...shown.map((command, i) => {
        const item = document.createElement("li");
        item.id = `palette-${i}`;
        item.setAttribute("role", "option");
        item.className = "setting-choice";
        const label = document.createElement("span");
        label.textContent = command.label;
        const hint = document.createElement("span");
        hint.className = "palette-hint";
        hint.textContent = command.hint ?? "";
        item.append(label, hint);
        item.addEventListener("click", () => choose(i));
        return item;
      }),
    );
    input.setAttribute("aria-expanded", String(shown.length > 0));
    highlight(0);
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (shown.length) highlight((active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  });
  list.addEventListener("pointerdown", (event) => event.preventDefault());
  dialog.addEventListener("close", () => {
    editor.focus({ preventScroll: true });
    const command = chosen;
    chosen = undefined;
    command?.run();
  });

  return {
    open: () => {
      all = commands();
      input.value = "";
      render();
      dialog.showModal();
      input.focus();
    },
  };
}
