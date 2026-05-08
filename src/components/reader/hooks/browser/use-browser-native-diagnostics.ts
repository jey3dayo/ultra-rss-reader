import { useCallback, useEffect, useState } from "react";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser-debug-geometry";

export function useBrowserNativeDiagnostics(showDiagnostics: boolean) {
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserDebugGeometryNativeDiagnostics | null>(null);

  const handleNativeDiagnostics = useCallback((payload: BrowserDebugGeometryNativeDiagnostics) => {
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
  } as const;
}
