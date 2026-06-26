import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { ScrollArea } from "@/design-system";
import { cn } from "@/lib/utils";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";
import { ReaderPassiveCard, readerListPassiveCardOffsetClassName } from "./reader-passive-card";

export type ArticleListEmptyStateVariant = "default" | "setup" | "hidden";

type ArticleListScreenViewProps = {
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
  if (isLoading) {
    return (
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="flex h-full items-center justify-center p-6">
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border/70 bg-surface-1/72 px-4 py-3 text-center text-sm text-foreground-soft"
          >
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
                "w-full max-w-sm px-5 py-5 text-left",
                !isSetupEmptyState ? readerListPassiveCardOffsetClassName : undefined,
                isSetupEmptyState
                  ? "rounded-md border border-border/65 bg-surface-1/48 shadow-[0_18px_48px_-40px_rgba(38,37,30,0.18)] dark:border-border/75 dark:bg-[rgba(38,34,29,0.52)] dark:shadow-none"
                  : undefined,
              )}
            >
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
                <ReaderPassiveActionButton variant="outline" size="sm" className="mt-5" onClick={onEmptyAction}>
                  {emptyActionLabel}
                </ReaderPassiveActionButton>
              ) : null}
            </ReaderPassiveCard>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <ScrollArea
        className="relative z-10 h-full"
        contentClassName="pb-4"
        scrollbarClassName="data-vertical:bg-[color-mix(in_srgb,var(--background)_42%,var(--surface-2)_58%)] data-vertical:border-l-[color-mix(in_srgb,var(--color-border)_58%,transparent)]"
        thumbClassName="bg-[color-mix(in_srgb,var(--color-border-strong)_72%,transparent)]"
        viewportRef={viewportRef}
      >
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
      <div
        aria-hidden="true"
        data-testid="article-list-scrollbar-lane"
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-3 border-l border-[color-mix(in_srgb,var(--color-border)_34%,transparent)] bg-[color-mix(in_srgb,var(--background)_64%,var(--surface-2)_36%)]"
      />
    </div>
  );
}
