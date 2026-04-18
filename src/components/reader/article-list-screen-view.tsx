import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("reader");

  if (isLoading) {
    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="flex h-full items-center justify-center p-6">
          <div className="rounded-md border border-border/70 bg-surface-1/72 px-4 py-3 text-center text-sm text-foreground-soft">
            {loadingMessage}
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (groups.length === 0) {
    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="flex h-full items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-[linear-gradient(180deg,rgba(247,247,244,0.94)_0%,rgba(235,234,229,0.86)_100%)] px-5 py-6 text-left shadow-[0_24px_56px_-40px_rgba(38,37,30,0.26)]">
            <div className="mb-3 inline-flex rounded-full border border-border/70 bg-surface-1/88 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.12em] text-foreground-soft uppercase">
              {t("queue_label")}
            </div>
            <p className="text-[1.15rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
              {emptyMessage}
            </p>
            {emptyDescription ? (
              <p className="mt-3 text-sm leading-6 text-foreground-soft">{emptyDescription}</p>
            ) : null}
            {emptyActionLabel && onEmptyAction ? (
              <Button type="button" variant="outline" size="sm" className="mt-5" onClick={onEmptyAction}>
                {emptyActionLabel}
              </Button>
            ) : null}
          </div>
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
