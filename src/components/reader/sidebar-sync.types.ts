import type { AccountSyncWarning } from "@/api/schemas/sync-result";
import type { SyncProgressEvent, SyncProgressState } from "@/stores/ui-store";

export type SidebarSyncProgressPayload = SyncProgressEvent;
export type SidebarSyncWarningPayload = AccountSyncWarning[];

export type SidebarSyncParams = {
  selectedAccountId: string | null;
  syncProgress: SyncProgressState;
  applySyncProgress: (event: SyncProgressEvent) => void;
  clearSyncProgress: () => void;
  showToast: (message: string) => void;
};

export type SidebarSyncResult = {
  handleSync: () => Promise<void>;
  lastSyncedLabel: string;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
};
