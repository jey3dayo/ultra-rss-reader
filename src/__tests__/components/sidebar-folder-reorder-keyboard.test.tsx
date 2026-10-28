import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@tests/helpers/i18n-setup";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";

const moveFolderByDirection = vi.fn(() => true);

vi.mock("@/components/reader/hooks/sidebar/use-sidebar-controller", () => ({
  useSidebarController: () => ({
    sidebarClassName: "sidebar-test",
    headerProps: {
      onSync: vi.fn(),
      onAddFeed: vi.fn(),
      syncButtonLabel: "Sync",
      syncButtonText: "Sync",
      addFeedButtonLabel: "Add feed",
      addFeedButtonText: "Add feed",
      displayState: { layout: "desktop", titlebar: "standard" },
      syncState: { status: "idle" },
    },
    accountSectionProps: {
      accounts: [],
      selectedAccountId: null,
      onSelectAccount: vi.fn(),
      onToggleAccountList: vi.fn(),
      onCloseAccountList: vi.fn(),
      onOpenAccountSettings: vi.fn(),
      accountStatusLabels: {},
      lastSyncedLabel: "",
      selectedAccountName: undefined,
      isAccountListOpen: false,
      accountMenuId: "account-menu",
      containerRef: { current: null },
      triggerRef: { current: null },
      itemRefs: { current: [] },
    },
    smartViewsProps: {
      views: [],
      onSelectSmartView: vi.fn(),
      selectedAccountId: null,
    },
    contentSectionsProps: {
      onFocusAccountList: vi.fn(),
      subscriptions: { label: "Subscriptions", isOpen: true, onToggle: vi.fn(), renderContextMenu: () => null },
      viewportRef: { current: null },
      navigation: {
        subscriptionsIndexLabel: "Manage",
        subscriptionsIndexShortLabel: "Manage",
        settingsLabel: "Settings",
        themeToggleLabel: "Theme",
        onOpenSubscriptionsIndex: vi.fn(),
        onOpenSettings: vi.fn(),
      },
      addFeedDialog: { accountId: null, isOpen: false, onOpenChange: vi.fn() },
      feedTree: {
        props: {
          isOpen: true,
          folders: [],
          unfolderedFeeds: [],
          onToggleFolder: vi.fn(),
          onSelectFeed: vi.fn(),
          displayFavicons: false,
          emptyState: { kind: "hidden" },
        },
        noFolderLabel: "No folder",
        pressPlusToAddFeedLabel: "Add feed",
        isLoading: false,
        showSkeleton: false,
      },
      tagSection: {
        isVisible: false,
        label: "Tags",
        emptyLabel: "No tags",
        isOpen: false,
        onToggle: vi.fn(),
        tags: [],
        tagArticleCounts: {},
        selection: { type: "all" },
        onSelectTag: vi.fn(),
        renderContextMenu: () => null,
        renderSectionContextMenu: () => null,
      },
      sidebarDensity: "normal",
    },
    folderReorderKeyboard: {
      liveRegionMessage: "Work moved up",
      onFolderReorderKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.metaKey && event.altKey && event.key === "ArrowUp") {
          moveFolderByDirection();
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  }),
}));

describe("Sidebar folder reorder keyboard", () => {
  it("announces folder reorder changes in a polite live region", async () => {
    await i18n.changeLanguage("en");
    render(
      <I18nextProvider i18n={i18n}>
        <Sidebar />
        <button type="button" data-sidebar-folder-navigation-target="true" data-folder-id="folder-1">
          Work
        </button>
      </I18nextProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Work moved up");

    fireEvent.keyDown(document.querySelector('[data-sidebar-pane="true"]') as HTMLElement, {
      key: "ArrowUp",
      metaKey: true,
      altKey: true,
    });

    expect(moveFolderByDirection).toHaveBeenCalled();
  });
});
