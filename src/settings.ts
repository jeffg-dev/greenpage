import { S } from "./strings.js";
import type { Command } from "./palette.js";

export const OPTIONS = {
  font: ["serif", "sans", "mono"],
  size: ["small", "regular", "large"],
  spacing: ["normal", "compact"],
  view: ["page", "pageless"],
  theme: ["system", "light", "dark"],
} as const;

export type Settings = { -readonly [K in keyof typeof OPTIONS]: (typeof OPTIONS)[K][number] };

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  font: "serif",
  size: "regular",
  spacing: "normal",
  view: "page",
  theme: "system",
});

export const pick = <K extends keyof Settings>(key: K, value: unknown): Settings[K] | undefined =>
  (OPTIONS[key] as readonly unknown[]).includes(value) ? (value as Settings[K]) : undefined;

const read = (get: (key: keyof Settings) => unknown): Settings =>
  Object.fromEntries(
    (Object.keys(OPTIONS) as (keyof Settings)[]).map((key) => [key, pick(key, get(key)) ?? DEFAULT_SETTINGS[key]]),
  ) as Settings;

export const currentSettings = (): Settings => read((key) => document.documentElement.dataset[key]);

export function applySettings(settings: Settings): void {
  Object.assign(document.documentElement.dataset, settings);
}

export function initSettings(
  onApply: (settings: Settings) => void,
  onClose?: () => void,
): { open: () => void } {
  const dialog = document.getElementById("settingsDlg") as HTMLDialogElement;
  const form = document.getElementById("settingsForm") as HTMLFormElement;
  const resetButton = document.getElementById("settingsReset") as HTMLButtonElement;
  document.getElementById("appVersion")!.textContent = import.meta.env.CP_VERSION;

  const fromForm = (values: FormData): Settings => read((key) => values.get(key));

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
    onApply(fromForm(new FormData(form)));
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
      setChoices(currentSettings());
      dialog.showModal();
    },
  };
}

const ALIASES: Partial<Record<string, string>> = { regular: "medium" };
const title = (word: string): string => word[0]!.toUpperCase() + word.slice(1);

export function settingCommands(choose: (settings: Settings) => void): Command[] {
  const current = currentSettings();
  return (Object.keys(OPTIONS) as (keyof Settings)[]).flatMap((key) => {
    const values: readonly string[] = OPTIONS[key];
    const field = (value: string): Element | null =>
      document.querySelector(`#settingsForm input[name="${key}"][value="${value}"]`);
    const name = (value: string): string => field(value)?.nextElementSibling?.textContent ?? title(value);
    const words = (value: string): string => `${value} ${ALIASES[value] ?? ""}`;
    const set = (value: string) => () => choose({ ...current, [key]: value });
    if (values.length === 2) {
      const other = values.find((value) => value !== current[key])!;
      return [{ label: `${title(key)}: ${name(current[key])}`, hint: S.switchTo(name(other)), words: values.map(words).join(" "), run: set(other) }];
    }
    return values.map((value) => ({
      label: `${title(key)}: ${name(value)}`,
      hint: value === current[key] ? S.current : "",
      words: words(value),
      run: set(value),
    }));
  });
}
