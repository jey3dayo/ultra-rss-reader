import { execFileSync, spawnSync } from "node:child_process";
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
import { run, writeChanges } from "../scripts/release/bump-version.ts";
import { validateReleaseConfig } from "../scripts/release/validate-release-config.ts";

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
  "scripts/release/validate-release-config.ts",
  ".codex/skills/release/scripts/release_checks.py",
] as const;

const baseVersionMatch = readFileSync(resolve("package.json"), "utf8").match(/"version": "([^"]+)"/);
if (!baseVersionMatch) {
  throw new Error("repository package.json version is missing");
}
const BASE_VERSION = baseVersionMatch[1];
const stableVersionMatch = BASE_VERSION.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
if (!stableVersionMatch) {
  throw new Error(`repository package.json version is not stable: ${BASE_VERSION}`);
}
const TARGET_VERSION = `${stableVersionMatch[1]}.${stableVersionMatch[2]}.${Number(stableVersionMatch[3]) + 1}`;

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

const runBump = (fixtureRoot: string, version: string): string[] => run([version], fixtureRoot);

const runParity = (fixtureRoot: string, version: string): void => {
  const errors = validateReleaseConfig({ root: fixtureRoot, releaseTag: `v${version}` });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
};

const PYTHON_PARITY_DRIVER = `
import contextlib, importlib.util, io, json, sys

exit_codes = []
for root, version in zip(sys.argv[1::2], sys.argv[2::2]):
    spec = importlib.util.spec_from_file_location(
        "release_checks", root + "/.codex/skills/release/scripts/release_checks.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.argv = ["release_checks.py", "verify-version", version]
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            exit_codes.append(module.main())
    except Exception:
        exit_codes.append(1)
print(json.dumps(exit_codes))
`;

const runPythonParity = (cases: readonly { fixtureRoot: string; version: string }[]): number[] => {
  const output = execFileSync(
    "python3",
    ["-I", "-c", PYTHON_PARITY_DRIVER, ...cases.flatMap(({ fixtureRoot, version }) => [fixtureRoot, version])],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const exitCodes: unknown = JSON.parse(output);
  if (!Array.isArray(exitCodes) || !exitCodes.every((code): code is number => typeof code === "number")) {
    throw new Error(`unexpected python parity output: ${output}`);
  }
  return exitCodes;
};

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

const replaceInFixture = (fixtureRoot: string, relativePath: string, transform: (source: string) => string): void => {
  const path = join(fixtureRoot, relativePath);
  writeFileSync(path, transform(readFileSync(path, "utf8")), "utf8");
};

const duplicateJsonOwnerCases = [
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
];

const noncanonicalJsonKeyFiles = ["package.json", "src-tauri/tauri.conf.json"] as const;

const rejectedOwnerMutations: readonly { name: string; mutate: (fixtureRoot: string) => void }[] = [
  {
    name: "duplicate Cargo.lock owner",
    mutate: (fixtureRoot) =>
      replaceInFixture(fixtureRoot, "src-tauri/Cargo.lock", (cargoLock) => {
        const version = cargoLock.match(/\[\[package\]\]\nname = "ultra-rss-reader"\nversion = "([^"]+)"/)?.[1];
        if (!version) {
          throw new Error("Cargo.lock owner version is missing");
        }
        return `${cargoLock}\n[[package]]\nversion = "${version}"\nname = "ultra-rss-reader"\n`;
      }),
  },
  ...duplicateJsonOwnerCases.map(({ name, relativePath, ownerPattern }) => ({
    name: `duplicate ${name} owner`,
    mutate: (fixtureRoot: string) =>
      replaceInFixture(fixtureRoot, relativePath, (source) => {
        const owner = source.match(ownerPattern)?.[0];
        if (!owner) {
          throw new Error(`${relativePath} owner is missing`);
        }
        return source.replace(owner, `${owner}\n${owner}`);
      }),
  })),
  ...noncanonicalJsonKeyFiles.map((relativePath) => ({
    name: `noncanonical duplicate JSON version key in ${relativePath}`,
    mutate: (fixtureRoot: string) =>
      replaceInFixture(fixtureRoot, relativePath, (source) => {
        const canonicalOwner = `  "version": "${BASE_VERSION}",`;
        if (!source.includes(canonicalOwner)) {
          throw new Error(`${relativePath} owner is missing`);
        }
        return source.replace(canonicalOwner, `\t"version":"${BASE_VERSION}",\n${canonicalOwner}`);
      }),
  })),
  {
    name: "escaped duplicate JSON version key",
    mutate: (fixtureRoot) =>
      replaceInFixture(fixtureRoot, "package.json", (source) => {
        const canonicalOwner = `  "version": "${BASE_VERSION}",`;
        return source.replace(canonicalOwner, `  "vers\\u0069on": "${BASE_VERSION}",\n${canonicalOwner}`);
      }),
  },
  {
    name: "Cargo.toml metadata version without a package owner",
    mutate: (fixtureRoot) =>
      replaceInFixture(fixtureRoot, "src-tauri/Cargo.toml", (source) => {
        const packageVersion = source.match(/^version = "[^"]+"$/m)?.[0];
        if (!packageVersion) {
          throw new Error("Cargo.toml package version is missing");
        }
        return (
          source.replace(packageVersion, "# package version owner removed") +
          `\n[package.metadata.release]\nversion = "${BASE_VERSION}"\n`
        );
      }),
  },
];

