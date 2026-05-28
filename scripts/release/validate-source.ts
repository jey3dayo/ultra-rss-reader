import { execFileSync } from "node:child_process";

const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`missing required environment variable ${key}`);
  }
  return value;
};

const git = (args: readonly string[]): string =>
  execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const gitInherit = (args: readonly string[]): void => {
  execFileSync("git", [...args], { stdio: "inherit" });
};

const gitSucceeds = (args: readonly string[]): boolean => {
  try {
    execFileSync("git", [...args], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const fail = (message: string): never => {
  console.error(`::error::${message}`);
  process.exit(1);
};

const eventName = requiredEnv("EVENT_NAME");
const releaseTag = requiredEnv("RELEASE_TAG");
const workflowRef = requiredEnv("WORKFLOW_REF");
const workflowRefName = requiredEnv("WORKFLOW_REF_NAME");
const reuseExistingAssets = process.env.REUSE_EXISTING_ASSETS === "true";

if (!RELEASE_TAG_PATTERN.test(releaseTag)) {
  fail("release tag must match vX.Y.Z, optionally with prerelease or build metadata");
}

if (eventName === "push") {
  if (workflowRef !== `refs/tags/${releaseTag}` || workflowRefName !== releaseTag) {
    fail(`tag push ref ${workflowRef} does not match release tag ${releaseTag}`);
  }
} else if (eventName === "workflow_dispatch") {
  if (workflowRef.startsWith("refs/tags/") && workflowRefName !== releaseTag) {
    fail(`manual dispatch ref ${workflowRef} does not match release tag ${releaseTag}`);
  }
} else {
  fail(`unsupported release event ${eventName}`);
}

if (!gitSucceeds(["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${releaseTag}`])) {
  fail(`release tag ${releaseTag} does not exist on origin; create and push an annotated tag before manual dispatch`);
}

gitInherit(["fetch", "--force", "--tags", "origin", `refs/tags/${releaseTag}:refs/tags/${releaseTag}`]);
gitInherit(["fetch", "--force", "origin", "main:refs/remotes/origin/main"]);

const tagObjectType = git(["cat-file", "-t", `refs/tags/${releaseTag}`]);
if (tagObjectType !== "tag") {
  fail(`release tag ${releaseTag} must be an annotated tag object, got ${tagObjectType}`);
}

const tagObjectSha = git(["rev-parse", `refs/tags/${releaseTag}`]);
const tagTargetSha = git(["rev-parse", `refs/tags/${releaseTag}^{}`]);
if (eventName === "workflow_dispatch") {
  gitInherit(["checkout", "--detach", tagTargetSha]);
}

const checkoutSha = git(["rev-parse", "HEAD"]);
if (tagObjectSha === tagTargetSha) {
  fail(`release tag ${releaseTag} tag object matches peeled commit; expected annotated tag metadata`);
}
if (tagTargetSha !== checkoutSha) {
  fail(`release tag ${releaseTag} points at ${tagTargetSha}, but checkout is ${checkoutSha}`);
}
if (!reuseExistingAssets && !gitSucceeds(["merge-base", "--is-ancestor", tagTargetSha, "refs/remotes/origin/main"])) {
  fail(`release tag ${releaseTag} target ${tagTargetSha} is not reachable from origin/main`);
}
if (reuseExistingAssets && !gitSucceeds(["merge-base", "--is-ancestor", tagTargetSha, "refs/remotes/origin/main"])) {
  console.log(
    `::notice::release recovery is validating existing assets for ${releaseTag}; tag target ${tagTargetSha} is not reachable from origin/main`,
  );
}
