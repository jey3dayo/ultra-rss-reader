import { describe, expect, it } from "vitest";
import { createGitHubClient, type ReleaseEnvironment } from "../scripts/release/lib/github-client";
import {
  type ReleaseSourceDependencies,
  ReleaseSourceValidationError,
} from "../scripts/release/lib/release-source-policy";
import { validateReleaseSource } from "../scripts/release/validate-source";
import { runReleaseBuildGuardWorkflow } from "../scripts/release/workflows/guard-release-build";
import { runReleaseSourceValidationWorkflow } from "../scripts/release/workflows/validate-source";

const tag = "v0.64.4";
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const tagObjectSha = "c".repeat(40);
const sourceEnv: ReleaseEnvironment = {
  EVENT_NAME: "workflow_dispatch",
  RELEASE_TAG: tag,
  WORKFLOW_REF: "refs/heads/main",
  WORKFLOW_REF_NAME: "main",
};
const buildEnv: ReleaseEnvironment = {
  RELEASE_TAG: tag,
  GITHUB_SHA: sha,
  GITHUB_REF: `refs/tags/${tag}`,
  GITHUB_RUN_ID: "2",
  GITHUB_REPOSITORY: "o/r",
  GH_TOKEN: "test-only-placeholder",
};

const sourceHarness = () => {
  const writes: string[][] = [];
  const notices: string[] = [];
  const state: {
    remoteExists: boolean;
    annotated: boolean;
    tagObjectSha: string;
    checkoutSha: string;
    reachable: boolean;
    fetchFailure?: Error;
  } = {
    remoteExists: true,
    annotated: true,
    tagObjectSha,
    checkoutSha: otherSha,
    reachable: true,
    fetchFailure: undefined,
  };
  const dependencies: ReleaseSourceDependencies = {
    git: (args) => {
      if (args[0] === "cat-file") return state.annotated ? "tag" : "commit";
      if (args[0] === "rev-parse") {
        if (args[1] === "HEAD") return state.checkoutSha;
        return args[1].endsWith("^{}") ? sha : state.tagObjectSha;
      }
      throw new Error(`Unexpected git ${args.join(" ")}`);
    },
    gitInherit: (args) => {
      writes.push([...args]);
      if (args[0] === "fetch" && state.fetchFailure) throw state.fetchFailure;
      if (args[0] === "checkout") state.checkoutSha = args[2];
    },
    gitSucceeds: (args) => {
      if (args[0] === "ls-remote") return state.remoteExists;
      if (args[0] === "merge-base") return state.reachable;
      throw new Error(`Unexpected git ${args.join(" ")}`);
    },
    notice: (message) => {
      notices.push(message);
    },
  };
  const run = (env: ReleaseEnvironment = sourceEnv) => runReleaseSourceValidationWorkflow(env, dependencies);
  return { state, dependencies, writes, notices, run };
};

const tagFetch = ["fetch", "--force", "--tags", "origin", `refs/tags/${tag}:refs/tags/${tag}`];
const mainFetch = ["fetch", "--force", "origin", "main:refs/remotes/origin/main"];

