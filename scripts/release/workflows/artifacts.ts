import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  bundleRoots,
  currentAssetContract,
  currentAssetPlatform,
  type ReleaseAssetContract,
  UNSUPPORTED_UPDATER_PLATFORM_KEYS,
} from "../lib/artifact-contract.ts";
import {
  type ArtifactBundleTree,
  findAppBundles,
  findUpdaterAssets,
  type GitHubReleaseView,
  parseAssetPathList,
  parseGitHubReleaseView,
} from "../lib/artifact-inventory.ts";
import {
  buildReleaseProvenanceRecord,
  CHECKSUM_ASSETS_LIST,
  DEPENDENCY_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_DIR,
} from "../lib/release-provenance.ts";
import { expectedReleaseAssetNames } from "../release-artifact-contract.ts";

const RELEASE_VIEW_FIELDS = "assets,isDraft,isPrerelease,tagName,url";

type DirectoryEntry = {
  isDirectory: boolean;
  name: string;
};

type CommandResult = {
  status: number | null;
  stderr: string | null;
  stdout: string | null;
};

type UploadResult = {
  status: number | null;
};

export type ArtifactWorkflowIO = {
  copyFile: (source: string, destination: string) => void;
  error: (message: string) => void;
  exists: (filePath: string) => boolean;
  exit: (status: number) => never;
  git: (args: readonly string[]) => string;
  listDirectory: (directory: string) => readonly DirectoryEntry[];
  log: (message: string) => void;
  makeDirectory: (directory: string) => void;
  readFile: (filePath: string) => Uint8Array;
  readTextFile: (filePath: string) => string;
  stderr: (output: string) => void;
  stdout: (output: string) => void;
  uploadReleaseAssetsWithClobber: (tag: string, assets: readonly string[]) => UploadResult;
  verifyCommand: (command: string, args: readonly string[]) => CommandResult;
  viewRelease: (tag: string) => CommandResult;
  writeFile: (filePath: string, content: string | Uint8Array) => void;
};

const nodeArtifactWorkflowIO: ArtifactWorkflowIO = {
  copyFile: (source, destination) => copyFileSync(source, destination),
  error: (message) => console.error(message),
  exists: (filePath) => existsSync(filePath),
  exit: (status) => process.exit(status),
  git: (args) => execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
  listDirectory: (directory) =>
    readdirSync(directory, { withFileTypes: true }).map((entry) => ({
      isDirectory: entry.isDirectory(),
      name: entry.name,
    })),
  log: (message) => console.log(message),
  makeDirectory: (directory) => mkdirSync(directory, { recursive: true }),
  readFile: (filePath) => readFileSync(filePath),
  readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  stderr: (output) => process.stderr.write(output),
  stdout: (output) => process.stdout.write(output),
  uploadReleaseAssetsWithClobber: (tag, assets) => {
    const result = spawnSync("gh", ["release", "upload", tag, ...assets, "--clobber"], { stdio: "inherit" });
    return { status: result.status };
  },
  verifyCommand: (command, args) => {
    const result = spawnSync(command, [...args], { encoding: "utf8" });
    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
  },
  viewRelease: (tag) => {
    const result = spawnSync("gh", ["release", "view", tag, "--json", RELEASE_VIEW_FIELDS], {
      encoding: "utf8",
    });
    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
  },
  writeFile: (filePath, content) => writeFileSync(filePath, content),
};

export const productionArtifactWorkflowIO = nodeArtifactWorkflowIO;

const requiredEnv = (key: string, env: Readonly<Record<string, string | undefined>>): string => {
  const value = env[key];
  if (!value) {
    throw new Error(`missing required environment variable ${key}`);
  }
  return value;
};

const readAssetPathList = (filePath: string, io: ArtifactWorkflowIO): string[] =>
  parseAssetPathList(io.readTextFile(filePath));

const collectBundleTree = (roots: readonly string[], io: ArtifactWorkflowIO): ArtifactBundleTree => {
  const files: string[] = [];
  const directories: string[] = [];
  const readDirectory = (directory: string): void => {
    for (const entry of io.listDirectory(directory)) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory) {
        directories.push(entryPath);
        readDirectory(entryPath);
      } else {
        files.push(entryPath);
      }
    }
  };

  for (const root of roots) {
    if (io.exists(root)) {
      readDirectory(root);
    }
  }

  return { directories, files };
};

const bundleTreeFor = (contract: ReleaseAssetContract, io: ArtifactWorkflowIO): ArtifactBundleTree =>
  collectBundleTree(bundleRoots(contract), io);

const validateUpdaterAssets = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  const contract = currentAssetContract(env);
  const bundleTree = bundleTreeFor(contract, io);
  const updaterAssets = findUpdaterAssets(bundleTree.files, contract);

  if (updaterAssets.length !== 1) {
    throw new Error(
      `updater platform ${contract.platformKey} must produce exactly one ${contract.assetPattern} asset, found ${updaterAssets.length}`,
    );
  }

  const signatureAsset = `${updaterAssets[0]}.sig`;
  if (!io.exists(signatureAsset)) {
    throw new Error(`updater platform ${contract.platformKey} is missing signature sidecar ${signatureAsset}`);
  }

  for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
    if (bundleTree.files.some((filePath) => filePath.includes(unsupportedPlatformKey))) {
      throw new Error(`unexpected future updater platform artifact present: ${unsupportedPlatformKey}`);
    }
  }
};

