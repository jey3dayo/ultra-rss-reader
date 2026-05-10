import { describe, expect, it } from "vitest";

import {
  extractIssueTemplateDoneWhenDescription,
  extractIssueTemplateDoneWhenPlaceholder,
  extractMarkdownCheckboxLabels,
  extractMarkdownSection,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "./repo-contract-parser";

describe("repo contract parser helpers", () => {
  it("extracts markdown sections and unchecked checkbox labels from fixtures", () => {
    const fixture = [
      "# Pull Request",
      "",
      "## 確認済み",
      "- [ ] 型エラー 0 件",
      "- [ ] リント違反 0 件",
      "- [x] 手動確認済み",
      "",
      "## メモ",
      "- [ ] 対象外",
      "",
    ].join("\n");

    expect(extractMarkdownSection(fixture, "確認済み")).toContain("- [ ] 型エラー 0 件");
    expect(extractMarkdownCheckboxLabels(fixture, "確認済み")).toEqual(["型エラー 0 件", "リント違反 0 件"]);
    expect(extractMarkdownCheckboxLabels(fixture, "存在しない")).toEqual([]);
  });

  it("extracts YAML-ish labels from fixtures", () => {
    const fixture = [
      "labels: ['bug', \"category/tests\", 'needs, comma', 'literal # value', 'literal [bracket]'] # default labels",
      "assignees:",
      "  - 'octo-user'",
      '  - "release[bot]" # bot account',
      "",
      "bug:",
      "  - changed-files:",
      "      - any-glob-to-any-file: src/**",
      "category/tests:",
      "",
      "categories:",
      '  - title: "Bug fixes"',
      '    labels: ["bug", "*"]',
      '  - title: "Tests"',
      '    labels: ["category/tests"]',
      "",
    ].join("\n");

    expect(extractYamlInlineListValues(fixture, "labels")).toEqual([
      "bug",
      "category/tests",
      "needs, comma",
      "literal # value",
      "literal [bracket]",
    ]);
    expect(extractYamlInlineListValues(fixture, "assignees")).toEqual(["octo-user", "release[bot]"]);
    expect(extractYamlTopLevelKeys(fixture)).toEqual(["assignees", "bug", "category/tests", "categories"]);
    expect(extractYamlLabelsFields(fixture)).toEqual(["bug", "category/tests"]);
  });

  it("extracts issue template Done When attributes from fixtures", () => {
    const fixture = [
      "body:",
      "  - type: textarea",
      "    id: done-when",
      "    attributes:",
      "      label: Done When",
      "      description: PR DoD 共通 gate、bug 固有 gate、manual verification gate を分けて完了条件を書いてください",
      "      placeholder: |",
      "        - [ ] PR DoD 共通 gate（型・lint・test・format）が通っている",
      "        - [ ] PR 作成時は PR template の確認済み DoD を満たす",
      "    validations:",
      "      required: true",
      "  - type: textarea",
      "    id: notes",
      "",
    ].join("\n");

    expect(extractIssueTemplateDoneWhenDescription(fixture)).toContain("manual verification gate");
    expect(extractIssueTemplateDoneWhenPlaceholder(fixture)).toContain("PR template の確認済み DoD");
  });
});
