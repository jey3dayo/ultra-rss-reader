import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/components/reader/sidebar", () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock("@/components/reader/article-list", () => ({
  ArticleList: () => <div>Article List</div>,
}));

vi.mock("@/components/reader/article-view", () => ({
  ArticleView: () => <div>Article View</div>,
}));

describe("AppLayout", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
  });

  it("hides the article list when feed cleanup is open in wide layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      feedCleanupOpen: true,
      focusedPane: "content",
    });

    render(<AppLayout />);

    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByText("Article List")).not.toBeInTheDocument();
  });
});
