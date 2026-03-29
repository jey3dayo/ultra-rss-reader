import type { ReactNode, RefObject } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";

export type ArticleListScreenViewProps = {
  listAriaLabel: string;
  listRef: RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  groups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  onSelectArticle: (articleId: string) => void;
  renderRow?: (params: { article: ArticleDto; articleId: string; content: ReactNode }) => ReactNode;
};

export function ArticleListScreenView({
  listAriaLabel,
  listRef,
  isLoading,
  loadingMessage,
  emptyMessage,
  groups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
  renderRow,
}: ArticleListScreenViewProps) {
  return (
    <ScrollArea className="h-full">
      <div ref={listRef} role="listbox" aria-label={listAriaLabel} className="pb-4">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">{loadingMessage}</div>
        ) : groups.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          <ArticleGroupsView
            groups={groups}
            dimArchived={dimArchived}
            textPreview={textPreview}
            imagePreviews={imagePreviews}
            selectionStyle={selectionStyle}
            onSelectArticle={onSelectArticle}
            renderRow={renderRow}
          />
        )}
      </div>
    </ScrollArea>
  );
}
