import { describe, expect, it } from "vitest";
import { parseKnipReport, parseReactDoctorReport, readJsonPayload } from "../../../scripts/quality-baseline";

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

  it("throws a stable error when tool output does not contain valid JSON", () => {
    expect(() => readJsonPayload("react-doctor 0.1.4\nno json payload")).toThrow(
      "Tool output did not contain a JSON object.",
    );
  });
});
