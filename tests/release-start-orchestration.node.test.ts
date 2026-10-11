import { describe, expect, it } from "vitest";
import { requireBuildSlot } from "../scripts/release/guard-release-build";
import { createGitHubClient, type ReleaseEnvironment } from "../scripts/release/lib/github-client";
import {
  createStartReleaseDependencies,
  type StartReleaseDependencies,
} from "../scripts/release/lib/release-start-policy";
import { runStartReleaseWorkflow } from "../scripts/release/workflows/start-release";

const sha = "a".repeat(40);
const tag = "v0.64.4";
const tagObjectSha = "c".repeat(40);
const draft = {
  id: 12,
  tag_name: tag,
  draft: true,
  body: "### Maintenance\n\n- Release change",
  assets: [],
  html_url: "https://github.com/o/r/releases/tag/v0.64.4",
};
const ciRun = {
  id: 1,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/o/r/actions/runs/1",
};
const releaseRun = {
  ...ciRun,
  id: 2,
  head_branch: tag,
  event: "workflow_dispatch",
  status: "queued",
  conclusion: null,
  html_url: "https://github.com/o/r/actions/runs/2",
};
const environment: ReleaseEnvironment = {
  RELEASE_TAG: tag,
  EXPECTED_SHA: sha,
  GITHUB_SHA: sha,
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "o/r",
  GH_TOKEN: "test-only-placeholder",
};

const createHarness = () => {
  const writes: string[] = [];
  const delays: number[] = [];
  const summaries: string[] = [];
  const state = {
    tagExists: false,
    draftExists: false,
    dispatched: false,
    otherRelease: false,
    dispatchFails: false,
    mainMoved: false,
    priorRun: false,
    unresolvedReleaseTarget: "",
    lightweightTag: false,
    wrongTagTarget: false,
    changedDraft: false,
    hideRun: false,
    ciFailed: false,
    moveMainAfter: "",
    priorRunAfter: "",
    writeFailure: "",
    missingWriteMetadata: "",
    ciPageTwoFails: false,
    secondReleasePage: false,
    invalidCursor: false,
    malformedCi: false,
    writes,
    delays,
    summaries,
  };
  const requestFetch: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const path = url.replace("https://api.github.com/repos/o/r/", "");
    const method = init?.method ?? "GET";
    if (url === "https://api.github.com/graphql") {
      const nodes = state.unresolvedReleaseTarget
        ? [{ databaseId: 99, tagName: "old-tag", tagCommit: null, url: "old-release" }]
        : state.otherRelease
          ? [{ databaseId: 99, tagName: "other-tag", tagCommit: { oid: sha }, url: "existing" }]
          : state.draftExists
            ? [{ databaseId: 12, tagName: tag, tagCommit: { oid: sha }, url: draft.html_url }]
            : [];
      const body: unknown = JSON.parse(String(init?.body));
      const after =
        typeof body === "object" &&
        body !== null &&
        "variables" in body &&
        typeof body.variables === "object" &&
        body.variables !== null &&
        "after" in body.variables
          ? body.variables.after
          : undefined;
      if (state.secondReleasePage && after === null) {
        return Response.json({
          data: {
            repository: {
              releases: {
                nodes: [],
                pageInfo: { hasNextPage: true, endCursor: "next" },
              },
            },
          },
        });
      }
      return Response.json({
        data: {
          repository: {
            releases: {
              nodes,
              pageInfo: {
                hasNextPage: state.invalidCursor,
                endCursor: null,
              },
            },
          },
        },
      });
    }
    if (method === "POST") {
      state.writes.push(path);
      if (state.moveMainAfter === path) state.mainMoved = true;
      if (state.priorRunAfter === path) state.priorRun = true;
      if (state.writeFailure === path) return new Response("", { status: 502 });
      if (state.missingWriteMetadata === path) return Response.json({});
    }
    if (path === "releases/99") return Response.json({ target_commitish: state.unresolvedReleaseTarget });
    if (path.startsWith("commits/")) return new Response("", { status: 404 });
    if (path === "git/ref/heads/main")
      return Response.json({ object: { type: "commit", sha: state.mainMoved ? "b".repeat(40) : sha } });
    if (path.startsWith("actions/workflows/ci.yml/")) {
      if (state.malformedCi) return Response.json({ workflow_runs: [{ ...ciRun, head_sha: 42 }] });
      const runs = state.ciPageTwoFails
        ? path.endsWith("page=1")
          ? Array.from({ length: 100 }, () => ciRun)
          : [{ ...ciRun, id: 3, status: "in_progress", conclusion: null }]
        : [{ ...ciRun, conclusion: state.ciFailed ? "failure" : "success" }];
      return Response.json({ workflow_runs: runs });
    }
    if (path.startsWith("actions/workflows/release.yml/"))
      return Response.json({
        workflow_runs: state.priorRun || (state.dispatched && !state.hideRun) ? [releaseRun] : [],
      });
    if (path === `git/ref/tags/${tag}`)
      return state.tagExists
        ? Response.json({ object: { type: state.lightweightTag ? "commit" : "tag", sha: tagObjectSha } })
        : new Response("", { status: 404 });
    if (path === "git/tags" && method === "POST") return Response.json({ sha: tagObjectSha });
    if (path === "git/refs" && method === "POST") {
      state.tagExists = true;
      return Response.json({});
    }
    if (path.startsWith("git/tags/"))
      return Response.json({ tag, object: { type: "commit", sha: state.wrongTagTarget ? "b".repeat(40) : sha } });
    if (path === "releases" && method === "POST") {
      state.draftExists = true;
      return Response.json(draft);
    }
    if (path === "releases/12") return Response.json({ ...draft, body: state.changedDraft ? "changed" : draft.body });
    throw new Error(`Unexpected ${method} ${path}`);
  };
  const dependencies: StartReleaseDependencies = {
    checkoutSha: () => sha,
    validateConfig: () => {},
    readChangelog: () => `## [0.64.4]\n\n${draft.body}\n`,
    github: (repository, token) => createGitHubClient(repository, token, "start", requestFetch),
    dispatch: (repository, releaseTag) => {
      expect(repository).toBe("o/r");
      expect(releaseTag).toBe(tag);
      state.writes.push("dispatch");
      if (state.dispatchFails) throw new Error("uncertain dispatch");
      state.dispatched = true;
    },
    delay: async (milliseconds) => {
      state.delays.push(milliseconds);
    },
    summary: (text) => {
      state.summaries.push(text);
    },
  };
  const start = (env: ReleaseEnvironment = environment) => runStartReleaseWorkflow(env, dependencies);
  return { state, dependencies, start };
};

