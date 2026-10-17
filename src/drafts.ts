import { ASTEROID_NAMES } from "./names.js";

export interface DraftRecord {
  id: string;
  name: string;
  text: string;
  updatedAt: number;
}

export const DRAFTS_KEY = "greenpage:drafts:v1";
export const CURRENT_KEY = "greenpage:draft:v1";

const NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "twentyone", "twentytwo", "twentythree", "twentyfour", "twentyfive",
] as const;

export function randomDraftName(rand: () => number = Math.random): string {
  const number = NUMBER_WORDS[Math.floor(rand() * NUMBER_WORDS.length)];
  const asteroid = ASTEROID_NAMES[Math.floor(rand() * ASTEROID_NAMES.length)];
  return `${number}-${asteroid}.txt`;
}

export function newDraftId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDraftRecord(value: unknown): value is DraftRecord {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.text === "string" && typeof value.updatedAt === "number";
}

function readAll(): DraftRecord[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isDraftRecord) : [];
  } catch {
    return [];
  }
}

function writeAll(records: DraftRecord[]): boolean {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export function upsertDraft(records: DraftRecord[], record: DraftRecord): DraftRecord[] {
  const rest = records.filter((r) => r.id !== record.id);
  return record.text.trim() ? [...rest, record] : rest;
}

export function listDrafts(): DraftRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function readDraft(id: string): DraftRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

function storeDraft(record: DraftRecord): boolean {
  return writeAll(upsertDraft(readAll(), record));
}

export function deleteDraft(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

function rememberedDraft(): { id: string; name: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(CURRENT_KEY) ?? "null") as unknown;
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
    return { id: value.id, name: value.name };
  } catch {
    return null;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(CURRENT_KEY, JSON.stringify({ id, name }));
  } catch {
  }
}

export function formatRelativeTime(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function previewOf(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length) ?? "";
  const trimmed = line.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed;
}

let id = "";
let name = "";
let saveTimer = 0;
let onError: (() => void) | undefined;

export function initDraftStorage(handler: () => void): void {
  onError = handler;
}

function persist(text: string): void {
  if (!storeDraft({ id, name, text, updatedAt: Date.now() })) onError?.();
}

export function currentName(): string {
  return name;
}

export function currentId(): string {
  return id;
}

export function boot(): { name: string; text: string } {
  const remembered = rememberedDraft();
  const existing = remembered ? readDraft(remembered.id) : null;
  id = existing?.id ?? remembered?.id ?? newDraftId();
  name = existing?.name ?? remembered?.name ?? randomDraftName();
  remember();
  return { name, text: existing?.text ?? "" };
}

export function scheduleAutosave(text: string): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => persist(text), 300);
}

export function flush(text: string): void {
  clearTimeout(saveTimer);
  persist(text);
}

export function startNew(currentText: string): { name: string; text: string } {
  flush(currentText);
  id = newDraftId();
  name = randomDraftName();
  remember();
  return { name, text: "" };
}

export function adoptFile(currentText: string, fileName: string, fileText: string): { name: string; text: string } {
  flush(currentText);
  id = newDraftId();
  name = fileName;
  remember();
  persist(fileText);
  return { name, text: fileText };
}

export function switchTo(currentText: string, targetId: string): { name: string; text: string } | null {
  flush(currentText);
  const record = readDraft(targetId);
  if (!record) return null;
  id = record.id;
  name = record.name;
  remember();
  return { name, text: record.text };
}

export function rename(newName: string, text: string): string {
  name = newName;
  remember();
  persist(text);
  return name;
}

export function saveAs(newName: string, text: string): string {
  if (newName !== name) {
    id = newDraftId();
    name = newName;
    remember();
  }
  persist(text);
  return name;
}

