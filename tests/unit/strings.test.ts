import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { S } from "../../src/strings.js";

const HTML = readFileSync(join(import.meta.dirname, "..", "..", "index.html"), "utf8");

const IN_MARKUP = [
  "appName",
  "toolbar",
  "openFile",
  "openDraft",
  "rename",
  "docNameLabel",
  "close",
  "letters",
  "lettersSerif",
  "lettersSansSerif",
  "fontSize",
  "sizeRegular",
  "sizeLarge",
  "onScreenColors",
  "colorsLight",
  "colorsDark",
  "resetSettings",
  "applySettings",
  "cancel",
  "previewLetters",
  "previewSize",
  "about",
  "website",
  "saveTitle",
  "saveName",
  "saveDraft",
  "download",
  "draftsTitle",
  "draftsEmpty",
  "pageLabel",
  "tabHint",
] as const;

const IN_CODE = [
  "newDoc",
  "open",
  "save",
  "settings",
  "tabHintMac",
  "saved",
  "pageCount",
  "resetTitle",
  "resetBody",
  "nameRequired",
  "nameInvalid",
  "draftsDelete",
  "errSave",
  "errNew",
  "errOpen",
  "errNotText",
  "errOk",
  "settingsStorageError",
  "draftsStorageError",
  "newTab",
  "errTitle",
] as const;

describe("strings.ts is the single source of the wording", () => {
  it.each(IN_MARKUP)("index.html renders S.%s verbatim", (key) => {
    const value = S[key];
    expect(typeof value, `${key} is a plain string`).toBe("string");
    expect(HTML, `index.html must contain S.${key}`).toContain(value as string);
  });

  it("accounts for every exported key: markup or code, nothing orphaned", () => {
    const covered = new Set<string>([...IN_MARKUP, ...IN_CODE]);
    const orphans = Object.keys(S).filter((k) => !covered.has(k));
    expect(orphans, "a new string must be wired up, not just declared").toEqual([]);
  });
});
