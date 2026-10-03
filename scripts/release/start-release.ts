import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

type GitObject = { type: string; sha: string };
type GitRef = { object: GitObject };
type GitTag = { tag: string; object: GitObject };
type Release = {
  id: number;
  tag_name: string;
  draft: boolean;
  body: string | null;
  html_url: string;
  assets: unknown[];
};
type WorkflowRun = {
  id: number;
  head_sha: string;
  head_branch: string | null;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
};
type WorkflowRuns = { workflow_runs: WorkflowRun[] };
type ReleaseConnection = {
  nodes: { tagName: string; tagCommit: { oid: string } | null; url: string }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type ReleaseQuery = {
  errors?: unknown[];
  data?: { repository: { releases: ReleaseConnection } | null };
};

export const validateStartInputs = (releaseTag: string, expectedSha: string): void => {
  if (releaseTag !== releaseTag.trim() || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(releaseTag)) {
    throw new Error("release_tag must be a stable vX.Y.Z tag without leading zeroes");
  }
  if (expectedSha !== expectedSha.trim() || !/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error("expected_sha must be a lowercase 40-character commit SHA");
  }
};

export const requireExpectedMain = (mainSha: string, expectedSha: string): void => {
  if (mainSha !== expectedSha) {
    throw new Error(`main is ${mainSha}, expected ${expectedSha}; stop and review the new commit`);
  }
};

export const extractReleaseNotes = (source: string, releaseTag: string): string => {
  const changelog = source.replace(/\r\n/g, "\n");
  const version = releaseTag.slice(1);
  const matches = [...changelog.matchAll(/^##[ \t]+\[([^\]\n]+)\][^\n]*(?:\n|$)/gm)].filter(
    (match) => match[1] === version,
  );
  if (matches.length !== 1) throw new Error(`CHANGELOG.md must contain exactly one section for ${version}`);
  const match = matches[0];
  const remaining = changelog.slice((match.index ?? 0) + match[0].length);
  const nextHeading = remaining.search(/^##[ \t]+/m);
  const notes = (nextHeading === -1 ? remaining : remaining.slice(0, nextHeading)).trim();
  if (!notes) throw new Error(`CHANGELOG.md section ${version} is empty`);
  return notes;
};

export const requireSuccessfulCi = (runs: WorkflowRun[], expectedSha: string): WorkflowRun => {
  const latest = runs
    .filter((run) => run.head_sha === expectedSha && run.head_branch === "main" && run.event === "push")
    .sort((left, right) => right.id - left.id)[0];
  if (latest?.status !== "completed" || latest.conclusion !== "success") {
    throw new Error(`Latest main-push ci.yml run for ${expectedSha} must be completed successfully`);
  }
  return latest;
};

export const requireAnnotatedTag = (ref: GitRef, tag: GitTag, releaseTag: string, expectedSha: string): void => {
  if (
    ref.object.type !== "tag" ||
    ref.object.sha === expectedSha ||
    tag.tag !== releaseTag ||
    tag.object.type !== "commit" ||
    tag.object.sha !== expectedSha
  ) {
    throw new Error(`${releaseTag} must be an annotated tag pointing directly to ${expectedSha}; never overwrite it`);
  }
};

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export const startRelease = async (): Promise<void> => {
  const releaseTag = requiredEnv("RELEASE_TAG");
  const expectedSha = requiredEnv("EXPECTED_SHA");
  validateStartInputs(releaseTag, expectedSha);
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== expectedSha) {
    throw new Error("Dispatch this workflow from main at exactly expected_sha");
  }
  const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  requireExpectedMain(checkoutSha, expectedSha);
  execFileSync(process.execPath, ["./scripts/release/validate-release-config.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  const notes = extractReleaseNotes(readFileSync("CHANGELOG.md", "utf8"), releaseTag);
  const repository = requiredEnv("GITHUB_REPOSITORY");
  if (repository !== repository.trim() || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Invalid GITHUB_REPOSITORY");
  }
  const token = requiredEnv("GH_TOKEN");
  const base = `https://api.github.com/repos/${repository}`;
  const request = async <T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
    optional = false,
  ): Promise<T | undefined> => {
    const response = await fetch(endpoint === "graphql" ? "https://api.github.com/graphql" : `${base}/${endpoint}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (optional && response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${endpoint} failed with HTTP ${response.status}; do not blindly retry writes`);
    }
    return (await response.json()) as T;
  };
  const get = async <T>(endpoint: string): Promise<T> => {
    const value = await request<T>("GET", endpoint);
    if (value === undefined) throw new Error(`Missing response for ${endpoint}`);
    return value;
  };
  const mainIsCurrent = async (): Promise<void> => {
    const main = await get<GitRef>("git/ref/heads/main");
    if (main.object.type !== "commit") throw new Error("main is not a commit ref");
    requireExpectedMain(main.object.sha, expectedSha);
  };
  const runsFor = async (workflow: string): Promise<WorkflowRun[]> => {
    const result: WorkflowRun[] = [];
    for (let page = 1; ; page += 1) {
      const response = await get<WorkflowRuns>(
        `actions/workflows/${workflow}/runs?head_sha=${expectedSha}&per_page=100&page=${page}`,
      );
      result.push(...response.workflow_runs);
      if (response.workflow_runs.length < 100) return result;
    }
  };
  const noPriorRun = async (): Promise<void> => {
    const runs = (await runsFor("release.yml")).filter((run) => run.head_sha === expectedSha);
    if (runs.length > 0) {
      throw new Error(`Release run already exists: ${runs[0].html_url}. Inspect status/assets; do not redispatch.`);
    }
  };
  const noExistingRelease = async (): Promise<void> => {
    const [owner, name] = repository.split("/");
    let after: string | null = null;
    for (;;) {
      const response: ReleaseQuery | undefined = await request<ReleaseQuery>("POST", "graphql", {
        query: `query($owner:String!,$name:String!,$after:String) {
          repository(owner:$owner,name:$name) {
            releases(first:100,after:$after) {
              nodes { tagName tagCommit { oid } url }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        variables: { owner, name, after },
      });
      const releases: ReleaseConnection | undefined = response?.data?.repository?.releases;
      if (response?.errors?.length || !releases) throw new Error("Cannot verify existing releases");
      const existing = releases.nodes.find(
        (release) => release.tagName === releaseTag || release.tagCommit?.oid === expectedSha,
      );
      if (existing)
        throw new Error(`Release already exists: ${existing.url}. Preserve notes/assets and inspect recovery.`);
      if (releases.nodes.some((release) => !release.tagCommit))
        throw new Error("Cannot resolve an existing release commit");
      if (!releases.pageInfo.hasNextPage) return;
      if (!releases.pageInfo.endCursor || releases.pageInfo.endCursor === after)
        throw new Error("Invalid release cursor");
      after = releases.pageInfo.endCursor;
    }
  };
  const verifyRemoteTag = async (): Promise<void> => {
    const ref = await get<GitRef>(`git/ref/tags/${releaseTag}`);
    if (ref.object.type !== "tag") throw new Error(`${releaseTag} is a lightweight tag; never overwrite it`);
    const tag = await get<GitTag>(`git/tags/${ref.object.sha}`);
    requireAnnotatedTag(ref, tag, releaseTag, expectedSha);
  };
  const preflight = async (): Promise<void> => {
    await mainIsCurrent();
    requireSuccessfulCi(await runsFor("ci.yml"), expectedSha);
    await noExistingRelease();
    await noPriorRun();
  };
  await preflight();
  const existingRef = await request<GitRef>("GET", `git/ref/tags/${releaseTag}`, undefined, true);
  if (existingRef) {
    await verifyRemoteTag();
  } else {
    const tag = await request<{ sha: string }>("POST", "git/tags", {
      tag: releaseTag,
      message: releaseTag,
      object: expectedSha,
      type: "commit",
    });
    if (!tag?.sha) throw new Error("GitHub did not return the annotated tag object");
    await mainIsCurrent();
    await request("POST", "git/refs", { ref: `refs/tags/${releaseTag}`, sha: tag.sha });
    await verifyRemoteTag();
  }
  await preflight();
  const draft = await request<Release>("POST", "releases", {
    tag_name: releaseTag,
    target_commitish: expectedSha,
    name: releaseTag,
    body: notes,
    draft: true,
    prerelease: false,
    make_latest: "false",
    generate_release_notes: false,
  });
  if (!draft?.id) throw new Error("GitHub did not return the created draft");
  await mainIsCurrent();
  await verifyRemoteTag();
  await noPriorRun();
  const verifiedDraft = await get<Release>(`releases/${draft.id}`);
  if (
    !verifiedDraft.draft ||
    verifiedDraft.tag_name !== releaseTag ||
    verifiedDraft.body !== notes ||
    verifiedDraft.assets.length !== 0
  ) {
    throw new Error("Created draft changed unexpectedly; stop without dispatching or overwriting anything");
  }
  // GITHUB_TOKEN tag writes do not trigger push workflows. Dispatch once;
  // the retained draft blocks blind retries before Actions indexes the run.
  try {
    execFileSync(
      "gh",
      [
        "workflow",
        "run",
        "release.yml",
        "--repo",
        repository,
        "--ref",
        releaseTag,
        "-f",
        `release_tag=${releaseTag}`,
        "-f",
        "dry_run=false",
        "-f",
        "reuse_existing_assets=false",
        "-f",
        "build_linux=false",
      ],
      { stdio: "inherit", env: process.env },
    );
  } catch {
    throw new Error(`Dispatch failed or is uncertain. Keep ${draft.html_url}; inspect Actions before manual dispatch.`);
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const run = (await runsFor("release.yml")).find(
      (candidate) =>
        candidate.head_sha === expectedSha &&
        candidate.head_branch === releaseTag &&
        candidate.event === "workflow_dispatch",
    );
    if (run) {
      const summary =
        `Draft: ${draft.html_url}\n\nTag: ${releaseTag}\n\nCommit: ${expectedSha}\n\n` +
        `Release workflow: ${run.html_url}\n\nVerify required builds and assets before publishing.\n`;
      console.log(summary);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
      return;
    }
    await delay(3_000);
  }
  throw new Error(
    `Dispatch accepted but run is not visible. Keep ${draft.html_url}; inspect Actions, do not redispatch.`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startRelease().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
