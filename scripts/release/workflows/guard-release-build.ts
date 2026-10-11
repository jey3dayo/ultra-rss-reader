import type { ReleaseEnvironment } from "../lib/github-client.ts";
import {
  type BuildGuardDependencies,
  type BuildRelease,
  type BuildRun,
  createBuildGuardDependencies,
  parseBuildReleases,
  parseBuildRuns,
  requireBuildSlot,
} from "../lib/release-start-policy.ts";

const executeBuildGuard = async (env: ReleaseEnvironment, dependencies: BuildGuardDependencies): Promise<void> => {
  const tag = env.RELEASE_TAG ?? "";
  const sha = env.GITHUB_SHA ?? "";
  const repository = env.GITHUB_REPOSITORY ?? "";
  const token = env.GH_TOKEN;
  const runId = Number(env.GITHUB_RUN_ID);
  const reuse = env.REUSE_EXISTING_ASSETS === "true";
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag) || tag !== tag.trim()) {
    throw new Error("Invalid release tag");
  }
  if (!/^[0-9a-f]{40}$/.test(sha) || sha !== sha.trim() || !Number.isSafeInteger(runId) || runId <= 0) {
    throw new Error("Invalid release commit or run ID");
  }
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository !== repository.trim()) {
    throw new Error("Missing release authorization or repository");
  }
  if (!reuse) {
    if (env.GITHUB_REF !== `refs/tags/${tag}`) {
      throw new Error("Build dispatch must select the release tag as its workflow ref");
    }
    const checkoutSha = dependencies.checkoutSha();
    if (checkoutSha !== sha) throw new Error("Release run metadata must match the checked-out tag commit");
  }
  const { request } = dependencies.github(repository, token);
  const releases: BuildRelease[] = [];
  for (let page = 1; ; page += 1) {
    const batch = parseBuildReleases(await request("GET", `releases?per_page=100&page=${page}`));
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const runs: BuildRun[] = [];
  if (!reuse) {
    for (let page = 1; ; page += 1) {
      const batch = parseBuildRuns(
        await request("GET", `actions/workflows/release.yml/runs?head_sha=${sha}&per_page=100&page=${page}`),
      );
      runs.push(...batch.workflow_runs);
      if (batch.workflow_runs.length < 100) break;
    }
  }
  requireBuildSlot(releases, runs, tag, sha, runId, reuse);
};

export const runReleaseBuildGuardWorkflow = async (
  env: ReleaseEnvironment,
  dependencies: BuildGuardDependencies = createBuildGuardDependencies(),
): Promise<void> => {
  try {
    await executeBuildGuard(env, dependencies);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error), { cause: error });
  }
};
