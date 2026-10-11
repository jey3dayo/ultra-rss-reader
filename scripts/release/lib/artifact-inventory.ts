import type { ReleaseAssetContract } from "./artifact-contract.ts";

export type ArtifactBundleTree = {
  directories: readonly string[];
  files: readonly string[];
};

export type GitHubReleaseView = {
  assets: { name: string }[];
  isDraft: boolean;
  isPrerelease: boolean;
  tagName: string;
  url: string;
};

export const parseAssetPathList = (content: string): string[] => content.trim().split("\n").filter(Boolean);

export const findUpdaterAssets = (files: readonly string[], contract: ReleaseAssetContract): string[] =>
  files.filter(
    (filePath) =>
      filePath.endsWith(contract.assetPattern) &&
      !filePath.endsWith(contract.signaturePattern) &&
      !filePath.endsWith(contract.checksumPattern),
  );

export const findAppBundles = (directories: readonly string[]): string[] =>
  directories.filter((directoryPath) => directoryPath.endsWith(".app"));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNamedAsset = (value: unknown): value is { name: string } => isRecord(value) && typeof value.name === "string";

export const parseGitHubReleaseView = (value: unknown): GitHubReleaseView => {
  if (
    !isRecord(value) ||
    typeof value.isDraft !== "boolean" ||
    typeof value.isPrerelease !== "boolean" ||
    typeof value.tagName !== "string" ||
    typeof value.url !== "string" ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isNamedAsset)
  ) {
    throw new Error("gh release view returned invalid JSON");
  }

  return {
    assets: value.assets,
    isDraft: value.isDraft,
    isPrerelease: value.isPrerelease,
    tagName: value.tagName,
    url: value.url,
  };
};
