import { pathToFileURL } from "node:url";
import {
  classifySignatureDiffs,
  compareSnapshots,
  KEYCHAIN_SERVICE,
  type MacosKeychainSignatureSnapshot,
  parseCodesignDetails,
} from "./lib/macos-signature-diagnostics.ts";
import {
  compareSnapshotFiles,
  type MacosSignatureDiagnosticOptions,
  recordSnapshot,
  writeComparisonReport,
  writeSnapshot,
} from "./workflows/macos-signature-diagnostics.ts";

export type { MacosKeychainSignatureSnapshot };
export { classifySignatureDiffs, compareSnapshots, parseCodesignDetails, recordSnapshot };

const DEFAULT_APP_PATH = "/Applications/Ultra RSS Reader.app";

type CliOptions = MacosSignatureDiagnosticOptions & {
  after?: string;
  before?: string;
  out?: string;
};

const usage = `Usage:
  pnpm run diagnose:macos-keychain-signature -- record [--app <path>] --label <name> --out <snapshot.json> [--artifact-url <url>] [--version <version>]
  pnpm run diagnose:macos-keychain-signature -- compare --before <old.json> --after <new.json> [--out <report.md>]

Records only signature, bundle identifier, verification status, artifact URL, and keychain service/account-id scope.
It never reads or prints Keychain password values.`;

const parseArgs = (args: string[]): { command: "compare" | "record"; options: CliOptions } => {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  const [command, ...rest] = normalizedArgs;
  if (command !== "record" && command !== "compare") {
    throw new Error(usage);
  }

  const options: CliOptions = {
    appPath: DEFAULT_APP_PATH,
    label: command === "record" ? "macos-keychain-signature" : "signature-comparison",
  };

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for ${key ?? "(unknown option)"}\n\n${usage}`);
    }

    index += 1;
    switch (key) {
      case "--after":
        options.after = value;
        break;
      case "--app":
        options.appPath = value;
        break;
      case "--artifact-url":
        options.artifactUrl = value;
        break;
      case "--before":
        options.before = value;
        break;
      case "--label":
        options.label = value;
        break;
      case "--out":
        options.out = value;
        break;
      case "--version":
        options.version = value;
        break;
      default:
        throw new Error(`unknown option: ${key}\n\n${usage}`);
    }
  }

  return { command, options };
};

const requireOption = (value: string | undefined, option: string): string => {
  if (!value) {
    throw new Error(`missing required option ${option}\n\n${usage}`);
  }

  return value;
};

const runCli = (): void => {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "record") {
    const out = requireOption(options.out, "--out");
    const snapshot = recordSnapshot(options);
    writeSnapshot(out, snapshot);
    console.log(`wrote macOS Keychain signature snapshot: ${out}`);
    console.log(`keychain scope: service=${KEYCHAIN_SERVICE}, account_id=Ultra RSS Reader account id`);
    return;
  }

  const beforePath = requireOption(options.before, "--before");
  const afterPath = requireOption(options.after, "--after");
  const { comparison, report } = compareSnapshotFiles(beforePath, afterPath);

  if (options.out) {
    writeComparisonReport(options.out, report);
    console.log(`wrote macOS Keychain signature comparison: ${options.out}`);
  } else {
    console.log(report);
  }

  if (!comparison.ok) {
    process.exitCode = 1;
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
