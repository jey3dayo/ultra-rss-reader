import * as Sentry from "@sentry/react";
import type { ErrorInfo } from "react";

// Single source of truth for the Sentry ingest origin allowed by the packaged app's
// CSP `connect-src` directive (see src-tauri/tauri.conf.json). A DSN pointing at a
// different origin would let Sentry.init() succeed while every event send is silently
// blocked by CSP.
export const SENTRY_INGEST_ORIGIN = "https://o4511908351180800.ingest.us.sentry.io";

export type MonitoringInitOptions = {
  dsn?: string;
  isDev?: boolean;
  mode?: string;
};

function dsnOriginMatchesAllowedIngestOrigin(dsn: string): boolean {
  try {
    return new URL(dsn).origin === SENTRY_INGEST_ORIGIN;
  } catch {
    return false;
  }
}

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
  if (!dsnOriginMatchesAllowedIngestOrigin(dsn)) {
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
    if (dsn && isDev !== true && mode !== "test" && !dsnOriginMatchesAllowedIngestOrigin(dsn)) {
      console.warn(
        "Sentry DSN origin does not match the packaged app's allowed CSP connect-src origin; monitoring disabled.",
      );
    }
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
