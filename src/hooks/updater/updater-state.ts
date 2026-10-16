import type { Result } from "@praha/byethrow";
import type { UpdateInfoDto } from "@/api/schemas/update-info";
import type { AppError } from "@/api/tauri-commands";

type UpdaterRuntimeState = {
  /** Share a single in-flight update check across startup and manual triggers. */
  checkInFlight: Result.ResultAsync<UpdateInfoDto | null, AppError> | null;
  downloadInFlight: boolean;
  activeDownloadSessionId: number | null;
  activeDownloadProgressPercent: number | null;
  activeDownloadRequestId: number | null;
  activeDownloadVersion: string | null;
  /** Whether the active download was started silently (startup check). Silent
   * downloads suppress progress and failure toasts; the ready toast still fires. */
  activeDownloadSilent: boolean;
  nextDownloadRequestId: number;
  updateCheckGeneration: number;
};

export const updaterState: UpdaterRuntimeState = {
  checkInFlight: null,
  downloadInFlight: false,
  activeDownloadSessionId: null,
  activeDownloadProgressPercent: null,
  activeDownloadRequestId: null,
  activeDownloadVersion: null,
  activeDownloadSilent: false,
  nextDownloadRequestId: 0,
  updateCheckGeneration: 0,
};

export const staleDownloadSessionIds = new Set<number>();

export function rememberStaleDownloadSession(): void {
  if (updaterState.activeDownloadSessionId !== null) {
    staleDownloadSessionIds.add(updaterState.activeDownloadSessionId);
  }
}

export function clearActiveDownload(): void {
  updaterState.downloadInFlight = false;
  updaterState.activeDownloadSessionId = null;
  updaterState.activeDownloadProgressPercent = null;
  updaterState.activeDownloadRequestId = null;
  updaterState.activeDownloadVersion = null;
  updaterState.activeDownloadSilent = false;
}
