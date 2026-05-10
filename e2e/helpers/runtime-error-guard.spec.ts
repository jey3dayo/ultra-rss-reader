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

  test("keeps expected console.error separate from runtime regressions", async ({ page }) => {
    const runtimeErrors = installRuntimeErrorGuard(page, {
      expectedConsoleErrors: [/expected fixture failure/i],
    });

    try {
      await page.evaluate(() => {
        console.error("expected fixture failure");
        console.error("real runtime regression");
      });

      expect(runtimeErrors.expectedConsoleErrors).toEqual(["expected fixture failure"]);
      expect(runtimeErrors.consoleErrors).toEqual(["real runtime regression"]);
      expect(runtimeErrors.pageErrors).toEqual([]);
    } finally {
      runtimeErrors.dispose();
    }
  });
});