describe("release source workflow", () => {
  it("imports the CLI without reading release environment or executing git", () => {
    expect(validateReleaseSource).toBeTypeOf("function");
  });
  it("fetches the tag and main before checking out the exact peeled commit for a build dispatch", () => {
    const { run, writes, state } = sourceHarness();
    expect(() => run()).not.toThrow();
    expect(writes).toEqual([tagFetch, mainFetch, ["checkout", "--detach", sha]]);
    expect(state.checkoutSha).toBe(sha);
  });
  it("requires a pushed tag checkout to already match without replacing it", () => {
    const { run, writes, state } = sourceHarness();
    const env = { ...sourceEnv, EVENT_NAME: "push", WORKFLOW_REF: `refs/tags/${tag}`, WORKFLOW_REF_NAME: tag };
    expect(() => run(env)).toThrow("but checkout is");
    expect(writes).toEqual([tagFetch, mainFetch]);
    state.checkoutSha = sha;
    expect(() => run(env)).not.toThrow();
  });
  it("preserves the recovery checkout and emits a notice for a target outside main", () => {
    const { run, writes, state, notices } = sourceHarness();
    state.reachable = false;
    expect(() => run({ ...sourceEnv, REUSE_EXISTING_ASSETS: "true" })).not.toThrow();
    expect(writes).toEqual([tagFetch, mainFetch]);
    expect(state.checkoutSha).toBe(otherSha);
    expect(notices).toEqual([
      `::notice::release recovery is validating existing assets for ${tag}; tag target ${sha} is not reachable from origin/main`,
    ]);
  });
  it("rejects an unreachable build target", () => {
    const { run, state, notices } = sourceHarness();
    state.reachable = false;
    expect(() => run()).toThrow("not reachable from origin/main");
    expect(notices).toEqual([]);
  });
  it("does not fetch or checkout when the tag is absent on origin", () => {
    const { run, state, writes } = sourceHarness();
    state.remoteExists = false;
    expect(() => run()).toThrow("does not exist on origin");
    expect(writes).toEqual([]);
  });
  it("requires annotated metadata even during asset recovery", () => {
    const { run, state, writes } = sourceHarness();
    state.annotated = false;
    expect(() => run({ ...sourceEnv, REUSE_EXISTING_ASSETS: "true" })).toThrow("must be an annotated tag");
    expect(writes).toEqual([tagFetch, mainFetch]);
    state.annotated = true;
    state.tagObjectSha = sha;
    expect(() => run({ ...sourceEnv, REUSE_EXISTING_ASSETS: "true" })).toThrow("expected annotated tag metadata");
  });
  it.each([
    { RELEASE_TAG: "invalid" },
    { EVENT_NAME: "push", WORKFLOW_REF: "refs/heads/main" },
    { WORKFLOW_REF: "refs/tags/v0.1.0", WORKFLOW_REF_NAME: "v0.1.0" },
    { EVENT_NAME: "pull_request" },
  ])("rejects invalid event/ref context before native writes: %o", (overrides) => {
    const { run, writes } = sourceHarness();
    expect(() => run({ ...sourceEnv, ...overrides })).toThrow(ReleaseSourceValidationError);
    expect(writes).toEqual([]);
  });
  it("keeps missing-environment failures distinct from annotated GitHub errors", () => {
    const { run, writes } = sourceHarness();
    const invoke = () => run({ ...sourceEnv, EVENT_NAME: undefined });
    expect(invoke).toThrow("missing required environment variable EVENT_NAME");
    expect(invoke).not.toThrow(ReleaseSourceValidationError);
    expect(writes).toEqual([]);
  });
  it("propagates fetch failure without proceeding to checkout", () => {
    const { run, state, writes } = sourceHarness();
    state.fetchFailure = new Error("fetch failed");
    expect(() => {
      try {
        run();
      } catch (error) {
        expect(error).toBe(state.fetchFailure);
        throw error;
      }
    }).toThrow(state.fetchFailure);
    expect(writes).toEqual([tagFetch]);
  });
  it("normalizes a non-Error boundary failure with its cause", () => {
    const { run, dependencies } = sourceHarness();
    dependencies.gitSucceeds = () => {
      throw "native failure";
    };
    expect(() => run()).toThrow(expect.objectContaining({ message: "native failure", cause: "native failure" }));
  });
});

const buildHarness = () => {
  const paths: string[] = [];
  const state = {
    checkoutSha: sha,
    reuse: false,
    publishedOnSecondPage: false,
    priorRunOnSecondPage: false,
    malformedRelease: false,
    nonErrorFailure: false,
  };
  const requestFetch: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const path = url.replace("https://api.github.com/repos/o/r/", "");
    paths.push(path);
    if (state.nonErrorFailure) throw "request failed";
    if (path.startsWith("releases?")) {
      if (state.malformedRelease) return Response.json([{ tag_name: tag, draft: true, assets: null }]);
      if (state.publishedOnSecondPage) {
        return Response.json(
          path.endsWith("page=1")
            ? Array.from({ length: 100 }, () => ({ tag_name: "other", draft: false, assets: [] }))
            : [{ tag_name: tag, draft: false, assets: [] }],
        );
      }
      return Response.json([{ tag_name: tag, draft: true, assets: state.reuse ? [{}] : [] }]);
    }
    if (path.startsWith("actions/workflows/release.yml/runs?")) {
      if (state.reuse) throw new Error("Asset recovery must not request workflow runs");
      return Response.json({
        workflow_runs: state.priorRunOnSecondPage
          ? path.endsWith("page=1")
            ? Array.from({ length: 100 }, () => ({ id: 3, head_sha: otherSha }))
            : [{ id: 1, head_sha: sha }]
          : [{ id: 2, head_sha: sha }],
      });
    }
    throw new Error(`Unexpected path ${path}`);
  };
  const run = (env: ReleaseEnvironment = buildEnv) =>
    runReleaseBuildGuardWorkflow(env, {
      checkoutSha: () => {
        if (state.reuse) throw new Error("Asset recovery must not inspect the checkout");
        return state.checkoutSha;
      },
      github: (repository, token) => createGitHubClient(repository, token, "build", requestFetch),
    });
  return { state, paths, run };
};

