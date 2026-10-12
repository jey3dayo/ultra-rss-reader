import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createGitHubClient, type GitHubClient, type ReleaseEnvironment } from "./github-client.ts";

type GitObject = { type: string; sha: string };
type GitRef = { object: GitObject };
type GitTag = { tag: string; object: GitObject };
type Commit = { sha: string };
export type BuildRelease = { tag_name: string; draft: boolean; assets: unknown[] };
export type BuildRun = { id: number; head_sha: string };
type Release = BuildRelease & { id: number; body: string | null; html_url: string };
export type WorkflowRun = BuildRun & {
  head_branch: string | null;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
};
type ReleaseQuery = {
  errors?: unknown[];
  data?: {
    repository: {
      releases: {
        nodes: { databaseId: number; tagName: string; tagCommit: { oid: string } | null; url: string }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  } | null;
};

const isResponseObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const responseObject = (value: unknown): Record<string, unknown> => {
  if (!isResponseObject(value)) {
    throw new Error("Invalid GitHub response: expected an object");
  }
  return value;
};
const responseString = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Invalid GitHub response: expected a string");
  return value;
};
const responseNullableString = (value: unknown): string | null => (value === null ? null : responseString(value));
const responseNumber = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error("Invalid GitHub response: expected a number");
  return value;
};
const responseBoolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("Invalid GitHub response: expected a boolean");
  return value;
};
const responseArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new Error("Invalid GitHub response: expected an array");
  return value;
};
const parseGitObject = (value: unknown): GitObject => {
  const object = responseObject(value);
  return { type: responseString(object.type), sha: responseString(object.sha) };
};
export const parseGitRef = (value: unknown): GitRef => {
  const ref = responseObject(value);
  return { object: parseGitObject(ref.object) };
};
export const parseGitTag = (value: unknown): GitTag => {
  const tag = responseObject(value);
  return { tag: responseString(tag.tag), object: parseGitObject(tag.object) };
};
export const parseCommit = (value: unknown): Commit => {
  const commit = responseObject(value);
  return { sha: responseString(commit.sha) };
};
const parseBuildRelease = (value: unknown): BuildRelease => {
  const release = responseObject(value);
  return {
    tag_name: responseString(release.tag_name),
    draft: responseBoolean(release.draft),
    assets: responseArray(release.assets),
  };
};
export const parseRelease = (value: unknown): Release => {
  const release = responseObject(value);
  return {
    ...parseBuildRelease(release),
    id: responseNumber(release.id),
    body: responseNullableString(release.body),
    html_url: responseString(release.html_url),
  };
};
const parseBuildRun = (value: unknown): BuildRun => {
  const run = responseObject(value);
  return { id: responseNumber(run.id), head_sha: responseString(run.head_sha) };
};
const parseWorkflowRun = (value: unknown): WorkflowRun => {
  const run = responseObject(value);
  return {
    ...parseBuildRun(run),
    head_branch: responseNullableString(run.head_branch),
    event: responseString(run.event),
    status: responseString(run.status),
    conclusion: responseNullableString(run.conclusion),
    html_url: responseString(run.html_url),
  };
};
export const parseWorkflowRuns = (value: unknown): { workflow_runs: WorkflowRun[] } => {
  const response = responseObject(value);
  return { workflow_runs: responseArray(response.workflow_runs).map(parseWorkflowRun) };
};
export const parseBuildReleases = (value: unknown): BuildRelease[] => responseArray(value).map(parseBuildRelease);
export const parseBuildRuns = (value: unknown): { workflow_runs: BuildRun[] } => {
  const response = responseObject(value);
  return { workflow_runs: responseArray(response.workflow_runs).map(parseBuildRun) };
};
export const parseReleaseQuery = (value: unknown): ReleaseQuery => {
  const response = responseObject(value);
  const errors = response.errors === undefined ? undefined : responseArray(response.errors);
  if (response.data === undefined || response.data === null) return { errors, data: response.data };
  const data = responseObject(response.data);
  if (data.repository === null) return { errors, data: { repository: null } };
  const repository = responseObject(data.repository);
  const releases = responseObject(repository.releases);
  const nodes = responseArray(releases.nodes).map((value) => {
    const node = responseObject(value);
    return {
      databaseId: responseNumber(node.databaseId),
      tagName: responseString(node.tagName),
      tagCommit: node.tagCommit === null ? null : { oid: responseString(responseObject(node.tagCommit).oid) },
      url: responseString(node.url),
    };
  });
  const pageInfo = responseObject(releases.pageInfo);
  return {
    errors,
    data: {
      repository: {
        releases: {
          nodes,
          pageInfo: {
            hasNextPage: responseBoolean(pageInfo.hasNextPage),
            endCursor: responseNullableString(pageInfo.endCursor),
          },
        },
      },
    },
  };
};
export const parseReleaseTarget = (value: unknown): { target_commitish?: unknown } => {
  const release = responseObject(value);
  return { target_commitish: release.target_commitish };
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

export const requireBuildSlot = (
  releases: BuildRelease[],
  runs: BuildRun[],
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

export const parseCreatedTag = (value: unknown): Commit => {
  let tag: Commit;
  try {
    tag = parseCommit(value);
  } catch {
    throw new Error("GitHub did not return the annotated tag object");
  }
  if (!tag.sha) throw new Error("GitHub did not return the annotated tag object");
  return tag;
};

export const parseCreatedDraft = (value: unknown): Release => {
  let draft: Release;
  try {
    draft = parseRelease(value);
  } catch {
    throw new Error("GitHub did not return the created draft");
  }
  if (!draft.id) throw new Error("GitHub did not return the created draft");
  return draft;
};

export const requiredStartEnv = (env: ReleaseEnvironment, name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export type StartReleaseDependencies = {
  checkoutSha: () => string;
  validateConfig: () => void;
  readChangelog: () => string;
  github: (repository: string, token: string) => GitHubClient;
  dispatch: (repository: string, releaseTag: string) => void;
  delay: (milliseconds: number) => Promise<unknown>;
  summary: (text: string) => void;
};

export type ReleaseCommand = (
  command: string,
  args: readonly string[],
  options: { encoding?: "utf8"; stdio?: "inherit"; env?: ReleaseEnvironment },
) => string | Buffer;

const executeReleaseCommand: ReleaseCommand = (command, args, options) => execFileSync(command, [...args], options);

export const createStartReleaseDependencies = (
  env: ReleaseEnvironment,
  runCommand: ReleaseCommand = executeReleaseCommand,
): StartReleaseDependencies => ({
  checkoutSha: () => runCommand("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).toString().trim(),
  validateConfig: () => {
    runCommand(process.execPath, ["./scripts/release/validate-release-config.ts"], { stdio: "inherit", env });
  },
  readChangelog: () => readFileSync("CHANGELOG.md", "utf8"),
  github: (repository, token) => createGitHubClient(repository, token, "start"),
  dispatch: (repository, releaseTag) => {
    runCommand(
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
      { stdio: "inherit", env },
    );
  },
  delay,
  summary: (text) => {
    console.log(text);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text);
  },
});

export type BuildGuardDependencies = Pick<StartReleaseDependencies, "checkoutSha" | "github">;
export const createBuildGuardDependencies = (
  runCommand: ReleaseCommand = executeReleaseCommand,
): BuildGuardDependencies => ({
  checkoutSha: () => runCommand("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).toString().trim(),
  github: (repository, token) => createGitHubClient(repository, token, "build"),
});
