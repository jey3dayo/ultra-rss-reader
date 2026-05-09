import { type ConsoleMessage, expect, type Page } from "@playwright/test";

const storybookRuntimeErrorText = /StorybookError|Cannot find module|Failed to fetch dynamically imported module/i;

type RuntimeErrorCollector = {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  clear: () => void;
  dispose: () => void;
};

const runtimeErrorsByPage = new WeakMap<Page, RuntimeErrorCollector>();

export function installRuntimeErrorGuard(page: Page): RuntimeErrorCollector {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrorHandler = (message: ConsoleMessage) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  };
  const pageErrorHandler = (error: Error) => pageErrors.push(error.message);
  const collector = {
    consoleErrors,
    pageErrors,
    clear: () => {
      consoleErrors.length = 0;
      pageErrors.length = 0;
    },
    dispose: () => {
      page.off("console", consoleErrorHandler);
      page.off("pageerror", pageErrorHandler);
      runtimeErrorsByPage.delete(page);
    },
  };

  page.on("console", consoleErrorHandler);
  page.on("pageerror", pageErrorHandler);
  runtimeErrorsByPage.set(page, collector);

  return collector;
}

export function expectNoRuntimeErrors(page: Page) {
  const runtimeErrors = runtimeErrorsByPage.get(page);
  expect(runtimeErrors?.pageErrors ?? []).toEqual([]);
  expect(runtimeErrors?.consoleErrors ?? []).toEqual([]);
}

export function disposeRuntimeErrorGuard(page: Page) {
  runtimeErrorsByPage.get(page)?.dispose();
}

export async function expectNoStorybookRuntimeErrorDom(page: Page) {
  await expect(page.locator(`text=${storybookRuntimeErrorText}`)).toHaveCount(0);
}
