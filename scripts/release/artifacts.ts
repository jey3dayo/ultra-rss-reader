import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type ReleaseAssetContract = {
  assetPattern: string;
  artifactArch: string;
  artifactPlatform: string;
  checksumPattern: string;
  matrixArgs: string;
  matrixPlatform: string;
  platformKey: string;
  signaturePattern: string;
};

type PackageJson = {
  version?: string;
};

type GitHubReleaseAsset = {
  name: string;
};

type GitHubReleaseView = {
  assets: GitHubReleaseAsset[];
  isDraft: boolean;
  isPrerelease: boolean;
  tagName: string;
  url: string;
};

export const RELEASE_UPDATER_ASSET_CONTRACT: readonly ReleaseAssetContract[] = [
  {
    assetPattern: ".app.tar.gz",
    artifactArch: "aarch64",
    artifactPlatform: "darwin",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
    platformKey: "darwin-aarch64",
    signaturePattern: ".app.tar.gz.sig",
  },
  {
    assetPattern: "-setup.exe",
    artifactArch: "x86_64",
    artifactPlatform: "windows",
    checksumPattern: "-setup.exe.sha256",
    matrixArgs: '""',
    matrixPlatform: "windows-latest",
    platformKey: "windows-x86_64",
    signaturePattern: "-setup.exe.sig",
  },
];

export const UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"] as const;

const RUNNER_TO_MATRIX_PLATFORM: Readonly<Record<string, string>> = {
  macOS: "macos-latest",
  Windows: "windows-latest",
};

const RUNNER_TO_ASSET_PLATFORM: Readonly<Record<string, string>> = {
  macOS: "darwin-aarch64",
  Windows: "windows-x86_64",
};

const CHECKSUM_ASSETS_LIST = "src-tauri/target/updater-checksum-assets.txt";
const DEPENDENCY_PROVENANCE_ASSETS_LIST = "src-tauri/target/release-dependency-provenance-assets.txt";
const RELEASE_PROVENANCE_ASSETS_LIST = "src-tauri/target/release-provenance-assets.txt";
const RELEASE_PROVENANCE_DIR = "src-tauri/target/release-provenance";

const fail = (message: string): never => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const validateStaticAssetContract = (): void => {
  const platformKeys = RELEASE_UPDATER_ASSET_CONTRACT.map((contract) => contract.platformKey);
  if (platformKeys.length !== new Set(platformKeys).size) {
    fail("latest.json updater manifest must map exactly to the release asset contract without duplicate platforms");
  }
  for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
    if (contract.signaturePattern !== `${contract.assetPattern}.sig`) {
      fail(`updater platform ${contract.platformKey} signature sidecar must map to ${contract.assetPattern}.sig`);
    }
    if (contract.checksumPattern !== `${contract.assetPattern}.sha256`) {
      fail(`updater platform ${contract.platformKey} checksum sidecar must map to ${contract.assetPattern}.sha256`);
    }
  }
  for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
    if (platformKeys.includes(unsupportedPlatformKey)) {
      fail(`latest.json updater manifest must not include unsupported future platform ${unsupportedPlatformKey}`);
    }
  }
};

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  return value || fail(`missing required environment variable ${key}`);
};

const readList = (filePath: string): string[] => readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);

const listFiles = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
};

const listDirectories = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? [entryPath, ...listDirectories(entryPath)] : [];
  });
};

const currentContract = (): ReleaseAssetContract => {
  const matrixPlatform = RUNNER_TO_MATRIX_PLATFORM[process.env.RUNNER_OS ?? ""];
  const contract = RELEASE_UPDATER_ASSET_CONTRACT.find((item) => item.matrixPlatform === matrixPlatform);
  return contract ?? fail(`missing updater asset contract for runner ${process.env.RUNNER_OS ?? "(unknown)"}`);
};

const currentAssetPlatform = (label: string): string => {
  const assetPlatform = RUNNER_TO_ASSET_PLATFORM[process.env.RUNNER_OS ?? ""];
  return assetPlatform || fail(`missing ${label} platform for runner ${process.env.RUNNER_OS ?? "(unknown)"}`);
};

const bundleRoots = (contract: ReleaseAssetContract): string[] => {
  const targetTriple = contract.matrixArgs.startsWith("--target ")
    ? contract.matrixArgs.slice("--target ".length)
    : null;
  return [
    "src-tauri/target/release/bundle",
    path.join("src-tauri/target", contract.platformKey, "release/bundle"),
    ...(targetTriple ? [path.join("src-tauri/target", targetTriple, "release/bundle")] : []),
  ];
};

const findUpdaterAssets = (contract: ReleaseAssetContract): string[] =>
  bundleRoots(contract)
    .flatMap(listFiles)
    .filter(
      (filePath) =>
        filePath.endsWith(contract.assetPattern) &&
        !filePath.endsWith(contract.signaturePattern) &&
        !filePath.endsWith(contract.checksumPattern),
    );

