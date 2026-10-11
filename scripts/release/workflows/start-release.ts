import type { ReleaseEnvironment } from "../lib/github-client.ts";
import {
  createStartReleaseDependencies,
  extractReleaseNotes,
  parseCommit,
  parseCreatedDraft,
  parseCreatedTag,
  parseGitRef,
  parseGitTag,
  parseRelease,
  parseReleaseQuery,
  parseReleaseTarget,
  parseWorkflowRuns,
  requireAnnotatedTag,
  requiredStartEnv,
  requireExpectedMain,
  requireSuccessfulCi,
  type StartReleaseDependencies,
  validateStartInputs,
  type WorkflowRun,
} from "../lib/release-start-policy.ts";

const executeStartRelease = async (env: ReleaseEnvironment, dependencies: StartReleaseDependencies): Promise<void> => {
  const releaseTag = requiredStartEnv(env, "RELEASE_TAG");
  const expectedSha = requiredStartEnv(env, "EXPECTED_SHA");
  validateStartInputs(releaseTag, expectedSha);
  if (env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_SHA !== expectedSha) {
    throw new Error("Dispatch this workflow from main at exactly expected_sha");
  }
  requireExpectedMain(dependencies.checkoutSha(), expectedSha);
  dependencies.validateConfig();
  const notes = extractReleaseNotes(dependencies.readChangelog(), releaseTag);
  const repository = requiredStartEnv(env, "GITHUB_REPOSITORY");
  if (repository !== repository.trim() || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Invalid GITHUB_REPOSITORY");
  }
  const token = requiredStartEnv(env, "GH_TOKEN");
  const { request } = dependencies.github(repository, token);
  const get = async (endpoint: string): Promise<unknown> => {
    const value = await request("GET", endpoint);
    if (value === undefined) throw new Error(`Missing response for ${endpoint}`);
    return value;
  };
  const mainIsCurrent = async (): Promise<void> => {
    const main = parseGitRef(await get("git/ref/heads/main"));
    if (main.object.type !== "commit") throw new Error("main is not a commit ref");
    requireExpectedMain(main.object.sha, expectedSha);
  };
  const runsFor = async (workflow: string): Promise<WorkflowRun[]> => {
    const result: WorkflowRun[] = [];
    for (let page = 1; ; page += 1) {
      const response = parseWorkflowRuns(
        await get(`actions/workflows/${workflow}/runs?head_sha=${expectedSha}&per_page=100&page=${page}`),
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
      const response = parseReleaseQuery(
        await request("POST", "graphql", {
          query: `query($owner:String!,$name:String!,$after:String) {
          repository(owner:$owner,name:$name) {
            releases(first:100,after:$after) {
              nodes { databaseId tagName tagCommit { oid } url }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
          variables: { owner, name, after },
        }),
      );
      const releases = response?.data?.repository?.releases;
      if (response?.errors?.length || !releases) throw new Error("Cannot verify existing releases");
      const existing = releases.nodes.find(
        (release) => release.tagName === releaseTag || release.tagCommit?.oid === expectedSha,
      );
      if (existing)
        throw new Error(`Release already exists: ${existing.url}. Preserve notes/assets and inspect recovery.`);
      for (const release of releases.nodes.filter((candidate) => !candidate.tagCommit)) {
        const detail = parseReleaseTarget(await get(`releases/${release.databaseId}`));
        const target = detail.target_commitish;
        if (typeof target !== "string" || !target) throw new Error("Cannot verify an existing release target");
        const resolved = /^[0-9a-f]{40}$/.test(target)
          ? { sha: target }
          : await request("GET", `commits/${encodeURIComponent(target)}`, undefined, true);
        if (resolved !== undefined && parseCommit(resolved).sha === expectedSha) {
          throw new Error(`Release already targets this commit: ${release.url}; inspect recovery`);
        }
      }
      if (!releases.pageInfo.hasNextPage) return;
      if (!releases.pageInfo.endCursor || releases.pageInfo.endCursor === after)
        throw new Error("Invalid release cursor");
      after = releases.pageInfo.endCursor;
    }
  };
  const verifyRemoteTag = async (): Promise<void> => {
    const ref = parseGitRef(await get(`git/ref/tags/${releaseTag}`));
    if (ref.object.type !== "tag") throw new Error(`${releaseTag} is a lightweight tag; never overwrite it`);
    const tag = parseGitTag(await get(`git/tags/${ref.object.sha}`));
    requireAnnotatedTag(ref, tag, releaseTag, expectedSha);
  };
  const preflight = async (): Promise<void> => {
    await mainIsCurrent();
    requireSuccessfulCi(await runsFor("ci.yml"), expectedSha);
    await noExistingRelease();
    await noPriorRun();
  };
  await preflight();
  const existingRef = await request("GET", `git/ref/tags/${releaseTag}`, undefined, true);
  if (existingRef) {
    await verifyRemoteTag();
  } else {
    const tagResponse = await request("POST", "git/tags", {
      tag: releaseTag,
      message: releaseTag,
      object: expectedSha,
      type: "commit",
    });
    const tag = parseCreatedTag(tagResponse);
    await mainIsCurrent();
    await request("POST", "git/refs", { ref: `refs/tags/${releaseTag}`, sha: tag.sha });
    await verifyRemoteTag();
  }
  await preflight();
  const draft = parseCreatedDraft(
    await request("POST", "releases", {
      tag_name: releaseTag,
      target_commitish: expectedSha,
      name: releaseTag,
      body: notes,
      draft: true,
      prerelease: false,
      make_latest: "false",
      generate_release_notes: false,
    }),
  );
  await mainIsCurrent();
  await verifyRemoteTag();
  await noPriorRun();
  const verifiedDraft = parseRelease(await get(`releases/${draft.id}`));
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
    dependencies.dispatch(repository, releaseTag);
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
      dependencies.summary(summary);
      return;
    }
    await dependencies.delay(3_000);
  }
  throw new Error(
    `Dispatch accepted but run is not visible. Keep ${draft.html_url}; inspect Actions, do not redispatch.`,
  );
};

export const runStartReleaseWorkflow = async (
  env: ReleaseEnvironment,
  dependencies: StartReleaseDependencies = createStartReleaseDependencies(env),
): Promise<void> => {
  try {
    await executeStartRelease(env, dependencies);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error), { cause: error });
  }
};
