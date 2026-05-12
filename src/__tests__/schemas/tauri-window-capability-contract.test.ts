import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonWithSchema } from "@/schemas/parse";

type TauriConfig = {
  app?: {
    withGlobalTauri?: boolean;
  };
};

const expectedMainWebviewPermissions = [
  "core:default",
  "opener:allow-open-url",
  "clipboard-manager:allow-write-text",
  "core:window:allow-center",
  "core:window:allow-is-fullscreen",
  "core:window:allow-set-always-on-top",
  "core:window:allow-set-badge-count",
  "core:window:allow-set-fullscreen",
  "core:window:allow-set-icon",
  "core:window:allow-set-size",
  "core:window:allow-start-dragging",
  "core:window:allow-unmaximize",
  "reader-commands",
  "browser-commands",
  "settings-commands",
  "debug-log-commands",
  "database-commands",
  "updater-commands",
  "share-commands",
] as const;

const expectedCommandOwnerAllowlists = {
  "browser-commands": [
    "open_in_browser",
    "check_browser_embed_support",
    "create_or_update_browser_webview",
    "set_browser_webview_bounds",
    "focus_browser_webview",
    "go_back_browser_webview",
    "go_forward_browser_webview",
    "reload_browser_webview",
    "close_browser_webview",
  ],
  "database-commands": ["get_database_info", "vacuum_database"],
  "debug-log-commands": [
    "get_dev_runtime_options",
    "get_platform_permission_denied_recovery",
    "open_log_dir",
    "reset_oversized_dev_credentials_store",
  ],
  "reader-commands": [
    "list_accounts",
    "add_account",
    "update_account_sync",
    "update_account_credentials",
    "rename_account",
    "test_account_connection",
    "delete_account",
    "list_folders",
    "create_folder",
    "list_feeds",
    "add_local_feed",
    "delete_feed",
    "rename_feed",
    "update_feed_folder",
    "update_feed_display_settings",
    "discover_feeds",
    "trigger_sync",
    "trigger_startup_sync",
    "get_account_sync_status",
    "trigger_sync_account",
    "trigger_sync_feed",
    "trigger_automatic_sync",
    "list_articles",
    "list_account_articles",
    "list_feed_article_summaries",
    "list_folder_articles",
    "list_starred_articles",
    "list_recent_articles",
    "count_account_unread_articles",
    "count_account_starred_articles",
    "mark_account_read",
    "mark_account_starred_read",
    "count_old_unread_articles",
    "mark_old_unread_read",
    "unstar_account_articles",
    "get_feed_integrity_report",
    "cleanup_feed_integrity_orphans",
    "mark_article_read",
    "record_article_view",
    "clear_article_view_history",
    "mark_articles_read",
    "mark_feed_read",
    "mark_folder_read",
    "toggle_article_star",
    "import_opml",
    "export_opml",
    "search_articles",
    "list_mute_keywords",
    "create_mute_keyword",
    "update_mute_keyword",
    "delete_mute_keyword",
    "set_mute_auto_mark_read",
    "list_tags",
    "create_tag",
    "rename_tag",
    "delete_tag",
    "create_tag_and_assign_article",
    "tag_article",
    "untag_article",
    "get_article_tags",
    "list_articles_by_tag",
    "get_tag_article_counts",
  ],
  "settings-commands": ["get_preferences", "set_preference", "get_platform_info"],
  "share-commands": ["copy_to_clipboard", "add_to_reading_list"],
  "updater-commands": ["check_for_update", "download_and_install_update", "restart_app"],
} as const satisfies Record<string, readonly string[]>;

type CapabilityPermission =
  | string
  | {
      identifier: string;
      allow?: Array<{ url: string }>;
      deny?: Array<{ url: string }>;
    };

const TauriCapabilityContractSchema = z.object({
  identifier: z.string().optional(),
  webviews: z.array(z.string()).optional(),
  permissions: z.array(
    z.union([
      z.string(),
      z.object({
        identifier: z.string(),
        allow: z.array(z.object({ url: z.string() })).optional(),
        deny: z.array(z.object({ url: z.string() })).optional(),
      }),
    ]),
  ),
});
type TauriCapability = z.output<typeof TauriCapabilityContractSchema>;
const TauriCapabilityFileSchema = z.union([TauriCapabilityContractSchema, z.array(TauriCapabilityContractSchema)]);

function permissionIdentifier(permission: CapabilityPermission): string {
  return typeof permission === "string" ? permission : permission.identifier;
}

function readDefaultCapability(identifier = "main"): TauriCapability {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const capabilityPath = path.resolve(currentDir, "../../../src-tauri/capabilities/default.json");
  const capabilityFile = parseJsonWithSchema(readFileSync(capabilityPath, "utf8"), TauriCapabilityFileSchema);
  if (!Array.isArray(capabilityFile)) {
    return capabilityFile;
  }
  const capability = capabilityFile.find((entry) => entry.identifier === identifier);
  if (!capability) {
    throw new Error(`Missing Tauri capability: ${identifier}`);
  }
  return capability;
}

