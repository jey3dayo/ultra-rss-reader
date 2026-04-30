import { describe, expect, it, vi } from "vitest";
import { buildArticleListBodyEmptyState } from "@/components/reader/use-article-list-body-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "reader");

describe("buildArticleListBodyEmptyState", () => {
  it("uses search empty state labels and clear action when search has no results", () => {
    const handleCloseSearch = vi.fn();

    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: true,
      setupEmptyState: "none",
      trimmedDebouncedQuery: "rust",
      handleCloseSearch,
    });

    expect(props).toEqual({
      emptyStateVariant: "default",
      emptyMessage: t("search_no_results_title", { query: "rust" }),
      emptyDescription: t("search_no_results_description"),
      emptyActionLabel: t("clear_search_action"),
      onEmptyAction: handleCloseSearch,
    });
  });

  it("hides the setup empty state before accounts exist", () => {
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "no-accounts",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
    });

    expect(props).toEqual({
      emptyStateVariant: "hidden",
      emptyMessage: t("article_list_setup_no_accounts_title"),
      emptyDescription: t("article_list_setup_no_accounts_description"),
      emptyActionLabel: undefined,
      onEmptyAction: undefined,
    });
  });

  it("uses setup copy when feeds are missing", () => {
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "no-feeds",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
    });

    expect(props).toEqual({
      emptyStateVariant: "setup",
      emptyMessage: t("article_list_setup_no_feeds_title"),
      emptyDescription: t("article_list_setup_no_feeds_description"),
      emptyActionLabel: undefined,
      onEmptyAction: undefined,
    });
  });

  it("uses the default article empty state when setup is complete", () => {
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "none",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
    });

    expect(props).toEqual({
      emptyStateVariant: "default",
      emptyMessage: t("no_articles"),
      emptyDescription: t("no_articles_description"),
      emptyActionLabel: undefined,
      onEmptyAction: undefined,
    });
  });
});
