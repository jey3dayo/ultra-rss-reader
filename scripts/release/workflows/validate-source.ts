import type { ReleaseEnvironment } from "../lib/github-client.ts";
import {
  parseReleaseSourceInputs,
  type ReleaseSourceDependencies,
  ReleaseSourceValidationError,
  releaseSourceDependencies,
} from "../lib/release-source-policy.ts";

export const runReleaseSourceValidationWorkflow = (
  env: ReleaseEnvironment,
  dependencies: ReleaseSourceDependencies = releaseSourceDependencies,
): void => {
  try {
    const { eventName, releaseTag, reuseExistingAssets } = parseReleaseSourceInputs(env);
    const { git, gitInherit, gitSucceeds, notice } = dependencies;
    if (!gitSucceeds(["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${releaseTag}`])) {
      throw new ReleaseSourceValidationError(
        `release tag ${releaseTag} does not exist on origin; create and push an annotated tag before manual dispatch`,
      );
    }

    gitInherit(["fetch", "--force", "--tags", "origin", `refs/tags/${releaseTag}:refs/tags/${releaseTag}`]);
    gitInherit(["fetch", "--force", "origin", "main:refs/remotes/origin/main"]);

    const tagObjectType = git(["cat-file", "-t", `refs/tags/${releaseTag}`]);
    if (tagObjectType !== "tag") {
      throw new ReleaseSourceValidationError(
        `release tag ${releaseTag} must be an annotated tag object, got ${tagObjectType}`,
      );
    }

    const tagObjectSha = git(["rev-parse", `refs/tags/${releaseTag}`]);
    const tagTargetSha = git(["rev-parse", `refs/tags/${releaseTag}^{}`]);
    if (eventName === "workflow_dispatch" && !reuseExistingAssets) {
      gitInherit(["checkout", "--detach", tagTargetSha]);
    }

    const checkoutSha = git(["rev-parse", "HEAD"]);
    if (tagObjectSha === tagTargetSha) {
      throw new ReleaseSourceValidationError(
        `release tag ${releaseTag} tag object matches peeled commit; expected annotated tag metadata`,
      );
    }
    if (!reuseExistingAssets && tagTargetSha !== checkoutSha) {
      throw new ReleaseSourceValidationError(
        `release tag ${releaseTag} points at ${tagTargetSha}, but checkout is ${checkoutSha}`,
      );
    }
    if (
      !reuseExistingAssets &&
      !gitSucceeds(["merge-base", "--is-ancestor", tagTargetSha, "refs/remotes/origin/main"])
    ) {
      throw new ReleaseSourceValidationError(
        `release tag ${releaseTag} target ${tagTargetSha} is not reachable from origin/main`,
      );
    }
    if (
      reuseExistingAssets &&
      !gitSucceeds(["merge-base", "--is-ancestor", tagTargetSha, "refs/remotes/origin/main"])
    ) {
      notice(
        `::notice::release recovery is validating existing assets for ${releaseTag}; tag target ${tagTargetSha} is not reachable from origin/main`,
      );
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error), { cause: error });
  }
};
