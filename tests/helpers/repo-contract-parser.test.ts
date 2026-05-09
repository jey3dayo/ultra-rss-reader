import { describe, expect, it } from "vitest";

import {
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
      'labels: ["bug", "category/tests"]',
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

    expect(extractYamlInlineListValues(fixture, "labels")).toEqual(["bug", "category/tests"]);
    expect(extractYamlTopLevelKeys(fixture)).toEqual(["bug", "category/tests", "categories"]);
    expect(extractYamlLabelsFields(fixture)).toEqual(["bug", "category/tests"]);
  });
});
