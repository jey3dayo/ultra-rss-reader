import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

type CargoMetadata = {
  packages: Array<{
    license?: string | null;
    license_file?: string | null;
    name: string;
    repository?: string | null;
    version: string;
  }>;
};

const outputDir = "tmp/dependency-licenses";
const pnpmCommand = process.platform === "win32" ? "pnpm.CMD" : "pnpm";

const run = (command: string, args: readonly string[], stdoutFile?: string): void => {
  const result = spawnSync(command, [...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: stdoutFile ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (stdoutFile && result.stdout !== null) {
    writeFileSync(stdoutFile, result.stdout);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
};

mkdirSync(outputDir, { recursive: true });
run(pnpmCommand, ["licenses", "list", "--json"], `${outputDir}/pnpm-licenses.json`);
run(
  "cargo",
  ["metadata", "--manifest-path", "src-tauri/Cargo.toml", "--format-version=1", "--locked"],
  `${outputDir}/cargo-metadata.json`,
);

const metadata = JSON.parse(readFileSync(`${outputDir}/cargo-metadata.json`, "utf8")) as CargoMetadata;
const packages = metadata.packages.map((pkg) => ({
  license: pkg.license ?? null,
  license_file: pkg.license_file ?? null,
  name: pkg.name,
  repository: pkg.repository ?? null,
  version: pkg.version,
}));
writeFileSync(`${outputDir}/cargo-licenses.json`, `${JSON.stringify(packages, null, 2)}\n`);
