import { expect, test } from "@playwright/test";
import {
  expectedBrowserWebviewFallbackConsoleWarnings,
  installAppRuntimeErrorGuard,
  installRuntimeErrorGuard,
} from "./runtime-error-guard";

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

  test("keeps expected browser webview fallback warnings separate from runtime regressions", async ({ page }) => {
    const runtimeErrors = installRuntimeErrorGuard(page, {
      expectedConsoleWarnings: expectedBrowserWebviewFallbackConsoleWarnings,
    });

    try {
      await page.evaluate(() => {
        console.warn("Embedded browser webview disappeared while overlay was open: missing native webview");
        console.warn("real warning regression");
        console.error("real runtime regression");
      });

      expect(runtimeErrors.expectedConsoleWarnings).toEqual([
        "Embedded browser webview disappeared while overlay was open: missing native webview",
      ]);
      expect(runtimeErrors.consoleWarnings).toEqual(["real warning regression"]);
      expect(runtimeErrors.consoleErrors).toEqual(["real runtime regression"]);
      expect(runtimeErrors.pageErrors).toEqual([]);
    } finally {
      runtimeErrors.dispose();
    }
  });

  test("does not classify malformed browser webview fallback payload warnings as expected fallback", async ({
    page,
  }) => {
    const runtimeErrors = installAppRuntimeErrorGuard(page);

    try {
      await page.evaluate(() => {
        console.warn("Ignored malformed embedded browser webview browser-webview-fallback payload: payloadType=object");
      });

      expect(runtimeErrors.expectedConsoleWarnings).toEqual([]);
      expect(runtimeErrors.consoleWarnings).toEqual([
        "Ignored malformed embedded browser webview browser-webview-fallback payload: payloadType=object",
      ]);
      expect(runtimeErrors.pageErrors).toEqual([]);
    } finally {
      runtimeErrors.dispose();
    }
  });
});