function readTauriConfig(): TauriConfig {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const configPath = path.resolve(currentDir, "../../../src-tauri/tauri.conf.json");
  return JSON.parse(readFileSync(configPath, "utf8")) as TauriConfig;
}

function readWorkspaceFile(relativePath: string): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../..", relativePath), "utf8");
}

function readWorkspaceDir(relativePath: string): string[] {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readdirSync(path.resolve(currentDir, "../../..", relativePath)).toSorted();
}

function extractRegisteredCommandNames(source: string): string[] {
  const handlerBlock = source.match(/\.invoke_handler\(tauri::generate_handler!\[\s*([\s\S]*?)\s*\]\)/)?.[1] ?? "";
  return [...handlerBlock.matchAll(/commands::[a-z_]+::([a-z_]+)/g)]
    .map((match) => match[1])
    .filter((command): command is string => Boolean(command));
}

function extractPermissionAllowlist(source: string): {
  identifier: string;
  commands: string[];
} {
  const identifier = source.match(/identifier\s*=\s*"([^"]+)"/)?.[1];
  const allowBlock = source.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  if (!identifier) {
    throw new Error("Missing permission identifier");
  }
  return {
    identifier,
    commands: [...allowBlock.matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((command): command is string => Boolean(command)),
  };
}

describe("tauri window capability contract", () => {
  it("keeps the main webview permission matrix minimal and feature-backed", () => {
    const capability = readDefaultCapability();

    const permissionIds = capability.permissions.map(permissionIdentifier);

    expect(permissionIds).toEqual(expectedMainWebviewPermissions);
    expect(permissionIds).not.toContain("opener:default");
    expect(permissionIds).not.toContain("opener:allow-default-urls");
    expect(permissionIds).not.toContain("opener:allow-open-path");
    expect(permissionIds).not.toContain("opener:allow-reveal-item-in-dir");
    expect(permissionIds).not.toContain("updater:default");
    expect(capability.permissions).toContainEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: "http://*" }, { url: "https://*" }, { url: "mailto:*" }],
    });
  });

  it("does not ship debug-only MCP bridge permissions in the default release capability", () => {
    const capability = readDefaultCapability();

    expect(
      capability.permissions.map(permissionIdentifier).filter((permission) => permission.startsWith("mcp-bridge:")),
    ).toEqual([]);
  });

  it("keeps the embedded browser webview capability event-only", () => {
    const capability = readDefaultCapability("browser-webview");

    expect(capability.webviews).toEqual(["browser-webview"]);
    expect(capability.permissions.map(permissionIdentifier)).toEqual(["core:event:default"]);
  });

  it("keeps release plugin permissions backed by runtime plugin initialization", () => {
    const permissionIds = readDefaultCapability().permissions.map(permissionIdentifier);
    const tauriLib = readWorkspaceFile("src-tauri/src/lib.rs");

    expect(permissionIds).toEqual(
      expect.arrayContaining(["opener:allow-open-url", "clipboard-manager:allow-write-text", "updater-commands"]),
    );
    expect(tauriLib).toContain("tauri_plugin_clipboard_manager::init()");
    expect(tauriLib).toContain("tauri_plugin_opener::init()");
    expect(tauriLib).toContain("tauri_plugin_updater::Builder::new().build()");
  });

  it("keeps Tauri command permissions split by command ownership", () => {
    const mainCapability = readDefaultCapability();
    const permissionIds = mainCapability.permissions.map(permissionIdentifier);
    const permissionFiles = readWorkspaceDir("src-tauri/permissions");
    const permissionAllowlists = Object.fromEntries(
      permissionFiles.map((fileName) => {
        const permission = extractPermissionAllowlist(readWorkspaceFile(`src-tauri/permissions/${fileName}`));
        return [permission.identifier, permission.commands];
      }),
    );
    const allowedCommands = Object.values(permissionAllowlists).flat();
    const registeredCommands = extractRegisteredCommandNames(readWorkspaceFile("src-tauri/src/lib.rs"));

    expect(permissionFiles).toEqual([
      "browser-commands.toml",
      "database-commands.toml",
      "debug-log-commands.toml",
      "reader-commands.toml",
      "settings-commands.toml",
      "share-commands.toml",
      "updater-commands.toml",
    ]);
    expect(permissionAllowlists).toEqual(expectedCommandOwnerAllowlists);
    expect(permissionIds).toEqual(expect.arrayContaining(Object.keys(expectedCommandOwnerAllowlists)));
    expect(allowedCommands.toSorted()).toEqual(registeredCommands.toSorted());
    expect(new Set(allowedCommands).size).toBe(allowedCommands.length);
  });

  it("keeps browser-mode fallback independent from the global Tauri runtime object", () => {
    const config = readTauriConfig();

    expect(config.app?.withGlobalTauri).toBe(false);
  });
});
