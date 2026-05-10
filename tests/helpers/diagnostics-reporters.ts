import { resetCreateQueryDiagnosticsReporterForTests } from "@/hooks/create-query";
import { resetQueryInvalidationFailureReporterForTests } from "@/lib/query/query-invalidation";
import { resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";

export function resetDiagnosticsReporterModuleGlobalsForTests(): void {
  resetCreateQueryDiagnosticsReporterForTests();
  resetQueryInvalidationFailureReporterForTests();
  resetRuntimeDiagnosticOnceSuppressionForTests();
}
