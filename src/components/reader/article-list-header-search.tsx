import { type RefObject, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";

type ArticleListHeaderSearchProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchArticlesLabel: string;
  searchArticlesPlaceholder: string;
  onSearchQueryChange: (query: string) => void;
  onCloseSearch: () => void;
  onRestoreSearchToggleFocus: () => void;
};

export function ArticleListHeaderSearch({
  searchInputRef,
  searchQuery,
  searchArticlesLabel,
  searchArticlesPlaceholder,
  onSearchQueryChange,
  onCloseSearch,
  onRestoreSearchToggleFocus,
}: ArticleListHeaderSearchProps) {
  useEffect(() => {
    const focus = () => searchInputRef.current?.focus({ preventScroll: true });
    focus();
    const frame = requestAnimationFrame(focus);
    const timeout = window.setTimeout(focus, 0);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [searchInputRef]);

  return (
    <div
      data-testid="article-list-search-motion"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} border-b border-border px-4 py-2`}
    >
      <Input
        ref={searchInputRef}
        name="article-search"
        type="text"
        value={searchQuery}
        className="border-[var(--sidebar-frame-border)] bg-[var(--workspace-header-surface)] shadow-none focus:border-[color:color-mix(in_srgb,var(--foreground)_22%,var(--border))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)] focus-visible:border-[color:color-mix(in_srgb,var(--foreground)_22%,var(--border))] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)]"
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onRestoreSearchToggleFocus();
            onCloseSearch();
          }
        }}
        aria-label={searchArticlesLabel}
        placeholder={searchArticlesPlaceholder}
      />
    </div>
  );
}
