import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { commandArgsSchemas } from "../src/api/schemas/commands";

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

const schemaArgNames = (schema: z.ZodType<Record<string, unknown>>): string[] => {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape).toSorted();
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    return sortedUnique(
      schema.options.flatMap((option) => {
        if (!(option instanceof z.ZodObject)) {
          throw new Error(`Unsupported discriminated union option schema: ${option.constructor.name}`);
        }
        return Object.keys(option.shape);
      }),
    );
  }

  throw new Error(`Unsupported command args schema: ${schema.constructor.name}`);
};

const registryArgNames = (): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(commandArgsSchemas)
      .filter(([command]) => !command.startsWith("plugin:"))
      .map(([command, schema]) => {
        const frontendOnlyArgs = FRONTEND_ONLY_OPTIONAL_ARGS[command] ?? [];
        const rustBackedArgs = schemaArgNames(schema).filter((argName) => !frontendOnlyArgs.includes(argName));
        return [command, rustBackedArgs.toSorted()];
      }),
  );

describe("tauri command return contract", () => {
  it("keeps frontend null-response commands aligned with Rust unit-result commands", () => {
    const tauriCommands = readText("src/api/tauri-commands.ts");
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");

    expect(
      extractResponseSchemaCommands(tauriCommands, ["NullResponseSchema"]).filter(
        (command) => !command.startsWith("plugin:"),
      ),
    ).toEqual(extractRustResultCommands(rustCommandSources, ["()"]));
  });

  it("keeps frontend string-response commands aligned with Rust string-result commands", () => {
    const tauriCommands = readText("src/api/tauri-commands.ts");
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");

    expect(extractResponseSchemaCommands(tauriCommands, ["StringResponseSchema"])).toEqual(
      extractRustResultCommands(rustCommandSources, ["String"]),
    );
  });

  it("keeps frontend boolean-response commands aligned with Rust bool-result commands", () => {
    const tauriCommands = readText("src/api/tauri-commands.ts");
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");

    expect(extractResponseSchemaCommands(tauriCommands, ["BooleanResponseSchema"])).toEqual(
      extractRustResultCommands(rustCommandSources, ["bool"]),
    );
  });

  it("keeps frontend count-response commands aligned with Rust numeric count-result commands", () => {
    const tauriCommands = readText("src/api/tauri-commands.ts");
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");

    expect(extractResponseSchemaCommands(tauriCommands, COUNT_RESPONSE_SCHEMA_NAMES)).toEqual(
      extractRustResultCommands(rustCommandSources, ["i32", "i64", "u64", "usize"]),
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
