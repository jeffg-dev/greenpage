import { DEFAULT_SETTINGS, OPTIONS, pick, type Settings } from "./settings.js";

export const SETTINGS_KEY = "greenpage:settings:v1";

function read(key: string): unknown {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function write(key: string, value: Settings): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value, Object.keys(OPTIONS)));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSettings(): Settings | null {
  const stored = read(SETTINGS_KEY);
  if (!isRecord(stored)) return null;
  const merged: Record<string, unknown> = {
    ...DEFAULT_SETTINGS,
    ...stored,
    font: stored.font === "dys" ? "sans" : stored.font,
    size: stored.size === "medium" ? "regular" : stored.size,
  };
  const keys = Object.keys(OPTIONS) as (keyof Settings)[];
  return keys.every((key) => pick(key, merged[key]) !== undefined)
    ? (Object.fromEntries(keys.map((key) => [key, merged[key]])) as Settings)
    : null;
}

export function writeSettings(settings: Settings): boolean {
  return write(SETTINGS_KEY, settings);
}
