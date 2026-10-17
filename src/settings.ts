export const OPTIONS = {
  font: ["serif", "sans", "mono"],
  size: ["small", "regular", "large"],
  theme: ["system", "light", "dark"],
} as const;

export type Settings = { -readonly [K in keyof typeof OPTIONS]: (typeof OPTIONS)[K][number] };

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  font: "serif",
  size: "regular",
  theme: "system",
});

export const pick = <K extends keyof Settings>(key: K, value: unknown): Settings[K] | undefined =>
  (OPTIONS[key] as readonly unknown[]).includes(value) ? (value as Settings[K]) : undefined;

export function applySettings(settings: Settings): void {
  Object.assign(document.documentElement.dataset, settings);
}

export function initSettings(
  initial: Settings,
  onApply: (settings: Settings) => void,
  onClose?: () => void,
): { open: () => void } {
  const dialog = document.getElementById("settingsDlg") as HTMLDialogElement;
  const form = document.getElementById("settingsForm") as HTMLFormElement;
  const resetButton = document.getElementById("settingsReset") as HTMLButtonElement;
  document.getElementById("appVersion")!.textContent = import.meta.env.CP_VERSION;
  let committed = { ...initial };

  const fromForm = (values: FormData): Settings =>
    Object.fromEntries(
      (Object.keys(OPTIONS) as (keyof Settings)[]).map((key) => [key, pick(key, values.get(key)) ?? DEFAULT_SETTINGS[key]]),
    ) as Settings;

  function updatePreviews(): void {
    const font = fromForm(new FormData(form)).font;
    for (const sample of form.querySelectorAll<HTMLElement>(".size-preview")) {
      sample.dataset.previewFont = font;
    }
  }

  function setChoices(settings: Settings): void {
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      input.checked = settings[input.name as keyof Settings] === input.value;
    }
    updatePreviews();
  }

  form.addEventListener("change", updatePreviews);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    committed = fromForm(values);
    onApply({ ...committed });
    dialog.close();
  });
  document.getElementById("settingsCancel")!.addEventListener("click", () => {
    dialog.close();
  });
  resetButton.addEventListener("click", () => setChoices(DEFAULT_SETTINGS));
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.isComposing) return;
    const stops = Array.from(form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input[type="radio"]:checked, button'))
      .filter((control) => !control.disabled && control.getClientRects().length > 0);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener("close", () => onClose?.());

  return {
    open: () => {
      if (dialog.open) return;
      setChoices(committed);
      dialog.showModal();
    },
  };
}
