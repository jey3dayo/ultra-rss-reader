import { expect, test } from "@playwright/test";
import { installRuntimeErrorGuard } from "./runtime-error-guard";

test.describe("runtime error guard", () => {
  test("collects pageerror and console.error messages", async ({ page }) => {
    const runtimeErrors = installRuntimeErrorGuard(page);

    try {
      const pageError = page.waitForEvent("pageerror");

      await page.evaluate(() => {
        console.error("console failure");
        setTimeout(() => {
          throw new Error("page failure");
        }, 0);
      });
      await pageError;

      expect(runtimeErrors.consoleErrors).toEqual(["console failure"]);
      expect(runtimeErrors.pageErrors).toEqual(["page failure"]);
    } finally {
      runtimeErrors.dispose();
    }
  });
});
