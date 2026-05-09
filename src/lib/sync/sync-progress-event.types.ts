import type { SyncProgressKind, SyncProgressStage } from "@/lib/sync/sync-progress.types";

export type SyncProgressRuntimeEventDto = {
  stage: SyncProgressStage;
  kind: SyncProgressKind;
  total: number;
  completed: number;
  account_id?: string | null;
  account_name?: string | null;
  success?: boolean | null;
};

export type SyncProgressEventDto = SyncProgressRuntimeEventDto;
