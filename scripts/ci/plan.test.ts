import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type TestContext, test } from "node:test";
import { parsePlan, validateGate } from "./gate.ts";
import { checkJobs, detectPlan, fullPlan, type Plan, parseChangedPaths, planChanges, requiredJobs } from "./plan.ts";

function temporaryDirectory(context: TestContext): string {
  const root = resolve("tmp/ci-change-scopes");
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "test-fixture-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const ui = planChanges("pull_request", ["src/components/reader/article.tsx", "src/styles/global.css"]);
function results(plan: Plan): Record<string, { result: string }> {
  return Object.fromEntries([
    ["change-plan", { result: "success" }],
    ...checkJobs.map((job) => [job, { result: requiredJobs(plan)[job] ? "success" : "skipped" }]),
  ]);
}

test("UI-only runs the complete Ubuntu frontend lane without native compilation", () => {
  assert.deepEqual(ui, { full: false, frontend: true, native: false, credentials: false, windows: false });
  assert.deepEqual(requiredJobs(ui), {
    toolchain: true,
    format: true,
    lint: true,
    "rust-clippy": false,
    "test-node": true,
    "test-rust": false,
    "test-jsdom": true,
    build: true,
    "native-smoke": false,
    audit: false,
  });
  for (const path of [
    "src/locales/ja/settings.json",
    "src/locales/ja/account.json",
    "src/locales/en/auth.json",
    "src/locales/ja/updater.json",
  ]) {
    assert.deepEqual(planChanges("pull_request", [path]), ui);
  }
  for (const extension of ["js", "ts", "tsx", "css"])
    assert.deepEqual(planChanges("pull_request", [`src/components/view.${extension}`]), ui);
});

test("Rust and native changes retain the full frontend baseline and native lanes", () => {
  const rust = planChanges("pull_request", ["src-tauri/src/domain/article.rs"]);
  assert.deepEqual(rust, { full: false, frontend: true, native: true, credentials: false, windows: true });
  for (const path of [
    "src/api/tauri-commands.ts",
    "src-tauri/resources/icon.png",
    "src-tauri/build.rs",
    "src-tauri/capabilities/default.json",
    "src-tauri/tauri.conf.json",
  ]) {
    const plan = planChanges("pull_request", [path]);
    assert.equal(plan.native, true, path);
    assert.equal(plan.frontend, true, path);
    assert.equal(plan.windows, true, path);
    assert.equal(plan.credentials, false, path);
  }
});

test("shared and indirect platform inputs select the full suite before UI classification", () => {
  for (const path of [
    "src/lib/platform/save-dialog.ts",
    "src/hooks/use-updater.ts",
    "src/constants/platform.ts",
    "src/lib/new-helper.ts",
    "src/hooks/use-new-feature.ts",
    "src/stores/new-store.ts",
    "src/schemas/new-schema.ts",
    "src/constants/new-contract.ts",
    "src/App.tsx",
    "src/components/settings/updater-panel.tsx",
    "src/__tests__/lib/tauri-window.node.test.ts",
  ])
    assert.deepEqual(planChanges("pull_request", [path]), fullPlan(), path);
});

test("credential changes add macOS session-cache verification", () => {
  for (const path of [
    "src-tauri/src/infra/keyring_store/session_cache.rs",
    "src-tauri/src/commands/account_commands/credentials.rs",
    "src/components/settings/account-settings.tsx",
  ]) {
    const plan = planChanges("pull_request", [path]);
    assert.equal(plan.credentials, true, path);
    assert.equal(plan.native, true, path);
  }
  assert.equal(planChanges("pull_request", ["src-tauri/src/commands/sync_providers/session.rs"]).credentials, true);
});

test("credential matching uses whole path tokens, not substrings", () => {
  for (const path of [
    "src/components/reader/article-author.tsx",
    "src/__tests__/components/feed-tree-drag-session.node.test.ts",
  ]) {
    assert.equal(planChanges("pull_request", [path]).credentials, false, path);
  }
});

test("unknown paths, shared configuration, locks, CI and process/release scripts fail conservatively to full", () => {
  for (const path of [
    "unknown.ts",
    "docs/guide.md",
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "vite.config.ts",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "mise/lint.toml",
    ".github/workflows/ci.yml",
    ".github/actions/setup/action.yml",
    "scripts/ci/change-plan.ts",
    "scripts/ci/gate.ts",
    "scripts/release-debug-feature-flags-report.ts",
    "src/config/settings.json",
    "scripts/ci/plan.ts",
    "scripts/release/start.ts",
    "scripts/lib/windows-dispatch.ts",
    "tests/windows-dispatch.test.ts",
    "tests/release-repo-contract.node.test.ts",
  ]) {
    assert.deepEqual(planChanges("pull_request", [path]), fullPlan(), path);
  }
  assert.deepEqual(planChanges("pull_request", []), fullPlan());
  for (const event of ["push", "workflow_dispatch", "unknown"])
    assert.deepEqual(
      detectPlan(event, () => {
        throw new Error("must not read PR diff");
      }),
      fullPlan(),
    );
});

test("NUL diff keeps deleted paths and both rename sides, including whitespace", () => {
  assert.deepEqual(parseChangedPaths("D\0src/old.ts\0R100\0src/api/old.ts\0src/components/new name.tsx\0"), {
    paths: ["src/old.ts", "src/api/old.ts", "src/components/new name.tsx"],
    unclassifiable: false,
  });
  assert.equal(detectPlan("pull_request", () => "R100\0src/api/old.ts\0src/components/new.tsx\0").native, true);
  assert.deepEqual(
    detectPlan("pull_request", () => "D\0pnpm-lock.yaml\0"),
    fullPlan(),
  );
  for (const diff of ["M\0src/a.ts", "R100\0src/a.ts\0", "?\0src/a.ts\0", "M\0\0", "garbage\0src/a.ts\0"])
    assert.throws(() => parseChangedPaths(diff));
});

test("typechange is a normal change; statuses git defines but we cannot classify plan full", () => {
  assert.deepEqual(parseChangedPaths("T\0src/components/a.tsx\0"), {
    paths: ["src/components/a.tsx"],
    unclassifiable: false,
  });
  assert.deepEqual(
    detectPlan("pull_request", () => "T\0src/components/a.tsx\0"),
    ui,
  );
  for (const status of ["U", "X", "B"])
    assert.deepEqual(
      detectPlan("pull_request", () => `${status}\0src/components/a.tsx\0`),
      fullPlan(),
      status,
    );
  assert.throws(() => detectPlan("pull_request", () => "?\0src/components/a.tsx\0"));
});

test("failed file detection fails the planner instead of permitting skipped checks", () => {
  assert.throws(
    () =>
      detectPlan("pull_request", () => {
        throw new Error("git failed");
      }),
    /git failed/,
  );
});

test("gate accepts only explicitly unneeded skips; failure, cancellation, missing and unknown jobs fail", () => {
  assert.deepEqual(validateGate(ui, results(ui), "pull_request"), []);
  for (const job of checkJobs) {
    for (const result of ["failure", "cancelled", "", "unknown"]) {
      assert.ok(validateGate(ui, { ...results(ui), [job]: { result } }, "pull_request").length, `${job}: ${result}`);
    }
    const missing = results(ui);
    delete missing[job];
    assert.ok(validateGate(ui, missing, "pull_request").length, job);
    if (requiredJobs(ui)[job])
      assert.ok(validateGate(ui, { ...results(ui), [job]: { result: "skipped" } }, "pull_request").length, job);
  }
  assert.ok(validateGate(ui, { ...results(ui), unexpected: { result: "skipped" } }, "pull_request").length);
  for (const result of ["failure", "cancelled", "skipped"])
    assert.ok(validateGate(ui, { ...results(ui), "change-plan": { result } }, "pull_request").length);
  assert.ok(validateGate(ui, results(ui), "push").length);
  assert.deepEqual(validateGate(fullPlan(), results(fullPlan()), "workflow_dispatch"), []);
});

test("malformed or contradictory plans cannot bypass required checks", () => {
  for (const plan of [
    null,
    {},
    { ...ui, frontend: "true" },
    { ...ui, frontend: false },
    { ...ui, full: true },
    { ...ui, credentials: true },
    { ...ui, unexpected: false },
  ]) {
    assert.throws(() => parsePlan(plan));
  }
});

test("real git diff detects deletion and rename beyond the API first-page limit", (context) => {
  const dir = temporaryDirectory(context);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.name", "CI fixture");
  git("config", "user.email", "ci-fixture@example.invalid");
  mkdirSync(join(dir, "src/api"), { recursive: true });
  writeFileSync(join(dir, "src/api/old.ts"), "unchanged rename fixture\n");
  writeFileSync(join(dir, "pnpm-lock.yaml"), "delete fixture\n");
  git("add", "src/api/old.ts", "pnpm-lock.yaml");
  git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD").trim();
  git("mv", "src/api/old.ts", "src/new.ts");
  git("rm", "pnpm-lock.yaml");
  const files = Array.from({ length: 350 }, (_, index) => `src/file${index}.ts`);
  for (const file of files) writeFileSync(join(dir, file), "export {};\n");
  git("add", ...files);
  git("commit", "-qm", "head");
  const { paths } = parseChangedPaths(git("diff", "--name-status", "-z", "--find-renames", `${base}...HEAD`, "--"));
  assert.equal(paths.length, 353);
  assert.ok(paths.includes("src/api/old.ts"));
  assert.ok(paths.includes("src/new.ts"));
  assert.ok(paths.includes("pnpm-lock.yaml"));
  assert.deepEqual(planChanges("pull_request", paths), fullPlan());
  const output = join(dir, "github-output");
  execFileSync(process.execPath, [resolve("scripts/ci/change-plan.ts")], {
    cwd: dir,
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "pull_request",
      PR_BASE_SHA: base,
      PR_HEAD_SHA: git("rev-parse", "HEAD").trim(),
      GITHUB_OUTPUT: output,
    },
  });
  assert.ok(readFileSync(output, "utf8").includes(`plan=${JSON.stringify(fullPlan())}`));
});

