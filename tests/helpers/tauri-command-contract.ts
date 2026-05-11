import type { Result } from "@praha/byethrow";
import { expect } from "vitest";
import { expectTauriCommandValidationError, suppressConsoleError } from "./console-spies";

export type CommandValidationBoundary = "args" | "response";

export type CommandValidationError = {
  readonly type?: string;
  readonly message: string;
};

export type CommandValidationCase = readonly [string, () => Promise<Result.Result<unknown, CommandValidationError>>];

export async function runCommandCases<TCommand extends CommandValidationCase>(
  commandCases: readonly TCommand[],
): Promise<Array<readonly [string, Result.Result<unknown, CommandValidationError>]>> {
  return Promise.all(
    commandCases.map(async ([command, runCommand]) => {
      const result = await runCommand();
      return [command, result] as const;
    }),
  );
}

export async function runValidationCommandCases<TCommand extends CommandValidationCase>(
  commandCases: readonly TCommand[],
  boundary: CommandValidationBoundary,
): Promise<Array<readonly [string, Result.Result<unknown, CommandValidationError>]>> {
  const consoleError = suppressConsoleError();
  const results = await runCommandCases(commandCases);

  for (const [command] of results) {
    expectTauriCommandValidationError(consoleError, command, boundary);
  }

  return results;
}

export function extractCommandNames(source: string, commandPattern: RegExp): string[] {
  const commands = new Set<string>();

  for (const match of source.matchAll(commandPattern)) {
    const command = match[1];
    if (command) {
      commands.add(command);
    }
  }

  return [...commands].toSorted();
}

export function extractSafeInvokeCommandsWithArgs(source: string): string[] {
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
          if (/\bargs\s*:/.test(call)) {
            const match = call.match(/safeInvoke\(\s*"([^"]+)"/);
            const command = match?.[1];
            if (command) {
              commands.add(command);
            }
          }
          break;
        }
      }
    }

    searchFrom = end + 1;
  }

  return [...commands].toSorted();
}

export function extractRegisteredRustCommandNames(source: string): string[] {
  const handlerMatch = source.match(/tauri::generate_handler!\s*\[([\s\S]*?)\]/);
  if (!handlerMatch) {
    throw new Error("Tauri generate_handler command list should exist");
  }

  return [
    ...new Set(
      [...(handlerMatch[1] ?? "").matchAll(/commands::[a-zA-Z0-9_]+::([a-zA-Z0-9_]+)/g)].map((match) => match[1] ?? ""),
    ),
  ].toSorted();
}

export function extractRustTauriAsyncCommandNames(source: string): string[] {
  const commandPattern = /#\[tauri::command\]\s+(?:#\[[^\]]+\]\s+)*(?:pub\s+)?async\s+fn\s+([a-zA-Z0-9_]+)\s*\(/g;

  return [...new Set([...source.matchAll(commandPattern)].map((match) => match[1] ?? ""))].toSorted();
}

export function extractRustStructFields(source: string, structName: string, sourceLabel: string): string[] {
  const structMatch = source.match(
    new RegExp(`((?:#\\[[^\\]]+\\]\\s*)*)pub struct ${structName} \\{([\\s\\S]*?)\\n\\}`),
  );
  expect(structMatch, `${structName} should exist in ${sourceLabel}`).not.toBeNull();

  const renameAll = structMatch?.[1]?.match(/#\[serde\(rename_all = "([^"]+)"\)\]/)?.[1];
  const body = structMatch?.[2] ?? "";
  const fields: string[] = [];
  let fieldAttributes: string[] = [];

  for (const line of body.split("\n")) {
    const attributeMatch = line.trim().match(/^#\[(.+)\]$/);
    if (attributeMatch?.[1]) {
      fieldAttributes.push(attributeMatch[1]);
      continue;
    }

    const fieldMatch = line.match(/^ {4}pub ([a-zA-Z0-9_]+):/);
    if (!fieldMatch?.[1]) {
      continue;
    }

    if (fieldAttributes.some((attribute) => attribute.startsWith("serde(skip"))) {
      fieldAttributes = [];
      continue;
    }

    fields.push(serializedRustFieldName(fieldMatch[1], fieldAttributes, renameAll));
    fieldAttributes = [];
  }

  return fields.toSorted();
}

export function extractCommandDbLockPolicyCases(source: string): Record<string, string> {
  const policyBodyMatch = source.match(
    /pub\(crate\)\s+fn\s+command_db_lock_policy[\s\S]*?let policy = match command_name \{([\s\S]*?)\n\s*_\s*=>\s*return None,/,
  );
  if (!policyBodyMatch) {
    throw new Error("command_db_lock_policy match body should exist");
  }

  const policies: Record<string, string> = {};
  const policyArmPattern = /([\s\S]*?)=>\s*CommandDbLockPolicy::([A-Za-z0-9_]+)/g;

  for (const match of (policyBodyMatch[1] ?? "").matchAll(policyArmPattern)) {
    const commands = [...(match[1] ?? "").matchAll(/"([^"]+)"/g)]
      .map((commandMatch) => commandMatch[1])
      .filter(Boolean);
    const policy = match[2];
    if (!policy) {
      continue;
    }

    for (const command of commands) {
      policies[command] = policy;
    }
  }

  return policies;
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function serializedRustFieldName(fieldName: string, attributes: readonly string[], renameAll?: string): string {
  const renamed = attributes.map((attribute) => attribute.match(/serde\(rename = "([^"]+)"/)?.[1]).find(Boolean);
  if (renamed) {
    return renamed;
  }

  return renameAll === "camelCase" ? snakeToCamel(fieldName) : fieldName;
}

export type CommandIndex = {
  readonly commands: readonly string[];
  readonly commandSet: ReadonlySet<string>;
};

export function createCommandIndex(commands: readonly string[]): CommandIndex {
  return {
    commands,
    commandSet: new Set(commands),
  };
}

export function orderedCommandDifference(left: CommandIndex, right: CommandIndex): string[] {
  const difference: string[] = [];

  for (const command of left.commands) {
    if (!right.commandSet.has(command)) {
      difference.push(command);
    }
  }

  return difference;
}
