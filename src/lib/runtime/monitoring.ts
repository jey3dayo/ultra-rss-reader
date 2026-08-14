import * as Sentry from "@sentry/react";
import type { ErrorInfo } from "react";

// Single source of truth for the Sentry ingest origin allowed by the packaged app's
// CSP `connect-src` directive (see src-tauri/tauri.conf.json). A DSN pointing at a
// different origin would let Sentry.init() succeed while every event send is silently
// blocked by CSP.
export const SENTRY_INGEST_ORIGIN = "https://o4511908351180800.ingest.us.sentry.io";

// Public Sentry DSN (not a secret). Release builds do not receive the dotenvx
// decryption key, so `VITE_SENTRY_DSN` (an `encrypted:` value in `.env`) stays
// encrypted at build time and fails origin validation, silently disabling
// monitoring. This default keeps monitoring enabled unless a build explicitly
// opts out with an empty `VITE_SENTRY_DSN`.
export const DEFAULT_SENTRY_DSN =
  "https://6b07cc097a80795f8ea1883e0f2f108b0@o4511908351180800.ingest.us.sentry.io/4511908558012416";

// Reviewed allowlist of default Sentry integrations kept enabled, matching the
// remote telemetry privacy contract in docs/feed-content-privacy.md. Only the
// minimal set needed for error capture, stack quality, dedupe, and inbound
// filtering is allowed; integrations that send DOM/URL/referrer/UA data
// (Breadcrumbs, HttpContext), locale/timezone data (CultureContext), or
// session envelopes without an exception (BrowserSession) are excluded.
export const ALLOWED_SENTRY_INTEGRATIONS = [
  "InboundFilters",
  "FunctionToString",
  "BrowserApiErrors",
  "GlobalHandlers",
  "LinkedErrors",
  "Dedupe",
] as const;

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

// A dotenvx-managed .env stores VITE_SENTRY_DSN as a non-null "encrypted:..." string,
// so a plain `?? DEFAULT_SENTRY_DSN` fallback never fires in builds that lack the
// decryption key. Treat the undecrypted placeholder as "not configured" and fall back;
// keep the empty string as the explicit opt-out and any other value as-is so a
// deliberate misconfiguration still fails loudly via origin validation.
export function resolveMonitoringDsn(rawDsn: string | undefined = import.meta.env.VITE_SENTRY_DSN): string {
  if (rawDsn === undefined || rawDsn.startsWith("encrypted:")) {
    return DEFAULT_SENTRY_DSN;
  }
  return rawDsn;
}

export function initMonitoring({
  dsn = resolveMonitoringDsn(),
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
      // Allowlist (not an exclude list) of default Sentry integrations, per the
      // remote telemetry privacy contract in docs/feed-content-privacy.md.
      integrations: (defaults) => {
        const allowedIntegrationNames: readonly string[] = ALLOWED_SENTRY_INTEGRATIONS;
        return defaults.filter((integration) => allowedIntegrationNames.includes(integration.name));
      },
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
