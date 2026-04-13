import { useCallback } from "react";
import type { SidebarControllerActionsParams, SidebarControllerActionsResult } from "./sidebar-controller.types";
import { useSidebarUiActions } from "./use-sidebar-ui-actions";

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
