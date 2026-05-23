import type { MuteKeywordScope } from "@/api/schemas";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

function isMuteKeywordScope(value: string | null): value is MuteKeywordScope {
  return value === "title" || value === "body" || value === "title_and_body";
}

export function handleMuteKeywordScopeSelectValue(
  value: string | null,
  onValidScopeChange: (scope: MuteKeywordScope) => void,
  context: { source: "add-row" | "saved-rule"; ruleId?: string },
) {
  if (isMuteKeywordScope(value)) {
    onValidScopeChange(value);
    return;
  }

  logRuntimeDiagnostic("mute-keyword-scope-select", "Ignored invalid mute keyword scope select value", {
    source: context.source,
    ruleId: context.ruleId,
    value,
  });
}
