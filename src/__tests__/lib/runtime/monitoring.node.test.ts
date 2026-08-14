import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.hoisted(() => vi.fn());
const reactErrorHandlerMock = vi.hoisted(() => vi.fn(() => vi.fn()));

vi.mock("@sentry/react", () => ({
  init: initMock,
  reactErrorHandler: reactErrorHandlerMock,
}));

import {
  createReactErrorHandlers,
  initMonitoring,
  SENTRY_INGEST_ORIGIN,
  shouldInitMonitoring,
} from "@/lib/runtime/monitoring";

describe("shouldInitMonitoring", () => {
  it("skips when dsn is missing", () => {
    expect(shouldInitMonitoring({ dsn: undefined, isDev: false, mode: "production" })).toBe(false);
  });

  it("skips when dsn is empty", () => {
    expect(shouldInitMonitoring({ dsn: "", isDev: false, mode: "production" })).toBe(false);
  });

  it("skips in dev mode", () => {
    expect(shouldInitMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: true, mode: "production" })).toBe(false);
  });

  it("skips in test mode", () => {
    expect(shouldInitMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: false, mode: "test" })).toBe(false);
  });

  it("initializes with dsn matching the allowed CSP ingest origin, non-dev, production mode", () => {
    expect(shouldInitMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: false, mode: "production" })).toBe(true);
  });

  it("skips when dsn origin does not match the packaged CSP ingest origin", () => {
    expect(
      shouldInitMonitoring({ dsn: "https://o999999.ingest.us.sentry.io/1", isDev: false, mode: "production" }),
    ).toBe(false);
  });

  it("skips when dsn is not a parseable URL", () => {
    expect(shouldInitMonitoring({ dsn: "not-a-valid-url", isDev: false, mode: "production" })).toBe(false);
  });
});

describe("initMonitoring", () => {
  beforeEach(() => {
    initMock.mockReset();
  });

  it("calls Sentry.init and returns true when conditions are met", () => {
    const result = initMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: false, mode: "production" });

    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: `${SENTRY_INGEST_ORIGIN}/1`,
        environment: "production",
        sendDefaultPii: false,
        integrations: expect.any(Function),
      }),
    );
    expect(result).toBe(true);
  });

  it("returns false without calling Sentry.init when dsn is missing", () => {
    const result = initMonitoring({ dsn: undefined, isDev: false, mode: "production" });

    expect(initMock).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("returns false without throwing when Sentry.init throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    initMock.mockImplementationOnce(() => {
      throw new Error("init failed");
    });

    const result = initMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: false, mode: "production" });

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("excludes the Breadcrumbs integration to keep default breadcrumbs off per feed-content-privacy policy", () => {
    initMonitoring({ dsn: `${SENTRY_INGEST_ORIGIN}/1`, isDev: false, mode: "production" });

    const initArgs = initMock.mock.calls[0]?.[0] as { integrations: (defaults: { name: string }[]) => unknown };
    const defaults = [{ name: "Breadcrumbs" }, { name: "Dedupe" }, { name: "HttpContext" }];

    expect(initArgs.integrations(defaults)).toEqual([{ name: "Dedupe" }, { name: "HttpContext" }]);
  });
});

describe("createReactErrorHandlers", () => {
  beforeEach(() => {
    reactErrorHandlerMock.mockClear();
  });

  it("wires onCaughtError, onRecoverableError, and onUncaughtError to Sentry.reactErrorHandler", () => {
    const handlers = createReactErrorHandlers();

    expect(reactErrorHandlerMock).toHaveBeenCalledTimes(3);
    expect(handlers.onCaughtError).toBeInstanceOf(Function);
    expect(handlers.onRecoverableError).toBeInstanceOf(Function);
    expect(handlers.onUncaughtError).toBeInstanceOf(Function);
  });
});
