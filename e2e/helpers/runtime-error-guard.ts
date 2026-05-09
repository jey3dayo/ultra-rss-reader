import { expect, type Page } from "@playwright/test";

const storybookRuntimeErrorText = /StorybookError|Cannot find module|Failed to fetch dynamically imported module/i;

type RuntimeErrorCollector = {
  readonly pageErrors: string[];
  clear: () => void;
  dispose: () => void;
};

const runtimeErrorsByPage = new WeakMap<Page, RuntimeErrorCollector>();

export function installRuntimeErrorGuard(page: Page): RuntimeErrorCollector {
  const pageErrors: string[] = [];
  const pageErrorHandler = (error: Error) => pageErrors.push(error.message);
  const collector = {
    pageErrors,
    clear: () => {
      pageErrors.length = 0;
    },
    dispose: () => {
      page.off("pageerror", pageErrorHandler);
      runtimeErrorsByPage.delete(page);
    },
  };

  page.on("pageerror", pageErrorHandler);
  runtimeErrorsByPage.set(page, collector);

  return collector;
}

export function expectNoPageErrors(page: Page) {
  expect(runtimeErrorsByPage.get(page)?.pageErrors ?? []).toEqual([]);
}

export function disposeRuntimeErrorGuard(page: Page) {
  runtimeErrorsByPage.get(page)?.dispose();
}

export async function expectNoStorybookRuntimeErrorDom(page: Page) {
  await expect(page.locator(`text=${storybookRuntimeErrorText}`)).toHaveCount(0);
}
