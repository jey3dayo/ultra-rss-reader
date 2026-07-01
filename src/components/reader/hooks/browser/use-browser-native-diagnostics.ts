import { useCallback, useState } from "react";
import type { BrowserWebviewDiagnosticsPayload } from "../../browser-view.types";

type UseBrowserNativeDiagnosticsResult = {
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  handleNativeDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

export function useBrowserNativeDiagnostics(showDiagnostics: boolean): UseBrowserNativeDiagnosticsResult {
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserWebviewDiagnosticsPayload | null>(null);
  const [wasShowingDiagnostics, setWasShowingDiagnostics] = useState(showDiagnostics);

  // Adjust state during render when the prop changes instead of routing the reset
  // through an effect, which would force an extra render with a stale value.
  if (wasShowingDiagnostics !== showDiagnostics) {
    setWasShowingDiagnostics(showDiagnostics);
    if (!showDiagnostics) {
      setNativeDiagnostics(null);
    }
  }

  const handleNativeDiagnostics = useCallback((payload: BrowserWebviewDiagnosticsPayload) => {
    setNativeDiagnostics(payload);
  }, []);

  return {
    nativeDiagnostics,
    handleNativeDiagnostics,
  };
}
