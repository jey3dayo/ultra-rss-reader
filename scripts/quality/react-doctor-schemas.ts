import * as v from "valibot";

export const reactDoctorPinSchema = v.object({
  scanSha: v.string(),
  pluginVersion: v.string(),
  scanCommand: v.string(),
  diff: v.object({
    score: v.nullable(v.number()),
    errorCount: v.number(),
    warningCount: v.number(),
    affectedFileCount: v.number(),
  }),
  full: v.object({
    score: v.nullable(v.number()),
    errorCount: v.number(),
    warningCount: v.number(),
    affectedFileCount: v.number(),
  }),
  auditScanCommand: v.string(),
  auditWarningCount: v.number(),
});

export type ReactDoctorPin = v.InferOutput<typeof reactDoctorPinSchema>;

const reactDoctorSummarySchema = v.object({
  score: v.nullable(v.number()),
  errorCount: v.number(),
  warningCount: v.number(),
  affectedFileCount: v.number(),
});

const reactDoctorDiagnosticSchema = v.object({
  severity: v.fallback(v.string(), "(unknown severity)"),
  rule: v.fallback(v.string(), "(unknown rule)"),
});

export const reactDoctorReportSchema = v.object({
  version: v.string(),
  mode: v.string(),
  baselineDegraded: v.fallback(v.boolean(), false),
  summary: reactDoctorSummarySchema,
  diagnostics: v.fallback(
    v.pipe(
      v.union([v.array(v.unknown()), v.undefined()]),
      v.transform((val) => val ?? []),
    ),
    [],
  ),
  projects: v.optional(
    v.array(
      v.object({
        diagnostics: v.optional(v.array(v.unknown())),
      }),
    ),
  ),
});

export type ReactDoctorSummary = v.InferOutput<typeof reactDoctorSummarySchema>;
export type ReactDoctorDiagnostic = v.InferOutput<typeof reactDoctorDiagnosticSchema>;

export function parseReactDoctorDiagnostics(diagnostics: unknown[]): { severity: string; rule: string }[] {
  return diagnostics
    .filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null && !Array.isArray(d))
    .map((d) => {
      const result = v.safeParse(reactDoctorDiagnosticSchema, d);
      if (result.success) {
        return result.output;
      }
      return {
        severity: "(unknown severity)",
        rule: "(unknown rule)",
      };
    });
}
