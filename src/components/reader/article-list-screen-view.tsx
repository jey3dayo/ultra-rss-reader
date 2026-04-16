import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";

export type ArticleListScreenViewProps = {
  listAriaLabel: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onListKeyDownCapture?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
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
  viewportRef,
  onListKeyDownCapture,
  isLoading,
  loadingMessage,
  emptyMessage,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  groups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
  renderRow,
}: ArticleListScreenViewProps) {
  if (isLoading) {
    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="p-6 text-center text-foreground-soft">{loadingMessage}</div>
      </ScrollArea>
    );
  }

  if (groups.length === 0) {
    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
          {emptyDescription ? <p className="max-w-sm text-sm text-foreground-soft">{emptyDescription}</p> : null}
          {emptyActionLabel && onEmptyAction ? (
            <Button type="button" variant="outline" size="sm" onClick={onEmptyAction}>
              {emptyActionLabel}
            </Button>
          ) : null}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full" viewportRef={viewportRef}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={listAriaLabel}
        className="pb-4"
        onKeyDownCapture={onListKeyDownCapture}
      >
        <ArticleGroupsView
          groups={groups}
          dimArchived={dimArchived}
          textPreview={textPreview}
          imagePreviews={imagePreviews}
          selectionStyle={selectionStyle}
          onSelectArticle={onSelectArticle}
          renderRow={renderRow}
        />
      </div>
    </ScrollArea>
  );
}
