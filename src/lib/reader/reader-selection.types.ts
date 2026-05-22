import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";

type FeedReaderSelection = { type: "feed"; feedId: string };
type FolderReaderSelection = { type: "folder"; folderId: string };
type SmartReaderSelection = { type: "smart"; kind: SmartViewKind };
type TagReaderSelection = { type: "tag"; tagId: string };
type AllReaderSelection = { type: "all" };

// TODO(settings-root-type-surface): keep this root contract until article derivation and sidebar props stop importing it directly.
export type ReaderSelection =
  | FeedReaderSelection
  | FolderReaderSelection
  | SmartReaderSelection
  | TagReaderSelection
  | AllReaderSelection;