test("workflow connects every planned lane to the gate and keeps Windows/full release paths", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const expression = (body: string) => `${String.fromCharCode(36)}{{ ${body} }}`;
  const gate = workflow.slice(workflow.indexOf("  quality-gate:"));
  for (const job of checkJobs) assert.ok(gate.includes(job), job);
  assert.ok(workflow.includes("fetch-depth: 0"));
  assert.ok(workflow.includes("run: node scripts/ci/change-plan.ts"));
  assert.ok(gate.includes("run: node scripts/ci/quality-gate.ts"));
  assert.ok(workflow.includes("run: mise run test:change-plan"));
  assert.ok(workflow.includes(`PR_BASE_SHA: ${expression("github.event.pull_request.base.sha")}`));
  assert.ok(workflow.includes(`PR_HEAD_SHA: ${expression("github.event.pull_request.head.sha")}`));
  assert.ok(workflow.includes(`CI_NEEDS: ${expression("toJSON(needs)")}`));
  assert.ok(workflow.includes("needs.change-plan.outputs.credentials == 'true'"));
  assert.ok(workflow.includes("os: [macos-latest, windows-latest]"));
  assert.ok(!workflow.includes("run: |"));
});

test("dependency-free Node CLIs emit a full dispatch plan and enforce gate failure exits", (context) => {
  const dir = temporaryDirectory(context);
  const output = join(dir, "github-output");
  const summary = join(dir, "github-summary");
  const planner = resolve("scripts/ci/change-plan.ts");
  const gate = resolve("scripts/ci/quality-gate.ts");
  const env = {
    ...process.env,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
  };
  execFileSync(process.execPath, [planner], { cwd: dir, env });
  const lines = readFileSync(output, "utf8");
  assert.ok(lines.includes(`plan=${JSON.stringify(fullPlan())}`));
  assert.ok(lines.includes("credentials=true"));
  assert.ok(lines.includes('frontend_os=["ubuntu-latest","windows-latest"]'));
  assert.throws(
    () =>
      execFileSync(process.execPath, [planner], {
        cwd: dir,
        env: { ...env, GITHUB_EVENT_NAME: "pull_request", PR_BASE_SHA: "", PR_HEAD_SHA: "" },
        stdio: "pipe",
      }),
    /Command failed/,
  );
  const gateEnv = { ...env, CI_PLAN: JSON.stringify(fullPlan()), CI_NEEDS: JSON.stringify(results(fullPlan())) };
  execFileSync(process.execPath, [gate], { cwd: dir, env: gateEnv });
  assert.ok(readFileSync(summary, "utf8").includes("Quality Gate: PASSED"));
  assert.throws(
    () =>
      execFileSync(process.execPath, [gate], {
        cwd: dir,
        env: { ...gateEnv, CI_NEEDS: JSON.stringify({ ...results(fullPlan()), build: { result: "skipped" } }) },
        stdio: "pipe",
      }),
    /Command failed/,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [gate], {
        cwd: dir,
        env: { ...gateEnv, CI_PLAN: "" },
        stdio: "pipe",
      }),
    /Command failed/,
  );
  assert.ok(readFileSync(summary, "utf8").includes("Quality Gate: FAILED"));
});

