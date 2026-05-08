import { useCallback, useEffect, useState } from "react";
import type { BrowserWebviewDiagnosticsPayload } from "../../browser-view.types";

type UseBrowserNativeDiagnosticsResult = {
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  handleNativeDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

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
