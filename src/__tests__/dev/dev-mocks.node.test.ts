import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readTauriCommandsSource } from "@tests/helpers/tauri-command-source";
import { describe, expect, it } from "vitest";
import { commandArgsSchemas, PlatformInfoSchema } from "@/api/schemas";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { DEV_MOCK_NETWORK_BOUNDARY, DEV_MOCK_PLATFORM_INFO, DEV_MOCK_SIDE_EFFECT_BOUNDARY } from "@/dev/mocks";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dev mock static contracts", () => {
  it("keeps browser-only mock platform capabilities aligned with production defaults", () => {
    expect(PlatformInfoSchema.parse(DEV_MOCK_PLATFORM_INFO)).toEqual(DEV_MOCK_PLATFORM_INFO);
    expect(DEV_MOCK_PLATFORM_INFO).toEqual(DEFAULT_PLATFORM_INFO);
  });

  it("documents browser-only side effect and network boundaries", () => {
    expect(DEV_MOCK_NETWORK_BOUNDARY).toEqual({
      externalOpen: "record-only",
      browserWebview: "state-only",
      feedDiscovery: "synthetic",
    });
    expect(DEV_MOCK_SIDE_EFFECT_BOUNDARY).toEqual({
      externalOpen: "record-only",
      readingList: "record-only",
      browserWebview: "state-only",
      feedIntegrityCleanup: "dry-run-safe",
      opmlImport: "explicitly-unsupported",
    });
  });

  it("keeps every schema-validated command covered by the browser-only mock switch", () => {
    const source = readSource("src/dev/mocks.ts");
    const mockedCommands = new Set([...source.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));

    expect(Object.keys(commandArgsSchemas).filter((command) => !mockedCommands.has(command))).toEqual([]);
  });

  it("keeps every response-schema command covered by the browser-only mock switch", () => {
    const [mockSource, commandSource] = [readSource("src/dev/mocks.ts"), readTauriCommandsSource()];
    const mockedCommands = new Set([...mockSource.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));
    const responseSchemaCommands = new Set(
      [...commandSource.matchAll(/safeInvoke\(\s*"([^"]+)"\s*,\s*\{[^}]*response:/gs)].map((match) => match[1]),
    );

    expect([...responseSchemaCommands].filter((command) => !mockedCommands.has(command))).toEqual([]);
  });

  it("parses every schema-validated browser-only command at the mock IPC boundary", () => {
    const source = readSource("src/dev/mocks.ts");
    const parsedCommands = new Set(
      [...source.matchAll(/parseBrowserMockArgs\(\s*"([^"]+)"/g)].map((match) => match[1]),
    );

    expect(Object.keys(commandArgsSchemas).filter((command) => !parsedCommands.has(command))).toEqual([]);
  });
});
