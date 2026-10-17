import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#ta")).toBeFocused();
});

test("the palette filters, navigates, toggles and applies settings that persist", async ({ page }) => {
  const root = page.locator("html");
  const input = page.getByRole("combobox", { name: "Commands" });
  const options = page.getByRole("option");
  const dialog = page.getByRole("dialog", { name: "Commands" });

  await page.keyboard.press("ControlOrMeta+/");
  await expect(input).toBeFocused();
  await expect(options.first()).toHaveAttribute("aria-selected", "true");

  await input.fill("compact");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Spacing: Normal");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(root).toHaveAttribute("data-spacing", "compact");
  await expect(page.locator("#ta")).toBeFocused();

  await page.keyboard.press("ControlOrMeta+/");
  await input.fill("medium");
  await expect(options.first()).toContainText("Size: Regular");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#ta")).toBeFocused();

  await page.keyboard.press("ControlOrMeta+/");
  await input.fill("theme");
  await expect(options).toHaveCount(3);
  await expect(options.filter({ hasText: "Theme: System" })).toContainText("Current");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(options.filter({ hasText: "Theme: Dark" })).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("ArrowDown");
  await expect(options.filter({ hasText: "Theme: Dark" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-spacing", "compact");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
});

test("palette operations run the toolbar's actions", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Commands" });
  const ta = page.locator("#ta");

  await ta.fill("words in progress");
  await page.keyboard.press("ControlOrMeta+/");
  await input.fill("download");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.locator("#downloadDlg")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ta).toBeFocused();

  await page.keyboard.press("ControlOrMeta+/");
  await input.fill("new");
  await page.keyboard.press("Enter");
  await expect(ta).toHaveValue("");
  await expect(ta).toBeFocused();

  await page.keyboard.press("ControlOrMeta+/");
  await input.fill("settings");
  await page.keyboard.press("Enter");
  await expect(page.locator("#settingsDlg")).toBeVisible();
});
