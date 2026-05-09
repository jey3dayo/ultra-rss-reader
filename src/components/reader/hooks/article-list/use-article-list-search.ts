import { useCallback, useEffect, useReducer, useRef } from "react";
import { ARTICLE_SEARCH_DEBOUNCE_MS } from "@/constants/reader";
import { useSearchArticles } from "@/hooks/use-articles";
import type { UseArticleListSearchParams, UseArticleListSearchResult } from "../../article-list.types";

type ArticleListSearchState = {
  showSearch: boolean;
  searchQuery: string;
  debouncedQuery: string;
};

type ArticleListSearchAction =
  | { type: "open-search" }
  | { type: "close-search" }
  | { type: "reset-search" }
  | { type: "set-search-query"; value: string }
  | { type: "set-debounced-query"; value: string };

const initialArticleListSearchState: ArticleListSearchState = {
  showSearch: false,
  searchQuery: "",
  debouncedQuery: "",
};

function articleListSearchReducer(
  state: ArticleListSearchState,
  action: ArticleListSearchAction,
): ArticleListSearchState {
  switch (action.type) {
    case "open-search":
      return { ...state, showSearch: true };
    case "close-search":
      return { ...state, showSearch: false, searchQuery: "", debouncedQuery: "" };
    case "reset-search":
      return initialArticleListSearchState;
    case "set-search-query":
      return { ...state, searchQuery: action.value };
    case "set-debounced-query":
      return { ...state, debouncedQuery: action.value };
    default:
      return state;
  }
}

export function useArticleListSearch({ selectedAccountId }: UseArticleListSearchParams): UseArticleListSearchResult {
  const [state, dispatch] = useReducer(articleListSearchReducer, initialArticleListSearchState);
  const { showSearch, searchQuery, debouncedQuery } = state;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousAccountIdRef = useRef(selectedAccountId);
  const debounceGenerationRef = useRef(0);

  useEffect(() => {
    if (previousAccountIdRef.current === selectedAccountId) {
      return;
    }

    previousAccountIdRef.current = selectedAccountId;
    debounceGenerationRef.current += 1;
    dispatch({ type: "reset-search" });
  }, [selectedAccountId]);

  useEffect(() => {
    const generation = debounceGenerationRef.current;
    const timer = setTimeout(() => {
      if (generation !== debounceGenerationRef.current) {
        return;
      }

      dispatch({ type: "set-debounced-query", value: searchQuery });
    }, ARTICLE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const trimmedDebouncedQuery = showSearch ? debouncedQuery.trim() : "";
  const { data: searchResults, isFetching: isSearching } = useSearchArticles(selectedAccountId, trimmedDebouncedQuery);

  const focusSearchInput = useCallback(() => {
    const focus = () => searchInputRef.current?.focus({ preventScroll: true });
    focus();
    requestAnimationFrame(focus);
    window.setTimeout(focus, 0);
  }, []);

  const openSearch = useCallback(() => {
    dispatch({ type: "open-search" });
    focusSearchInput();
  }, [focusSearchInput]);

  const handleToggleSearch = useCallback(() => {
    if (!showSearch) {
      openSearch();
    } else {
      focusSearchInput();
    }
  }, [focusSearchInput, openSearch, showSearch]);

  const handleCloseSearch = useCallback(() => {
    debounceGenerationRef.current += 1;
    dispatch({ type: "close-search" });
  }, []);

  const setSearchQuery = useCallback((value: string) => {
    debounceGenerationRef.current += 1;
    dispatch({ type: "set-search-query", value });
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
