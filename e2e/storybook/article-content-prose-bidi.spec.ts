import { expect, test } from "@playwright/test";
import {
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import { getStorybookIframeUrl } from "./storybook-index-payload";

const storyId = "reader-article-articlecontentview--prose-plaintext-bidi-contract";

test.describe("Storybook article prose bidi", () => {
  test("applies unicode-bidi plaintext only outside explicit dir wrappers", async ({ page }) => {
    const runtimeErrors = installRuntimeErrorGuard(page);

    try {
      await page.goto(getStorybookIframeUrl(storyId), { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("article-content-dir-bidi-contract")).toBeVisible();

      const dirWrapperParagraph = page.getByTestId("article-content-dir-wrapper-paragraph");
      const plainParagraph = page.getByTestId("article-content-plain-paragraph");

      await expect(dirWrapperParagraph).not.toHaveCSS("unicode-bidi", "plaintext");
      await expect(plainParagraph).toHaveCSS("unicode-bidi", "plaintext");

      await expectNoStorybookRuntimeErrorDom(page);
      expectNoRuntimeErrors(page);
    } finally {
      runtimeErrors.dispose();
    }
  });
});
