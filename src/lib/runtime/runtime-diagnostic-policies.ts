// Runtime diagnostic policy ids and the per-policy logging/redaction table.

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
  | "mute-keyword-scope-select"
  | "command-history-storage"
  | "sidebar-expanded-folders-storage"
  | "window-always-on-top"
  | "window-runtime-error";

export type RuntimeDiagnosticPolicy = {
  console: "warn" | "error";
  devOnlyConsole: boolean;
  productionDiagnostics: boolean;
  once: boolean;
  redactSecrets: boolean;
};

export const RUNTIME_DIAGNOSTIC_POLICIES = {
  "app-action-window": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "app-action-sync": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "app-action-browser": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "app-action-updates": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "dev-runtime-options-load": {
    console: "warn",
    devOnlyConsole: true,
    productionDiagnostics: false,
    once: true,
    redactSecrets: true,
  },
  "startup-sync": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "sync-on-wake": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "manual-sync-cooldown-listener": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "menu-action": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "platform-info-load": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "app-icon-theme": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "unread-badge": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "unread-badge-runtime-unavailable": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "unread-badge-command-failure": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "article-action": {
    console: "error",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "database-runtime-recovery": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "mutation-invalidation": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "mute-keyword-scope-select": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "command-history-storage": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "sidebar-expanded-folders-storage": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: true,
    redactSecrets: true,
  },
  "window-always-on-top": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
  "window-runtime-error": {
    console: "warn",
    devOnlyConsole: false,
    productionDiagnostics: true,
    once: false,
    redactSecrets: true,
  },
} as const satisfies Record<RuntimeDiagnosticPolicyId, RuntimeDiagnosticPolicy>;
