import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractTopLevelWorkflowPermissions(source: string): Record<string, string> {
  const permissionsSection = source.match(/^permissions:\n((?: {2}[A-Za-z-]+:\s+\S+\n?)+)/m)?.[1] ?? "";
  return Object.fromEntries(
    [...permissionsSection.matchAll(/^ {2}([A-Za-z-]+):\s+(\S+)$/gm)].map((match) => [match[1] ?? "", match[2] ?? ""]),
  );
}

function extractWorkflowJobIf(source: string, jobId: string): string {
  return (
    source.match(new RegExp(`^  ${jobId}:\\n(?:    .+\\n)*?    if: (.+)$`, "m"))?.[1] ??
    source.match(new RegExp(`^  ${jobId}:\\n    if: (.+)$`, "m"))?.[1] ??
    ""
  );
}

describe("GitHub templates contract", () => {
  it("keeps release-readiness ownership in labeler", () => {
    const labeler = readRepoFile(".github/labeler.yml");

    expect(labeler).toContain("release-readiness:");
    expect(labeler).toContain('".github/release.yml"');
    expect(labeler).toContain('".github/workflows/release.yml"');
    expect(labeler).toContain('"src-tauri/tauri.release.conf.json"');
  });

  it("keeps write-permission labeler workflows scoped to same-repository pull requests", () => {
    const sameRepositoryPullRequestOnly =
      "$" + "{{ github.event.pull_request.head.repo.full_name == github.repository }}";
    const workflows = [".github/workflows/labeler.yml", ".github/workflows/pr-insights-labeler.yml"] as const;

    for (const path of workflows) {
      const source = readRepoFile(path);
      const permissions = extractTopLevelWorkflowPermissions(source);
      const writePermissions = Object.entries(permissions)
        .filter(([, access]) => access === "write")
        .map(([permission]) => permission)
        .toSorted();

      expect(writePermissions.length, path).toBeGreaterThan(0);
      expect(writePermissions, path).not.toContain("contents");
      expect(extractWorkflowJobIf(source, "label"), path).toBe(sameRepositoryPullRequestOnly);
    }
  });
});
