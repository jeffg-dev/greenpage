import { expect, test } from "@playwright/test";
import { SETTINGS_KEY } from "../../src/storage.js";
import { engineUnavailable, ready, settle } from "./helpers.js";

const STORY = "The next chapter\n猫 and a space traveller 👩🏽‍🚀\nTo be continued…\n";

test.beforeEach(({ browserName }) => {
  const unavailable = engineUnavailable(browserName);
  test.skip(!!unavailable, unavailable ?? "");
});

test("reload keeps the same draft, while a new tab starts a different, empty document", async ({ page, context }) => {
  await page.goto("./");
  await ready(page);
  await page.locator("#ta").fill(STORY);
  await settle(page);
  const name = await page.locator("#docName").innerText();

  const other = await context.newPage();
  await other.goto("./");
  await ready(other);
  await expect(other.locator("#ta")).toHaveValue("");
  const otherName = await other.locator("#docName").innerText();
  expect(otherName, "a new tab is a different document").not.toBe(name);
  await other.locator("#ta").fill("Another page");
  await settle(other);

  await page.reload();
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue(STORY);
  await expect(page.locator("#docName")).toHaveText(name);
  await expect(other.locator("#ta")).toHaveValue("Another page");

  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("./");
  await ready(reopened);
  await expect(reopened.locator("#ta")).toHaveValue("");
  expect(await reopened.locator("#docName").innerText(), "a fresh tab never resumes another one's draft").not.toBe(name);
});

test("only applied settings survive tab closure, and resetting settings preserves current writing", async ({ page, context }) => {
  await page.goto("./");
  await ready(page);
  await page.locator("#ta").fill(STORY);
  await page.locator("#btnSettings").click();
  await page.getByRole("radio", { name: "Sans-serif" }).check();
  await page.getByRole("radio", { name: "Large", exact: true }).check();
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.locator("#settingsApply").click();
  await page.locator("#btnSettings").click();
  await page.getByRole("radio", { name: "Regular", exact: true }).check();
  await page.locator("#settingsCancel").click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("./");
  await ready(reopened);
  await expect(reopened.locator("#ta")).toHaveValue("");
  await expect(reopened.locator("html")).toHaveAttribute("data-font", "sans");
  await expect(reopened.locator("html")).toHaveAttribute("data-size", "large");
  await expect(reopened.locator("html")).toHaveAttribute("data-theme", "dark");
  await reopened.locator("#ta").fill(STORY);
  await reopened.locator("#btnSettings").click();
  await reopened.locator("#settingsReset").click();
  await reopened.locator("#settingsApply").click();
  await expect(reopened.locator("#settingsDlg")).toBeHidden();
  await expect(reopened.locator("#ta")).toHaveValue(STORY);
  expect(await reopened.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SETTINGS_KEY))
    .toEqual({ font: "serif", size: "regular", theme: "light" });
});

test("a draft named by sessionStorage is restored on boot", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("greenpage:drafts:v1", JSON.stringify([
      { id: "old", name: "Old.txt", text: "Old writing", updatedAt: 1 },
    ]));
    sessionStorage.setItem("greenpage:draft:v1", JSON.stringify({ id: "old", name: "Old.txt" }));
  });
  await page.goto("./");
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue("Old writing");
  await expect(page.locator("#docName")).toHaveText("Old.txt");
});

test("a remembered draft that was never written keeps its name on reload", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("greenpage:draft:v1", JSON.stringify({ id: "unwritten", name: "Untouched.txt" }));
  });
  await page.goto("./");
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue("");
  await expect(page.locator("#docName")).toHaveText("Untouched.txt");
});

test("a garbled tab pointer starts a fresh auto-named document", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("greenpage:draft:v1", "does-not-exist");
  });
  await page.goto("./");
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue("");
  await expect(page.locator("#docName")).toHaveText(/^[a-z]+-[a-z]+\.txt$/);
});

test("denied storage does not break writing and reports a settings save failure", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => { throw new DOMException("Disabled by policy", "SecurityError"); },
    });
  });
  await page.goto("./");
  await ready(page);
  await page.locator("#ta").fill(STORY);
  await expect(page.locator("#status")).toHaveAttribute("data-state", "dirty");
  await page.locator("#btnSettings").click();
  await page.getByRole("radio", { name: "Large", exact: true }).check();
  await page.locator("#settingsApply").click();
  await expect(page.locator("#sayBody")).toHaveText("Could not keep your settings on this device.");
  await page.locator("#sayOk").click();
  await expect(page.locator("#ta")).toHaveValue(STORY);
  await expect(page.locator("#ta")).toBeEditable();
});
