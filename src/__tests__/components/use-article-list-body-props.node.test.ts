import { describe, expect, it, vi } from "vitest";
import { buildArticleListBodyEmptyState } from "@/components/reader/hooks/article-list/use-article-list-body-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "reader");

describe("buildArticleListBodyEmptyState", () => {
  it.each(["no-accounts", "no-feeds"] as const)(
    "uses search empty state copy and action before setup state when setup is %s",
    (setupEmptyState) => {
      const handleCloseSearch = vi.fn();

      const props = buildArticleListBodyEmptyState({
        t,
        isSearchEmptyState: true,
        setupEmptyState,
        trimmedDebouncedQuery: "rss",
        handleCloseSearch,
      });

      expect(props).toEqual({
        emptyStateVariant: "default",
        emptyMessage: t("search_no_results_title", { query: "rss" }),
        emptyDescription: t("search_no_results_description"),
        emptyActionLabel: t("clear_search_action"),
        onEmptyAction: handleCloseSearch,
      });
    },
  );

  it("offers account setup before accounts exist", () => {
    const onAddAccount = vi.fn();
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "no-accounts",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
      onAddAccount,
      addAccountLabel: "Add account…",
    });

    expect(props).toEqual({
      emptyStateVariant: "setup",
      emptyMessage: t("article_list_setup_no_accounts_title"),
      emptyDescription: t("article_list_setup_no_accounts_description"),
      emptyActionLabel: "Add account…",
      onEmptyAction: onAddAccount,
    });
  });

  it("uses setup copy when feeds are missing", () => {
    const onAddFeed = vi.fn();
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "no-feeds",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
      onAddFeed,
    });

    expect(props).toEqual({
      emptyStateVariant: "setup",
      emptyMessage: t("article_list_setup_no_feeds_title"),
      emptyDescription: t("article_list_setup_no_feeds_description"),
      emptyActionLabel: t("add_feed"),
      onEmptyAction: onAddFeed,
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

  it("offers feed editing when the selected feed has no articles", () => {
    const onManageSelectedFeed = vi.fn();

    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: "none",
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
      onManageSelectedFeed,
    });

    expect(props).toMatchObject({
      emptyStateVariant: "default",
      emptyMessage: t("no_articles"),
      emptyDescription: t("no_articles_description"),
      emptyActionLabel: t("edit_feed_ellipsis"),
      onEmptyAction: onManageSelectedFeed,
    });
  });

  it.each([
    ["permission", "Permission required", "The article list is unavailable until access is restored."],
    ["auth", "Authentication required", "Reconnect the account before treating this list as empty."],
    ["network", "Cannot refresh articles", "Check the connection or retry before assuming there are no articles."],
    ["schema", "Article data needs recovery", "The response could not be read. Open logs or contact support."],
  ] as const)("uses failure copy instead of true empty copy for %s failures", (failureState, message, description) => {
    const props = buildArticleListBodyEmptyState({
      t,
      isSearchEmptyState: false,
      setupEmptyState: failureState,
      trimmedDebouncedQuery: "",
      handleCloseSearch: vi.fn(),
    });

    expect(props).toEqual({
      emptyStateVariant: "setup",
      emptyMessage: message,
      emptyDescription: description,
      emptyActionLabel: undefined,
      onEmptyAction: undefined,
    });
  });
});
