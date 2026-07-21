import { Inbox } from "lucide-react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { MOTION_CONTENT_SWAP_SLOW_DURATION_MS, MOTION_CONTENT_SWAP_SLOW_OFFSET_PX } from "@/constants";
import { ScrollArea } from "@/design-system";
import { cn } from "@/lib/utils";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";
import { ReaderPassiveCard, readerListPassiveCardOffsetClassName } from "./reader-passive-card";

export type ArticleListEmptyStateVariant = "default" | "setup" | "hidden";

type ListMotionStyle = CSSProperties &
  Record<"--motion-content-swap-offset" | "--motion-duration-content-swap", string>;
const LIST_MOTION_STYLE: ListMotionStyle = {
  "--motion-content-swap-offset": MOTION_CONTENT_SWAP_SLOW_OFFSET_PX,
  "--motion-duration-content-swap": MOTION_CONTENT_SWAP_SLOW_DURATION_MS,
};

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
  contentMotionKey?: string;
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
  contentMotionKey = "article-list",
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
          {isHiddenEmptyState ? null : isSetupEmptyState ? (
            <ReaderPassiveCard className="w-full max-w-sm rounded-md border border-border/65 bg-surface-1/48 px-7 py-6 text-left shadow-[0_18px_48px_-40px_rgba(38,37,30,0.18)] dark:border-border/75 dark:bg-[rgba(38,34,29,0.52)] dark:shadow-none">
              <p className="text-base font-medium leading-6 tracking-[-0.01em] text-foreground">{emptyMessage}</p>
              {emptyDescription ? (
                <p className="mt-2 text-sm leading-6 text-foreground-soft">{emptyDescription}</p>
              ) : null}
              {emptyActionLabel && onEmptyAction ? (
                <ReaderPassiveActionButton variant="outline" size="sm" className="mt-5" onClick={onEmptyAction}>
                  {emptyActionLabel}
                </ReaderPassiveActionButton>
              ) : null}
            </ReaderPassiveCard>
          ) : (
            <div
              className={cn(
                "flex w-full max-w-[17rem] flex-col items-center text-center",
                readerListPassiveCardOffsetClassName,
              )}
              data-testid="article-list-empty-state"
            >
              <Inbox aria-hidden="true" className="size-9 text-foreground-soft/60" strokeWidth={1.5} />
              <p className="mt-3 text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
                {emptyMessage}
              </p>
              {emptyDescription ? (
                <p className="mt-1.5 text-sm leading-6 text-foreground-soft">{emptyDescription}</p>
              ) : null}
              {emptyActionLabel && onEmptyAction ? (
                <ReaderPassiveActionButton variant="outline" size="sm" className="mt-5" onClick={onEmptyAction}>
                  {emptyActionLabel}
                </ReaderPassiveActionButton>
              ) : null}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <ScrollArea className="relative z-10 h-full" contentClassName="pb-4" viewportRef={viewportRef}>
        <div
          key={contentMotionKey}
          data-testid="article-list-scroll-content"
          className="motion-content-swap"
          data-motion-phase="entering"
          style={LIST_MOTION_STYLE}
        >
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
    </div>
  );
}
