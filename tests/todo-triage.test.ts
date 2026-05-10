import { describe, expect, it } from "vitest";

import {
  buildTodoAgingReport,
  buildTodoMergeWorkflows,
  buildTodoShardPlans,
  exportWorkerIssues,
  findDuplicateTodoGroups,
  parseTodoMarkdown,
} from "../scripts/todo-triage";

const fixture = [
  "## Intake",
  "",
  "- [ ] P1 provider auth failure storm を止める",
  "  - 対象: `src-tauri/src/infra/provider`, `src-tauri/src/service/sync_scheduler.rs`",
  "  - 検証: provider Rust tests、manual native verification",
  "  - created batch: 2026-01-01 wave",
  "",
  "- [ ] P2 provider auth failure backoff contract を追加する",
  "  - 対象: `src-tauri/src/infra/provider`, `src-tauri/src/service/sync_scheduler.rs`",
  "  - 検証: provider Rust tests",
  "  - superseded by: P1 provider auth failure storm を止める",
  "  - created batch: 2026-02-01 wave",
  "",
  "- [ ] P3 TODO priority aging policy を作る",
  "  - 対象: `TODO.md`, `.claude/rules/quality-policy.md`",
  "  - created batch: 2026-02-01 wave",
  "",
  "- [ ] P3 risk TODO を implementation / contract test / manual verification / rule update へ自動分類する",
  "  - 対象: `TODO.md`, task triage tooling",
  "  - heading parser、target path extraction、priority extraction、work type classifier、worker batch export の script を追加する",
  "  - last reviewed: 2026-05-01 kept for tooling",
  "",
  "- [ ] P3 TODO risk register を domain owner 別に shard する計画を作る",
  "  - domain shard: `quality-tooling`",
  "  - 対象: `TODO.md`, future task files",
  "  - completed by: P2 Quality / TODO tooling バッチを実装する",
].join("\n");

describe("todo triage tooling", () => {
  const items = parseTodoMarkdown(fixture);

  it("parses priorities, target paths, verification, and work type classification", () => {
    expect(items).toHaveLength(5);
    expect(items[0]?.priority).toBe("P1");
    expect(items[0]?.domainBucket).toBe("provider-sync");
    expect(items[0]?.targetFiles).toEqual(["src-tauri/src/infra/provider", "src-tauri/src/service/sync_scheduler.rs"]);
    expect(items[0]?.manualVerification).toEqual(["manual native verification"]);
    expect(items[3]?.workTypes).toEqual(["contract-test", "implementation", "manual-verification", "rule-update"]);
  });

  it("groups duplicate-like TODOs and returns a merge workflow", () => {
    const groups = findDuplicateTodoGroups(items, 0.25);
    const providerGroup = groups.find((group) => group.id.includes("provider auth failure"));

    expect(providerGroup?.items.map((item) => item.priority)).toEqual(["P1", "P2"]);
    expect(buildTodoMergeWorkflows(groups).some((workflow) => workflow.closeStrategy === "superseded-by")).toBe(true);
  });

  it("builds domain owner shard plans", () => {
    const shards = buildTodoShardPlans(items);
    const qualityShard = shards.find((shard) => shard.domainBucket === "quality-tooling");

    expect(qualityShard?.owner).toBe("quality");
    expect(qualityShard?.writeScopes).toContain("TODO.md");
  });

  it("exports worker issues with implementation order and verification commands", () => {
    const issues = exportWorkerIssues(items, { priorities: ["P1", "P2", "P3"] });

    expect(issues[0]?.priority).toBe("P1");
    expect(issues.map((issue) => issue.domainBucket)).toContain("quality-tooling");
  });

  it("reports priority aging actions from created and reviewed markers", () => {
    const report = buildTodoAgingReport(items, { now: new Date("2026-05-10T00:00:00.000Z") });

    expect(report.policy).toEqual({ staleP1Days: 30, staleP2Days: 60, staleP3Days: 90 });
    expect(report.entries.find((entry) => entry.title.includes("auth failure storm"))?.action).toBe("escalate");
    expect(report.entries.find((entry) => entry.title.includes("priority aging policy"))?.action).toBe(
      "archive-candidate",
    );
    expect(report.entries.find((entry) => entry.title.includes("自動分類"))?.action).toBe("none");
    expect(report.entries.find((entry) => entry.title.includes("risk register"))?.action).toBe("changelog-candidate");
  });
});
