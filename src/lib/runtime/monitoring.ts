import * as Sentry from "@sentry/react";
import type { ErrorInfo } from "react";

export type MonitoringInitOptions = {
  dsn?: string;
  isDev?: boolean;
  mode?: string;
};

export function shouldInitMonitoring({ dsn, isDev, mode }: MonitoringInitOptions): boolean {
  if (!dsn) {
    return false;
  }
  if (isDev === true) {
    return false;
  }
  if (mode === "test") {
    return false;
  }
  return true;
}

export function initMonitoring({
  dsn = import.meta.env.VITE_SENTRY_DSN,
  isDev = import.meta.env.DEV,
  mode = import.meta.env.MODE,
}: MonitoringInitOptions = {}): boolean {
  if (!shouldInitMonitoring({ dsn, isDev, mode })) {
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: mode,
      sendDefaultPii: false,
      // Breadcrumbs default integration records DOM clicks, console args, fetch/XHR URLs,
      // and history navigation; excluded per docs/feed-content-privacy.md remote telemetry policy.
      integrations: (defaults) => defaults.filter((integration) => integration.name !== "Breadcrumbs"),
    });
    return true;
  } catch (error) {
    console.error("Failed to initialize Sentry monitoring.", error);
    return false;
  }
}

export type ReactRootErrorHandlers = {
  onCaughtError: (error: unknown, errorInfo: ErrorInfo) => void;
  onRecoverableError: (error: unknown, errorInfo: ErrorInfo) => void;
  onUncaughtError: (error: unknown, errorInfo: ErrorInfo) => void;
};

export function createReactErrorHandlers(): ReactRootErrorHandlers {
  return {
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
    onUncaughtError: Sentry.reactErrorHandler(),
  };
}
