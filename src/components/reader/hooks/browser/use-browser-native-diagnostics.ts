import { useCallback, useEffect, useState } from "react";
import type { BrowserWebviewDiagnosticsPayload, UseBrowserNativeDiagnosticsResult } from "../../browser-view.types";

export function useBrowserNativeDiagnostics(showDiagnostics: boolean): UseBrowserNativeDiagnosticsResult {
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserWebviewDiagnosticsPayload | null>(null);

  const handleNativeDiagnostics = useCallback((payload: BrowserWebviewDiagnosticsPayload) => {
    setNativeDiagnostics(payload);
  }, []);

  useEffect(() => {
    if (showDiagnostics) {
      return;
    }

    setNativeDiagnostics(null);
  }, [showDiagnostics]);

  return {
    nativeDiagnostics,
    handleNativeDiagnostics,
  };
}
