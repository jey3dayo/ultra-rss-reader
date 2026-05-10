import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type InventoryItem = {
  area: "rust-cfg" | "vite-env" | "dev-module" | "tauri-config" | "release-absence";
  flag: string;
  debugBehavior: string;
  releaseBehavior: string;
  evidence: string[];
};

const OUTPUT_PATH = "tmp/release-debug-feature-flags.json";
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);

const readText = (filePath: string): string => readFileSync(filePath, "utf8");

const listFiles = (dir: string, extensions: readonly string[]): string[] =>
  readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
    .map((entry) => path.posix.join(dir, entry.split(path.sep).join(path.posix.sep)));

const sourceFiles = [
  ...listFiles("src", [".ts", ".tsx"]),
  ...listFiles("src-tauri/src", [".rs"]),
  ...["src-tauri/tauri.conf.json", "src-tauri/tauri.dev.conf.json", "src-tauri/tauri.release.conf.json"],
];

const filesContaining = (pattern: RegExp): string[] =>
  sourceFiles.filter((filePath) => pattern.test(readText(filePath))).sort((left, right) => left.localeCompare(right));

const inventory: InventoryItem[] = [
  {
    area: "rust-cfg",
    flag: "debug_assertions",
    debugBehavior: "enables the MCP bridge plugin for local native inspection",
    releaseBehavior: "excludes the MCP bridge plugin from release builds",
    evidence: filesContaining(/cfg\(debug_assertions\)|tauri_plugin_mcp_bridge/),
  },
  {
    area: "vite-env",
    flag: "VITE_DEV_INTENT",
    debugBehavior: "routes development launches into registered debug scenarios",
    releaseBehavior: "not set by release workflow or release Tauri config",
    evidence: filesContaining(/VITE_DEV_INTENT|import\.meta\.env/),
  },
  {
    area: "dev-module",
    flag: "@/dev/scenarios",
    debugBehavior: "keeps debug scenarios under src/dev",
    releaseBehavior: "release source outside src/dev must not import debug scenarios",
    evidence: filesContaining(/@\/dev\/scenarios|src\/dev\/scenarios/),
  },
  {
    area: "dev-module",
    flag: "@/dev/mock-data",
    debugBehavior: "provides local-only mock data for dev and tests",
    releaseBehavior: "release source outside src/dev must not import dev mock data",
    evidence: filesContaining(/@\/dev\/mock-data|src\/dev\/mock-data/),
  },
  {
    area: "tauri-config",
    flag: "src-tauri/tauri.dev.conf.json",
    debugBehavior: "uses the dev bundle identifier, product name, and Vite devUrl",
    releaseBehavior: "release builds use src-tauri/tauri.release.conf.json instead",
    evidence: ["src-tauri/tauri.dev.conf.json", "src-tauri/tauri.release.conf.json"],
  },
  {
    area: "release-absence",
    flag: "DEV_CREDENTIALS",
    debugBehavior: "allows development launches to use file-backed credentials",
    releaseBehavior: "release workflow and Tauri release config must not enable dev credentials",
    evidence: filesContaining(/DEV_CREDENTIALS|ULTRA_RSS_DEV_CREDENTIALS/),
  },
];

const report = {
  generatedBy: "scripts/release-debug-feature-flags-report.ts",
  inventory,
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
