import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { writeChanges } from "../scripts/release/bump-version.ts";

const VERSION_FILES = [
  "package.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "msix/Package.appxmanifest",
] as const;

const SUPPORT_FILES = [
  ".github/workflows/release.yml",
  "src-tauri/tauri.release.conf.json",
  "src-tauri/tauri.dev.conf.json",
  "src-tauri/capabilities/default.json",
  "scripts/release/bump-version.ts",
  "scripts/release/validate-version-parity.ts",
  ".codex/skills/release/scripts/release_checks.py",
] as const;

const createFixture = (): string => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ultra-rss-version-bump-"));
  for (const relativePath of [...VERSION_FILES, ...SUPPORT_FILES]) {
    const sourcePath = resolve(relativePath);
    const destinationPath = join(fixtureRoot, relativePath);
    const destinationDirectory = dirname(destinationPath);
    if (destinationDirectory !== fixtureRoot) {
      mkdirSync(destinationDirectory, { recursive: true });
    }
    copyFileSync(sourcePath, destinationPath);
  }
  return fixtureRoot;
};

const runScript = (fixtureRoot: string, relativeScript: string, args: readonly string[] = []): string =>
  execFileSync(process.execPath, [relativeScript, ...args], {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const runBump = (fixtureRoot: string, version: string): string =>
  runScript(fixtureRoot, "scripts/release/bump-version.ts", [version]);

const runParity = (fixtureRoot: string, version: string): string =>
  execFileSync(process.execPath, ["scripts/release/validate-version-parity.ts"], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: { ...process.env, RELEASE_TAG: `v${version}` },
    stdio: ["ignore", "pipe", "pipe"],
  });

const runPythonParity = (fixtureRoot: string, version: string): string =>
  execFileSync("python3", [".codex/skills/release/scripts/release_checks.py", "verify-version", version], {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const readVersionFiles = (fixtureRoot: string): Record<string, string> =>
  Object.fromEntries(
    VERSION_FILES.map((relativePath) => [relativePath, readFileSync(join(fixtureRoot, relativePath), "utf8")]),
  );

const readPackageVersion = (fixtureRoot: string): string => {
  const match = readFileSync(join(fixtureRoot, "package.json"), "utf8").match(/"version": "([^"]+)"/);
  if (!match) {
    throw new Error("package.json version is missing");
  }
  return match[1];
};

const withFixture = (callback: (fixtureRoot: string) => void): void => {
  const fixtureRoot = createFixture();
  try {
    callback(fixtureRoot);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

describe("release version bump contract", () => {
  it("updates all five owners, passes parity, and is byte-idempotent", () => {
    withFixture((fixtureRoot) => {
      runBump(fixtureRoot, "0.59.1");
      runParity(fixtureRoot, "0.59.1");

      const afterFirstRun = readVersionFiles(fixtureRoot);
      expect(afterFirstRun["package.json"]).toContain('"version": "0.59.1"');
      expect(afterFirstRun["src-tauri/Cargo.lock"]).toContain('name = "ultra-rss-reader"\nversion = "0.59.1"');
      expect(afterFirstRun["msix/Package.appxmanifest"]).toContain('Version="0.59.1.0"');

      runBump(fixtureRoot, "0.59.1");
      expect(readVersionFiles(fixtureRoot)).toEqual(afterFirstRun);
    });
  });

  it("previews all five owners without writing", () => {
    withFixture((fixtureRoot) => {
      const before = readVersionFiles(fixtureRoot);
      const output = runScript(fixtureRoot, "scripts/release/bump-version.ts", ["0.59.1", "--check"]);

      expect(output).toContain("Would update 5 version files");
      for (const relativePath of VERSION_FILES) {
        expect(output).toContain(relativePath);
      }
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
    });
  });

  it("rejects duplicate Cargo.lock owners before writing", () => {
    withFixture((fixtureRoot) => {
      const lockPath = join(fixtureRoot, "src-tauri/Cargo.lock");
      const cargoLock = readFileSync(lockPath, "utf8");
      const owner = cargoLock.match(/\[\[package\]\]\nname = "ultra-rss-reader"\nversion = "[^"]+"/);
      if (!owner) {
        throw new Error("Cargo.lock owner is missing");
      }
      const version = owner[0].match(/version = "([^"]+)"/)?.[1];
      if (!version) {
        throw new Error("Cargo.lock owner version is missing");
      }
      writeFileSync(lockPath, `${cargoLock}\n[[package]]\nversion = "${version}"\nname = "ultra-rss-reader"\n`, "utf8");
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
      expect(() => runParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
      expect(() => runPythonParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
    });
  });

  it("rejects duplicate MSIX Identity owners before writing", () => {
    withFixture((fixtureRoot) => {
      const manifestPath = join(fixtureRoot, "msix/Package.appxmanifest");
      const manifest = readFileSync(manifestPath, "utf8");
      const owner = manifest.match(/<Identity\b[^>]*\/>/)?.[0];
      if (!owner) {
        throw new Error("MSIX Identity owner is missing");
      }
      writeFileSync(manifestPath, manifest.replace("</Package>", `${owner}\n</Package>`), "utf8");
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
    });
  });

  it("rolls back every owner after a mid-commit rename failure", () => {
    withFixture((fixtureRoot) => {
      const changes = VERSION_FILES.map((relativePath) => {
        const path = join(fixtureRoot, relativePath);
        const original = readFileSync(path, "utf8");
        return { path, original, updated: `${original}\n` };
      });
      const before = readVersionFiles(fixtureRoot);
      let shouldFail = true;
      const tauriConfigPath = join(fixtureRoot, "src-tauri/tauri.conf.json");

      expect(() =>
        writeChanges(changes, (source, target) => {
          if (shouldFail && target === tauriConfigPath) {
            shouldFail = false;
            throw new Error("injected rename failure");
          }
          renameSync(source, target);
        }),
      ).toThrow(/injected rename failure/);
      expect(readVersionFiles(fixtureRoot)).toEqual(before);

      const temporaryDirectories = new Set<string>();
      for (const relativePath of VERSION_FILES) {
        const directory = dirname(join(fixtureRoot, relativePath));
        for (const entry of readdirSync(directory)) {
          if (entry.startsWith(".bump-version-")) {
            temporaryDirectories.add(join(directory, entry));
          }
        }
      }
      expect(temporaryDirectories).toHaveLength(0);
    });
  });

  it.each([
    {
      name: "stale",
      mutate: (cargoLock: string) =>
        cargoLock.replace(
          'name = "ultra-rss-reader"\nversion = "0.59.1"',
          'name = "ultra-rss-reader"\nversion = "0.59.0"',
        ),
    },
    {
      name: "missing",
      mutate: (cargoLock: string) =>
        cargoLock.replace('name = "ultra-rss-reader"', 'name = "removed-ultra-rss-reader"'),
    },
    {
      name: "duplicate",
      mutate: (cargoLock: string) => `${cargoLock}\n[[package]]\nname = "ultra-rss-reader"\nversion = "0.59.1"\n`,
    },
  ])("parity rejects a $name Cargo.lock owner", ({ mutate }) => {
    withFixture((fixtureRoot) => {
      runBump(fixtureRoot, "0.59.1");
      const lockPath = join(fixtureRoot, "src-tauri/Cargo.lock");
      writeFileSync(lockPath, mutate(readFileSync(lockPath, "utf8")), "utf8");

      expect(() => runParity(fixtureRoot, "0.59.1")).toThrow();
    });
  });

  it("rejects MSIX-incompatible components before writing", () => {
    withFixture((fixtureRoot) => {
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, "65536.0.0")).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
    });
  });

  it("does not rewrite a later Version attribute when Identity has no owner", () => {
    withFixture((fixtureRoot) => {
      const manifestPath = join(fixtureRoot, "msix/Package.appxmanifest");
      const brokenManifest = readFileSync(manifestPath, "utf8")
        .replace(/(\s+)Version="\d+\.\d+\.\d+\.0"/, "$1")
        .concat('\n<OtherMetadata Version="0.59.0.0" />\n');
      writeFileSync(manifestPath, brokenManifest, "utf8");

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(readFileSync(manifestPath, "utf8")).toBe(brokenManifest);
    });
  });

  it("parity rejects duplicate MSIX Identity elements", () => {
    withFixture((fixtureRoot) => {
      const manifestPath = join(fixtureRoot, "msix/Package.appxmanifest");
      const version = readPackageVersion(fixtureRoot);
      const manifest = readFileSync(manifestPath, "utf8");
      const duplicateIdentity = `  <Identity Name="duplicate" Publisher="CN=test" Version="${version}.0" />\n`;
      writeFileSync(manifestPath, manifest.replace("</Package>", `${duplicateIdentity}</Package>`), "utf8");

      expect(() => runParity(fixtureRoot, version)).toThrow();
    });
  });

  it("parity rejects duplicate MSIX Identity Version attributes", () => {
    withFixture((fixtureRoot) => {
      const manifestPath = join(fixtureRoot, "msix/Package.appxmanifest");
      const version = readPackageVersion(fixtureRoot);
      const manifest = readFileSync(manifestPath, "utf8");
      const identityVersion = `Version="${version}.0"`;
      const duplicateVersionManifest = manifest.replace(identityVersion, `${identityVersion} ${identityVersion}`);
      writeFileSync(manifestPath, duplicateVersionManifest, "utf8");

      expect(() => runParity(fixtureRoot, version)).toThrow();
    });
  });

  it.each([
    {
      name: "package.json",
      relativePath: "package.json",
      ownerPattern: /^ {2}"version": "[^"]+",$/m,
    },
    {
      name: "Cargo.toml",
      relativePath: "src-tauri/Cargo.toml",
      ownerPattern: /^version = "[^"]+"$/m,
    },
    {
      name: "tauri.conf.json",
      relativePath: "src-tauri/tauri.conf.json",
      ownerPattern: /^ {2}"version": "[^"]+",$/m,
    },
  ])("rejects duplicate $name owners before writing and in parity", ({ relativePath, ownerPattern }) => {
    withFixture((fixtureRoot) => {
      const ownerPath = join(fixtureRoot, relativePath);
      const source = readFileSync(ownerPath, "utf8");
      const owner = source.match(ownerPattern)?.[0];
      if (!owner) {
        throw new Error(`${relativePath} owner is missing`);
      }
      writeFileSync(ownerPath, source.replace(owner, `${owner}\n${owner}`), "utf8");
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
      expect(() => runParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
      expect(() => runPythonParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
    });
  });

  it.each(["package.json", "src-tauri/tauri.conf.json"])(
    "rejects noncanonical duplicate JSON version keys in %s",
    (relativePath) => {
      withFixture((fixtureRoot) => {
        const ownerPath = join(fixtureRoot, relativePath);
        const version = readPackageVersion(fixtureRoot);
        const source = readFileSync(ownerPath, "utf8");
        const canonicalOwner = `  "version": "${version}",`;
        if (!source.includes(canonicalOwner)) {
          throw new Error(`${relativePath} owner is missing`);
        }
        writeFileSync(
          ownerPath,
          source.replace(canonicalOwner, `\t"version":"${version}",\n${canonicalOwner}`),
          "utf8",
        );
        const before = readVersionFiles(fixtureRoot);

        expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
        expect(readVersionFiles(fixtureRoot)).toEqual(before);
        expect(() => runParity(fixtureRoot, version)).toThrow();
        expect(() => runPythonParity(fixtureRoot, version)).toThrow();
      });
    },
  );

  it("rejects an escaped duplicate JSON version key", () => {
    withFixture((fixtureRoot) => {
      const ownerPath = join(fixtureRoot, "package.json");
      const version = readPackageVersion(fixtureRoot);
      const source = readFileSync(ownerPath, "utf8");
      const canonicalOwner = `  "version": "${version}",`;
      writeFileSync(
        ownerPath,
        source.replace(canonicalOwner, `  "vers\\u0069on": "${version}",\n${canonicalOwner}`),
        "utf8",
      );
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
      expect(() => runParity(fixtureRoot, version)).toThrow();
      expect(() => runPythonParity(fixtureRoot, version)).toThrow();
    });
  });

  it("rejects a Cargo.toml metadata version when the package owner is missing", () => {
    withFixture((fixtureRoot) => {
      const cargoPath = join(fixtureRoot, "src-tauri/Cargo.toml");
      const source = readFileSync(cargoPath, "utf8");
      const packageVersion = source.match(/^version = "[^"]+"$/m)?.[0];
      if (!packageVersion) {
        throw new Error("Cargo.toml package version is missing");
      }
      writeFileSync(
        cargoPath,
        source.replace(packageVersion, "# package version owner removed") +
          '\n[package.metadata.release]\nversion = "0.59.0"\n',
        "utf8",
      );

      expect(() => runBump(fixtureRoot, "0.59.1")).toThrow();
      expect(() => runParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
      expect(() => runPythonParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
    });
  });
});
