import { describe, expect, it } from "vitest";
import {
  parseBuildReleases,
  parseBuildRuns,
  parseCommit,
  parseCreatedDraft,
  parseCreatedTag,
  parseGitRef,
  parseGitTag,
  parseRelease,
  parseReleaseQuery,
  parseReleaseTarget,
  parseWorkflowRuns,
} from "../scripts/release/lib/release-start-policy";
import {
  extractReleaseNotes,
  requireAnnotatedTag,
  requireExpectedMain,
  requireSuccessfulCi,
  validateStartInputs,
} from "../scripts/release/start-release";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const tagObjectSha = "c".repeat(40);
const run = {
  id: 1,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/example/repository/actions/runs/1",
};

describe("release starter", () => {
  it("accepts only strict stable tags and full commit SHAs", () => {
    expect(() => validateStartInputs("v0.65.0", sha)).not.toThrow();
    for (const tag of ["0.65.0", "v00.65.0", "v0.65.0-rc.1", "v0.65.0+build.1", "v0.65.0\nx", "v0.65.0\n"]) {
      expect(() => validateStartInputs(tag, sha)).toThrow();
    }
    for (const value of [sha.slice(1), `${sha}a`, "g".repeat(40), `${sha}\n`]) {
      expect(() => validateStartInputs("v0.65.0", value)).toThrow();
    }
  });

  it("rejects a main commit that moved", () => {
    expect(() => requireExpectedMain(sha, sha)).not.toThrow();
    expect(() => requireExpectedMain(otherSha, sha)).toThrow();
  });

  it("extracts only the exact nonempty changelog section", () => {
    const changelog =
      "# Changelog\n\n## [Unreleased]\n\n## [0.65.0] - 2026-10-03\n\n" +
      "### Features\n\n- 日本語の変更内容\n\n## [0.64.3] - 2026-09-29\n\n- Old entry\n";
    expect(extractReleaseNotes(changelog, "v0.65.0")).toBe("### Features\n\n- 日本語の変更内容");
    expect(extractReleaseNotes(changelog.replace(/\n/g, "\r\n"), "v0.65.0")).toBe("### Features\n\n- 日本語の変更内容");
    expect(() => extractReleaseNotes(changelog, "v0.65.1")).toThrow();
    expect(() => extractReleaseNotes(`${changelog}\n## [0.65.0]\n\nDuplicate\n`, "v0.65.0")).toThrow();
    expect(() => extractReleaseNotes("## [0.65.0]\n\n## [0.64.3]\n\nOld\n", "v0.65.0")).toThrow();
  });

  it("requires the latest exact-SHA main-push CI to succeed", () => {
    expect(requireSuccessfulCi([run], sha)).toEqual(run);
    expect(() => requireSuccessfulCi([{ ...run, head_sha: otherSha }], sha)).toThrow();
    expect(() => requireSuccessfulCi([{ ...run, event: "pull_request" }], sha)).toThrow();
    expect(() => requireSuccessfulCi([{ ...run, head_branch: "feature" }], sha)).toThrow();
    expect(() => requireSuccessfulCi([run, { ...run, id: 2, status: "in_progress", conclusion: null }], sha)).toThrow();
    expect(() => requireSuccessfulCi([run, { ...run, id: 2, conclusion: "failure" }], sha)).toThrow();
  });

  it("requires an annotated tag pointing directly to the expected commit", () => {
    const ref = { object: { type: "tag", sha: tagObjectSha } };
    const tag = { tag: "v0.65.0", object: { type: "commit", sha } };
    expect(() => requireAnnotatedTag(ref, tag, "v0.65.0", sha)).not.toThrow();
    expect(() => requireAnnotatedTag({ object: { type: "commit", sha } }, tag, "v0.65.0", sha)).toThrow();
    expect(() =>
      requireAnnotatedTag(ref, { ...tag, object: { type: "commit", sha: otherSha } }, "v0.65.0", sha),
    ).toThrow();
    expect(() => requireAnnotatedTag(ref, { ...tag, object: { type: "tag", sha } }, "v0.65.0", sha)).toThrow();
    expect(() => requireAnnotatedTag(ref, { ...tag, tag: "v0.65.1" }, "v0.65.0", sha)).toThrow();
  });
});

describe("cold GitHub response validation", () => {
  const draft = { id: 12, tag_name: "v0.65.0", draft: true, body: null, html_url: "draft", assets: [] };
  const query = {
    data: {
      repository: {
        releases: {
          nodes: [{ databaseId: 12, tagName: "v0.65.0", tagCommit: null, url: "draft" }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  };

  it("preserves nullable release metadata and unresolved GraphQL targets", () => {
    expect(parseRelease(draft)).toEqual(draft);
    expect(parseWorkflowRuns({ workflow_runs: [{ ...run, head_branch: null, conclusion: null }] })).toEqual({
      workflow_runs: [{ ...run, head_branch: null, conclusion: null }],
    });
    expect(parseReleaseQuery(query)).toEqual(query);
    expect(parseReleaseQuery({ errors: ["denied"], data: null })).toEqual({ errors: ["denied"], data: null });
    expect(parseReleaseQuery({ data: { repository: null } })).toEqual({ data: { repository: null } });
    expect(parseReleaseTarget({})).toEqual({});
    expect(parseReleaseTarget({ target_commitish: 42 })).toEqual({ target_commitish: 42 });
  });

  it.each([
    ["main ref", parseGitRef, { object: { type: "commit", sha: 42 } }],
    ["annotated tag", parseGitTag, { tag: "v0.65.0", object: null }],
    ["resolved commit", parseCommit, {}],
    ["draft inventory", parseBuildReleases, [{ ...draft, assets: null }]],
    ["draft status", parseBuildReleases, [{ ...draft, draft: "true" }]],
    ["build run ID", parseBuildRuns, { workflow_runs: [{ id: "1", head_sha: sha }] }],
    ["build run collection", parseBuildRuns, { workflow_runs: null }],
    ["CI SHA", parseWorkflowRuns, { workflow_runs: [{ ...run, head_sha: 42 }] }],
    ["CI conclusion", parseWorkflowRuns, { workflow_runs: [{ ...run, conclusion: undefined }] }],
    ["draft notes", parseRelease, { ...draft, body: 42 }],
    ["draft ID", parseRelease, { ...draft, id: Number.NaN }],
    ["GraphQL errors", parseReleaseQuery, { errors: "denied" }],
    ["GraphQL data", parseReleaseQuery, { data: {} }],
    ["release target", parseReleaseTarget, null],
    [
      "GraphQL pagination",
      parseReleaseQuery,
      { data: { repository: { releases: { nodes: [], pageInfo: { hasNextPage: "false", endCursor: null } } } } },
    ],
    [
      "GraphQL tag commit",
      parseReleaseQuery,
      {
        data: {
          repository: {
            releases: {
              ...query.data.repository.releases,
              nodes: [{ databaseId: 12, tagName: "v0.65.0", tagCommit: { oid: 42 }, url: "draft" }],
            },
          },
        },
      },
    ],
  ])("rejects malformed %s before it can inform release writes", (_name, parse, value) => {
    expect(() => parse(value)).toThrow("Invalid GitHub response:");
  });

  it("keeps the created-tag and created-draft failure messages", () => {
    for (const value of [{}, { sha: "" }, { sha: 42 }]) {
      expect(() => parseCreatedTag(value)).toThrow("GitHub did not return the annotated tag object");
    }
    for (const value of [{}, { ...draft, id: 0 }, { ...draft, assets: null }]) {
      expect(() => parseCreatedDraft(value)).toThrow("GitHub did not return the created draft");
    }
  });
});
