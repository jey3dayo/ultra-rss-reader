import { type ConsoleMessage, expect, type Page } from "@playwright/test";

const storybookRuntimeErrorText = /StorybookError|Cannot find module|Failed to fetch dynamically imported module/i;

type ExpectedRuntimeErrorMatcher = RegExp | string;

type RuntimeErrorGuardOptions = {
  readonly expectedConsoleErrors?: readonly ExpectedRuntimeErrorMatcher[];
  readonly expectedConsoleWarnings?: readonly ExpectedRuntimeErrorMatcher[];
};

type RuntimeErrorCollector = {
  readonly consoleErrors: string[];
  readonly consoleWarnings: string[];
  readonly expectedConsoleErrors: string[];
  readonly expectedConsoleWarnings: string[];
  readonly pageErrors: string[];
  clear: () => void;
  dispose: () => void;
};

const runtimeErrorsByPage = new WeakMap<Page, RuntimeErrorCollector>();

export const expectedBrowserWebviewFallbackConsoleWarnings = [
  /^Embedded browser webview disappeared while overlay was open:/,
  /^Browser webview load timeout timer is unavailable\.$/,
  /^Failed to schedule browser webview load timeout\./,
  /^Failed to clear browser webview load timeout\./,
] as const satisfies readonly RegExp[];

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
  const consoleWarnings: string[] = [];
  const expectedConsoleErrors: string[] = [];
  const expectedConsoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const expectedConsoleErrorMatchers = options.expectedConsoleErrors ?? [];
  const expectedConsoleWarningMatchers = options.expectedConsoleWarnings ?? [];
  const consoleErrorHandler = (message: ConsoleMessage) => {
    const messageType = message.type();
    if (messageType === "error") {
      const messageText = message.text();
      if (isExpectedConsoleError(messageText, expectedConsoleErrorMatchers)) {
        expectedConsoleErrors.push(messageText);
        return;
      }

      consoleErrors.push(messageText);
      return;
    }

    if (messageType === "warning") {
      const messageText = message.text();
      if (isExpectedConsoleError(messageText, expectedConsoleWarningMatchers)) {
        expectedConsoleWarnings.push(messageText);
        return;
      }

      consoleWarnings.push(messageText);
    }
  };
  const pageErrorHandler = (error: Error) => pageErrors.push(error.message);
  const collector = {
    consoleErrors,
    consoleWarnings,
    expectedConsoleErrors,
    expectedConsoleWarnings,
    pageErrors,
    clear: () => {
      consoleErrors.length = 0;
      consoleWarnings.length = 0;
      expectedConsoleErrors.length = 0;
      expectedConsoleWarnings.length = 0;
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

export function installAppRuntimeErrorGuard(page: Page): RuntimeErrorCollector {
  return installRuntimeErrorGuard(page, {
    expectedConsoleWarnings: expectedBrowserWebviewFallbackConsoleWarnings,
  });
}

export function expectNoRuntimeErrors(page: Page) {
  const runtimeErrors = runtimeErrorsByPage.get(page);
  expect(runtimeErrors?.pageErrors ?? []).toEqual([]);
  expect(runtimeErrors?.consoleErrors ?? []).toEqual([]);
  expect(runtimeErrors?.consoleWarnings ?? []).toEqual([]);
}

export function disposeRuntimeErrorGuard(page: Page) {
  runtimeErrorsByPage.get(page)?.dispose();
}

export async function expectNoStorybookRuntimeErrorDom(page: Page) {
  await expect(page.locator(`text=${storybookRuntimeErrorText}`)).toHaveCount(0);
}
