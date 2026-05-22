import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";

type UiStoreFeedSelection = { type: "feed"; feedId: string };
type UiStoreFolderSelection = { type: "folder"; folderId: string };
type UiStoreSmartSelection = { type: "smart"; kind: SmartViewKind };
type UiStoreTagSelection = { type: "tag"; tagId: string };
type UiStoreAllSelection = { type: "all" };

export type UiStoreReaderSelection =
  | UiStoreFeedSelection
  | UiStoreFolderSelection
  | UiStoreSmartSelection
  | UiStoreTagSelection
  | UiStoreAllSelection;
