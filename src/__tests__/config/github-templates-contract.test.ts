import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

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

  describe("label-sync workflow", () => {
    const source = readRepoFile(".github/workflows/label-sync.yml");

    it("runs pull requests only from the same repository", () => {
      expect(extractWorkflowJobIf(source, "sync")).toBe(
        "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository",
      );
    });

    it("never prunes labels that are missing from labels.yml", () => {
      expect(source).toMatch(/^ {10}skip-delete: true$/m);
    });

    it("applies changes only on main and dry-runs every other ref", () => {
      expect(source).toContain("dry-run: $" + "{{ github.ref != 'refs/heads/main' }}");
    });
  });

  describe("labels.yml definitions", () => {
    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null;
    }

    function stringList(value: unknown): string[] {
      if (typeof value === "string") {
        return value
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }
      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    }

    const labelsDocument: unknown = parseYaml(readRepoFile(".github/labels.yml"));
    const labelEntries: Record<string, unknown>[] = Array.isArray(labelsDocument)
      ? labelsDocument.filter(isRecord)
      : [];
    const definedNames = new Set(
      labelEntries.map((entry) => entry.name).filter((name): name is string => typeof name === "string"),
    );

    it("defines every label referenced by labeler, release categories, and issue templates", () => {
      const referenced = new Set<string>();

      const labelerDocument: unknown = parseYaml(readRepoFile(".github/labeler.yml"));
      if (isRecord(labelerDocument)) {
        for (const name of Object.keys(labelerDocument)) {
          referenced.add(name);
        }
      }

      const releaseDocument: unknown = parseYaml(readRepoFile(".github/release.yml"));
      const changelog = isRecord(releaseDocument) ? releaseDocument.changelog : undefined;
      if (isRecord(changelog)) {
        const exclude = changelog.exclude;
        if (isRecord(exclude)) {
          for (const name of stringList(exclude.labels)) {
            referenced.add(name);
          }
        }
        const categories = Array.isArray(changelog.categories) ? changelog.categories : [];
        for (const category of categories) {
          if (!isRecord(category)) {
            continue;
          }
          for (const name of stringList(category.labels)) {
            if (name !== "*") {
              referenced.add(name);
            }
          }
        }
      }

      const templateDir = join(repoRoot, ".github/ISSUE_TEMPLATE");
      for (const file of readdirSync(templateDir)) {
        if (!file.endsWith(".yml") && !file.endsWith(".yaml")) {
          continue;
        }
        const templateDocument: unknown = parseYaml(readRepoFile(join(".github/ISSUE_TEMPLATE", file)));
        if (isRecord(templateDocument)) {
          for (const name of stringList(templateDocument.labels)) {
            referenced.add(name);
          }
        }
      }

      const missing = [...referenced].filter((name) => !definedNames.has(name)).toSorted();
      expect(missing).toEqual([]);
    });

    it("keeps at least one definition for each dynamically applied label family", () => {
      // risk/*, size/*, and auto/* are applied by pr-insights-labeler at
      // runtime, so no static file references them by full name.
      for (const prefix of ["risk/", "size/", "auto/"]) {
        const hasDefinition = [...definedNames].some((name) => name.startsWith(prefix));
        expect(hasDefinition, prefix).toBe(true);
      }
    });

    it("stores every label color as a lowercase six-digit hex string", () => {
      expect(labelEntries.length).toBeGreaterThan(0);
      for (const entry of labelEntries) {
        const name = typeof entry.name === "string" ? entry.name : "(unnamed)";
        expect(typeof entry.color, name).toBe("string");
        expect(entry.color, name).toMatch(/^[0-9a-f]{6}$/);
      }
    });
  });
});
