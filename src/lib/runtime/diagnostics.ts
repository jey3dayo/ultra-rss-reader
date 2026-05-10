export type RuntimeDiagnosticPolicyId =
  | "dev-runtime-options-load"
  | "startup-sync"
  | "sync-on-wake"
  | "manual-sync-cooldown-listener"
  | "platform-info-load"
  | "app-icon-theme"
  | "unread-badge"
  | "article-action"
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
  "article-action": {
    console: "error",
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

const URL_LIKE_TOKEN_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY|API_KEY)[A-Z0-9_]*)=([^\s,;]+)/gi;
const AUTH_HEADER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const SECRET_OBJECT_KEY_PATTERN =
  /(?:token|secret|password|credential|privateKey|apiKey)/i;
const SECRET_URL_PATH_SEGMENT_PATTERN =
  /(?:token|secret|password|credential|private[-_]?key|api[-_]?key)/i;

const emittedRuntimeDiagnosticKeys = new Set<string>();

function redactUrlToken(value: string): string {
  const trailingPunctuation = value.match(/[),.;!?]+$/)?.[0] ?? "";
  const urlToken = trailingPunctuation
    ? value.slice(0, -trailingPunctuation.length)
    : value;

  try {
    const url = new URL(urlToken);
    url.username = "";
    url.password = "";
    if (
      url.pathname !== "/" &&
      url.pathname
        .split("/")
        .some((segment) => SECRET_URL_PATH_SEGMENT_PATTERN.test(segment))
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
    return value;
  }
}

export function redactRuntimeDiagnosticText(message: string): string {
  return message
    .replace(URL_LIKE_TOKEN_PATTERN, redactUrlToken)
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=<redacted>")
    .replace(AUTH_HEADER_PATTERN, "$1 <redacted>");
}

function isMessageRecord(
  value: unknown,
): value is { message: string } & Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
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
      "cause" in detail
        ? redactRuntimeDiagnosticDetail(detail.cause, shouldRedact, seen)
        : undefined;
    if (redactedMessage === detail.message && redactedCause === detail.cause) {
      return detail;
    }

    const redactedError =
      "cause" in detail
        ? new Error(redactedMessage, { cause: redactedCause })
        : new Error(redactedMessage);
    redactedError.name = detail.name;
    return redactedError;
  }

  if (typeof detail === "object" && detail !== null) {
    if (seen.has(detail)) {
      return "[Circular]";
    }
    seen.add(detail);

    if (Array.isArray(detail)) {
      return detail.map((item) =>
        redactRuntimeDiagnosticDetail(item, shouldRedact, seen),
      );
    }

    return Object.fromEntries(
      Object.entries(detail).map(([key, value]) => [
        key,
        SECRET_OBJECT_KEY_PATTERN.test(key)
          ? "<redacted>"
          : redactRuntimeDiagnosticDetail(value, shouldRedact, seen),
      ]),
    );
  }

  return detail;
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

  const redactedMessage = policy.redactSecrets
    ? redactRuntimeDiagnosticText(message)
    : message;
  const redactedDetails = details.map((detail) =>
    redactRuntimeDiagnosticDetail(detail, policy.redactSecrets),
  );

  if (policy.once) {
    const onceKey = runtimeDiagnosticOnceKey(
      policyId,
      redactedMessage,
      redactedDetails,
    );
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
