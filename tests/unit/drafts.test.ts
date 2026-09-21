import { describe, expect, it } from "vitest";
import { randomDraftName, upsertDraft, type DraftRecord } from "../../src/drafts.js";

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