test("automated CI shell lint detects a faulty external script body and accepts the repair", (context) => {
  const dir = temporaryDirectory(context);
  mkdirSync(join(dir, "scripts/ci"), { recursive: true });
  const body = join(dir, "scripts/ci/new.sh");
  const scan = () =>
    spawnSync(process.execPath, [resolve("scripts/ci/check-shell.ts")], { cwd: dir, encoding: "utf8" });
  writeFileSync(body, '#!/usr/bin/env bash\nprintf "%s\\n" $HOME\n');
  const red = scan();
  assert.notEqual(red.status, 0);
  assert.match(red.stdout + red.stderr, /SC2086/);
  writeFileSync(body, '#!/usr/bin/env bash\nprintf "%s\\n" "$HOME"\n');
  const green = scan();
  assert.equal(green.status, 0, green.stdout + green.stderr);
});

test("Quality Gate CLI reports invalid inputs safely before exiting with failure", (context) => {
  const dir = temporaryDirectory(context);
  const sentinel = "CI_INPUT_SENTINEL_DO_NOT_EXPOSE";
  const validPlan = JSON.stringify(fullPlan());
  const validNeeds = JSON.stringify(results(fullPlan()));
  const cases = [
    { name: "empty plan", plan: "", needs: validNeeds },
    { name: "malformed plan JSON", plan: `{${sentinel}`, needs: validNeeds },
    { name: "invalid plan shape", plan: JSON.stringify({ sentinel }), needs: validNeeds },
    { name: "inconsistent plan", plan: JSON.stringify({ ...fullPlan(), credentials: false }), needs: validNeeds },
    { name: "empty needs", plan: validPlan, needs: "" },
    { name: "malformed needs JSON", plan: validPlan, needs: `{${sentinel}` },
    { name: "invalid needs shape", plan: validPlan, needs: JSON.stringify(sentinel) },
    {
      name: "unplanned needs key",
      plan: validPlan,
      needs: JSON.stringify({ ...results(fullPlan()), [sentinel]: { result: "skipped" } }),
    },
    {
      name: "invalid needs result",
      plan: validPlan,
      needs: JSON.stringify({ ...results(fullPlan()), build: { result: sentinel } }),
    },
  ];
  for (const [index, input] of cases.entries()) {
    const summaryPath = join(dir, `summary-${index}`);
    const result = spawnSync(process.execPath, [resolve("scripts/ci/quality-gate.ts")], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "pull_request",
        CI_PLAN: input.plan,
        CI_NEEDS: input.needs,
        GITHUB_STEP_SUMMARY: summaryPath,
      },
    });
    assert.equal(result.status, 1, input.name);
    assert.equal(existsSync(summaryPath), true, `${input.name} must write a failure summary`);
    const summary = readFileSync(summaryPath, "utf8");
    assert.ok(summary.includes("Quality Gate: FAILED"), input.name);
    assert.match(
      summary,
      /CI plan or job results are missing or invalid\.|Required CI jobs did not complete successfully\./,
    );
    const output = result.stdout + result.stderr + summary;
    assert.ok(!output.includes(sentinel), input.name);
    assert.ok(!output.includes("SyntaxError"), input.name);
    assert.ok(!output.includes("Unexpected token"), input.name);
  }
});

