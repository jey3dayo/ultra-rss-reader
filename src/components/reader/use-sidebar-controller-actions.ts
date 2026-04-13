import { useCallback } from "react";
import type { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { useSidebarUiActions } from "./use-sidebar-ui-actions";

type UpdateFeedFolderVariables = Parameters<ReturnType<typeof useUpdateFeedFolder>["mutateAsync"]>[0];
type SidebarUiActionParams = Omit<Parameters<typeof useSidebarUiActions>[0], "setSelectedAccountPreference">;

type UseSidebarControllerActionsParams = SidebarUiActionParams & {
  setPref: (key: string, value: string) => void;
  updateFeedFolder: (variables: UpdateFeedFolderVariables) => Promise<unknown>;
};

export function useSidebarControllerActions({
  setPref,
  updateFeedFolder,
  ...uiActionsParams
}: UseSidebarControllerActionsParams) {
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
