import { describe, expect, it } from "vitest";
import {
  buildSubscriptionsEmptyLabel,
  resolveSubscriptionsEmptyExceptionLabel,
  resolveSubscriptionsEmptyLabel,
} from "@/components/subscriptions-index/hooks/subscriptions-index-fetch-error-summary";

const exceptionLabels = {
  fetchErrorsUnknown: "取得状態を確認できません",
  fetchErrorsEmpty: "取得エラーのある購読はありません",
  summariesUnavailable: "集計を読み込めないため、この絞り込みは表示できません。",
};

const labels = {
  default: "一致する購読はありません。",
  filterAndSearch: (filter: string, query: string) => `「${filter}」で、検索「${query}」に一致する購読はありません`,
  searchOnly: (query: string) => `検索「${query}」に一致する購読はありません`,
  filterOnly: (filter: string) => `「${filter}」に一致する購読はありません`,
};

function build(overrides: Partial<Parameters<typeof buildSubscriptionsEmptyLabel>[0]> = {}) {
  return buildSubscriptionsEmptyLabel({
    exceptionLabel: null,
    activeSummaryFilter: "all",
    filterLabel: "90日以上未更新",
    searchQuery: "",
    labels,
    ...overrides,
  });
}

describe("buildSubscriptionsEmptyLabel", () => {
  it("names both the filter and the search query when both are active", () => {
    expect(build({ activeSummaryFilter: "stale", searchQuery: "Missing" })).toBe(
      "「90日以上未更新」で、検索「Missing」に一致する購読はありません",
    );
  });

  it("names only the search query when the filter is all", () => {
    expect(build({ searchQuery: "Missing" })).toBe("検索「Missing」に一致する購読はありません");
  });

  it("names only the filter when there is no search query", () => {
    expect(build({ activeSummaryFilter: "frequent", filterLabel: "更新過多" })).toBe(
      "「更新過多」に一致する購読はありません",
    );
  });

  it("falls back to the default label when neither is active", () => {
    expect(build()).toBe("一致する購読はありません。");
  });

  it("prefers the exception label over the conditional text", () => {
    const fetchErrorsException = resolveSubscriptionsEmptyExceptionLabel("fetch_errors", 0, false, exceptionLabels);
    expect(
      build({
        exceptionLabel: fetchErrorsException,
        activeSummaryFilter: "fetch_errors",
        filterLabel: "取得エラー",
        searchQuery: "Missing",
      }),
    ).toBe("取得エラーのある購読はありません");

    const summariesException = resolveSubscriptionsEmptyExceptionLabel("stale", null, true, exceptionLabels);
    expect(build({ exceptionLabel: summariesException, activeSummaryFilter: "stale", searchQuery: "Missing" })).toBe(
      "集計を読み込めないため、この絞り込みは表示できません。",
    );
  });
});

describe("resolveSubscriptionsEmptyLabel", () => {
  it("keeps the exception and default outcomes from before the conditional text", () => {
    const allLabels = { default: labels.default, ...exceptionLabels };
    expect(resolveSubscriptionsEmptyLabel("all", null, false, allLabels)).toBe(labels.default);
    expect(resolveSubscriptionsEmptyLabel("fetch_errors", null, false, allLabels)).toBe(
      exceptionLabels.fetchErrorsUnknown,
    );
    expect(resolveSubscriptionsEmptyLabel("fetch_errors", 0, false, allLabels)).toBe(exceptionLabels.fetchErrorsEmpty);
    expect(resolveSubscriptionsEmptyLabel("fetch_errors", 3, false, allLabels)).toBe(labels.default);
    expect(resolveSubscriptionsEmptyLabel("frequent", null, true, allLabels)).toBe(
      exceptionLabels.summariesUnavailable,
    );
  });
});
