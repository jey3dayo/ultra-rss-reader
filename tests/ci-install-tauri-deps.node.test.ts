import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Runs scripts/ci/install-tauri-deps.sh against stub sudo / apt-get / timeout
// so the cache bookkeeping and the mirror retry are checked without touching
// the host's apt. Linux and macOS only: the script is bash and CI runs it on
// ubuntu-latest.
const script = join(process.cwd(), "scripts/ci/install-tauri-deps.sh");

const stubs: Record<string, string> = {
  // Log mirror rewrites instead of running them (BSD and GNU sed -i differ).
  sudo: `#!/usr/bin/env bash
if [ "$1" = sed ]; then echo "sed $*" >> "$STUB_LOG"; exit 0; fi
exec "$@"
`,
  timeout: `#!/usr/bin/env bash
shift
if [ -n "$STUB_TIMEOUT_ONCE" ] && [ ! -e "$STUB_TIMEOUT_ONCE" ] && [[ " $* " == *" install "* ]]; then
  touch "$STUB_TIMEOUT_ONCE"
  echo "timeout install" >> "$STUB_LOG"
  exit 124
fi
exec "$@"
`,
  "apt-get": `#!/usr/bin/env bash
echo "apt-get $*" >> "$STUB_LOG"
[ "$1" = update ] && exit 0
[ -n "$STUB_FAIL" ] && exit "$STUB_FAIL"
archives=""
print_uris=""
for arg in "$@"; do
  case "$arg" in
    Dir::Cache::Archives=*) archives="$(printf '%s' "$arg" | cut -d= -f2-)" ;;
    --print-uris) print_uris=1 ;;
  esac
done
for deb in $STUB_DEBS; do
  if [ -n "$print_uris" ]; then
    echo "'http://archive.example/$deb' $deb 10 SHA256:sum-$deb"
  elif [ -n "$archives" ] && [ ! -e "$archives/$deb" ]; then
    echo "download $deb" >> "$STUB_LOG"
    touch "$archives/$deb"
  fi
done
[ -n "$archives" ] && [ -z "$print_uris" ] && touch "$archives/lock"
exit 0
`,
};

let workDir = "";

afterEach(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = "";
});

function setup() {
  workDir = mkdtempSync(join(tmpdir(), "tauri-apt-"));
  const binDir = join(workDir, "bin");
  const runnerTemp = join(workDir, "runner-temp");
  const archiveDir = join(runnerTemp, "tauri-apt-archives");
  const aptEtc = join(workDir, "etc-apt");
  mkdirSync(binDir);
  mkdirSync(runnerTemp);
  mkdirSync(aptEtc);
  // ubuntu-24.04 keeps its mirrors here; the stub sudo logs the sed calls.
  writeFileSync(join(aptEtc, "apt-mirrors.txt"), "http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n");
  const binaries = { ...stubs };
  // macOS before 15 has no sha256sum; shasum gives the same output format.
  if (spawnSync("sh", ["-c", "command -v sha256sum"]).status !== 0) {
    binaries.sha256sum = `#!/usr/bin/env bash
exec shasum -a 256 "$@"
`;
  }
  for (const [name, body] of Object.entries(binaries)) {
    writeFileSync(join(binDir, name), body);
    chmodSync(join(binDir, name), 0o755);
  }
  const log = join(workDir, "stub.log");
  writeFileSync(log, "");
  const run = (mode: "plan" | "install", env: Record<string, string> = {}) =>
    spawnSync("bash", [script, mode], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        RUNNER_TEMP: runnerTemp,
        GITHUB_OUTPUT: join(workDir, "github-output"),
        ImageOS: "ubuntu24",
        STUB_LOG: log,
        TAURI_APT_ETC: aptEtc,
        TAURI_SYSTEM_DEPS: "libgtk-3-dev patchelf",
        ...env,
      },
    });
  const logLines = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
  return { archiveDir, runnerTemp, run, logLines };
}

