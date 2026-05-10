import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const issueTemplateDirectory = join(repoRoot, ".github/ISSUE_TEMPLATE");
const issueTemplatePaths = readdirSync(issueTemplateDirectory)
  .filter((fileName) => fileName.endsWith(".yml"))
  .filter((fileName) => fileName !== "config.yml")
  .map((fileName) => `.github/ISSUE_TEMPLATE/${fileName}`)
  .toSorted();

const expectedTopLevelKeys = ["name", "description", "title", "labels", "body"] as const;
const expectedQualityGateLabels = [
  "型エラー 0 件 (`mise run check` の `lint:types`)",
  "リント違反 0 件 (`mise run check` の `lint`)",
  "全テスト成功 (`mise run check` の `test`)",
  "フォーマッター適用済み (`mise run check` の `format`)",
  "release / native / Storybook / manual verification / release readiness 影響時は `mise run ci` または focused test を確認内容へ記録",
] as const;
const expectedRequiredFieldIdsByTemplate = {
  "01-feature.yml": ["summary", "background", "scope", "done-when"],
  "02-bug.yml": ["current-behavior", "expected-behavior", "reproduction", "impact", "done-when"],
  "03-test-verification.yml": ["background", "scenarios", "prerequisites", "done-when"],
  "04-maintenance.yml": ["summary", "background", "scope", "done-when"],
} as const satisfies Record<string, readonly string[]>;

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractTopLevelKeys(source: string): string[] {
  return [...source.matchAll(/^([a-z-]+):/gm)].map((match) => match[1] ?? "");
}

function extractTemplateBodyItems(source: string): string[] {
  return [...`${source}\n  - type: __sentinel\n`.matchAll(/^ {2}- type: [\s\S]*?(?=^ {2}- type: )/gm)].map(
    (match) => match[0],
  );
}

function extractFieldId(bodyItem: string): string | null {
  return bodyItem.match(/^\s+id: ([a-z0-9-]+)$/m)?.[1] ?? null;
}

function extractRequiredFieldIds(source: string): string[] {
  return extractTemplateBodyItems(source)
    .filter((bodyItem) => bodyItem.includes("\n    validations:\n      required: true"))
    .map(extractFieldId)
    .filter((fieldId): fieldId is string => fieldId !== null);
}

function extractCheckboxLabels(source: string, fieldId: string): string[] {
  const bodyItem = extractTemplateBodyItems(source).find((item) => item.includes(`\n    id: ${fieldId}\n`)) ?? "";
  return [...bodyItem.matchAll(/^\s+- label: (.+)$/gm)].map((match) => match[1] ?? "");
}

function extractRequiredCheckboxLabels(source: string, fieldId: string): string[] {
  const bodyItem = extractTemplateBodyItems(source).find((item) => item.includes(`\n    id: ${fieldId}\n`)) ?? "";
  return [...bodyItem.matchAll(/^\s+- label: (.+)\n\s+required: true$/gm)].map((match) => match[1] ?? "");
}

function extractMarkdownCheckboxLabels(source: string, heading: string): string[] {
  const sectionStart = source.indexOf(`## ${heading}`);
  const nextSectionStart = source.indexOf("\n## ", sectionStart + 1);
  const section =
    sectionStart < 0 ? "" : source.slice(sectionStart, nextSectionStart < 0 ? undefined : nextSectionStart);
  return [...section.matchAll(/^- \[ \] (.+)$/gm)].map((match) => match[1] ?? "");
}

function normalizeQualityGateLabel(label: string): string {
  return label.replace("影響時: ", "影響時は ");
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
  it("keeps issue template YAML shape and required fields explicit", () => {
    expect(issueTemplatePaths).toEqual([
      ".github/ISSUE_TEMPLATE/01-feature.yml",
      ".github/ISSUE_TEMPLATE/02-bug.yml",
      ".github/ISSUE_TEMPLATE/03-test-verification.yml",
      ".github/ISSUE_TEMPLATE/04-maintenance.yml",
    ]);

    for (const path of issueTemplatePaths) {
      const source = readRepoFile(path);
      const fileName = path.split("/").at(-1);

      expect(extractTopLevelKeys(source), path).toEqual(expectedTopLevelKeys);
      expect(source, path).toContain("labels: [");
      expect(source, path).toContain("body:");
      expect(new Set(extractTemplateBodyItems(source).map(extractFieldId).filter(Boolean)).size, path).toBe(
        extractTemplateBodyItems(source).map(extractFieldId).filter(Boolean).length,
      );

      if (fileName !== undefined && fileName in expectedRequiredFieldIdsByTemplate) {
        expect(extractRequiredFieldIds(source), path).toEqual(
          expectedRequiredFieldIdsByTemplate[fileName as keyof typeof expectedRequiredFieldIdsByTemplate],
        );
      }
    }
  });

  it("keeps issue quality gate checkboxes aligned with the PR template", () => {
    const pullRequestTemplate = readRepoFile(".github/PULL_REQUEST_TEMPLATE.md");
    const prQualityGateLabels = extractMarkdownCheckboxLabels(pullRequestTemplate, "確認済み")
      .filter((label) => !label.startsWith("動作確認完了"))
      .filter((label) => !label.startsWith("環境変数の変更時"))
      .map(normalizeQualityGateLabel);

    expect(prQualityGateLabels).toEqual([...expectedQualityGateLabels]);

    for (const path of issueTemplatePaths) {
      const source = readRepoFile(path);
      expect(extractCheckboxLabels(source, "quality-gate"), path).toEqual([...expectedQualityGateLabels]);
      expect(extractRequiredCheckboxLabels(source, "quality-gate"), path).toEqual([...expectedQualityGateLabels]);
    }
  });

  it("keeps release-readiness ownership synchronized between issue forms and labeler", () => {
    const labeler = readRepoFile(".github/labeler.yml");

    expect(labeler).toContain("release-readiness:");
    expect(labeler).toContain('".github/release.yml"');
    expect(labeler).toContain('".github/workflows/release.yml"');
    expect(labeler).toContain('"src-tauri/tauri.release.conf.json"');

    for (const path of issueTemplatePaths) {
      const source = readRepoFile(path);
      expect(source, path).toContain("`release-readiness` は release 設定変更では `.github/labeler.yml` が付与");
    }
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

  it("keeps bug report diagnostics guidance privacy-safe", () => {
    const bugReport = readRepoFile(".github/ISSUE_TEMPLATE/02-bug.yml");

    expect(bugReport).toContain("diagnostics export の redacted subset");
    expect(bugReport).toContain("privacy-safe な最小証跡");
    expect(bugReport).toContain("raw database backup");
    expect(bugReport).toContain("keychain export");
    expect(bugReport).toContain("token や account URL を含む診断一式は添付しない");
  });
});
