import { describe, expect, it } from "vitest";

import {
  extractMiseRunTasks,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "./repo-contract-parser";

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

  describe("extractMiseRunTasks", () => {
    const shardTemplate = `${String.fromCharCode(36)}{{ matrix.shard }}`;

    it("extracts every `mise run` on one line", () => {
      expect(extractMiseRunTasks("run: mise run a && mise run b")).toEqual(["a", "b"]);
    });

    it("splits `:::`-separated tasks", () => {
      expect(extractMiseRunTasks("run: mise run lint:types ::: lint:biome")).toEqual(["lint:types", "lint:biome"]);
    });

    it("expands the shard matrix suffix against the same source", () => {
      const source = ["shard: [1, 2]", `run: mise run test:dom:shard${shardTemplate}`].join("\n");

      expect(extractMiseRunTasks(source)).toEqual(["test:dom:shard1", "test:dom:shard2"]);
    });

    it("throws when a shard template has no shard matrix", () => {
      expect(() => extractMiseRunTasks(`run: mise run test:dom:shard${shardTemplate}`)).toThrow(/shard: \[\.\.\.\]/);
    });
  });
});
