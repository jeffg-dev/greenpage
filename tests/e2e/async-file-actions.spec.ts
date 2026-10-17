import { expect, test } from "@playwright/test";
import { open, setText } from "./helpers.js";

test("a pending save keeps its document bound and later typing outside the exported snapshot", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      finishSave: () => void;
      saveStarted: boolean;
      pickerCalls: number;
      savedText: string;
    };
    state.pickerCalls = 0;
    (window as unknown as Record<string, unknown>)["showSaveFilePicker"] = async () => {
      state.pickerCalls++;
      return {
        name: "first-story.txt",
        createWritable: async () => ({
          write: async (blob: Blob) => { state.savedText = await blob.text(); },
          close: () => new Promise<void>((resolve) => {
            state.finishSave = resolve;
            state.saveStarted = true;
          }),
        }),
      };
    };
  });
  await open(page);
  await setText(page, "First story");
  await page.locator("#btnSave").click();
  await expect(page.locator("#downloadDlg")).toBeVisible();
  await page.locator("#downloadGo").click();
  await page.waitForFunction(() => (window as unknown as { saveStarted: boolean }).saveStarted);
  for (const id of ["btnNew", "btnOpen", "btnSave"]) {
    await expect(page.locator(`#${id}`)).toBeDisabled();
  }
  await page.locator("#ta").focus();
  await page.keyboard.press("Control+s");
  await page.keyboard.press("Control+o");
  await page.keyboard.press("Alt+f");
  await expect(page.locator("#ta")).toBeFocused();
  await page.keyboard.type(" continues");
  await page.evaluate(() => (window as unknown as { finishSave: () => void }).finishSave());
  await expect(page.locator("#btnNew")).toBeEnabled();
  await expect(page.locator("#ta")).toHaveValue("First story continues");
  await expect(page.locator("#say")).toBeHidden();
  expect(await page.evaluate(() => {
    const state = window as unknown as { pickerCalls: number; savedText: string };
    return { calls: state.pickerCalls, text: state.savedText };
  })).toEqual({ calls: 1, text: "First story" });

  await page.locator("#btnNew").click();
  await expect(page.locator("#ta")).toHaveValue("");
});

for (const source of ["open", "drop"] as const) {
  test(`opening a file mid-edit during a slow ${source} still replaces the document once it resolves`, async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as unknown as { finishRead: () => void; readStarted: boolean };
      const read = File.prototype.arrayBuffer;
      File.prototype.arrayBuffer = async function () {
        const bytes = await read.call(this);
        await new Promise<void>((resolve) => {
          state.finishRead = resolve;
          state.readStarted = true;
        });
        return bytes;
      };
      (window as unknown as Record<string, unknown>)["showOpenFilePicker"] = async () => [{
        name: "teacher.txt",
        getFile: async () => new File(["Teacher instructions"], "teacher.txt", { type: "text/plain" }),
      }];
    });
    await open(page);
    if (source === "open") {
      await page.locator("#btnOpen").click();
      await page.locator("#openMenuFile").click();
    } else {
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.items.add(new File(["Teacher instructions"], "teacher.txt", { type: "text/plain" }));
        document.getElementById("sheet")!.dispatchEvent(
          new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
        );
      });
    }
    await page.waitForFunction(() => (window as unknown as { readStarted: boolean }).readStarted);
    await page.locator("#ta").fill("New words written while the file loads.");
    await page.evaluate(() => (window as unknown as { finishRead: () => void }).finishRead());
    await expect(page.locator("#ta")).toHaveValue("Teacher instructions");
    await expect(page.locator("#btnOpen")).toBeEnabled();
    await expect(page.locator("#ta")).toBeFocused();
    await expect(page.locator("#docName")).toHaveText("teacher.txt");
  });
}
