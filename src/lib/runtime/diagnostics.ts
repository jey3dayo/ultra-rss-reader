export type RuntimeDiagnosticPolicyId =
  | "app-action-window"
  | "app-action-sync"
  | "app-action-browser"
  | "app-action-updates"
  | "dev-runtime-options-load"
  | "startup-sync"
  | "sync-on-wake"
  | "manual-sync-cooldown-listener"
  | "menu-action"
  | "platform-info-load"
  | "app-icon-theme"
  | "unread-badge"
  | "unread-badge-runtime-unavailable"
  | "unread-badge-command-failure"
  | "article-action"
  | "database-runtime-recovery"
  | "mutation-invalidation"
  | "command-history-storage"
  | "sidebar-expanded-folders-storage"
  | "window-always-on-top"
  | "window-runtime-error";

export type RuntimeDiagnosticPolicy = {
  console: "warn" | "error";
  devOnlyConsole: boolean;
  productionDiagnostics: boolean;
  toast: "never" | "user-action-only";
  once: boolean;
  redactSecrets: boolean;
};

export const RUNTIME_DIAGNOSTIC_POLICIES = {
  "app-action-window": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "app-action-sync": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "app-action-browser": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "app-action-updates": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "dev-runtime-options-load": {
    console: "warn",
    devOnlyConsole: true,
    productionDiagnostics: false,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "startup-sync": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "sync-on-wake": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "manual-sync-cooldown-listener": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "menu-action": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "platform-info-load": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "app-icon-theme": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "unread-badge": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "unread-badge-runtime-unavailable": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "unread-badge-command-failure": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "article-action": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "database-runtime-recovery": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "mutation-invalidation": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "command-history-storage": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "sidebar-expanded-folders-storage": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: true,
    redactSecrets: true,
  },
  "window-always-on-top": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
  "window-runtime-error": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    toast: "never",
    once: false,
    redactSecrets: true,
  },
} as const satisfies Record<RuntimeDiagnosticPolicyId, RuntimeDiagnosticPolicy>;

