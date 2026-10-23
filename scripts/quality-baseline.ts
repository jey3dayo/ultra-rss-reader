import { pathToFileURL } from "node:url";
import { runKnip } from "./quality/knip.ts";
import { runReactDoctor } from "./quality/react-doctor.ts";

export const qualityBaselineRepoScanIgnoredPathPrefixes = [
  "node_modules/",
  "dist/",
  "src-tauri/target/",
  "tmp/",
  "storybook-static/",
  "test-results/",
  "playwright-report/",
  "src-tauri/gen/schemas/",
] as const;


export function runQualityBaseline(command: string | undefined = process.argv[2]): void {
  if (
    command !== "react-doctor:diff" &&
    command !== "react-doctor:full" &&
    command !== "knip" &&
    command !== "knip:check"
  ) {
    console.error("Usage: node scripts/quality-baseline.ts react-doctor:diff|react-doctor:full|knip|knip:check");
    process.exit(2);
  }

  if (command === "react-doctor:diff") {
    runReactDoctor("diff", true);
  } else if (command === "react-doctor:full") {
    runReactDoctor("full", false);
  } else if (command === "knip") {
    runKnip(false);
  } else {
    runKnip(true);
  }
}

export function isQualityBaselineRepoScanIgnoredPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoScanPath(filePath);
  return qualityBaselineRepoScanIgnoredPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}


export function partitionQualityBaselineRepoScanPaths(paths: readonly string[]): {
  includedPaths: string[];
  ignoredPaths: string[];
} {
  const includedPaths: string[] = [];
  const ignoredPaths: string[] = [];

  for (const path of paths) {
    if (isQualityBaselineRepoScanIgnoredPath(path)) {
      ignoredPaths.push(path);
    } else {
      includedPaths.push(path);
    }
  }

  return { includedPaths, ignoredPaths };
}

function normalizeRepoScanPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runQualityBaseline();
}