const runVerification = (command: string, args: readonly string[], io: ArtifactWorkflowIO): void => {
  const result = io.verifyCommand(command, args);
  if (result.status === 0) {
    return;
  }

  io.stdout(result.stdout ?? "");
  io.stderr(result.stderr ?? "");
  throw new Error(`${command} ${args.join(" ")} failed`);
};

const validateMacosAppSignature = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  if (env.RUNNER_OS !== "macOS") {
    throw new Error("macOS app signature validation must run on macOS");
  }

  const contract = currentAssetContract(env);
  if (contract.platformKey !== "darwin-aarch64") {
    throw new Error(`macOS app signature validation cannot run for ${contract.platformKey}`);
  }

  const appBundles = findAppBundles(bundleTreeFor(contract, io).directories);
  if (appBundles.length !== 1) {
    throw new Error(`macOS release must produce exactly one .app bundle, found ${appBundles.length}`);
  }

  const appBundle = appBundles[0];
  runVerification("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle], io);

  const hasNotarizationCredentials = Boolean(
    env.APPLE_SIGNING_IDENTITY && env.APPLE_ID && env.APPLE_PASSWORD && env.APPLE_TEAM_ID,
  );
  if (!hasNotarizationCredentials) {
    io.log("Skipping Gatekeeper notarization assessment because Apple notarization credentials are not configured");
    return;
  }

  runVerification("spctl", ["--assess", "--type", "execute", "--verbose=4", appBundle], io);
};

const generateUpdaterChecksums = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  const contract = currentAssetContract(env);
  const updaterAsset = findUpdaterAssets(bundleTreeFor(contract, io).files, contract)[0];
  if (!updaterAsset) {
    throw new Error(`missing updater asset for ${contract.platformKey}`);
  }

  const checksum = createHash("sha256").update(io.readFile(updaterAsset)).digest("hex");
  const checksumAsset = `${updaterAsset}.sha256`;
  io.writeFile(checksumAsset, `${checksum}  ${path.basename(updaterAsset)}\n`);
  io.makeDirectory("src-tauri/target");
  io.writeFile(CHECKSUM_ASSETS_LIST, `${checksumAsset}\n`);
};

const generateDependencyProvenance = (
  env: Readonly<Record<string, string | undefined>>,
  io: ArtifactWorkflowIO,
): void => {
  const assetPlatform = currentAssetPlatform("dependency provenance", env);
  io.makeDirectory(RELEASE_PROVENANCE_DIR);
  const assets = [
    ["tmp/dependency-licenses/pnpm-licenses.json", `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-${assetPlatform}.json`],
    ["tmp/dependency-licenses/cargo-licenses.json", `${RELEASE_PROVENANCE_DIR}/cargo-licenses-${assetPlatform}.json`],
  ] as const;

  for (const [source, destination] of assets) {
    if (!io.exists(source)) {
      throw new Error(`missing dependency provenance source ${source}`);
    }
    io.copyFile(source, destination);
  }

  io.writeFile(DEPENDENCY_PROVENANCE_ASSETS_LIST, `${assets.map(([, destination]) => destination).join("\n")}\n`);
};

const generateReleaseProvenance = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  const built = buildReleaseProvenanceRecord({
    env,
    git: io.git,
    readFile: io.readTextFile,
  });
  const { assetPlatform, record } = built;
  const recordPath = `${RELEASE_PROVENANCE_DIR}/release-provenance-${assetPlatform}.json`;
  io.writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  io.writeFile(RELEASE_PROVENANCE_ASSETS_LIST, `${recordPath}\n`);

  const { commitSha: sourceSha, tagTargetSha } = record.source;
  if (sourceSha !== tagTargetSha) {
    throw new Error(`release provenance source ${sourceSha} does not match tag target ${tagTargetSha}`);
  }
};

const releaseView = (tag: string, io: ArtifactWorkflowIO): GitHubReleaseView => {
  const result = io.viewRelease(tag);
  if (result.status !== 0) {
    io.stderr(result.stderr ?? "");
    io.exit(result.status ?? 1);
  }
  return parseGitHubReleaseView(JSON.parse(result.stdout ?? ""));
};

const inspectReleaseAssets = (
  label: string,
  expectedAssetNames: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: ArtifactWorkflowIO,
): void => {
  const tag = requiredEnv("RELEASE_TAG", env);
  const result = io.viewRelease(tag);
  if (result.status !== 0) {
    io.error(`::error::failed to inspect release asset inventory before ${label}`);
    io.stderr(result.stderr ?? "");
    io.exit(result.status ?? 1);
  }

  const release = parseGitHubReleaseView(JSON.parse(result.stdout ?? ""));
  const uploadedNames = new Set(release.assets.map((asset) => asset.name));
  const clobberTargets = expectedAssetNames.filter((name) => uploadedNames.has(name));
  const missingAssets = expectedAssetNames.filter((name) => !uploadedNames.has(name));
  io.log(
    `::notice::${label} release asset inventory tag=${release.tagName} draft=${release.isDraft} prerelease=${release.isPrerelease} clobber_targets=${clobberTargets.join(",") || "(none)"} missing_assets=${missingAssets.join(",") || "(none)"} url=${release.url}`,
  );
};

