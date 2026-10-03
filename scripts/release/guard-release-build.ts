import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

type Release = { tag_name: string; draft: boolean; assets: unknown[] };
type Run = { id: number; head_sha: string };

export const requireBuildSlot = (
  releases: Release[],
  runs: Run[],
  tag: string,
  sha: string,
  runId: number,
  reuse: boolean,
): void => {
  const matching = releases.filter((release) => release.tag_name === tag);
  if (matching.length > 1 || matching.some((release) => !release.draft)) {
    throw new Error("Release is published or ambiguous; do not overwrite it");
  }
  if (reuse) {
    if (matching.length !== 1) throw new Error("Asset recovery requires an existing draft");
    return;
  }
  if (matching.some((release) => release.assets.length > 0)) {
    throw new Error("Draft already contains assets; inspect the previous run before recovery");
  }
  if (runs.some((run) => run.head_sha === sha && run.id < runId)) {
    throw new Error("An earlier release run owns this commit; inspect/re-run that run instead of a duplicate dispatch");
  }
};

export const guardReleaseBuild = async (): Promise<void> => {
  const tag = process.env.RELEASE_TAG ?? "";
  const sha = process.env.GITHUB_SHA ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GH_TOKEN;
  const runId = Number(process.env.GITHUB_RUN_ID);
  const reuse = process.env.REUSE_EXISTING_ASSETS === "true";
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
    if (process.env.GITHUB_REF !== `refs/tags/${tag}`) {
      throw new Error("Build dispatch must select the release tag as its workflow ref");
    }
    const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (checkoutSha !== sha) throw new Error("Release run metadata must match the checked-out tag commit");
  }
  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Cannot verify release build slot: HTTP ${response.status}`);
    return (await response.json()) as T;
  };
  const releases: Release[] = [];
  for (let page = 1; ; page += 1) {
    const batch = await get<Release[]>(`releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const runs: Run[] = [];
  if (!reuse) {
    for (let page = 1; ; page += 1) {
      const batch = await get<{ workflow_runs: Run[] }>(
        `actions/workflows/release.yml/runs?head_sha=${sha}&per_page=100&page=${page}`,
      );
      runs.push(...batch.workflow_runs);
      if (batch.workflow_runs.length < 100) break;
    }
  }
  requireBuildSlot(releases, runs, tag, sha, runId, reuse);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  guardReleaseBuild().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
