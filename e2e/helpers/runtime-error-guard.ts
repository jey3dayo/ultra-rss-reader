import { type ConsoleMessage, expect, type Page } from "@playwright/test";

const storybookRuntimeErrorText = /StorybookError|Cannot find module|Failed to fetch dynamically imported module/i;

type ExpectedRuntimeErrorMatcher = RegExp | string;

type RuntimeErrorGuardOptions = {
  readonly expectedConsoleErrors?: readonly ExpectedRuntimeErrorMatcher[];
};

type RuntimeErrorCollector = {
  readonly consoleErrors: string[];
  readonly expectedConsoleErrors: string[];
  readonly pageErrors: string[];
  clear: () => void;
  dispose: () => void;
};

const runtimeErrorsByPage = new WeakMap<Page, RuntimeErrorCollector>();

function isExpectedConsoleError(messageText: string, matchers: readonly ExpectedRuntimeErrorMatcher[]): boolean {
  return matchers.some((matcher) => {
    if (typeof matcher === "string") {
      return messageText.includes(matcher);
    }

    return matcher.test(messageText);
  });
}

export function installRuntimeErrorGuard(page: Page, options: RuntimeErrorGuardOptions = {}): RuntimeErrorCollector {
  const consoleErrors: string[] = [];
  const expectedConsoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const expectedConsoleErrorMatchers = options.expectedConsoleErrors ?? [];
  const consoleErrorHandler = (message: ConsoleMessage) => {
    if (message.type() === "error") {
      const messageText = message.text();
      if (isExpectedConsoleError(messageText, expectedConsoleErrorMatchers)) {
        expectedConsoleErrors.push(messageText);
        return;
      }

      consoleErrors.push(messageText);
    }
  };
  const pageErrorHandler = (error: Error) => pageErrors.push(error.message);
  const collector = {
    consoleErrors,
    expectedConsoleErrors,
    pageErrors,
    clear: () => {
      consoleErrors.length = 0;
      expectedConsoleErrors.length = 0;
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