const uploadAssets = (
  label: string,
  failureLabel: string,
  assets: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: ArtifactWorkflowIO,
): void => {
  const tag = requiredEnv("RELEASE_TAG", env);
  const expectedAssetNames = assets.map((asset) => asset.split(/[\\/]/).at(-1) ?? asset);
  inspectReleaseAssets(label, expectedAssetNames, env, io);
  const result = io.uploadReleaseAssetsWithClobber(tag, assets);
  if ((result.status ?? 1) !== 0) {
    inspectReleaseAssets(failureLabel, expectedAssetNames, env, io);
  }
  io.exit(result.status ?? 1);
};

const uploadUpdaterChecksums = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  const checksumAssets = readAssetPathList(CHECKSUM_ASSETS_LIST, io);
  if (checksumAssets.length !== 1) {
    throw new Error(`expected exactly one updater checksum asset, found ${checksumAssets.length}`);
  }
  uploadAssets("checksum upload", "checksum upload failure recovery", checksumAssets, env, io);
};

const uploadReleaseProvenance = (env: Readonly<Record<string, string | undefined>>, io: ArtifactWorkflowIO): void => {
  const provenanceAssets = [
    ...readAssetPathList(DEPENDENCY_PROVENANCE_ASSETS_LIST, io),
    ...readAssetPathList(RELEASE_PROVENANCE_ASSETS_LIST, io),
  ];
  if (provenanceAssets.length !== 3) {
    throw new Error(`expected three release provenance assets, found ${provenanceAssets.length}`);
  }
  uploadAssets("provenance upload", "provenance upload failure recovery", provenanceAssets, env, io);
};

const validateExistingReleaseAssets = (
  env: Readonly<Record<string, string | undefined>>,
  io: ArtifactWorkflowIO,
): void => {
  const releaseTag = requiredEnv("RELEASE_TAG", env);
  const release = releaseView(releaseTag, io);
  const expectedAssetNames = expectedReleaseAssetNames(releaseTag);
  const uploadedNames = release.assets.map((asset) => asset.name);
  const uploadedNameSet = new Set(uploadedNames);
  const duplicateNames = uploadedNames.filter((name, index) => uploadedNames.indexOf(name) !== index);
  const missingAssets = expectedAssetNames.filter((name) => !uploadedNameSet.has(name));
  const expectedPrerelease = releaseTag.includes("-");

  if (release.tagName !== releaseTag) {
    throw new Error(`release inventory tag ${release.tagName} does not match ${releaseTag}`);
  }
  if (!release.isDraft) {
    throw new Error(`release ${releaseTag} must remain draft before manual publish`);
  }
  if (release.isPrerelease !== expectedPrerelease) {
    throw new Error(`release ${releaseTag} prerelease=${release.isPrerelease} does not match tag policy`);
  }
  if (duplicateNames.length > 0) {
    throw new Error(`release ${releaseTag} has duplicate assets: ${duplicateNames.join(",")}`);
  }
  if (missingAssets.length > 0) {
    throw new Error(`release ${releaseTag} is missing expected assets: ${missingAssets.join(",")}`);
  }

  io.log(
    `::notice::existing draft release asset inventory tag=${release.tagName} draft=${release.isDraft} prerelease=${release.isPrerelease} expected_assets=${expectedAssetNames.length} uploaded_assets=${uploadedNames.length} url=${release.url}`,
  );
};

export const runArtifactWorkflow = (
  command: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
  io: ArtifactWorkflowIO = nodeArtifactWorkflowIO,
): void => {
  switch (command) {
    case "validate-updater-assets":
      validateUpdaterAssets(env, io);
      return;
    case "validate-macos-app-signature":
      validateMacosAppSignature(env, io);
      return;
    case "generate-updater-checksums":
      generateUpdaterChecksums(env, io);
      return;
    case "generate-dependency-provenance":
      generateDependencyProvenance(env, io);
      return;
    case "generate-release-provenance":
      generateReleaseProvenance(env, io);
      return;
    case "upload-updater-checksums":
      uploadUpdaterChecksums(env, io);
      return;
    case "upload-release-provenance":
      uploadReleaseProvenance(env, io);
      return;
    case "validate-existing-release-assets":
      validateExistingReleaseAssets(env, io);
      return;
    default:
      throw new Error(
        `unknown release artifacts command ${command ?? "(missing)"}; expected validate-updater-assets, validate-macos-app-signature, generate-updater-checksums, generate-dependency-provenance, generate-release-provenance, upload-updater-checksums, upload-release-provenance, validate-existing-release-assets, or verify-draft-release`,
      );
  }
};