describe("release side effects", () => {
  it("uses the exact tag dispatch and explicit build flags in the native adapter", () => {
    const commands: { command: string; args: readonly string[]; inherited: boolean }[] = [];
    const dependencies = createStartReleaseDependencies(environment, (command, args, options) => {
      commands.push({ command, args, inherited: options.stdio === "inherit" });
      return "";
    });
    dependencies.dispatch("o/r", tag);
    expect(commands).toEqual([
      {
        command: "gh",
        args: [
          "workflow",
          "run",
          "release.yml",
          "--repo",
          "o/r",
          "--ref",
          tag,
          "-f",
          `release_tag=${tag}`,
          "-f",
          "dry_run=false",
          "-f",
          "reuse_existing_assets=false",
          "-f",
          "build_linux=false",
        ],
        inherited: true,
      },
    ]);
  });
  it("preserves Error failures and normalizes non-Error failures at the start boundary", async () => {
    const { start, dependencies } = createHarness();
    const error = new Error("configuration failed");
    dependencies.validateConfig = () => {
      throw error;
    };
    await expect(start()).rejects.toBe(error);
    dependencies.validateConfig = () => {
      throw "configuration failed";
    };
    await expect(start()).rejects.toMatchObject({ message: "configuration failed", cause: "configuration failed" });
  });
  it("creates an annotated tag and draft before one exact-tag dispatch", async () => {
    const { state, start } = createHarness();
    await start();
    expect(state.writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
    expect(state.summaries[0]).toContain(releaseRun.html_url);
  });
  it("reuses only a matching tag-only partial attempt", async () => {
    const { state, start } = createHarness();
    state.tagExists = true;
    await start();
    expect(state.writes).toEqual(["releases", "dispatch"]);
  });
  it("allows an unrelated missing tag but rejects its explicit same-SHA release target", async () => {
    const { state, start } = createHarness();
    state.unresolvedReleaseTarget = sha;
    await expect(start()).rejects.toThrow("already targets this commit");
    expect(state.writes).toEqual([]);
    state.unresolvedReleaseTarget = "b".repeat(40);
    await start();
    expect(state.writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
  });
  it("stops before writes when main moved, a same-SHA release exists, or a prior run exists", async () => {
    const { state, start } = createHarness();
    state.mainMoved = true;
    await expect(start()).rejects.toThrow("main is");
    state.mainMoved = false;
    state.otherRelease = true;
    await expect(start()).rejects.toThrow("Release already exists");
    state.otherRelease = false;
    state.priorRun = true;
    await expect(start()).rejects.toThrow("Release run already exists");
    expect(state.writes).toEqual([]);
  });
  it("preserves the draft and blocks a retry after an uncertain dispatch", async () => {
    const { state, start } = createHarness();
    state.dispatchFails = true;
    await expect(start()).rejects.toThrow("Dispatch failed or is uncertain");
    expect(state.draftExists).toBe(true);
    await expect(start()).rejects.toThrow("Release already exists");
    expect(state.writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
  });
  it.each([
    ["git/tags", ["git/tags"]],
    ["git/refs", ["git/tags", "git/refs"]],
    ["releases", ["git/tags", "git/refs", "releases"]],
  ])("stops subsequent writes when main moves after %s", async (write, expectedWrites) => {
    const { state, start } = createHarness();
    state.moveMainAfter = write;
    await expect(start()).rejects.toThrow("main is");
    expect(state.writes).toEqual(expectedWrites);
  });
  it.each(["git/refs", "releases"])("blocks a competing dispatch appearing after %s", async (write) => {
    const { state, start } = createHarness();
    state.priorRunAfter = write;
    await expect(start()).rejects.toThrow("Release run already exists");
    expect(state.writes).not.toContain("dispatch");
  });
  it("keeps the draft without dispatch when its notes changed", async () => {
    const { state, start } = createHarness();
    state.changedDraft = true;
    await expect(start()).rejects.toThrow("Created draft changed unexpectedly");
    expect(state.draftExists).toBe(true);
    expect(state.writes).not.toContain("dispatch");
  });
  it.each(["lightweightTag", "wrongTagTarget"] as const)("does not overwrite an existing %s", async (field) => {
    const { state, start } = createHarness();
    state.tagExists = true;
    state[field] = true;
    await expect(start()).rejects.toThrow("never overwrite");
    expect(state.writes).toEqual([]);
  });
  it.each(["git/tags", "git/refs", "releases"])("does not retry an uncertain %s write", async (path) => {
    const { state, start } = createHarness();
    state.writeFailure = path;
    await expect(start()).rejects.toThrow("do not blindly retry writes");
    expect(state.writes.filter((write) => write === path)).toHaveLength(1);
    expect(state.writes).not.toContain("dispatch");
  });
  it.each([
    ["git/tags", "GitHub did not return the annotated tag object"],
    ["releases", "GitHub did not return the created draft"],
  ])("preserves the missing-metadata failure after creating %s", async (path, message) => {
    const { state, start } = createHarness();
    state.missingWriteMetadata = path;
    await expect(start()).rejects.toThrow(message);
    expect(state.writes).not.toContain("dispatch");
  });
  it("uses the established twenty polls at three-second intervals without redispatching", async () => {
    const { state, start } = createHarness();
    state.hideRun = true;
    await expect(start()).rejects.toThrow("Dispatch accepted but run is not visible");
    expect(state.delays).toEqual(Array.from({ length: 20 }, () => 3_000));
    expect(state.writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
    expect(state.draftExists).toBe(true);
  });
  it("checks later CI pages before creating the tag", async () => {
    const { state, start } = createHarness();
    state.ciPageTwoFails = true;
    await expect(start()).rejects.toThrow("Latest main-push");
    expect(state.writes).toEqual([]);
  });
  it("checks later release pages and rejects unusable cursors", async () => {
    const { state, start } = createHarness();
    state.secondReleasePage = true;
    state.otherRelease = true;
    await expect(start()).rejects.toThrow("Release already exists");
    state.secondReleasePage = false;
    state.otherRelease = false;
    state.invalidCursor = true;
    await expect(start()).rejects.toThrow("Invalid release cursor");
    expect(state.writes).toEqual([]);
  });
  it("permits an unrelated draft whose unresolved target returns an optional 404", async () => {
    const { state, start } = createHarness();
    state.unresolvedReleaseTarget = "deleted-ref";
    await start();
    expect(state.dispatched).toBe(true);
  });
  it("rejects malformed external CI data before writes", async () => {
    const { state, start } = createHarness();
    state.malformedCi = true;
    await expect(start()).rejects.toThrow();
    expect(state.writes).toEqual([]);
  });
  it("rejects an incorrect workflow source and local checkout before remote access", async () => {
    const { state, dependencies, start } = createHarness();
    await expect(start({ ...environment, GITHUB_REF: "refs/heads/other" })).rejects.toThrow("Dispatch this workflow");
    dependencies.checkoutSha = () => "b".repeat(40);
    await expect(start()).rejects.toThrow("main is");
    expect(state.writes).toEqual([]);
  });
});

describe("serialized release build slot", () => {
  it("permits the first empty draft and an explicit rerun of the same run ID", () => {
    expect(() => requireBuildSlot([draft], [{ id: 2, head_sha: sha }], tag, sha, 2, false)).not.toThrow();
  });
  it("blocks queued duplicates even when the earlier run left no assets", () => {
    expect(() => requireBuildSlot([draft], [{ id: 1, head_sha: sha }], tag, sha, 2, false)).toThrow("earlier");
  });
  it("blocks published or partial releases, permitting only explicit draft-asset validation", () => {
    const partial = { ...draft, assets: [{}] };
    expect(() => requireBuildSlot([partial], [], tag, sha, 2, false)).toThrow("assets");
    expect(() => requireBuildSlot([partial], [], tag, sha, 2, true)).not.toThrow();
    expect(() => requireBuildSlot([{ ...partial, draft: false }], [], tag, sha, 2, true)).toThrow("published");
    expect(() => requireBuildSlot([], [], tag, sha, 2, true)).toThrow("existing draft");
  });
});
