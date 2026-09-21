export function initToolbar(
  root: HTMLElement,
  extra: HTMLButtonElement[],
  editor: HTMLTextAreaElement,
  dialogOpen: () => boolean,
): { refresh: () => void; focus: (button?: HTMLButtonElement) => void } {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button"), ...extra];
  let current = buttons[0];
  const available = () => buttons.filter((button) => !button.disabled);
  const refresh = () => {
    if (!current || current.disabled) current = available()[0];
    for (const button of buttons) button.tabIndex = button === current ? 0 : -1;
  };
  const focus = (button?: HTMLButtonElement) => {
    if (button && !button.disabled) current = button;
    refresh();
    current?.focus({ focusVisible: true } as FocusOptions);
  };
  const onFocusin = (event: FocusEvent) => {
    if (buttons.includes(event.target as HTMLButtonElement)) {
      current = event.target as HTMLButtonElement;
      refresh();
    }
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      editor.focus({ preventScroll: true });
      return;
    }
    const choices = available();
    const index = choices.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    let next: HTMLButtonElement | undefined;
    if (event.key === "ArrowRight") next = choices[(index + 1) % choices.length];
    else if (event.key === "ArrowLeft") next = choices[(index + choices.length - 1) % choices.length];
    else if (event.key === "Home") next = choices[0];
    else if (event.key === "End") next = choices[choices.length - 1];
    if (next) {
      event.preventDefault();
      focus(next);
    }
  };
  root.addEventListener("focusin", onFocusin);
  root.addEventListener("keydown", onKeydown);
  for (const button of extra) {
    button.addEventListener("focusin", onFocusin);
    button.addEventListener("keydown", onKeydown);
  }
  const apple = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  addEventListener("keydown", (event) => {
    if (event.isComposing || event.defaultPrevented || dialogOpen()) return;
    const key = event.key.toLowerCase();
    if (event.altKey && event.shiftKey && (apple ? event.metaKey : event.ctrlKey) && key === "m") {
      event.preventDefault();
      focus();
      return;
    }
    const menuModifiers = event.altKey && !event.metaKey && (apple ? event.ctrlKey : !event.ctrlKey);
    if (menuModifiers && (key === "f" || key === "t")) {
      event.preventDefault();
      if (key === "t") {
        document.getElementById("btnSettings")?.click();
        return;
      }
      focus(buttons.find((button) => button.id === "btnNew"));
      return;
    }
    const landmarkModifiers = apple
      ? event.metaKey && event.altKey && !event.ctrlKey
      : event.altKey && ((event.shiftKey && !event.ctrlKey) || (event.ctrlKey && !event.shiftKey));
    if (landmarkModifiers && (event.code === "Period" || event.code === "Comma")) {
      event.preventDefault();
      if (buttons.includes(document.activeElement as HTMLButtonElement)) editor.focus({ preventScroll: true });
      else focus();
    }
  });
  refresh();
  return { refresh, focus };
}
