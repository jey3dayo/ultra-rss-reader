export type SidebarSyncResult = {
  handleSync: () => Promise<void>;
  lastSyncedLabel: string;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
};