describe("release build guard workflow", () => {
  it("accepts the same run ID on an empty draft", async () => {
    const { run } = buildHarness();
    await expect(run()).resolves.toBeUndefined();
  });
  it("validates only the existing draft inventory during asset recovery", async () => {
    const { run, state, paths } = buildHarness();
    state.reuse = true;
    await expect(
      run({ ...buildEnv, REUSE_EXISTING_ASSETS: "true", GITHUB_REF: "refs/heads/main" }),
    ).resolves.toBeUndefined();
    expect(paths).toEqual(["releases?per_page=100&page=1"]);
  });
  it("checks all release pages for published releases before claiming the build slot", async () => {
    const { run, state } = buildHarness();
    state.publishedOnSecondPage = true;
    await expect(run()).rejects.toThrow("published or ambiguous");
  });
  it("checks later run pages for an earlier owner of this commit", async () => {
    const { run, state } = buildHarness();
    state.priorRunOnSecondPage = true;
    await expect(run()).rejects.toThrow("earlier release run owns this commit");
  });
  it("rejects an incorrect ref or checkout before remote requests", async () => {
    const { run, state, paths } = buildHarness();
    await expect(run({ ...buildEnv, GITHUB_REF: "refs/heads/main" })).rejects.toThrow(
      "release tag as its workflow ref",
    );
    state.checkoutSha = otherSha;
    await expect(run()).rejects.toThrow("checked-out tag commit");
    expect(paths).toEqual([]);
  });
  it("rejects malformed release inventory instead of accepting it as an empty draft", async () => {
    const { run, state } = buildHarness();
    state.malformedRelease = true;
    await expect(run()).rejects.toThrow(Error);
  });
  it("normalizes a non-Error request failure at the workflow boundary", async () => {
    const { run, state } = buildHarness();
    state.nonErrorFailure = true;
    await expect(run()).rejects.toThrow(
      expect.objectContaining({ message: "request failed", cause: "request failed" }),
    );
  });
});

describe("shared GitHub transport", () => {
  it("keeps optional 404 handling and POST payloads at the start-release adapter", async () => {
    const payloads: unknown[] = [];
    const requestFetch: typeof fetch = async (_input, init) => {
      if (init?.method === "GET") return new Response("", { status: 404 });
      payloads.push(JSON.parse(String(init?.body)));
      return Response.json({ sha: tagObjectSha });
    };
    const client = createGitHubClient("o/r", "test-only-placeholder", "start", requestFetch);
    expect(await client.request("GET", "git/ref/tags/missing", undefined, true)).toBeUndefined();
    await expect(client.request("GET", "git/ref/tags/missing")).rejects.toThrow(
      "GitHub GET git/ref/tags/missing failed with HTTP 404; do not blindly retry writes",
    );
    expect(await client.request("POST", "git/tags", { object: sha })).toEqual({ sha: tagObjectSha });
    expect(payloads).toEqual([{ object: sha }]);
  });
  it.each([
    ["start", "GitHub GET releases failed with HTTP 403; do not blindly retry writes"],
    ["build", "Cannot verify release build slot: HTTP 403"],
  ] as const)("preserves the %s caller's HTTP failure without response bodies or tokens", async (caller, message) => {
    const requestFetch: typeof fetch = async () => new Response("sensitive body", { status: 403 });
    const client = createGitHubClient("o/r", "test-only-placeholder", caller, requestFetch);
    await expect(client.request("GET", "releases")).rejects.toThrow(message);
  });
});
