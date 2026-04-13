import { Input } from "@/components/ui/input";
import type { ArticleListHeaderSearchProps } from "./article-list.types";

export function ArticleListHeaderSearch({
  searchInputRef,
  searchQuery,
  searchArticlesLabel,
  searchArticlesPlaceholder,
  onSearchQueryChange,
}: ArticleListHeaderSearchProps) {
  return (
    <div className="border-b border-border px-4 py-2">
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
