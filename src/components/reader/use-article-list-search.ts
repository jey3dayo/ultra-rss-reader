import { useCallback, useEffect, useRef, useState } from "react";
import { ARTICLE_SEARCH_DEBOUNCE_MS } from "@/constants/reader";
import { useSearchArticles } from "@/hooks/use-articles";

type UseArticleListSearchParams = {
  selectedAccountId: string | null;
};

type UseArticleListSearchResult = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  trimmedDebouncedQuery: string;
  searchResults: ReturnType<typeof useSearchArticles>["data"];
  isSearching: boolean;
  openSearch: () => void;
  handleToggleSearch: () => void;
  handleCloseSearch: () => void;
  setSearchQuery: (query: string) => void;
};

export function useArticleListSearch({ selectedAccountId }: UseArticleListSearchParams): UseArticleListSearchResult {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, ARTICLE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const trimmedDebouncedQuery = debouncedQuery.trim();
  const { data: searchResults, isFetching: isSearching } = useSearchArticles(selectedAccountId, trimmedDebouncedQuery);

  const openSearch = useCallback(() => {
    setShowSearch(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((visible) => !visible);
    if (!showSearch) {
      openSearch();
    } else {
      setSearchQuery("");
    }
  }, [openSearch, showSearch]);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
  }, []);

  return {
    showSearch,
    searchQuery,
    searchInputRef,
    trimmedDebouncedQuery,
    searchResults,
    isSearching,
    openSearch,
    handleToggleSearch,
    handleCloseSearch,
    setSearchQuery,
  };
}