describe("release version bump contract", () => {
  it("updates all five owners, passes parity, and is byte-idempotent", () => {
    withFixture((fixtureRoot) => {
      runBump(fixtureRoot, TARGET_VERSION);
      runParity(fixtureRoot, TARGET_VERSION);

      const afterFirstRun = readVersionFiles(fixtureRoot);
      expect(afterFirstRun["package.json"]).toContain(`"version": "${TARGET_VERSION}"`);
      expect(afterFirstRun["src-tauri/Cargo.lock"]).toContain(
        `name = "ultra-rss-reader"\nversion = "${TARGET_VERSION}"`,
      );
      expect(afterFirstRun["msix/Package.appxmanifest"]).toContain(`Version="${TARGET_VERSION}.0"`);

      runBump(fixtureRoot, TARGET_VERSION);
      expect(readVersionFiles(fixtureRoot)).toEqual(afterFirstRun);
    });
  });

  it("previews all five owners without writing", () => {
    withFixture((fixtureRoot) => {
      const before = readVersionFiles(fixtureRoot);
      const output = run([TARGET_VERSION, "--check"], fixtureRoot).join("\n");

      expect(output).toContain("Would update 5 version files");
      for (const relativePath of VERSION_FILES) {
        expect(output).toContain(relativePath);
      }
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
    });
  });

  it("runs the bump and validate-release-config CLIs with their exit codes and messages", () => {
    withFixture((fixtureRoot) => {
      const bump = spawnSync(process.execPath, ["scripts/release/bump-version.ts", TARGET_VERSION], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(bump.status).toBe(0);
      expect(bump.stdout).toContain(`Updated 5 version files: ${BASE_VERSION} -> ${TARGET_VERSION}`);

      const invalidBump = spawnSync(process.execPath, ["scripts/release/bump-version.ts", "not-a-version"], {
        cwd: fixtureRoot,
        encoding: "utf8",
      });
      expect(invalidBump.status).toBe(1);
      expect(invalidBump.stderr).toContain("invalid stable semantic version: not-a-version");

      const validate = (releaseTag: string) =>
        spawnSync(process.execPath, ["scripts/release/validate-release-config.ts"], {
          cwd: fixtureRoot,
          encoding: "utf8",
          env: { ...process.env, RELEASE_TAG: releaseTag },
        });
      expect(validate(`v${TARGET_VERSION}`).status).toBe(0);

      const mismatched = validate(`v${BASE_VERSION}`);
      expect(mismatched.status).toBe(1);
      expect(mismatched.stderr).toContain(
        `::error::release tag v${BASE_VERSION} does not match package.json version v${TARGET_VERSION}`,
      );
    });
  }, 60_000);

  it.each(rejectedOwnerMutations)("rejects $name before writing and in TS parity", ({ mutate }) => {
    withFixture((fixtureRoot) => {
      mutate(fixtureRoot);
      const before = readVersionFiles(fixtureRoot);

      expect(() => runBump(fixtureRoot, TARGET_VERSION)).toThrow();
      expect(readVersionFiles(fixtureRoot)).toEqual(before);
      expect(() => runParity(fixtureRoot, readPackageVersion(fixtureRoot))).toThrow();
    });
  });

  it("python verify-version agrees with TS parity on every rejected owner mutation", () => {
    const fixtures: string[] = [];
    try {
      const cleanFixture = createFixture();
      fixtures.push(cleanFixture);
      const mutatedFixtures = rejectedOwnerMutations.map(({ mutate }) => {
        const fixtureRoot = createFixture();
        fixtures.push(fixtureRoot);
        mutate(fixtureRoot);
        return fixtureRoot;
      });

      const exitCodes = runPythonParity([
        { fixtureRoot: cleanFixture, version: BASE_VERSION },
        ...mutatedFixtures.map((fixtureRoot) => ({ fixtureRoot, version: BASE_VERSION })),
      ]);

      expect(exitCodes).toEqual([0, ...mutatedFixtures.map(() => 1)]);
    } finally {
      for (const fixtureRoot of fixtures) {
        rmSync(fixtureRoot, { recursive: true, force: true });
      }
    }
  });

  it.each([
    {
      name: "without whitespace around equals",
      owner: `version="${BASE_VERSION}"`,
      updatedOwner: `version="${TARGET_VERSION}"`,
    },
    {
      name: "with multiple spaces around equals",
      owner: `version  =  "${BASE_VERSION}"`,
      updatedOwner: `version  =  "${TARGET_VERSION}"`,
    },
  ])("updates a Cargo.lock owner $name", ({ owner, updatedOwner }) => {
    withFixture((fixtureRoot) => {
      const lockPath = join(fixtureRoot, "src-tauri/Cargo.lock");
      const source = readFileSync(lockPath, "utf8");
      const mutatedSource = source.replace(
        /(\[\[package\]\]\nname = "ultra-rss-reader"\n)version = "([^"]+)"/,
        `$1${owner}`,
      );
      writeFileSync(lockPath, mutatedSource, "utf8");

      runBump(fixtureRoot, TARGET_VERSION);
      expect(readFileSync(lockPath, "utf8")).toContain(`name = "ultra-rss-reader"\n${updatedOwner}`);
      expect(() => runParity(fixtureRoot, TARGET_VERSION)).not.toThrow();
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

      expect(() => runBump(fixtureRoot, TARGET_VERSION)).toThrow();
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
          `name = "ultra-rss-reader"\nversion = "${TARGET_VERSION}"`,
          `name = "ultra-rss-reader"\nversion = "${BASE_VERSION}"`,
        ),
    },
    {
      name: "missing",
      mutate: (cargoLock: string) =>
        cargoLock.replace('name = "ultra-rss-reader"', 'name = "removed-ultra-rss-reader"'),
    },
    {
      name: "duplicate",
      mutate: (cargoLock: string) =>
        `${cargoLock}\n[[package]]\nname = "ultra-rss-reader"\nversion = "${TARGET_VERSION}"\n`,
    },
  ])("parity rejects a $name Cargo.lock owner", ({ mutate }) => {
    withFixture((fixtureRoot) => {
      runBump(fixtureRoot, TARGET_VERSION);
      const lockPath = join(fixtureRoot, "src-tauri/Cargo.lock");
      writeFileSync(lockPath, mutate(readFileSync(lockPath, "utf8")), "utf8");

      expect(() => runParity(fixtureRoot, TARGET_VERSION)).toThrow();
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
        .concat(`\n<OtherMetadata Version="${BASE_VERSION}.0" />\n`);
      writeFileSync(manifestPath, brokenManifest, "utf8");

      expect(() => runBump(fixtureRoot, TARGET_VERSION)).toThrow();
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
});
