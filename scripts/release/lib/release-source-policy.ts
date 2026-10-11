import { execFileSync } from "node:child_process";
import type { ReleaseEnvironment } from "./github-client.ts";

const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export class ReleaseSourceValidationError extends Error {}

export type ReleaseSourceInputs = {
  eventName: string;
  releaseTag: string;
  workflowRef: string;
  workflowRefName: string;
  reuseExistingAssets: boolean;
};

const requiredEnv = (env: ReleaseEnvironment, key: string): string => {
  const value = env[key];
  if (!value) throw new Error(`missing required environment variable ${key}`);
  return value;
};

export const parseReleaseSourceInputs = (env: ReleaseEnvironment): ReleaseSourceInputs => {
  const eventName = requiredEnv(env, "EVENT_NAME");
  const releaseTag = requiredEnv(env, "RELEASE_TAG");
  const workflowRef = requiredEnv(env, "WORKFLOW_REF");
  const workflowRefName = requiredEnv(env, "WORKFLOW_REF_NAME");
  const reuseExistingAssets = env.REUSE_EXISTING_ASSETS === "true";
  if (!RELEASE_TAG_PATTERN.test(releaseTag)) {
    throw new ReleaseSourceValidationError(
      "release tag must match vX.Y.Z, optionally with prerelease or build metadata",
    );
  }
  if (eventName === "push") {
    if (workflowRef !== `refs/tags/${releaseTag}` || workflowRefName !== releaseTag) {
      throw new ReleaseSourceValidationError(`tag push ref ${workflowRef} does not match release tag ${releaseTag}`);
    }
  } else if (eventName === "workflow_dispatch") {
    if (workflowRef.startsWith("refs/tags/") && workflowRefName !== releaseTag) {
      throw new ReleaseSourceValidationError(
        `manual dispatch ref ${workflowRef} does not match release tag ${releaseTag}`,
      );
    }
  } else {
    throw new ReleaseSourceValidationError(`unsupported release event ${eventName}`);
  }
  return { eventName, releaseTag, workflowRef, workflowRefName, reuseExistingAssets };
};

export type ReleaseSourceDependencies = {
  git: (args: readonly string[]) => string;
  gitInherit: (args: readonly string[]) => void;
  gitSucceeds: (args: readonly string[]) => boolean;
  notice: (message: string) => void;
};

export const releaseSourceDependencies: ReleaseSourceDependencies = {
  git: (args) => execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
  gitInherit: (args) => {
    execFileSync("git", [...args], { stdio: "inherit" });
  },
  gitSucceeds: (args) => {
    try {
      execFileSync("git", [...args], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  },
  notice: (message) => console.log(message),
};
