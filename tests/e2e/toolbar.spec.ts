import { expect, test } from "@playwright/test";
import { open } from "./helpers.js";

const TOOLS = ["New", "Open", "Download", "Settings"];

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

// No file picker on the phone, so Save wears its widest label, "Download".
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>)["showSaveFilePicker"];
  });
});

test("on a phone every tool stays on screen and the bar stays out of the way", async ({ page }) => {
  await open(page);
  const bar = page.locator("#bar");

  await expect(bar.getByRole("button", { name: "Download", exact: true })).toBeVisible();
  for (const name of TOOLS) {
    await expect(bar.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.locator("#docName")).toBeVisible();

  const box = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll("#bar button"))
      .filter((b) => !b.closest("#openMenu"))
      .map((b) => b.getBoundingClientRect());
    const root = document.documentElement;
    return {
      height: document.getElementById("bar")!.getBoundingClientRect().height,
      rows: new Set(boxes.map((r) => Math.round(r.top))).size,
      shortest: Math.min(...boxes.map((r) => r.height)),
      sideways: root.scrollWidth > root.clientWidth,
    };
  });

  expect(box.rows, "the toolbar wraps onto at most two rows").toBeLessThanOrEqual(2);
  expect(box.height, "two rows of buttons, not a slab").toBeLessThanOrEqual(2 * 44 + 16);
  expect(box.shortest, "a fingertip still gets 44 px").toBeGreaterThanOrEqual(44);
  expect(box.sideways, "nothing is pushed off the side").toBe(false);
});
