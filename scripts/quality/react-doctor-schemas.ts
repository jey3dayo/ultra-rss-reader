import * as v from "valibot";

export const reactDoctorPinSchema = v.object({
  description: v.optional(v.string()),
  scanSha: v.string(),
  pluginVersion: v.string(),
  scanCommand: v.string(),
  diff: v.object({
    score: v.nullable(v.number()),
    errorCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    warningCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    affectedFileCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  full: v.object({
    score: v.nullable(v.number()),
    errorCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    warningCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
    affectedFileCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  auditScanCommand: v.string(),
  auditWarningCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type ReactDoctorPin = v.InferOutput<typeof reactDoctorPinSchema>;

/**
 * Parse and validate React Doctor pin data.
 * @param data - Unknown data to parse
 * @returns Validated ReactDoctorPin
 * @throws ValiError if validation fails
 */
export function parseReactDoctorPin(data: unknown): ReactDoctorPin {
  return v.parse(reactDoctorPinSchema, data);
}

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

/**
 * Updates a React Doctor pin with new measurement values while preserving metadata.
 * @param originalPin - The original pin object (may contain extra fields like `description`)
 * @param updates - The new measurement values to apply
 * @returns Updated pin object with metadata preserved and $schema removed
 */
export function updateReactDoctorPin(
  originalPin: Record<string, unknown>,
  updates: {
    pluginVersion: string;
    fullSummary: { errorCount: number; warningCount: number; affectedFileCount: number };
    auditWarningCount: number;
  },
): ReactDoctorPin {
  const updated: ReactDoctorPin = {
    description: typeof originalPin.description === "string" ? originalPin.description : undefined,
    scanSha: typeof originalPin.scanSha === "string" ? originalPin.scanSha : "",
    pluginVersion: updates.pluginVersion,
    scanCommand: typeof originalPin.scanCommand === "string" ? originalPin.scanCommand : "",
    diff:
      typeof originalPin.diff === "object" && originalPin.diff !== null
        ? (originalPin.diff as ReactDoctorPin["diff"])
        : { score: null, errorCount: 0, warningCount: 0, affectedFileCount: 0 },
    full: {
      score: null,
      errorCount: updates.fullSummary.errorCount,
      warningCount: updates.fullSummary.warningCount,
      affectedFileCount: updates.fullSummary.affectedFileCount,
    },
    auditScanCommand: typeof originalPin.auditScanCommand === "string" ? originalPin.auditScanCommand : "",
    auditWarningCount: updates.auditWarningCount,
  };

  return updated;
}

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
