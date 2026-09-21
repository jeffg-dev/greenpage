import { expect, test } from "@playwright/test";
import { CORPUS, chooseFont, geometry, open, setText, settle } from "./helpers.js";

test("the saved indicator stays quiet while editing and follows edit and undo", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#status")).toHaveAttribute("data-empty", "true");
  await expect(page.locator("#status")).toHaveAttribute("data-state", "clean");

  await page.locator("#ta").click();
  await page.keyboard.type("Once upon a time");
  await expect(page.locator("#status")).toHaveAttribute("data-state", "dirty");
  await settle(page);
  await expect(page.locator("#status")).toHaveAttribute("data-state", "clean");

  for (let i = 0; i < 20 && (await page.inputValue("#ta")) !== ""; i++) {
    await page.keyboard.press("ControlOrMeta+z");
  }
  await settle(page);
  expect(await page.inputValue("#ta")).toBe("");
  await expect(page.locator("#status")).toHaveAttribute("data-state", "clean");
  await expect(page.locator("#status")).toHaveAttribute("data-empty", "true");
});

test("New clears the page immediately, without asking, and drafts persist so closing is always safe", async ({ page }) => {
  await open(page);
  await setText(page, "There are very few good tragedies\nsome are idylls in dialogue, well written and well rhymed.");

  await page.locator("#btnNew").click();
  await expect(page.locator("#ta")).toHaveValue("");
  await expect(page.locator("#ta")).toBeFocused();

  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.type());
    void d.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await new Promise((r) => setTimeout(r, 1500));
  expect(dialogs, "drafts persist automatically, so closing is always safe").toEqual([]);
});

test("New treats whitespace as a blank page", async ({ page }) => {
  await open(page);
  await page.locator("#ta").fill(" \n\t  ");
  await page.locator("#btnNew").click();
  await expect(page.locator("#ta")).toHaveValue("");
});

test("Tab types a tab, keeps focus, and is undoable", async ({ page }) => {
  await open(page);
  await page.locator("#ta").click();
  await page.keyboard.type("ab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("cd");
  await settle(page);

  expect(await page.inputValue("#ta")).toBe("ab\tcd");
  await expect(page.locator("#ta"), "Tab must not move focus out of the page").toBeFocused();

  for (let step = 0; step < 10 && (await page.inputValue("#ta")).includes("\t"); step += 1) {
    await page.keyboard.press("ControlOrMeta+z");
  }
  expect(await page.inputValue("#ta"), "the tab is undoable").not.toContain("\t");
});

test("pasting rich HTML puts plain text in the document", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const src = document.createElement("div");
    src.id = "__rich";
    src.contentEditable = "true";
    src.innerHTML = "<h1>Big</h1><b>bold</b> <i>it</i>";
    document.body.appendChild(src);
    const r = document.createRange();
    r.selectNodeContents(src);
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  });
  await page.keyboard.press("ControlOrMeta+c");
  await page.evaluate(() => document.getElementById("__rich")!.remove());

  await page.locator("#ta").click();
  await page.keyboard.press("ControlOrMeta+v");
  await settle(page);

  const v = await page.inputValue("#ta");
  expect(v, "no markup survives a paste into a textarea").not.toMatch(/[<>]/);
  expect(v.replace(/\s+/gu, " ").trim()).toBe("Big bold it");
});

test("Tab indents without showing a pop-up or arming a different keyboard mode", async ({ page }) => {
  await open(page);
  await page.locator("#ta").click();
  await page.keyboard.type("Hello");

  const ring = () =>
    page.evaluate(() => {
      const sheet = document.getElementById("sheet")!;
      return {
        armed: sheet.hasAttribute("data-armed"),
        hintShown: document.getElementById("tabhint")!.hasAttribute("data-shown"),
      };
    });

  const resting = await ring();
  expect(resting.armed).toBe(false);

  // A plain Tab still indents, without interrupting writing with a hint.
  await page.keyboard.press("Tab");
  expect(await page.inputValue("#ta")).toBe("Hello\t");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("ta");
  const afterTab = await ring();
  expect(afterTab.hintShown).toBe(false);

  // Escape no longer changes what the next Tab means.
  await page.keyboard.press("Escape");
  const armed = await ring();
  expect(armed.armed).toBe(false);
  expect(armed.hintShown).toBe(false);

  await page.keyboard.press("Tab");
  await expect(page.locator("#ta")).toHaveValue("Hello\t\t");
  // The Docs File shortcut is the direct way to the controls instead.
  await page.keyboard.press("Alt+f");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("btnNew");
  const left = await ring();
  expect(left.armed).toBe(false);
  expect(left.hintShown, "and it is gone once the child is out of the field").toBe(false);
});

/** Shift+Tab remains an unconditional, single-gesture exit as well. */
test("Shift and Tab together leave the writing area without arming anything", async ({ page }) => {
  await open(page);
  await page.locator("#ta").click();
  await page.keyboard.type("Hello");
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe("ta");
  expect(await page.inputValue("#ta"), "and no tab character is typed").toBe("Hello");
});

test("a tab lands on a real 0.5 in stop, identically in the field and the printed sheet", async ({
  page,
}) => {
  await open(page);
  await setText(page, "\tone\n\t\ttwo\nthree\n");
  const tabs = await page.evaluate(() => {
    const ta = document.getElementById("ta")!;
    const pre = document.querySelector("#printdoc .page pre")!;
    const read = (el: Element) => {
      const cs = getComputedStyle(el);
      return { tabSize: cs.tabSize, fontSize: cs.fontSize, width: cs.width };
    };
    return { ta: read(ta), pre: read(pre), mirror: read(document.getElementById("mirror")!) };
  });
  // The two faces have different space advances, so an integer tab-size cannot
  // express the same stop for both. The LENGTH form can.
  expect(tabs.ta.tabSize).toBe("48px");
  expect(tabs.pre.tabSize).toBe("48px");
  expect(tabs.mirror.tabSize).toBe("48px");

  // The rest of the metrics contract (DESIGN §3) on the same three elements.
  // These values live only in `.tp-text`; nothing in TypeScript mirrors them,
  // so this assertion is the only thing that holds them together.
  for (const [who, m] of Object.entries(tabs)) {
    expect(m.fontSize, `${who}: 12 pt`).toBe("16px");
    expect(m.width, `${who}: the 720 px column`).toBe("720px");
  }
});

test("switching typeface repaginates the document", async ({ page }) => {
  await open(page);
  await setText(page, CORPUS);

  const serif = await geometry(page);

  await chooseFont(page, "sans");
  const sans = await geometry(page);

  expect(sans.pages).not.toBe(serif.pages);
  expect(sans.taHeight).toBe(sans.pages * 960);
  expect(sans.sheetHeight).toBe(sans.pages * 960 + 96);
  expect(sans.ruleTops).toEqual(
    Array.from({ length: sans.pages - 1 }, (_, i) => 48 + (i + 1) * 960),
  );
  expect(sans.printPages).toBe(sans.pages);
  await expect(page.locator("#ta"), "focus comes back to the writing").toBeFocused();

  // And back again: the count returns to exactly what it was.
  await chooseFont(page, "serif");
  expect((await geometry(page)).pages).toBe(serif.pages);
});
