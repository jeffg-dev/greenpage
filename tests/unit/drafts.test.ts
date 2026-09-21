import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  boot,
  currentId,
  flush,
  initDraftStorage,
  persistedText,
  randomDraftName,
  switchTo,
  upsertDraft,
  type DraftRecord,
} from "../../src/drafts.js";

describe("randomDraftName", () => {
  it("produces <numberword>-<asteroid>.txt with no spaces or hyphens beyond the one separator", () => {
    for (let i = 0; i < 200; i++) {
      const name = randomDraftName();
      expect(name).toMatch(/^[a-z]+-[a-z]+\.txt$/);
      expect(name.split("-")).toHaveLength(2);
    }
  });

  it("is deterministic given a fixed source of randomness", () => {
    expect(randomDraftName(() => 0)).toBe("one-ceres.txt");
    expect(randomDraftName(() => 0.999999)).toBe("twentyfive-piazzia.txt");
  });
});

describe("upsertDraft", () => {
  const record = (id: string, text: string, updatedAt = 1): DraftRecord => ({ id, name: id + ".txt", text, updatedAt });

  it("adds a new record with non-empty text", () => {
    expect(upsertDraft([], record("a", "hello"))).toEqual([record("a", "hello")]);
  });

  it("replaces an existing record with the same id", () => {
    const list = [record("a", "old"), record("b", "keep")];
    expect(upsertDraft(list, record("a", "new", 2))).toEqual([record("b", "keep"), record("a", "new", 2)]);
  });

  it("removes the record instead of storing empty or whitespace-only text", () => {
    const list = [record("a", "old"), record("b", "keep")];
    expect(upsertDraft(list, record("a", "   ", 2))).toEqual([record("b", "keep")]);
    expect(upsertDraft(list, record("a", "", 2))).toEqual([record("b", "keep")]);
  });

  it("never adds an empty record that was not already present", () => {
    expect(upsertDraft([record("b", "keep")], record("a", ""))).toEqual([record("b", "keep")]);
  });
});

describe("storage-backed draft lifecycle", () => {
  let store: Map<string, string>;
  let session: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    session = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => { session.set(key, value); },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reopening the currently open draft keeps unflushed typing instead of reverting to a stale snapshot", () => {
    boot();
    const id = currentId();
    flush("Hello");

    const result = switchTo("Hello World", id);

    expect(result?.text).toBe("Hello World");
    expect(persistedText()).toBe("Hello World");
  });

  it("a failing write keeps persistedText() unchanged, so the dirty state stays truthful", () => {
    let errors = 0;
    initDraftStorage(() => { errors++; });
    boot();
    flush("first save");
    expect(persistedText()).toBe("first save");

    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: () => { throw new DOMException("Full", "QuotaExceededError"); },
    });
    flush("second save, never lands");

    expect(persistedText(), "a failed write must not be reported as saved").toBe("first save");
    expect(errors).toBe(1);
  });
});
