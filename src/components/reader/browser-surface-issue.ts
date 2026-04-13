export type BrowserSurfaceIssue = {
  kind: "failed" | "unsupported";
  title: string;
  description: string;
  detail?: string | null;
  canRetry?: boolean;
};

type BrowserSurfaceIssueLabels = {
  failed: string;
  failedHint: string;
  blocked: string;
  blockedHint: string;
  browserMode: string;
  browserModeHint: string;
};

export function createBrowserSurfaceFailure(
  errorMessage: string,
  labels: Pick<BrowserSurfaceIssueLabels, "failed" | "failedHint">,
): BrowserSurfaceIssue {
  return {
    kind: "failed",
    title: labels.failed,
    description: labels.failedHint,
    detail: errorMessage,
    canRetry: true,
  };
}

export function createBrowserSurfaceFallback(
  errorMessage: string | null,
  labels: Pick<BrowserSurfaceIssueLabels, "failed" | "failedHint" | "blocked" | "blockedHint">,
): BrowserSurfaceIssue {
  return {
    kind: errorMessage ? "failed" : "unsupported",
    title: errorMessage ? labels.failed : labels.blocked,
    description: errorMessage ? labels.failedHint : labels.blockedHint,
    detail: errorMessage,
    canRetry: Boolean(errorMessage),
  };
}

export function resolveRuntimeUnavailableSurfaceIssue({
  runtimeUnavailable,
  isLoading,
  labels,
}: {
  runtimeUnavailable: boolean;
  isLoading: boolean;
  labels: Pick<BrowserSurfaceIssueLabels, "browserMode" | "browserModeHint">;
}): BrowserSurfaceIssue | null {
  if (!runtimeUnavailable || isLoading) {
    return null;
  }

  return {
    kind: "unsupported",
    title: labels.browserMode,
    description: labels.browserModeHint,
    detail: null,
    canRetry: false,
  };
}
