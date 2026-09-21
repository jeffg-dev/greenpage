import { expect, test } from "@playwright/test";
import { open, ready, setText } from "./helpers.js";

test("boot gives every new document an auto name matching <numberword>-<asteroid>.txt", async ({ page }) => {
  await open(page);
  await expect(page.locator("#docName")).toHaveText(/^[a-z]+-[a-z]+\.txt$/);
});

test("typing then reloading keeps the same text and the same name", async ({ page }) => {
  await open(page);
  const name = await page.locator("#docName").innerText();
  await setText(page, "Keep me around.");
  await page.reload();
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue("Keep me around.");
  await expect(page.locator("#docName")).toHaveText(name);
});

test("a new tab starts a fresh, differently-named empty document", async ({ page, context }) => {
  await open(page);
  await setText(page, "First tab's writing.");
  const name = await page.locator("#docName").innerText();

  const other = await context.newPage();
  await other.goto("./");
  await ready(other);
  await expect(other.locator("#ta")).toHaveValue("");
  expect(await other.locator("#docName").innerText(), "a new tab is a different document").not.toBe(name);
});

test("New keeps the old draft available under Open > Draft…, and reopening it restores the text", async ({ page }) => {
  await open(page);
  await setText(page, "The old draft's words.");
  const oldName = await page.locator("#docName").innerText();

  await page.locator("#btnNew").click();
  await expect(page.locator("#ta")).toHaveValue("");
  const newName = await page.locator("#docName").innerText();
  expect(newName).not.toBe(oldName);

  await page.locator("#btnOpen").click();
  await page.locator("#openMenuDraft").click();
  await expect(page.locator("#draftsDlg")).toBeVisible();
  await page.locator(".draft-open", { hasText: oldName }).click();
  await expect(page.locator("#ta")).toHaveValue("The old draft's words.");
  await expect(page.locator("#docName")).toHaveText(oldName);
});

test("clicking the document name renames the draft, keeping its id and text", async ({ page }) => {
  await open(page);
  await setText(page, "Rename me.");
  await page.locator("#docName").click();
  await expect(page.locator("#docNameInput")).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("my-renamed-draft");
  await page.keyboard.press("Enter");
  await expect(page.locator("#docName")).toHaveText("my-renamed-draft.txt");
  await expect(page).toHaveTitle("my-renamed-draft.txt — Green Page");

  await page.reload();
  await ready(page);
  await expect(page.locator("#ta")).toHaveValue("Rename me.");
  await expect(page.locator("#docName")).toHaveText("my-renamed-draft.txt");
});

test("Escape cancels an in-progress rename", async ({ page }) => {
  await open(page);
  const name = await page.locator("#docName").innerText();
  await page.locator("#docName").click();
  await page.keyboard.type("a name nobody keeps");
  await page.keyboard.press("Escape");
  await expect(page.locator("#docName")).toHaveText(name);
});

test("Save > Save draft under a new name creates a second draft", async ({ page }) => {
  await open(page);
  await setText(page, "Original content.");
  const originalName = await page.locator("#docName").innerText();

  await page.locator("#btnSave").click();
  await page.locator("#downloadName").fill("second-draft");
  await page.locator("#saveDraftGo").click();
  await expect(page.locator("#docName")).toHaveText("second-draft.txt");
  await expect(page.locator("#ta")).toHaveValue("Original content.");

  await page.locator("#btnOpen").click();
  await page.locator("#openMenuDraft").click();
  await expect(page.locator("#draftsDlg")).toBeVisible();
  await expect(page.locator(".draft-open", { hasText: originalName })).toBeVisible();
  await expect(page.locator(".draft-open", { hasText: "second-draft.txt" })).toBeVisible();
  await page.locator("#draftsClose").click();
});

test("a draft can be deleted from the Drafts list, but never the current one", async ({ page }) => {
  await open(page);
  await setText(page, "Keep this one for now.");
  const keepName = await page.locator("#docName").innerText();

  await page.locator("#btnNew").click();
  await setText(page, "Delete this one.");

  await page.locator("#btnOpen").click();
  await page.locator("#openMenuDraft").click();
  await expect(page.locator("#draftsDlg")).toBeVisible();
  const rows = page.locator("#draftsList li");
  await expect(rows).toHaveCount(2);
  await expect(page.locator(`.draft-row:has-text("${keepName}") .draft-delete`)).toBeVisible();
  await expect(page.locator(".draft-row:has-text('Delete this one.') .draft-delete")).toHaveCount(0);

  await page.locator(`.draft-row:has-text("${keepName}") .draft-delete`).click();
  await expect(rows).toHaveCount(1);
  await page.locator("#draftsClose").click();
});

test("an empty Drafts list shows a short message", async ({ page }) => {
  await open(page);
  await page.locator("#btnOpen").click();
  await page.locator("#openMenuDraft").click();
  await expect(page.locator("#draftsEmpty")).toBeVisible();
  await expect(page.locator("#draftsEmpty")).toHaveText("No drafts yet.");
});
