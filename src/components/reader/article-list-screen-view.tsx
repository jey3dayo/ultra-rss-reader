import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListEmptyStateVariant } from "./article-list.types";
import { ReaderPassiveCard, readerPassiveCardOffsetClassName } from "./reader-passive-card";

export type ArticleListScreenViewProps = {
  listAriaLabel: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onListKeyDownCapture?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  isLoading: boolean;
  loadingMessage: string;
  emptyStateVariant?: ArticleListEmptyStateVariant;
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
  emptyStateVariant = "default",
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
    const isSetupEmptyState = emptyStateVariant === "setup";
    const isHiddenEmptyState = emptyStateVariant === "hidden";

    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className={cn("h-full", isHiddenEmptyState ? "" : "flex items-center justify-center p-6")}>
          {isHiddenEmptyState ? null : (
            <ReaderPassiveCard
              className={cn(
                "w-full max-w-sm px-5 py-6 text-left",
                !isSetupEmptyState ? readerPassiveCardOffsetClassName : undefined,
                isSetupEmptyState
                  ? "rounded-2xl border border-border/65 bg-surface-1/48 shadow-[0_18px_48px_-40px_rgba(38,37,30,0.18)] dark:border-border/75 dark:bg-[rgba(38,34,29,0.52)] dark:shadow-none"
                  : undefined,
              )}
            >
              {isSetupEmptyState ? null : (
                <div className="mb-3 inline-flex rounded-full border border-border/70 bg-surface-1/88 px-2.5 py-1 text-[0.65rem] font-medium tracking-[0.12em] text-foreground-soft uppercase">
                  {t("queue_label")}
                </div>
              )}
              <p
                className={cn(
                  "text-foreground",
                  isSetupEmptyState
                    ? "text-base font-medium leading-6 tracking-[-0.01em]"
                    : "min-h-11 text-[1.15rem] font-semibold leading-[1.2] tracking-[-0.02em]",
                )}
              >
                {emptyMessage}
              </p>
              {emptyDescription ? (
                <p
                  className={cn("text-sm leading-6 text-foreground-soft", isSetupEmptyState ? "mt-2" : "mt-3 min-h-12")}
                >
                  {emptyDescription}
                </p>
              ) : null}
              {emptyActionLabel && onEmptyAction ? (
                <Button type="button" variant="outline" size="sm" className="mt-5" onClick={onEmptyAction}>
                  {emptyActionLabel}
                </Button>
              ) : null}
            </ReaderPassiveCard>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full" contentClassName="pb-4 pr-3" viewportRef={viewportRef}>
      <div data-testid="article-list-scroll-content">
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          data-article-list-root="true"
          aria-label={listAriaLabel}
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
      </div>
    </ScrollArea>
  );
}
