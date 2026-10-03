import { describe, expect, it } from "vitest";
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
