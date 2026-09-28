import { act, render, screen } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { mockObserverConstructors } from "@tests/helpers/typed-test-factories";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArticleListScreenView } from "@/components/reader/article-list-screen-view";
import { SelectionSummaryEmptyState } from "@/components/reader/article-selection-summary";
import { ReaderPassiveLayoutProvider } from "@/components/reader/reader-passive-layout";
import type { ArticleViewSummaryState } from "@/lib/articles/article-view";

let cleanupObserverMocks: (() => void) | null = null;

function mockLayoutObservers() {
  const mocks = mockObserverConstructors();
  cleanupObserverMocks = mocks.cleanupObservers;
  return mocks;
}

function mockBounds(element: HTMLElement, top: number, bottom: number) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top,
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
}

function mockAnimationFrames() {
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });

  const flushUntilMeasured = (card: HTMLElement) => {
    let safety = 0;
    while (card.style.visibility === "hidden" && callbacks.length > 0 && safety < 12) {
      const callback = callbacks.shift();
      if (callback) {
        act(() => {
          callback(0);
        });
      }
      safety += 1;
    }
  };

  return { flushUntilMeasured };
}

const smartSummary: ArticleViewSummaryState = {
  kind: "smart",
  smartKind: "unread",
  articleCount: 0,
  feedCount: 0,
  unreadCount: 0,
  todayArticleCount: 0,
  weekArticleCount: 0,
  recentFeeds: [],
  latestArticlePublishedAt: null,
};

afterEach(() => {
  cleanupObserverMocks?.();
  cleanupObserverMocks = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Reader passive layout product surfaces", () => {
  it("ArticleListScreenView hides the default empty card until measurement, then applies marginTop", () => {
    mockLayoutObservers();
    const { flushUntilMeasured } = mockAnimationFrames();
    const listRef: RefObject<HTMLDivElement | null> = { current: null };

    render(
      <ReaderPassiveLayoutProvider layoutMode="wide" visiblePanes={["list", "content"]}>
        <ArticleListScreenView
          listAriaLabel="Article list"
          listRef={listRef}
          isActivePane
          isLoading={false}
          loadingMessage="Loading articles"
          emptyMessage="No articles yet"
          groups={[]}
          dimArchived="true"
          textPreview="true"
          imagePreviews="off"
          selectionStyle="modern"
          onSelectArticle={vi.fn()}
          renderRow={({ content }) => content}
        />
      </ReaderPassiveLayoutProvider>,
      { wrapper: createWrapper() },
    );

    const emptyCard = screen.getByTestId("article-list-empty-state");
    const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

    expect(viewport).not.toBeNull();
    expect(emptyCard.style.visibility).toBe("hidden");
    expect(emptyCard.style.marginTop).toBe("");

    mockBounds(viewport as HTMLElement, 0, 1000);
    mockBounds(emptyCard, 0, 100);

    flushUntilMeasured(emptyCard);

    expect(emptyCard.style.visibility).not.toBe("hidden");
    expect(emptyCard.style.marginTop).toBe("250px");
  });

  it("SelectionSummaryEmptyState hides the summary card until measurement, then applies marginTop", () => {
    mockLayoutObservers();
    const { flushUntilMeasured } = mockAnimationFrames();

    render(
      <ReaderPassiveLayoutProvider layoutMode="wide" visiblePanes={["list", "content"]}>
        <SelectionSummaryEmptyState summary={smartSummary} />
      </ReaderPassiveLayoutProvider>,
      { wrapper: createWrapper() },
    );

    const summary = screen.getByTestId("article-selection-summary");
    const body = summary.parentElement;

    expect(body).not.toBeNull();
    expect(summary.style.visibility).toBe("hidden");
    expect(summary.style.marginTop).toBe("");

    mockBounds(body as HTMLElement, 0, 1000);
    mockBounds(summary, 0, 100);

    flushUntilMeasured(summary);

    expect(summary.style.visibility).not.toBe("hidden");
    expect(summary.style.marginTop).toBe("250px");
  });
});
