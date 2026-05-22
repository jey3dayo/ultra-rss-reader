import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandArgsSchemaKeys, commandArgsSchemas } from "../src/api/schemas/commands";
import {
  extractCommandDbLockPolicyCases,
  extractRegisteredRustCommandNames,
  extractRustTauriAsyncCommandNames,
} from "./helpers/tauri-command-contract";
import { readTauriCommandsSource } from "./helpers/tauri-command-source";

const readText = (path: string): string => readFileSync(path, "utf8");

const RUST_FRAMEWORK_ARG_NAMES = new Set(["app", "app_handle", "state", "window"]);

const FRONTEND_ONLY_OPTIONAL_ARGS: Readonly<Record<string, readonly string[]>> = {
  add_account: ["appId", "appKey"],
};

const COUNT_RESPONSE_SCHEMA_NAMES = [
  "CountResponseSchema",
  "NonnegativeIntResponseSchema",
  "NullableStarredCountSchema",
] as const;

const extractResponseSchemaCommands = (source: string, schemaNames: readonly string[]): string[] => {
  const commands = new Set<string>();
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const start = source.indexOf("safeInvoke(", searchFrom);
    if (start === -1) {
      break;
    }

    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          const call = source.slice(start, end + 1);
          const command = call.match(/safeInvoke\(\s*"([^"]+)"/)?.[1];
          if (command && schemaNames.some((schemaName) => call.includes(`response: ${schemaName}`))) {
            commands.add(command);
          }
          break;
        }
      }
    }

    searchFrom = end + 1;
  }

  return [...commands].sort();
};

const extractRustResultCommands = (source: string, returnTypes: readonly string[]): string[] => {
  const commandPattern =
    /#\[tauri::command\]\s+(?:#\[[^\]]+\]\s+)*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*->\s*Result\s*<\s*([^,>]+)\s*,\s*AppError\s*>/g;
  return sortedUnique(
    [...source.matchAll(commandPattern)]
      .filter((match) => {
        const returnType = match[2]?.trim();
        return returnType ? returnTypes.includes(returnType) : false;
      })
      .map((match) => match[1] ?? ""),
  );
};

const snakeToCamel = (value: string): string => value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

const normalizeRustArgName = (name: string): string => snakeToCamel(name.replace(/^_/, ""));

const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].toSorted();

