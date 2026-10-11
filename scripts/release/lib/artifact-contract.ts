import path from "node:path";

export type ReleaseAssetContract = {
  assetPattern: string;
  artifactArch: string;
  artifactPlatform: string;
  checksumPattern: string;
  matrixArgs: string;
  matrixPlatform: string;
  platformKey: string;
  signaturePattern: string;
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

export const matrixPlatformForRunner = (runnerOs: string | undefined): string | undefined =>
  runnerOs === undefined ? undefined : RUNNER_TO_MATRIX_PLATFORM[runnerOs];

export const validateStaticAssetContract = (): void => {
  const platformKeys = RELEASE_UPDATER_ASSET_CONTRACT.map((contract) => contract.platformKey);
  if (platformKeys.length !== new Set(platformKeys).size) {
    throw new Error(
      "latest.json updater manifest must map exactly to the release asset contract without duplicate platforms",
    );
  }
  for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
    if (contract.signaturePattern !== `${contract.assetPattern}.sig`) {
      throw new Error(
        `updater platform ${contract.platformKey} signature sidecar must map to ${contract.assetPattern}.sig`,
      );
    }
    if (contract.checksumPattern !== `${contract.assetPattern}.sha256`) {
      throw new Error(
        `updater platform ${contract.platformKey} checksum sidecar must map to ${contract.assetPattern}.sha256`,
      );
    }
  }
  for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
    if (platformKeys.includes(unsupportedPlatformKey)) {
      throw new Error(
        `latest.json updater manifest must not include unsupported future platform ${unsupportedPlatformKey}`,
      );
    }
  }
};

export const currentAssetContract = (env: Readonly<Record<string, string | undefined>>): ReleaseAssetContract => {
  const runnerOs = env.RUNNER_OS;
  const contract = RELEASE_UPDATER_ASSET_CONTRACT.find(
    (item) => item.matrixPlatform === matrixPlatformForRunner(runnerOs),
  );
  if (!contract) {
    throw new Error(`missing updater asset contract for runner ${runnerOs ?? "(unknown)"}`);
  }
  return contract;
};

export const currentAssetPlatform = (label: string, env: Readonly<Record<string, string | undefined>>): string => {
  const platform = RUNNER_TO_ASSET_PLATFORM[env.RUNNER_OS ?? ""];
  if (!platform) {
    throw new Error(`missing ${label} platform for runner ${env.RUNNER_OS ?? "(unknown)"}`);
  }
  return platform;
};

export const bundleRoots = (contract: ReleaseAssetContract): string[] => {
  const targetTriple = contract.matrixArgs.startsWith("--target ")
    ? contract.matrixArgs.slice("--target ".length)
    : null;
  return [
    "src-tauri/target/release/bundle",
    path.join("src-tauri/target", contract.platformKey, "release/bundle"),
    ...(targetTriple ? [path.join("src-tauri/target", targetTriple, "release/bundle")] : []),
  ];
};
