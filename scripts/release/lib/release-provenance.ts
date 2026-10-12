import path from "node:path";
import { parseUpdaterChecksum } from "../updater-checksum.ts";
import { currentAssetPlatform, matrixPlatformForRunner } from "./artifact-contract.ts";
import { parseAssetPathList } from "./artifact-inventory.ts";

export const CHECKSUM_ASSETS_LIST = "src-tauri/target/updater-checksum-assets.txt";
export const DEPENDENCY_PROVENANCE_ASSETS_LIST = "src-tauri/target/release-dependency-provenance-assets.txt";
export const RELEASE_PROVENANCE_ASSETS_LIST = "src-tauri/target/release-provenance-assets.txt";
export const RELEASE_PROVENANCE_DIR = "src-tauri/target/release-provenance";

export class ReleaseProvenanceError extends Error {}

type ReleaseProvenanceDependencies = {
  env: Readonly<Record<string, string | undefined>>;
  git: (args: readonly string[]) => string;
  readFile: (filePath: string) => string;
};

type Reject = (message: string) => never;

const rejectProvenance: Reject = (message) => {
  throw new ReleaseProvenanceError(message);
};

const requiredEnv = (key: string, env: Readonly<Record<string, string | undefined>>, reject: Reject): string =>
  env[key] || reject(`missing required environment variable ${key}`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPackageVersion = (packageJsonContent: string): string | undefined => {
  const parsed: unknown = JSON.parse(packageJsonContent);
  return isRecord(parsed) && typeof parsed.version === "string" ? parsed.version : undefined;
};

export const buildReleaseProvenanceRecord = ({ env, git, readFile }: ReleaseProvenanceDependencies) => {
  const runnerOs = env.RUNNER_OS;
  const matrixPlatform = matrixPlatformForRunner(runnerOs);
  let assetPlatform: string;
  try {
    assetPlatform = currentAssetPlatform("release provenance", env);
  } catch (error) {
    if (error instanceof Error) {
      throw new ReleaseProvenanceError(error.message, { cause: error });
    }
    throw error;
  }
  if (!matrixPlatform) {
    rejectProvenance(`missing release provenance matrix platform for runner ${runnerOs ?? "(unknown)"}`);
  }
  const requireEnv = (key: string): string => requiredEnv(key, env, rejectProvenance);

  const checksumAssets = parseAssetPathList(readFile(CHECKSUM_ASSETS_LIST));
  const dependencyAssets = parseAssetPathList(readFile(DEPENDENCY_PROVENANCE_ASSETS_LIST));
  if (checksumAssets.length !== 1) {
    rejectProvenance(`expected exactly one updater checksum asset, found ${checksumAssets.length}`);
  }
  if (dependencyAssets.length !== 2) {
    rejectProvenance(`expected exactly two dependency provenance assets, found ${dependencyAssets.length}`);
  }

  const checksumAsset = checksumAssets[0];
  const parsedChecksum = parseUpdaterChecksum(readFile(checksumAsset));
  const checksum = parsedChecksum.ok ? parsedChecksum.value : rejectProvenance(parsedChecksum.error);

  const packageVersion = readPackageVersion(readFile("package.json"));
  const releaseTag = requireEnv("RELEASE_TAG");
  const sourceSha = git(["rev-parse", "HEAD"]);
  const tagTargetSha = git(["rev-parse", `refs/tags/${releaseTag}^{}`]);
  const mergeCommitSubject = git(["log", "-1", "--format=%s", sourceSha]);
  const pullRequestNumber = mergeCommitSubject.match(/\(#(?<number>\d+)\)$/)?.groups?.number ?? null;
  const workflowRunUrl = `${requireEnv("GITHUB_SERVER_URL")}/${requireEnv("GITHUB_REPOSITORY")}/actions/runs/${requireEnv("GITHUB_RUN_ID")}`;
  return {
    assetPlatform,
    record: {
      artifact: {
        checksumAssetName: path.basename(checksumAsset),
        name: checksum.artifactName,
        sha256: checksum.sha256,
      },
      dependencyProvenanceAssets: dependencyAssets.map((asset) => path.basename(asset)),
      packageVersion,
      releaseTag,
      runner: {
        assetPlatform,
        matrixPlatform,
        os: runnerOs,
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
        eventName: env.GITHUB_EVENT_NAME,
        ref: env.GITHUB_REF,
        refName: env.GITHUB_REF_NAME,
        runAttempt: env.GITHUB_RUN_ATTEMPT,
        runId: env.GITHUB_RUN_ID,
        runUrl: workflowRunUrl,
        workflow: env.GITHUB_WORKFLOW,
      },
    },
  };
};
