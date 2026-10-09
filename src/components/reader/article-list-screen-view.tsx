import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useMemo,
} from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { MOTION_CONTENT_SWAP_SLOW_DURATION_MS, MOTION_CONTENT_SWAP_SLOW_OFFSET_PX } from "@/constants";
import { ScrollArea } from "@/design-system";
import { ArticleGroupsView, type ArticleGroupsViewGroup } from "./article-groups-view";
import { ArticleListEmptyState, type ArticleListEmptyStateVariant } from "./article-list-empty-state";
import { ArticleListSkeleton } from "./article-list-skeleton";
import {
  mergeReaderPassiveLayoutRefs,
  useReaderPassiveLayoutBodyRef,
  useReaderPassiveLayoutCard,
} from "./hooks/use-reader-passive-layout-context";

export type { ArticleListEmptyStateVariant };

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
  isActivePane: boolean;
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
  isActivePane,
  contentMotionKey = "article-list",
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
  renderRow,
}: ArticleListScreenViewProps) {
  const bodyRef = useReaderPassiveLayoutBodyRef("list");
  const mergedViewportRef = useMemo(() => mergeReaderPassiveLayoutRefs(viewportRef, bodyRef), [viewportRef, bodyRef]);
  const passiveCard = useReaderPassiveLayoutCard("list", contentMotionKey);

  if (isLoading) {
    return (
      <ScrollArea className="h-full" viewportRef={mergedViewportRef}>
        <div>
          <ArticleListSkeleton label={loadingMessage} />
        </div>
      </ScrollArea>
    );
  }

  if (groups.length === 0) {
    return (
      <ScrollArea className="h-full" viewportRef={mergedViewportRef}>
        <ArticleListEmptyState
          variant={emptyStateVariant}
          passiveCard={passiveCard}
          message={emptyMessage}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </ScrollArea>
    );
  }

  return (
    <div className="relative h-full overflow-hidden">
      <ScrollArea className="relative z-10 h-full" contentClassName="pb-4" viewportRef={mergedViewportRef}>
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
              isActivePane={isActivePane}
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
