import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sha: "a".repeat(40),
  exec: vi.fn(),
  notes: "## [0.64.4]\n\n### Maintenance\n\n- Release change\n",
}));
vi.mock("node:child_process", () => ({ execFileSync: state.exec }));
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (path: string) => (path === "CHANGELOG.md" ? state.notes : actual.readFileSync(path)),
  };
});

import { requireBuildSlot } from "../scripts/release/guard-release-build";
import { startRelease } from "../scripts/release/start-release";

const tag = "v0.64.4";
const draft = {
  id: 12,
  tag_name: tag,
  draft: true,
  body: "### Maintenance\n\n- Release change",
  assets: [],
  html_url: "https://github.com/o/r/releases/tag/v0.64.4",
};

describe("release side effects", () => {
  let tagExists: boolean;
  let draftExists: boolean;
  let dispatched: boolean;
  let otherRelease: boolean;
  let dispatchFails: boolean;
  let mainMoved: boolean;
  let priorRun: boolean;
  let writes: string[];

  beforeEach(() => {
    tagExists = false;
    draftExists = false;
    dispatched = false;
    otherRelease = false;
    dispatchFails = false;
    mainMoved = false;
    priorRun = false;
    writes = [];
    for (const [name, value] of Object.entries({
      RELEASE_TAG: tag,
      EXPECTED_SHA: state.sha,
      GITHUB_SHA: state.sha,
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "o/r",
      GH_TOKEN: "test-only-placeholder",
      GITHUB_STEP_SUMMARY: "",
    }))
      vi.stubEnv(name, value);
    state.exec.mockReset().mockImplementation((command: string, args: string[]) => {
      if (command === "git") return state.sha;
      if (command === "gh") {
        expect(args).toEqual([
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
        ]);
        writes.push("dispatch");
        if (dispatchFails) throw new Error("uncertain dispatch");
        dispatched = true;
      }
      return "";
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = input.replace("https://api.github.com/repos/o/r/", "");
        const method = init?.method ?? "GET";
        if (input === "https://api.github.com/graphql") {
          const nodes = otherRelease
            ? [{ tagName: "other-tag", tagCommit: { oid: state.sha }, url: "existing" }]
            : draftExists
              ? [{ tagName: tag, tagCommit: { oid: state.sha }, url: draft.html_url }]
              : [];
          return Response.json({
            data: { repository: { releases: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } },
          });
        }
        if (method === "POST") writes.push(path);
        if (path === "git/ref/heads/main")
          return Response.json({ object: { type: "commit", sha: mainMoved ? "b".repeat(40) : state.sha } });
        if (path.startsWith("actions/workflows/ci.yml/"))
          return Response.json({
            workflow_runs: [
              {
                id: 1,
                head_sha: state.sha,
                head_branch: "main",
                event: "push",
                status: "completed",
                conclusion: "success",
              },
            ],
          });
        if (path.startsWith("actions/workflows/release.yml/"))
          return Response.json({
            workflow_runs:
              dispatched || priorRun
                ? [
                    {
                      id: 2,
                      head_sha: state.sha,
                      head_branch: tag,
                      event: "workflow_dispatch",
                      html_url: "https://github.com/o/r/actions/runs/2",
                    },
                  ]
                : [],
          });
        if (path === `git/ref/tags/${tag}`)
          return tagExists
            ? Response.json({ object: { type: "tag", sha: "c".repeat(40) } })
            : new Response("", { status: 404 });
        if (path === "git/tags" && method === "POST") return Response.json({ sha: "c".repeat(40) });
        if (path === "git/refs" && method === "POST") {
          tagExists = true;
          return Response.json({});
        }
        if (path.startsWith("git/tags/")) return Response.json({ tag, object: { type: "commit", sha: state.sha } });
        if (path === "releases" && method === "POST") {
          draftExists = true;
          return Response.json(draft);
        }
        if (path === "releases/12") return Response.json(draft);
        throw new Error(`Unexpected ${method} ${path}`);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("creates an annotated tag and draft before one exact-tag dispatch", async () => {
    await startRelease();
    expect(writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
  });
  it("reuses only a matching tag-only partial attempt", async () => {
    tagExists = true;
    await startRelease();
    expect(writes).toEqual(["releases", "dispatch"]);
  });
  it("stops before writes when main moved, a same-SHA release exists, or a prior run exists", async () => {
    mainMoved = true;
    await expect(startRelease()).rejects.toThrow("main is");
    mainMoved = false;
    otherRelease = true;
    await expect(startRelease()).rejects.toThrow("Release already exists");
    otherRelease = false;
    priorRun = true;
    await expect(startRelease()).rejects.toThrow("Release run already exists");
    expect(writes).toEqual([]);
  });
  it("preserves the draft and blocks a retry after an uncertain dispatch", async () => {
    dispatchFails = true;
    await expect(startRelease()).rejects.toThrow("Dispatch failed or is uncertain");
    expect(draftExists).toBe(true);
    await expect(startRelease()).rejects.toThrow("Release already exists");
    expect(writes).toEqual(["git/tags", "git/refs", "releases", "dispatch"]);
  });
});

describe("serialized release build slot", () => {
  it("permits the first empty draft and an explicit rerun of the same run ID", () => {
    expect(() => requireBuildSlot([draft], [{ id: 2, head_sha: state.sha }], tag, state.sha, 2, false)).not.toThrow();
  });
  it("blocks queued duplicates even when the earlier run left no assets", () => {
    expect(() => requireBuildSlot([draft], [{ id: 1, head_sha: state.sha }], tag, state.sha, 2, false)).toThrow(
      "earlier",
    );
  });
  it("blocks published or partial releases, permitting only explicit draft-asset validation", () => {
    const partial = { ...draft, assets: [{}] };
    expect(() => requireBuildSlot([partial], [], tag, state.sha, 2, false)).toThrow("assets");
    expect(() => requireBuildSlot([partial], [], tag, state.sha, 2, true)).not.toThrow();
    expect(() => requireBuildSlot([{ ...partial, draft: false }], [], tag, state.sha, 2, true)).toThrow("published");
    expect(() => requireBuildSlot([], [], tag, state.sha, 2, true)).toThrow("existing draft");
  });
});
