import type { UiSelection } from "@/stores/ui-store";
import type { ArticleListPrimarySourceContext } from "./article-list.types";

const EMPTY_ACCOUNT_SEGMENT = "null";

export function getPrimarySourceContext(
  selection: UiSelection,
  selectedAccountId: string | null,
): ArticleListPrimarySourceContext {
  const accountSegment = selectedAccountId ?? EMPTY_ACCOUNT_SEGMENT;

  switch (selection.type) {
    case "feed":
      return {
        kind: "feed",
        key: `feed:${accountSegment}:${selection.feedId}`,
      };
    case "tag":
      return {
        kind: "tag",
        key: `tag:${accountSegment}:${selection.tagId}`,
      };
    case "folder":
      return {
        kind: "account",
        key: `account:${accountSegment}:folder:${selection.folderId}`,
      };
    case "smart":
      return {
        kind: "account",
        key: `account:${accountSegment}:smart:${selection.kind}`,
      };
    case "all":
      return {
        kind: "account",
        key: `account:${accountSegment}:all`,
      };
  }
}
