import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  createProcessDiagnostic,
  createReportDiagnostic,
  parseKnipReport,
  parseReactDoctorReport,
  readJsonPayload,
} from "../../../scripts/quality-baseline";

describe("quality-baseline", () => {
  it("extracts JSON after tool version and log prefixes", () => {
    const output = [
      "react-doctor 0.1.4",
      "info: running offline scan",
      '{"version":"0.1.4","mode":"diff","summary":{"score":100,"errorCount":0,"warningCount":0,"affectedFileCount":0}}',
    ].join("\n");

    expect(parseReactDoctorReport(output)).toEqual({
      version: "0.1.4",
      mode: "diff",
      summary: {
        score: 100,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
      },
    });
  });

  it("keeps nested braces and braces inside strings inside the JSON payload", () => {
    const output = [
      "knip 6.12.2",
      '{"issues":[{"file":"src/example.ts","exports":["useThing"],"note":"literal { brace }"}]}',
      "scan finished",
    ].join("\n");

    expect(parseKnipReport(output)).toEqual({
      issues: [
        {
          file: "src/example.ts",
          exports: ["useThing"],
          note: "literal { brace }",
        },
      ],
    });
  });

  it("skips malformed brace-prefixed logs and reads the first valid JSON object", () => {
    const output = '{not json}\n{"issues":[]}';

    expect(readJsonPayload(output)).toBe('{"issues":[]}');
  });

  it("reads the React Doctor report after structured JSON log prefixes", () => {
    const output = [
      '{"level":"info","message":"scan started"}',
      '{"version":"0.1.4","mode":"full","summary":{"score":85,"errorCount":0,"warningCount":228,"affectedFileCount":87}}',
      "warning: trailing text",
    ].join("\n");

    expect(parseReactDoctorReport(output)).toEqual({
      version: "0.1.4",
      mode: "full",
      summary: {
        score: 85,
        errorCount: 0,
        warningCount: 228,
        affectedFileCount: 87,
      },
    });
  });

  it("reads the Knip report after unrelated JSON objects", () => {
    const output = '{"event":"start"}\n{"issues":[]}';

    expect(parseKnipReport(output)).toEqual({ issues: [] });
  });

  it("throws a stable error when tool output does not contain valid JSON", () => {
    expect(() => readJsonPayload("react-doctor 0.1.4\nno json payload")).toThrow(
      "Tool output did not contain a JSON object.",
    );
  });

  it("rejects JSON array output as a malformed tool report", () => {
    expect(() => parseKnipReport('[{"file":"src/example.ts"}]')).toThrow(
      "Knip did not return a valid report JSON object.",
    );
  });

  it("reports a missing command from the process error code", () => {
    const error = Object.assign(new Error("spawn pnpm ENOENT"), {
      code: "ENOENT",
    });

    expect(
      createProcessDiagnostic("React Doctor", "pnpm exec react-doctor", spawnResult({ error, status: null })),
    ).toMatchObject({
      kind: "missing-command",
      tool: "React Doctor",
      command: "pnpm exec react-doctor",
    });
  });

  it("reports non-zero exits with status and stderr", () => {
    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ status: 2, stderr: "failed to load config" }),
      ),
    ).toMatchObject({
      kind: "non-zero-exit",
      exitCode: 2,
      stderr: "failed to load config",
    });
  });

  it("reports empty tool reports separately from malformed reports", () => {
    expect(createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "", new Error("no json"))).toMatchObject({
      kind: "empty-report",
      stdout: undefined,
    });

    expect(
      createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "react-doctor 0.1.4\n{not json}", new Error()),
    ).toMatchObject({
      kind: "malformed-report",
      stdout: "react-doctor 0.1.4\n{not json}",
    });
  });

  it("reports timeouts from the process error code", () => {
    const error = Object.assign(new Error("spawnSync pnpm ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });

    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ error, signal: "SIGTERM", status: null }),
      ),
    ).toMatchObject({
      kind: "timeout",
      signal: "SIGTERM",
    });
  });

  it("reports signal termination while preserving captured output", () => {
    expect(
      createProcessDiagnostic(
        "Knip",
        "pnpm exec knip",
        spawnResult({
          signal: "SIGKILL",
          status: null,
          stdout: "partial json",
          stderr: "killed",
        }),
      ),
    ).toMatchObject({
      kind: "signal",
      signal: "SIGKILL",
      stdout: "partial json",
      stderr: "killed",
    });
  });
});

function spawnResult(overrides: Partial<SpawnSyncReturns<string>> = {}): SpawnSyncReturns<string> {
  return {
    pid: 123,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    ...overrides,
  };
}
