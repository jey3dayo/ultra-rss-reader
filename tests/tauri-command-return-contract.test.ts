import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readText = (path: string): string => readFileSync(path, "utf8");

const extractNullResponseCommands = (source: string): string[] => {
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
          if (command && call.includes("response: NullResponseSchema")) {
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

const extractRustUnitResultCommands = (source: string): string[] => {
  const commandPattern =
    /#\[tauri::command\]\s+(?:#\[[^\]]+\]\s+)*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*->\s*Result\s*<\s*\(\s*\)\s*,\s*AppError\s*>/g;
  return [...new Set([...source.matchAll(commandPattern)].map((match) => match[1] ?? ""))].sort();
};

describe("tauri command return contract", () => {
  it("keeps frontend null-response commands aligned with Rust unit-result commands", () => {
    const tauriCommands = readText("src/api/tauri-commands.ts");
    const rustCommandSources = readdirSync("src-tauri/src/commands")
      .filter((fileName) => fileName.endsWith(".rs"))
      .map((fileName) => readText(`src-tauri/src/commands/${fileName}`))
      .join("\n");

    expect(extractNullResponseCommands(tauriCommands).filter((command) => !command.startsWith("plugin:"))).toEqual(
      extractRustUnitResultCommands(rustCommandSources),
    );
  });
});