const validateUpdaterAssets = (): void => {
  const contract = currentContract();
  const bundleFiles = bundleRoots(contract).flatMap(listFiles);
  const updaterAssets = findUpdaterAssets(contract);

  if (updaterAssets.length !== 1) {
    fail(
      `updater platform ${contract.platformKey} must produce exactly one ${contract.assetPattern} asset, found ${updaterAssets.length}`,
    );
  }

  const signatureAsset = `${updaterAssets[0]}.sig`;
  if (!existsSync(signatureAsset)) {
    fail(`updater platform ${contract.platformKey} is missing signature sidecar ${signatureAsset}`);
  }

  for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
    if (bundleFiles.some((filePath) => filePath.includes(unsupportedPlatformKey))) {
      fail(`unexpected future updater platform artifact present: ${unsupportedPlatformKey}`);
    }
  }
};

const runVerification = (command: string, args: readonly string[]): void => {
  const result = spawnSync(command, [...args], { encoding: "utf8" });
  if (result.status === 0) {
    return;
  }

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  fail(`${command} ${args.join(" ")} failed`);
};

const validateMacosAppSignature = (): void => {
  if (process.env.RUNNER_OS !== "macOS") {
    fail("macOS app signature validation must run on macOS");
  }

  const contract = currentContract();
  if (contract.platformKey !== "darwin-aarch64") {
    fail(`macOS app signature validation cannot run for ${contract.platformKey}`);
  }

  const appBundles = bundleRoots(contract)
    .flatMap(listDirectories)
    .filter((directoryPath) => directoryPath.endsWith(".app"));

  if (appBundles.length !== 1) {
    fail(`macOS release must produce exactly one .app bundle, found ${appBundles.length}`);
  }

  const appBundle = appBundles[0];
  runVerification("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]);

  const hasNotarizationCredentials = Boolean(
    process.env.APPLE_SIGNING_IDENTITY &&
      process.env.APPLE_ID &&
      process.env.APPLE_PASSWORD &&
      process.env.APPLE_TEAM_ID,
  );
  if (!hasNotarizationCredentials) {
    console.log(
      "Skipping Gatekeeper notarization assessment because Apple notarization credentials are not configured",
    );
    return;
  }

  runVerification("spctl", ["--assess", "--type", "execute", "--verbose=4", appBundle]);
};

const generateUpdaterChecksums = (): void => {
  const contract = currentContract();
  const updaterAsset = findUpdaterAssets(contract)[0];
  if (!updaterAsset) {
    fail(`missing updater asset for ${contract.platformKey}`);
  }

  const checksum = createHash("sha256").update(readFileSync(updaterAsset)).digest("hex");
  const checksumAsset = `${updaterAsset}.sha256`;
  writeFileSync(checksumAsset, `${checksum}  ${path.basename(updaterAsset)}\n`);
  mkdirSync("src-tauri/target", { recursive: true });
  writeFileSync(CHECKSUM_ASSETS_LIST, `${checksumAsset}\n`);
};

const generateDependencyProvenance = (): void => {
  const assetPlatform = currentAssetPlatform("dependency provenance");
  mkdirSync(RELEASE_PROVENANCE_DIR, { recursive: true });
  const assets = [
    ["tmp/dependency-licenses/pnpm-licenses.json", `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-${assetPlatform}.json`],
    ["tmp/dependency-licenses/cargo-licenses.json", `${RELEASE_PROVENANCE_DIR}/cargo-licenses-${assetPlatform}.json`],
  ] as const;

  for (const [source, destination] of assets) {
    if (!existsSync(source)) {
      fail(`missing dependency provenance source ${source}`);
    }
    copyFileSync(source, destination);
  }

  writeFileSync(DEPENDENCY_PROVENANCE_ASSETS_LIST, `${assets.map(([, destination]) => destination).join("\n")}\n`);
};

const git = (args: readonly string[]): string =>
  execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const generateReleaseProvenance = (): void => {
  const matrixPlatform = RUNNER_TO_MATRIX_PLATFORM[process.env.RUNNER_OS ?? ""];
  const assetPlatform = currentAssetPlatform("release provenance");
  if (!matrixPlatform) {
    fail(`missing release provenance matrix platform for runner ${process.env.RUNNER_OS ?? "(unknown)"}`);
  }

  const checksumAssets = readList(CHECKSUM_ASSETS_LIST);
  const dependencyAssets = readList(DEPENDENCY_PROVENANCE_ASSETS_LIST);
  if (checksumAssets.length !== 1) {
    fail(`expected exactly one updater checksum asset, found ${checksumAssets.length}`);
  }
  if (dependencyAssets.length !== 2) {
    fail(`expected exactly two dependency provenance assets, found ${dependencyAssets.length}`);
  }

  const checksumAsset = checksumAssets[0];
  const checksumContent = readFileSync(checksumAsset, "utf8").trim();
  const [artifactSha256, artifactName] = checksumContent.split(/\s+/, 2);
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
  const releaseTag = requiredEnv("RELEASE_TAG");
  const sourceSha = git(["rev-parse", "HEAD"]);
  const tagTargetSha = git(["rev-parse", `refs/tags/${releaseTag}^{}`]);
  const mergeCommitSubject = git(["log", "-1", "--format=%s", sourceSha]);
  const pullRequestNumber = mergeCommitSubject.match(/\(#(?<number>\d+)\)$/)?.groups?.number ?? null;
  const workflowRunUrl = `${requiredEnv("GITHUB_SERVER_URL")}/${requiredEnv("GITHUB_REPOSITORY")}/actions/runs/${requiredEnv("GITHUB_RUN_ID")}`;
  const record = {
    artifact: {
      checksumAssetName: path.basename(checksumAsset),
      name: artifactName,
      sha256: artifactSha256,
    },
    dependencyProvenanceAssets: dependencyAssets.map((asset) => path.basename(asset)),
    packageVersion: packageJson.version,
    releaseTag,
    runner: {
      assetPlatform,
      matrixPlatform,
      os: process.env.RUNNER_OS,
    },
    pullRequest: {
      mergeCommitSubject,
      number: pullRequestNumber,
    },
    source: {
      commitSha: sourceSha,
      tagTargetSha,
    },
    workflow: {
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      refName: process.env.GITHUB_REF_NAME,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      runId: process.env.GITHUB_RUN_ID,
      runUrl: workflowRunUrl,
      workflow: process.env.GITHUB_WORKFLOW,
    },
  };
  const recordPath = `${RELEASE_PROVENANCE_DIR}/release-provenance-${assetPlatform}.json`;
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(RELEASE_PROVENANCE_ASSETS_LIST, `${recordPath}\n`);

  if (!/^[a-f0-9]{64}$/i.test(artifactSha256)) {
    fail(`invalid updater checksum digest for ${artifactName}`);
  }
  if (sourceSha !== tagTargetSha) {
    fail(`release provenance source ${sourceSha} does not match tag target ${tagTargetSha}`);
  }
};

const inspectReleaseAssets = (label: string, expectedAssetNames: readonly string[]): void => {
  const view = spawnSync(
    "gh",
    ["release", "view", requiredEnv("RELEASE_TAG"), "--json", "assets,isDraft,isPrerelease,tagName,url"],
    { encoding: "utf8" },
  );
  if (view.status !== 0) {
    console.error(`::error::failed to inspect release asset inventory before ${label}`);
    process.stderr.write(view.stderr ?? "");
    process.exit(view.status ?? 1);
  }

  const release = JSON.parse(view.stdout) as GitHubReleaseView;
  const uploadedNames = new Set(release.assets.map((asset) => asset.name));
  const clobberTargets = expectedAssetNames.filter((name) => uploadedNames.has(name));
  const missingAssets = expectedAssetNames.filter((name) => !uploadedNames.has(name));
  console.log(
    `::notice::${label} release asset inventory tag=${release.tagName} draft=${release.isDraft} prerelease=${release.isPrerelease} clobber_targets=${clobberTargets.join(",") || "(none)"} missing_assets=${missingAssets.join(",") || "(none)"} url=${release.url}`,
  );
};

const uploadAssets = (label: string, failureLabel: string, assets: readonly string[]): void => {
  const expectedAssetNames = assets.map((asset) => asset.split(/[\\/]/).at(-1) ?? asset);
  inspectReleaseAssets(label, expectedAssetNames);
  const result = spawnSync("gh", ["release", "upload", requiredEnv("RELEASE_TAG"), ...assets, "--clobber"], {
    stdio: "inherit",
  });
  if ((result.status ?? 1) !== 0) {
    inspectReleaseAssets(failureLabel, expectedAssetNames);
  }
  process.exit(result.status ?? 1);
};

const uploadUpdaterChecksums = (): void => {
  const checksumAssets = readList(CHECKSUM_ASSETS_LIST);
  if (checksumAssets.length !== 1) {
    fail(`expected exactly one updater checksum asset, found ${checksumAssets.length}`);
  }
  uploadAssets("checksum upload", "checksum upload failure recovery", checksumAssets);
};

const uploadReleaseProvenance = (): void => {
  const provenanceAssets = [
    ...readList(DEPENDENCY_PROVENANCE_ASSETS_LIST),
    ...readList(RELEASE_PROVENANCE_ASSETS_LIST),
  ];
  if (provenanceAssets.length !== 3) {
    fail(`expected three release provenance assets, found ${provenanceAssets.length}`);
  }
  uploadAssets("provenance upload", "provenance upload failure recovery", provenanceAssets);
};

const command = process.argv[2];
validateStaticAssetContract();

switch (command) {
  case "validate-updater-assets":
    validateUpdaterAssets();
    break;
  case "validate-macos-app-signature":
    validateMacosAppSignature();
    break;
  case "generate-updater-checksums":
    generateUpdaterChecksums();
    break;
  case "generate-dependency-provenance":
    generateDependencyProvenance();
    break;
  case "generate-release-provenance":
    generateReleaseProvenance();
    break;
  case "upload-updater-checksums":
    uploadUpdaterChecksums();
    break;
  case "upload-release-provenance":
    uploadReleaseProvenance();
    break;
  default:
    fail(
      `unknown release artifacts command ${command ?? "(missing)"}; expected validate-updater-assets, validate-macos-app-signature, generate-updater-checksums, generate-dependency-provenance, generate-release-provenance, upload-updater-checksums, or upload-release-provenance`,
    );
}
