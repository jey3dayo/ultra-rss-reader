import { Input } from "@/components/ui/input";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import type { ArticleListHeaderSearchProps } from "./article-list.types";

export function ArticleListHeaderSearch({
  searchInputRef,
  searchQuery,
  searchArticlesLabel,
  searchArticlesPlaceholder,
  onSearchQueryChange,
}: ArticleListHeaderSearchProps) {
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
        onChange={(e) => onSearchQueryChange(e.target.value)}
        aria-label={searchArticlesLabel}
        placeholder={searchArticlesPlaceholder}
      />
    </div>
  );
}
