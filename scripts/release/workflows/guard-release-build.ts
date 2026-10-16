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

type BuildGuardInput = {
  tag: string;
  sha: string;
  repository: string;
  token: string;
  runId: number;
  reuse: boolean;
};

const parseBuildGuardInput = (env: ReleaseEnvironment): BuildGuardInput => {
  const tag = env.RELEASE_TAG ?? "";
  const sha = env.GITHUB_SHA ?? "";
  const repository = env.GITHUB_REPOSITORY ?? "";
  const token = env.GH_TOKEN;
  const runId = Number(env.GITHUB_RUN_ID);
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tag) || tag !== tag.trim()) {
    throw new Error("Invalid release tag");
  }
  if (!/^[0-9a-f]{40}$/.test(sha) || sha !== sha.trim() || !Number.isSafeInteger(runId) || runId <= 0) {
    throw new Error("Invalid release commit or run ID");
  }
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository !== repository.trim()) {
    throw new Error("Missing release authorization or repository");
  }
  return { tag, sha, repository, token, runId, reuse: env.REUSE_EXISTING_ASSETS === "true" };
};

const requireTagCheckout = (env: ReleaseEnvironment, dependencies: BuildGuardDependencies, input: BuildGuardInput) => {
  if (env.GITHUB_REF !== `refs/tags/${input.tag}`) {
    throw new Error("Build dispatch must select the release tag as its workflow ref");
  }
  const checkoutSha = dependencies.checkoutSha();
  if (checkoutSha !== input.sha) throw new Error("Release run metadata must match the checked-out tag commit");
};

type GitHubRequest = ReturnType<BuildGuardDependencies["github"]>["request"];

const listBuildReleases = async (request: GitHubRequest): Promise<BuildRelease[]> => {
  const releases: BuildRelease[] = [];
  for (let page = 1; ; page += 1) {
    const batch = parseBuildReleases(await request("GET", `releases?per_page=100&page=${page}`));
    releases.push(...batch);
    if (batch.length < 100) return releases;
  }
};

const listReleaseRuns = async (request: GitHubRequest, sha: string): Promise<BuildRun[]> => {
  const runs: BuildRun[] = [];
  for (let page = 1; ; page += 1) {
    const batch = parseBuildRuns(
      await request("GET", `actions/workflows/release.yml/runs?head_sha=${sha}&per_page=100&page=${page}`),
    );
    runs.push(...batch.workflow_runs);
    if (batch.workflow_runs.length < 100) return runs;
  }
};

const executeBuildGuard = async (env: ReleaseEnvironment, dependencies: BuildGuardDependencies): Promise<void> => {
  const input = parseBuildGuardInput(env);
  if (!input.reuse) requireTagCheckout(env, dependencies, input);
  const { request } = dependencies.github(input.repository, input.token);
  const releases = await listBuildReleases(request);
  const runs = input.reuse ? [] : await listReleaseRuns(request, input.sha);
  requireBuildSlot(releases, runs, input.tag, input.sha, input.runId, input.reuse);
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