const extractRustCommandArgNames = (source: string): Record<string, string[]> => {
  const commandArgs = new Map<string, Set<string>>();
  const commandPattern =
    /#\[tauri::command\]\s+(?:#\[[^\]]+\]\s+)*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*->/g;

  for (const match of source.matchAll(commandPattern)) {
    const command = match[1];
    const params = match[2];
    if (!command || !params) {
      continue;
    }

    const args = commandArgs.get(command) ?? new Set<string>();
    for (const paramMatch of params.matchAll(/(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) {
      const paramName = paramMatch[1];
      if (paramName && !RUST_FRAMEWORK_ARG_NAMES.has(paramName)) {
        args.add(normalizeRustArgName(paramName));
      }
    }
    commandArgs.set(command, args);
  }

  return Object.fromEntries([...commandArgs.entries()].map(([command, args]) => [command, sortedUnique(args)]));
};

const registryArgNames = (): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(commandArgsSchemas)
      .filter(([command]) => !command.startsWith("plugin:"))
      .map(([command, schema]) => {
        const frontendOnlyArgs = FRONTEND_ONLY_OPTIONAL_ARGS[command] ?? [];
        const rustBackedArgs = commandArgsSchemaKeys(schema).filter((argName) => !frontendOnlyArgs.includes(argName));
        return [command, rustBackedArgs.toSorted()];
      }),
  );

describe("tauri command return contract", () => {
  it("extracts the registered Rust command list from Tauri generate_handler", () => {
    expect(
      extractRegisteredRustCommandNames(`
        .invoke_handler(tauri::generate_handler![
          commands::sync_commands::trigger_sync,
          commands::article_commands::mark_feed_read,
          commands::sync_commands::trigger_sync,
        ])
      `),
    ).toEqual(["mark_feed_read", "trigger_sync"]);
  });

  it("keeps registered Rust commands classified by DB lock policy", () => {
    const registeredCommands = extractRegisteredRustCommandNames(readText("src-tauri/src/lib.rs"));
    const lockPolicies = extractCommandDbLockPolicyCases(readText("src-tauri/src/commands/mod.rs"));

    expect(Object.keys(lockPolicies).toSorted()).toEqual(registeredCommands);
  });

  it("keeps async Tauri commands out of the synchronous blocking DB policy", () => {
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const lockPolicies = extractCommandDbLockPolicyCases(readText("src-tauri/src/commands/mod.rs"));
    const asyncCommands = extractRustTauriAsyncCommandNames(rustCommandSources);

    expect(asyncCommands.filter((command) => lockPolicies[command] === "BlockingLock")).toEqual([]);
    expect(
      Object.fromEntries(
        [
          "add_account",
          "test_account_connection",
          "add_local_feed",
          "trigger_sync",
          "trigger_startup_sync",
          "trigger_sync_account",
          "trigger_sync_feed",
          "trigger_automatic_sync",
        ].map((command) => [command, lockPolicies[command]]),
      ),
    ).toEqual({
      add_account: "AsyncCommandBlockingLock",
      test_account_connection: "AsyncCommandBlockingLock",
      add_local_feed: "AsyncCommandBlockingLock",
      trigger_sync: "AsyncCommandBlockingLock",
      trigger_startup_sync: "AsyncCommandBlockingLock",
      trigger_sync_account: "AsyncCommandBlockingLock",
      trigger_sync_feed: "AsyncCommandBlockingLock",
      trigger_automatic_sync: "AsyncCommandBlockingLock",
    });
  });

  it("keeps long-running operation progress contracts explicit where implementations exist", () => {
    const syncCommandsSource = readText("src-tauri/src/commands/sync_commands.rs");
    const updaterCommandsSource = readText("src-tauri/src/commands/updater_commands.rs");
    const opmlCommandsSource = readText("src-tauri/src/commands/opml_commands.rs");

    expect(syncCommandsSource).toContain("SYNC_PROGRESS_SESSION_ID");
    expect(syncCommandsSource).toContain("next_sync_progress_completed");
    expect(syncCommandsSource).toContain("session_id: self.session_id");
    expect(updaterCommandsSource).toContain("DOWNLOAD_SESSION_ID");
    expect(updaterCommandsSource).toContain("next_download_progress_percent");
    expect(updaterCommandsSource).toContain("percent.max(last_percent)");
    expect(opmlCommandsSource).not.toContain("import-progress");
    expect(opmlCommandsSource).not.toContain("export-progress");
  });

  it("keeps frontend null-response commands aligned with Rust unit-result commands", () => {
    const tauriCommands = readTauriCommandsSource();
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const registeredCommands = new Set(extractRegisteredRustCommandNames(readText("src-tauri/src/lib.rs")));

    expect(
      extractResponseSchemaCommands(tauriCommands, ["NullResponseSchema"]).filter(
        (command) => !command.startsWith("plugin:"),
      ),
    ).toEqual(
      extractRustResultCommands(rustCommandSources, ["()"]).filter((command) => registeredCommands.has(command)),
    );
  });

  it("keeps frontend string-response commands aligned with Rust string-result commands", () => {
    const tauriCommands = readTauriCommandsSource();
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const registeredCommands = new Set(extractRegisteredRustCommandNames(readText("src-tauri/src/lib.rs")));

    expect(extractResponseSchemaCommands(tauriCommands, ["StringResponseSchema"])).toEqual(
      extractRustResultCommands(rustCommandSources, ["String"]).filter((command) => registeredCommands.has(command)),
    );
  });

  it("keeps frontend boolean-response commands aligned with Rust bool-result commands", () => {
    const tauriCommands = readTauriCommandsSource();
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const registeredCommands = new Set(extractRegisteredRustCommandNames(readText("src-tauri/src/lib.rs")));

    expect(extractResponseSchemaCommands(tauriCommands, ["BooleanResponseSchema"])).toEqual(
      extractRustResultCommands(rustCommandSources, ["bool"]).filter((command) => registeredCommands.has(command)),
    );
  });

  it("keeps frontend count-response commands aligned with Rust numeric count-result commands", () => {
    const tauriCommands = readTauriCommandsSource();
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const registeredCommands = new Set(extractRegisteredRustCommandNames(readText("src-tauri/src/lib.rs")));

    expect(extractResponseSchemaCommands(tauriCommands, COUNT_RESPONSE_SCHEMA_NAMES)).toEqual(
      extractRustResultCommands(rustCommandSources, ["i32", "i64", "u64", "usize"]).filter((command) =>
        registeredCommands.has(command),
      ),
    );
  });

  it("keeps frontend command args registry aligned with Rust command argument names", () => {
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");
    const rustCommandArgs = extractRustCommandArgNames(rustCommandSources);

    expect(registryArgNames()).toEqual(
      Object.fromEntries(Object.keys(registryArgNames()).map((command) => [command, rustCommandArgs[command] ?? []])),
    );
  });
});
