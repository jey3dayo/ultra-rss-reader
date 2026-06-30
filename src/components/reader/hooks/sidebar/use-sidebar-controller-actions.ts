import { useCallback } from "react";
import { useSidebarUiActions } from "@/components/reader/hooks/sidebar/use-sidebar-ui-actions";
import type { UpdateFeedFolderArgs } from "@/hooks/use-update-feed-folder";
import type { PreferenceWritableKey } from "@/schemas/preference-values";
import type {
  SidebarSetSelectedAccountPreference,
  SidebarUiActionsParams,
  SidebarUiActionsResult,
} from "./use-sidebar-ui-actions";

type SidebarUpdateFeedFolder = (variables: UpdateFeedFolderArgs) => Promise<unknown>;

export type SidebarControllerActionsParams = Omit<SidebarUiActionsParams, "setSelectedAccountPreference"> & {
  setPref: <K extends PreferenceWritableKey>(key: K, value: string) => void;
  updateFeedFolder: SidebarUpdateFeedFolder;
};

export type SidebarControllerActionsResult = SidebarUiActionsResult & {
  setSelectedAccountPreference: SidebarSetSelectedAccountPreference;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
};

export function useSidebarControllerActions({
  setPref,
  updateFeedFolder,
  ...uiActionsParams
}: SidebarControllerActionsParams): SidebarControllerActionsResult {
  const setSelectedAccountPreference = useCallback(
    (accountId: string) => {
      setPref("selected_account_id", accountId);
    },
    [setPref],
  );

  const uiActions = useSidebarUiActions({
    ...uiActionsParams,
    setSelectedAccountPreference,
  });

  const moveFeedToFolder = useCallback(
    (feedId: string, folderId: string) => updateFeedFolder({ feedId, folderId }),
    [updateFeedFolder],
  );

  const moveFeedToUnfoldered = useCallback(
    (feedId: string) => updateFeedFolder({ feedId, folderId: null }),
    [updateFeedFolder],
  );

  return {
    setSelectedAccountPreference,
    moveFeedToFolder,
    moveFeedToUnfoldered,
    ...uiActions,
  };
}
