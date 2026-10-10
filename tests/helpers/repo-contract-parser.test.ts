import { describe, expect, it } from "vitest";

import { extractYamlInlineListValues, extractYamlLabelsFields, extractYamlTopLevelKeys } from "./repo-contract-parser";

describe("repo contract parser helpers", () => {
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
});