const URL_LIKE_TOKEN_PATTERN = /https?:\/\/[^\s<>"'`。、，．；：！？]+/gi;
const PROVIDER_SERVER_URL_TOKEN_PATTERN =
  /https?:\/\/[^\s<>"'`。、，．；：！？]*\/api\/greader\.php[^\s<>"'`。、，．；：！？]*/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY|API_KEY)[A-Z0-9_]*)=([^\s,;]+)/gi;
const AUTH_HEADER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const PROVIDER_AUTH_HEADER_PATTERN = /\bGoogleLogin\s+auth=[^\s,;]+/gi;
const COOKIE_HEADER_PATTERN = /\b(Cookie|Set-Cookie):\s*[^\n\r]+/gi;
const PROVIDER_IDENTIFIER_ASSIGNMENT_PATTERN =
  /\b((?:account[_-]?id|account[_-]?identifier|username|email|server[_-]?url|cookie))=([^\s,;]+)/gi;
const LOCAL_PATH_PATTERN = /(?:\/Users\/.*?(?=$|[\n\r,;'"`<>])|[A-Za-z]:\\.*?(?=$|[\n\r,;'"`<>]))/g;
const SECRET_OBJECT_KEY_PATTERN = /(?:token|secret|password|credential|privatekey|apikey)/i;
const SECRET_OBJECT_KEYS = new Set([
  "accountid",
  "accountidentifier",
  "accountname",
  "cookie",
  "filepath",
  "logpath",
  "path",
  "rawpayload",
  "serverpath",
  "serverurl",
  "server_url",
  "suggestedfilename",
  "suggestedpath",
  "username",
]);
const SECRET_URL_PATH_SEGMENT_PATTERN =
  /(?:token|secret|password|credential|private[-_]?key|api[-_]?key|signature|signed)/i;
const UUID_URL_PATH_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPAQUE_URL_PATH_SEGMENT_PATTERN = /^(?=.{24,}$)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9._~=-]+$/;
const URL_TOKEN_TRAILING_PUNCTUATION_PATTERN = /[\])}>,.;!?。、，．；：！？]+$/;
const UNSUPPORTED_DIAGNOSTICS_PAYLOAD = "[Unsupported diagnostics payload]";
const RUNTIME_DIAGNOSTIC_PAYLOAD_MAX_CHARS = 200;
const RUNTIME_DIAGNOSTIC_PAYLOAD_TRUNCATED_SUFFIX = "...[truncated]";

const emittedRuntimeDiagnosticKeys = new Set<string>();

function redactInvalidUrlToken(value: string): string {
  const withoutCredentials = value.replace(/^(https?:\/\/)(?:[^/?#\s@]+@)/i, "$1");
  const hashIndex = withoutCredentials.indexOf("#");
  const hashRedacted = hashIndex >= 0;
  const beforeHash = hashRedacted ? withoutCredentials.slice(0, hashIndex) : withoutCredentials;
  const queryIndex = beforeHash.indexOf("?");
  const beforeHashRedacted = queryIndex >= 0 ? `${beforeHash.slice(0, queryIndex)}?redacted` : beforeHash;

  return hashRedacted ? `${beforeHashRedacted}#redacted` : beforeHashRedacted;
}

function isSecretUrlPathSegment(segment: string): boolean {
  return (
    SECRET_URL_PATH_SEGMENT_PATTERN.test(segment) ||
    UUID_URL_PATH_SEGMENT_PATTERN.test(segment) ||
    OPAQUE_URL_PATH_SEGMENT_PATTERN.test(segment)
  );
}

function decodeUrlPathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function redactUrlToken(value: string): string {
  const trailingPunctuation = value.match(URL_TOKEN_TRAILING_PUNCTUATION_PATTERN)?.[0] ?? "";
  const urlToken = trailingPunctuation ? value.slice(0, -trailingPunctuation.length) : value;

  try {
    const url = new URL(urlToken);
    url.username = "";
    url.password = "";
    if (
      url.pathname !== "/" &&
      url.pathname.split("/").some((segment) => isSecretUrlPathSegment(decodeUrlPathSegment(segment)))
    ) {
      url.pathname = "/redacted";
    }
    if (url.search) {
      url.search = "?redacted";
    }
    if (url.hash) {
      url.hash = "#redacted";
    }
    return `${url.toString()}${trailingPunctuation}`;
  } catch {
    return `${redactInvalidUrlToken(urlToken)}${trailingPunctuation}`;
  }
}

export function redactRuntimeDiagnosticText(message: string): string {
  return message
    .replace(PROVIDER_SERVER_URL_TOKEN_PATTERN, "[redacted-provider-url]")
    .replace(URL_LIKE_TOKEN_PATTERN, redactUrlToken)
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=<redacted>")
    .replace(AUTH_HEADER_PATTERN, "$1 <redacted>")
    .replace(PROVIDER_AUTH_HEADER_PATTERN, "GoogleLogin auth=<redacted>")
    .replace(COOKIE_HEADER_PATTERN, "$1: <redacted>")
    .replace(LOCAL_PATH_PATTERN, "<redacted-path>");
}

export function redactProviderRuntimeDiagnosticText(message: string): string {
  return redactRuntimeDiagnosticText(message)
    .replace(URL_LIKE_TOKEN_PATTERN, "[redacted-provider-url]")
    .replace(PROVIDER_IDENTIFIER_ASSIGNMENT_PATTERN, "$1=<redacted>");
}

function isMessageRecord(value: unknown): value is { message: string } & Record<string, unknown> {
  return typeof value === "object" && value !== null && "message" in value && typeof value.message === "string";
}

function isSecretObjectKey(key: string): boolean {
  return SECRET_OBJECT_KEYS.has(key.toLowerCase()) || SECRET_OBJECT_KEY_PATTERN.test(key);
}

function redactRuntimeDiagnosticDetail(
  detail: unknown,
  shouldRedact: boolean,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (!shouldRedact) {
    return detail;
  }

  if (typeof detail === "string") {
    return redactRuntimeDiagnosticText(detail);
  }

  if (detail instanceof Error) {
    const redactedMessage = redactRuntimeDiagnosticText(detail.message);
    const redactedCause =
      "cause" in detail ? redactRuntimeDiagnosticDetail(detail.cause, shouldRedact, seen) : undefined;
    if (redactedMessage === detail.message && redactedCause === detail.cause) {
      return detail;
    }

    const redactedError =
      "cause" in detail ? new Error(redactedMessage, { cause: redactedCause }) : new Error(redactedMessage);
    redactedError.name = detail.name;
    return redactedError;
  }

  if (typeof detail === "object" && detail !== null) {
    if (seen.has(detail)) {
      return "[Circular]";
    }
    seen.add(detail);

    if (Array.isArray(detail)) {
      return detail.map((item) => redactRuntimeDiagnosticDetail(item, shouldRedact, seen));
    }

    return Object.fromEntries(
      Object.entries(detail).map(([key, value]) => [
        key,
        isSecretObjectKey(key) ? "<redacted>" : redactRuntimeDiagnosticDetail(value, shouldRedact, seen),
      ]),
    );
  }

  return detail;
}

function serializeRuntimeDiagnosticSupportCopyPayload(
  payload: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (payload instanceof Error) {
    return {
      name: payload.name,
      message: payload.message,
      ...("cause" in payload
        ? {
            cause: serializeRuntimeDiagnosticSupportCopyPayload(payload.cause, seen),
          }
        : {}),
    };
  }

  if (typeof payload === "object" && payload !== null) {
    if (seen.has(payload)) {
      return "[Circular]";
    }
    seen.add(payload);

    if (Array.isArray(payload)) {
      return payload.map((item) => serializeRuntimeDiagnosticSupportCopyPayload(item, seen));
    }

    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, serializeRuntimeDiagnosticSupportCopyPayload(value, seen)]),
    );
  }

  return payload;
}

export function redactRuntimeDiagnosticSupportCopy(payload: unknown): string {
  const redactedPayload = serializeRuntimeDiagnosticSupportCopyPayload(redactRuntimeDiagnosticDetail(payload, true));

  if (typeof redactedPayload === "string") {
    return redactedPayload;
  }

  if (
    typeof redactedPayload === "undefined" ||
    typeof redactedPayload === "function" ||
    typeof redactedPayload === "symbol" ||
    typeof redactedPayload === "bigint"
  ) {
    return UNSUPPORTED_DIAGNOSTICS_PAYLOAD;
  }

  try {
    return JSON.stringify(redactedPayload, null, 2) ?? UNSUPPORTED_DIAGNOSTICS_PAYLOAD;
  } catch {
    return UNSUPPORTED_DIAGNOSTICS_PAYLOAD;
  }
}

function truncateRuntimeDiagnosticPayload(value: string): string {
  if (value.length <= RUNTIME_DIAGNOSTIC_PAYLOAD_MAX_CHARS) {
    return value;
  }
  return `${value.slice(0, RUNTIME_DIAGNOSTIC_PAYLOAD_MAX_CHARS)}${RUNTIME_DIAGNOSTIC_PAYLOAD_TRUNCATED_SUFFIX}`;
}

export function formatRuntimeDiagnosticPayload(payload: unknown): string {
  const redactedPayload = serializeRuntimeDiagnosticSupportCopyPayload(redactRuntimeDiagnosticDetail(payload, true));

  if (typeof redactedPayload === "string") {
    return truncateRuntimeDiagnosticPayload(redactedPayload);
  }

  if (
    typeof redactedPayload === "undefined" ||
    typeof redactedPayload === "function" ||
    typeof redactedPayload === "symbol" ||
    typeof redactedPayload === "bigint"
  ) {
    return UNSUPPORTED_DIAGNOSTICS_PAYLOAD;
  }

  try {
    return truncateRuntimeDiagnosticPayload(JSON.stringify(redactedPayload) ?? UNSUPPORTED_DIAGNOSTICS_PAYLOAD);
  } catch {
    return UNSUPPORTED_DIAGNOSTICS_PAYLOAD;
  }
}

function shouldEmitRuntimeDiagnostic(policy: RuntimeDiagnosticPolicy): boolean {
  return import.meta.env.DEV || policy.productionDiagnostics;
}

function runtimeDiagnosticDetailKey(detail: unknown): string {
  if (isMessageRecord(detail) || detail instanceof Error) {
    return detail.message;
  }
  if (typeof detail === "object" && detail !== null) {
    try {
      return JSON.stringify(detail);
    } catch {
      return "[Unserializable detail]";
    }
  }
  return String(detail);
}

function runtimeDiagnosticOnceKey(
  policyId: RuntimeDiagnosticPolicyId,
  message: string,
  details: readonly unknown[],
): string {
  const detailKey = details.map(runtimeDiagnosticDetailKey).join("|");
  return `${policyId}:${message}:${detailKey}`;
}

export function logRuntimeDiagnostic(
  policyId: RuntimeDiagnosticPolicyId,
  message: string,
  ...details: readonly unknown[]
): void {
  const policy = RUNTIME_DIAGNOSTIC_POLICIES[policyId];
  if (!shouldEmitRuntimeDiagnostic(policy)) {
    return;
  }

  const redactedMessage = policy.redactSecrets ? redactRuntimeDiagnosticText(message) : message;
  const redactedDetails = details.map((detail) => redactRuntimeDiagnosticDetail(detail, policy.redactSecrets));

  if (policy.once) {
    const onceKey = runtimeDiagnosticOnceKey(policyId, redactedMessage, redactedDetails);
    if (emittedRuntimeDiagnosticKeys.has(onceKey)) {
      return;
    }
    emittedRuntimeDiagnosticKeys.add(onceKey);
  }

  if (redactedDetails.length === 0) {
    console[policy.console](redactedMessage);
    return;
  }

  console[policy.console](redactedMessage, ...redactedDetails);
}

export function resetRuntimeDiagnosticOnceSuppressionForTests(): void {
  emittedRuntimeDiagnosticKeys.clear();
}
