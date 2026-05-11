import type { SyncProgressKind, SyncProgressStage } from "@/lib/sync/sync-progress.types";

export type SyncProgressUiState = {
  active: boolean;
  sessionId: number | null;
  kind: SyncProgressKind | null;
  stage: SyncProgressStage | null;
  total: number;
  completed: number;
  currentAccountName: string | null;
  activeAccountIds: Set<string>;
};
