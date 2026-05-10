import { describe, expect, it } from "vitest";
import {
  buildTodoMergeWorkflows,
  buildTodoShardPlans,
  exportWorkerIssues,
  findDuplicateTodoGroups,
  formatWorkerIssuesMarkdown,
  parseTodoMarkdown,
} from "../../../scripts/todo-triage";

const todoFixture = `
## 次の並列バッチ候補

#### P2 Quality / TODO tooling 実装 tranche

- [ ] P2-QT3 TODO.md priority/domain/work-type parser を machine-readable にする
  - worker prompt: \`TODO.md\` の heading、priority、domain bucket、target files、work type、focused verification、dependency hint を JSON export できる parser を作る
  - 対象: future \`scripts/todo-triage.ts\`, \`TODO.md\`, parser fixture tests
  - 完了条件: P1/P2/P3、\`P1-Q*\`、\`P2-*\` tranche、\`supersedes\` が structured data として取り出せる
  - 検証: parser fixture tests、\`pnpm markdownlint-cli2 TODO.md\`, \`git diff --check\`
  - supersedes: \`P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する\`, \`P3 TODO priority aging policy を作る\`

- [ ] P2-QT4 risk TODO の duplicate grouping / superseded workflow を tooling 化する
  - worker prompt: normalized heading、priority bucket、file target overlap、similarity threshold、\`supersedes\` / \`superseded by\` / \`completed by\` を使って重複候補を report する
  - 対象: future TODO triage script, \`scripts/similarity-report.ts\`, \`TODO.md\`, CHANGELOG workflow
  - 完了条件: leaf task を削る前に、親バッチへ回収された検証観点と merge 理由を report できる
  - 検証: duplicate TODO fixture tests、similarity report fixture、manual sample on query/auth/recovery/focus domains
  - supersedes: \`P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する\`, \`P3 risk TODO の重複 close / merge workflow を決める\`

- [ ] P2-QT5 worker prompt / issue export format を P1/P2 tranche から生成する
  - worker prompt: TODO tranche から worker prompt、対象ファイル、禁止 scope、検証 command、parallel-safe hint を抜き出し、subagent や issue へ渡せる Markdown/JSON を生成する
  - 対象: future TODO export script, \`TODO.md\`, subagent workflow docs
  - 完了条件: P1-Q1〜Q5、P2 Settings/Reader/A11y の tranche を domain shard ごとに export できる
  - 検証: export fixture tests、sample export review、\`pnpm markdownlint-cli2 TODO.md\`
  - defer: TODO shard への実移行は、parser/export が安定してから別バッチで行う

- [ ] P2-C1 domain shard inventory を \`TODO.md\` 冒頭の tranche から作る
  - worker prompt: P1-Q1〜Q5、P2 Settings/Reader/A11y/Quality の tranche を shard 分類する
  - 対象: \`TODO.md\`
  - shard: \`quality-tooling\`
  - 完了条件: 各 tranche が priority、domain、write scope、focused verification、manual verification、parallel-safe hint を持つ
  - 検証: \`pnpm markdownlint-cli2 TODO.md\`, shard export fixture test

### TODO 棚卸し収束バッチ

- [ ] P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する
  - 対象: \`scripts/similarity-report.ts\`, \`TODO.md\`
  - 検証: duplicate TODO fixture tests
`;

describe("todo-triage", () => {
  it("parses priority, domain, work type, targets, verification, and supersedes as structured data", () => {
    const items = parseTodoMarkdown(todoFixture);
    const parserTask = items.find((item) => item.id === "P2-QT3");

    expect(parserTask).toMatchObject({
      priority: "P2",
      code: "QT3",
      domainBucket: "quality-tooling",
      implementationOrder: expect.any(Number),
      sectionPath: ["次の並列バッチ候補", "P2 Quality / TODO tooling 実装 tranche"],
      workerPrompt:
        "`TODO.md` の heading、priority、domain bucket、target files、work type、focused verification、dependency hint を JSON export できる parser を作る",
    });
    expect(parserTask?.workTypes).toEqual(["contract-test", "implementation", "tooling"]);
    expect(parserTask?.targetFiles).toEqual(["TODO.md", "scripts/todo-triage.ts"]);
    expect(parserTask?.focusedVerification).toEqual([
      "git diff --check",
      "parser fixture tests",
      "pnpm markdownlint-cli2 TODO.md",
    ]);
    expect(parserTask?.supersedes).toEqual([
      "P3 TODO priority aging policy を作る",
      "P3 TODO.md の優先度と実装順を machine-readable に抽出する script を追加する",
    ]);
  });

  it("groups duplicate risk TODOs through explicit supersedes and target overlap", () => {
    const items = parseTodoMarkdown(todoFixture);
    const groups = findDuplicateTodoGroups(items, 0.3);
    const workflows = buildTodoMergeWorkflows(groups);

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining("P2-QT4"),
          reason: expect.stringContaining("explicit supersedes workflow"),
          mergeNotes: expect.arrayContaining([
            "P2-QT4 supersedes P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する",
          ]),
        }),
      ]),
    );
    expect(workflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          closeStrategy: "superseded-by",
          mergeTarget: "P2-QT4",
          checklist: expect.arrayContaining([
            "Move unique acceptance criteria and focused verification into the merge target before closing a leaf TODO.",
          ]),
        }),
      ]),
    );
  });

  it("exports domain owner shard plans for risk register handoff", () => {
    const shards = buildTodoShardPlans(parseTodoMarkdown(todoFixture));
    const qualityShard = shards.find((shard) => shard.domainBucket === "quality-tooling");

    expect(qualityShard).toMatchObject({
      owner: "quality",
      writeScopes: ["TODO.md", "scripts/similarity-report.ts", "scripts/todo-triage.ts"],
      focusedVerification: expect.arrayContaining(["pnpm markdownlint-cli2 TODO.md", "shard export fixture test"]),
    });
    expect(qualityShard?.items.map((item) => item.id)).toEqual([
      "P2-C1",
      "P2-QT3",
      "P2-QT4",
      "P2-QT5",
      "P3 TODO.md の重複検出 / 類似 task grouping を tooling 化する",
    ]);
  });

  it("exports P1/P2 worker issue data and Markdown without P3 backlog-only items", () => {
    const issues = exportWorkerIssues(parseTodoMarkdown(todoFixture));

    expect(issues.map((issue) => issue.id)).toEqual(["P2-C1", "P2-QT3", "P2-QT4", "P2-QT5"]);
    expect(issues[3]).toMatchObject({
      id: "P2-QT5",
      priority: "P2",
      domainBucket: "quality-tooling",
      targetFiles: ["TODO.md"],
      prohibitedScope: ["TODO shard への実移行は、parser/export が安定してから別バッチで行う"],
      verificationCommands: ["pnpm markdownlint-cli2 TODO.md"],
    });

    const markdown = formatWorkerIssuesMarkdown(issues);

    expect(markdown).toContain("## P2-QT5 worker prompt / issue export format を P1/P2 tranche から生成する");
    expect(markdown).toContain("- worker prompt: TODO tranche から worker prompt");
    expect(markdown).not.toContain("## P3");
  });
});
