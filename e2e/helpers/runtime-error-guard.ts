import { type ConsoleMessage, expect, type Page, type Response } from "@playwright/test";

const storybookRuntimeErrorText = /StorybookError|Cannot find module|Failed to fetch dynamically imported module/i;

type ExpectedRuntimeErrorMatcher = RegExp | string;

type RuntimeErrorGuardOptions = {
  readonly expectedConsoleErrors?: readonly ExpectedRuntimeErrorMatcher[];
  readonly expectedConsoleWarnings?: readonly ExpectedRuntimeErrorMatcher[];
  /** HTTP 404 responses whose URL matches are allowed; unrelated 404 console noise is ignored only when no disallowed 404 occurred. */
  readonly allowedHttp404UrlMatchers?: readonly RegExp[];
};

type RuntimeErrorCollector = {
  readonly consoleErrors: string[];
  readonly consoleWarnings: string[];
  readonly expectedConsoleErrors: string[];
  readonly expectedConsoleWarnings: string[];
  readonly pageErrors: string[];
  readonly disallowedHttp404Urls: string[];
  clear: () => void;
  dispose: () => void;
};

const consoleResource404Message = /^Failed to load resource: the server responded with a status of 404/;

export const expectedGoogleFaviconHttp404UrlMatchers = [
  /\/\/www\.google\.com\/s2\/favicons/i,
  /\/\/[^/]*\.gstatic\.com\/faviconV2/i,
] as const satisfies readonly RegExp[];

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
  const disallowedHttp404Urls: string[] = [];
  const expectedConsoleErrorMatchers = options.expectedConsoleErrors ?? [];
  const expectedConsoleWarningMatchers = options.expectedConsoleWarnings ?? [];
  const allowedHttp404UrlMatchers = options.allowedHttp404UrlMatchers ?? [];
  const responseHandler = (response: Response) => {
    if (response.status() !== 404 || allowedHttp404UrlMatchers.length === 0) {
      return;
    }

    const url = response.url();
    const allowed = allowedHttp404UrlMatchers.some((matcher) => matcher.test(url));
    if (!allowed) {
      disallowedHttp404Urls.push(url);
    }
  };
  if (allowedHttp404UrlMatchers.length > 0) {
    page.on("response", responseHandler);
  }
  const consoleErrorHandler = (message: ConsoleMessage) => {
    const messageType = message.type();
    if (messageType === "error") {
      const messageText = message.text();
      if (allowedHttp404UrlMatchers.length > 0 && consoleResource404Message.test(messageText)) {
        expectedConsoleErrors.push(messageText);
        return;
      }
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
    disallowedHttp404Urls,
    clear: () => {
      consoleErrors.length = 0;
      consoleWarnings.length = 0;
      expectedConsoleErrors.length = 0;
      expectedConsoleWarnings.length = 0;
      pageErrors.length = 0;
      disallowedHttp404Urls.length = 0;
    },
    dispose: () => {
      page.off("console", consoleErrorHandler);
      page.off("pageerror", pageErrorHandler);
      if (allowedHttp404UrlMatchers.length > 0) {
        page.off("response", responseHandler);
      }
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
  expect(runtimeErrors?.disallowedHttp404Urls ?? []).toEqual([]);
}

export function disposeRuntimeErrorGuard(page: Page) {
  runtimeErrorsByPage.get(page)?.dispose();
}

export async function expectNoStorybookRuntimeErrorDom(page: Page) {
  await expect(page.locator(`text=${storybookRuntimeErrorText}`)).toHaveCount(0);
}