test("Quality Gate CLI still lists job results when the plan is invalid", (context) => {
  const dir = temporaryDirectory(context);
  const summaryPath = join(dir, "summary");
  const result = spawnSync(process.execPath, [resolve("scripts/ci/quality-gate.ts")], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "pull_request",
      CI_PLAN: "",
      CI_NEEDS: JSON.stringify(results(fullPlan())),
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  assert.equal(result.status, 1);
  const summary = readFileSync(summaryPath, "utf8");
  assert.ok(summary.includes("- toolchain: success"));
  assert.ok(summary.includes("Quality Gate: FAILED"));
});

test("Quality Gate CLI retains only fixed job names and whitelisted results", (context) => {
  const dir = temporaryDirectory(context);
  const summaryPath = join(dir, "summary");
  const sentinel = "CI_RESULT_SENTINEL_DO_NOT_EXPOSE";
  const needs: Record<string, { result: string }> = {
    ...results(fullPlan()),
    "change-plan": { result: "cancelled" },
    "test-node": { result: "failure" },
    "rust-clippy": { result: "skipped" },
    build: { result: sentinel },
    [sentinel]: { result: sentinel },
  };
  delete needs.audit;
  const result = spawnSync(process.execPath, [resolve("scripts/ci/quality-gate.ts")], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "pull_request",
      CI_PLAN: JSON.stringify(fullPlan()),
      CI_NEEDS: JSON.stringify(needs),
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  assert.equal(result.status, 1);
  const summary = readFileSync(summaryPath, "utf8");
  for (const line of [
    "- change-plan: cancelled",
    "- test-node: failure",
    "- rust-clippy: skipped",
    "- build: invalid",
    "- audit: missing",
    "- format: success",
  ]) {
    assert.ok(summary.includes(line), line);
  }
  const expectedJobs = ["change-plan", ...checkJobs];
  const resultLines = summary.split("\n").filter((line) => line.startsWith("- "));
  assert.deepEqual(
    resultLines.map((line) => line.split(":")[0]?.slice(2)),
    expectedJobs,
  );
  for (const line of resultLines) assert.match(line, /: (?:success|failure|cancelled|skipped|missing|invalid)$/);
  assert.ok(summary.includes("Quality Gate: FAILED"));
  assert.ok(!(result.stdout + result.stderr + summary).includes(sentinel));
});
