import type { UiSelection } from "@/stores/ui-store";
import type { ArticleListPrimarySourceContext } from "./article-list.types";

export function getPrimarySourceContext(
  selection: UiSelection,
  selectedAccountId: string | null,
): ArticleListPrimarySourceContext {
  switch (selection.type) {
    case "feed":
      return {
        kind: "feed",
        key: `feed:${selectedAccountId ?? "null"}:${selection.feedId}`,
      };
    case "tag":
      return {
        kind: "tag",
        key: `tag:${selectedAccountId ?? "null"}:${selection.tagId}`,
      };
    case "folder":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:folder:${selection.folderId}`,
      };
    case "smart":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:smart:${selection.kind}`,
      };
    case "all":
      return {
        kind: "account",
        key: `account:${selectedAccountId ?? "null"}:all`,
      };
  }
}
