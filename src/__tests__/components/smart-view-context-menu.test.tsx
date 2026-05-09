import { ContextMenu } from "@base-ui/react/context-menu";
import { fireEvent, render, screen } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmartViewContextMenuContent } from "@/components/reader/smart-view-context-menu";
import i18n from "@/lib/i18n";
import type { SmartViewItemViewModel } from "@/lib/sidebar/sidebar-smart-views";
import { useUiStore } from "@/stores/ui-store";

const {
  clearArticleViewHistoryMutateMock,
  markAccountReadMutateMock,
  markAccountStarredReadMutateMock,
  unstarAccountArticlesMutateMock,
} = vi.hoisted(() => ({
  clearArticleViewHistoryMutateMock: vi.fn(),
  markAccountReadMutateMock: vi.fn(),
  markAccountStarredReadMutateMock: vi.fn(),
  unstarAccountArticlesMutateMock: vi.fn(),
}));

vi.mock("@/hooks/use-articles", () => ({
  useClearArticleViewHistory: () => ({ mutate: clearArticleViewHistoryMutateMock }),
  useMarkAccountRead: () => ({ mutate: markAccountReadMutateMock }),
  useMarkAccountStarredRead: () => ({ mutate: markAccountStarredReadMutateMock }),
  useUnstarAccountArticles: () => ({ mutate: unstarAccountArticlesMutateMock }),
}));

vi.mock("@/components/reader/hooks/feed-actions/use-old-unread-read-action", () => ({
  useOldUnreadReadAction: () => vi.fn(),
}));

vi.mock("@/hooks/use-confirm-mark-all-read", () => ({
  useConfirmMarkAllRead: () => vi.fn(),
}));

function renderSmartViewMenu(view: SmartViewItemViewModel) {
  return render(
    <ContextMenu.Root open>
      <SmartViewContextMenuContent accountId="acc-1" view={view} />
    </ContextMenu.Root>,
    { wrapper: createWrapper() },
  );
}

describe("SmartViewContextMenuContent", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("maps unread smart view actions to unread action ids", () => {
    renderSmartViewMenu({
      kind: "unread",
      label: "Unread",
      count: 4,
      showCount: true,
      isSelected: true,
    });

    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toHaveAttribute(
      "data-action-id",
      "smart-unread-mark-all-read",
    );
  });

  it("maps starred smart view actions to starred action ids", () => {
    renderSmartViewMenu({
      kind: "starred",
      label: "Starred",
      count: 2,
      showCount: true,
      isSelected: true,
    });

    expect(screen.getByRole("menuitem", { name: "Mark all as read" })).toHaveAttribute(
      "data-action-id",
      "smart-starred-mark-all-read",
    );
    expect(screen.getByRole("menuitem", { name: "Unstar all" })).toHaveAttribute(
      "data-action-id",
      "smart-starred-unstar-all",
    );
  });

  it("maps recent smart view actions to recent action ids", () => {
    renderSmartViewMenu({
      kind: "recent",
      label: "Recently viewed",
      count: 0,
      showCount: false,
      isSelected: true,
    });

    expect(screen.getByRole("menuitem", { name: "Clear history" })).toHaveAttribute(
      "data-action-id",
      "smart-recent-clear-history",
    );
  });

  it("confirms before clearing recently viewed history", () => {
    renderSmartViewMenu({
      kind: "recent",
      label: "Recently viewed",
      count: 0,
      showCount: false,
      isSelected: true,
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Clear history" }));

    expect(clearArticleViewHistoryMutateMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toEqual(
      expect.objectContaining({
        open: true,
        actionLabel: "Clear history",
        variant: "warning",
      }),
    );

    useUiStore.getState().confirmDialog.onConfirm?.();

    expect(clearArticleViewHistoryMutateMock).toHaveBeenCalledWith("acc-1");
  });
});
