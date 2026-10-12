import { createHash } from "node:crypto";
import path from "node:path";
import { linuxReleaseBinaryNames, releaseVersion } from "../release-artifact-contract.ts";

export type LinuxProvenanceDependencies = {
  git: (args: readonly string[]) => string;
  readFile: (filePath: string) => Uint8Array;
  resolveArtifact: (filePath: string) => string;
};

const requiredEnv = (env: Readonly<Record<string, string | undefined>>, key: string): string => {
  const value = env[key];
  if (!value || value.trim() !== value) {
    throw new Error(`Linux provenance requires ${key}`);
  }
  return value;
};

const parseArtifactPaths = (text: string): string[] => {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error("Linux provenance requires exactly two Tauri action artifact paths");
  }
  const paths: string[] = [];
  for (const value of parsed) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Linux artifact paths must be nonempty strings");
    }
    paths.push(value);
  }
  return paths;
};

export const buildLinuxReleaseProvenance = (
  env: Readonly<Record<string, string | undefined>>,
  dependencies: LinuxProvenanceDependencies,
) => {
  const tag = requiredEnv(env, "RELEASE_TAG");
  const version = releaseVersion(tag);
  const releaseIdText = requiredEnv(env, "LINUX_RELEASE_ID");
  const releaseId = Number(releaseIdText);
  if (!/^[1-9]\d*$/.test(releaseIdText) || !Number.isSafeInteger(releaseId)) {
    throw new Error("Linux provenance requires a positive safe-integer LINUX_RELEASE_ID");
  }
  const sourceSha = requiredEnv(env, "GITHUB_SHA");
  const runId = requiredEnv(env, "GITHUB_RUN_ID");
  const runAttempt = requiredEnv(env, "GITHUB_RUN_ATTEMPT");
  const repository = requiredEnv(env, "GITHUB_REPOSITORY");
  const serverUrl = new URL(requiredEnv(env, "GITHUB_SERVER_URL"));
  if (
    !/^[a-f0-9]{40}$/.test(sourceSha) ||
    !/^[1-9]\d*$/.test(runId) ||
    !/^[1-9]\d*$/.test(runAttempt) ||
    !Number.isSafeInteger(Number(runAttempt)) ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    serverUrl.protocol !== "https:" ||
    serverUrl.username ||
    serverUrl.password ||
    serverUrl.pathname !== "/" ||
    serverUrl.search ||
    serverUrl.hash ||
    requiredEnv(env, "GITHUB_EVENT_NAME") !== "workflow_dispatch" ||
    requiredEnv(env, "GITHUB_WORKFLOW") !== "Release" ||
    requiredEnv(env, "GITHUB_REF") !== `refs/tags/${tag}` ||
    requiredEnv(env, "GITHUB_REF_NAME") !== tag ||
    requiredEnv(env, "RUNNER_OS") !== "Linux"
  ) {
    throw new Error("Linux provenance requires the exact tag-ref Linux Release dispatch build identity");
  }
  const commitSha = dependencies.git(["rev-parse", "HEAD"]);
  const tagTargetSha = dependencies.git(["rev-parse", `refs/tags/${tag}^{commit}`]);
  if (
    commitSha !== sourceSha ||
    tagTargetSha !== sourceSha ||
    dependencies.git(["cat-file", "-t", `refs/tags/${tag}`]) !== "tag"
  ) {
    throw new Error("Linux provenance checkout and annotated tag target must match the expected source SHA");
  }
  const artifactPaths = parseArtifactPaths(requiredEnv(env, "LINUX_ARTIFACT_PATHS"));
  const resolvedPaths = artifactPaths.map((filePath) => dependencies.resolveArtifact(filePath));
  if (new Set(resolvedPaths).size !== 2) {
    throw new Error("Linux provenance requires two unique artifact paths");
  }
  const names = linuxReleaseBinaryNames(tag);
  const artifacts = resolvedPaths.map((filePath) => {
    const rawName = path.basename(filePath);
    // Pinned tauri-action 84b9d35 src/upload-release-assets.ts matches GitHub's space-to-dot rename.
    const name = rawName.replaceAll(" ", ".");
    if (
      !names.includes(name) ||
      (rawName !== name && rawName !== name.replace("Ultra.RSS.Reader", "Ultra RSS Reader"))
    ) {
      throw new Error(`Linux artifact filename does not match this release: ${rawName}`);
    }
    const bytes = dependencies.readFile(filePath);
    if (bytes.byteLength === 0) {
      throw new Error(`Linux artifact must not be empty: ${rawName}`);
    }
    return { name, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  if (new Set(artifacts.map((artifact) => artifact.name)).size !== names.length) {
    throw new Error("Linux provenance requires both the .deb and AppImage with unique canonical names");
  }
  return {
    artifacts,
    packageVersion: version,
    releaseTag: tag,
    releaseId,
    runner: { assetPlatform: "linux-x86_64", matrixPlatform: "ubuntu-24.04", os: "Linux" },
    source: { commitSha, tagTargetSha },
    workflow: {
      eventName: "workflow_dispatch",
      ref: `refs/tags/${tag}`,
      refName: tag,
      runAttempt,
      runId,
      runUrl: `${serverUrl.origin}/${repository}/actions/runs/${runId}`,
      workflow: "Release",
    },
  };
};