describe.skipIf(process.platform === "win32")("scripts/ci/install-tauri-deps.sh", () => {
  it("plans a cache key from the exact .deb set, independent of apt's ordering", () => {
    const { runnerTemp, run } = setup();
    const first = run("plan", { STUB_DEBS: "b_2_amd64.deb a_1_amd64.deb" });
    expect(first.status, first.stderr).toBe(0);
    expect(readFileSync(join(runnerTemp, "tauri-apt-debs.txt"), "utf8")).toBe("a_1_amd64.deb\nb_2_amd64.deb\n");
    const output = readFileSync(join(workDir, "github-output"), "utf8");
    const key = output.match(/^deb-key=([0-9a-f]{16})$/m)?.[1];
    expect(key).toBeDefined();
    expect(output).toContain("image=ubuntu24\n");

    writeFileSync(join(workDir, "github-output"), "");
    expect(run("plan", { STUB_DEBS: "a_1_amd64.deb b_2_amd64.deb" }).status).toBe(0);
    expect(readFileSync(join(workDir, "github-output"), "utf8")).toContain(`deb-key=${key}\n`);

    writeFileSync(join(workDir, "github-output"), "");
    expect(run("plan", { STUB_DEBS: "a_1_amd64.deb b_3_amd64.deb" }).status).toBe(0);
    expect(readFileSync(join(workDir, "github-output"), "utf8")).not.toContain(`deb-key=${key}\n`);
  });

  it("reuses cached debs, downloads only missing ones, and prunes stale ones before save", () => {
    const { archiveDir, runnerTemp, run, logLines } = setup();
    mkdirSync(archiveDir);
    writeFileSync(join(archiveDir, "a_1_amd64.deb"), "");
    writeFileSync(join(archiveDir, "old_0_amd64.deb"), "");
    writeFileSync(join(runnerTemp, "tauri-apt-debs.txt"), "a_1_amd64.deb\nc_1_amd64.deb\n");

    const result = run("install", { TAURI_APT_ARCHIVE_DIR: archiveDir, STUB_DEBS: "a_1_amd64.deb c_1_amd64.deb" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("reusing 2 cached .deb files");
    expect(readdirSync(archiveDir).sort()).toEqual(["a_1_amd64.deb", "c_1_amd64.deb"]);
    expect(logLines().filter((line) => line.startsWith("download "))).toEqual(["download c_1_amd64.deb"]);
    expect(logLines().find((line) => line.startsWith("apt-get install"))).toContain(
      `Dir::Cache::Archives=${archiveDir}`,
    );
  });

  it("retries the install once from the fallback mirror when apt times out", () => {
    const { archiveDir, run, logLines } = setup();
    const result = run("install", {
      TAURI_APT_ARCHIVE_DIR: archiveDir,
      STUB_DEBS: "a_1_amd64.deb",
      STUB_TIMEOUT_ONCE: join(workDir, "timed-out"),
    });

    expect(result.status, result.stderr).toBe(0);
    const lines = logLines();
    expect(lines.filter((line) => line === "timeout install")).toHaveLength(1);
    const mirrorRewrites = lines.filter(
      (line) => line.startsWith("sed ") && line.includes("mirror.math.princeton.edu"),
    );
    expect(mirrorRewrites).toHaveLength(1);
    expect(mirrorRewrites[0]).toContain("etc-apt/apt-mirrors.txt");
    expect(lines.filter((line) => line.startsWith("apt-get update"))).toHaveLength(1);
    expect(lines.filter((line) => line.startsWith("apt-get install"))).toHaveLength(1);
    expect(existsSync(join(archiveDir, "a_1_amd64.deb"))).toBe(true);
  });

  it("fails without retrying when apt fails for a reason other than a timeout", () => {
    const { archiveDir, run, logLines } = setup();
    const result = run("install", { TAURI_APT_ARCHIVE_DIR: archiveDir, STUB_DEBS: "a_1_amd64.deb", STUB_FAIL: "100" });

    expect(result.status).toBe(100);
    expect(logLines().filter((line) => line.startsWith("apt-get install"))).toHaveLength(1);
    expect(logLines().some((line) => line.startsWith("apt-get update"))).toBe(false);
  });
});
