import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ImportGate = {
  pending: boolean;
  resolvers: Array<() => void>;
};

function createImportGate(): ImportGate {
  return { pending: true, resolvers: [] };
}

function waitForImportGate(gate: ImportGate): Promise<void> {
  if (!gate.pending) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    gate.resolvers.push(resolve);
  });
}

function releaseImportGate(gate: ImportGate) {
  gate.pending = false;
  for (const resolve of gate.resolvers) {
    resolve();
  }
  gate.resolvers = [];
}

const lazyPaneImportGates = vi.hoisted(() => ({
  sidebar: createImportGate(),
  account: createImportGate(),
  articleList: createImportGate(),
  articleView: createImportGate(),
  reset() {
    this.sidebar = createImportGate();
    this.account = createImportGate();
    this.articleList = createImportGate();
    this.articleView = createImportGate();
  },
}));

vi.mock("@/components/reader/sidebar", async () => {
  await waitForImportGate(lazyPaneImportGates.sidebar);
  return {
    Sidebar: () => <div>Sidebar</div>,
  };
});

vi.mock("@/components/reader/account-pane", async () => {
  await waitForImportGate(lazyPaneImportGates.account);
  return {
    AccountPane: () => <div>Account Pane</div>,
  };
});

vi.mock("@/components/reader/article-list", async () => {
  await waitForImportGate(lazyPaneImportGates.articleList);
  return {
    ArticleList: () => <div>Article List</div>,
  };
});

vi.mock("@/components/reader/article-view", async () => {
  await waitForImportGate(lazyPaneImportGates.articleView);
  return {
    ArticleView: () => <div>Article View</div>,
  };
});

async function loadLayoutTestModules() {
  vi.resetModules();
  lazyPaneImportGates.reset();

  const [{ AppLayout }, { useUiStore }, { usePlatformStore }] = await Promise.all([
    import("@/components/app-layout"),
    import("@/stores/ui-store"),
    import("@/stores/platform-store"),
  ]);

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

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    layoutMode: "wide",
    focusedPane: "sidebar",
    contentMode: "empty",
  });
  useUiStore.getState().openAccountPane();

  return { AppLayout, useUiStore };
}

describe("AppLayout lazy pane Suspense fallbacks", () => {
  beforeEach(() => {
    lazyPaneImportGates.reset();
  });

  it("shows pane shell skeletons in wide layout while lazy reader panes are still loading", async () => {
    const { AppLayout, useUiStore } = await loadLayoutTestModules();

    expect(useUiStore.getState().accountPaneOpen).toBe(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);

    render(<AppLayout />);

    expect(screen.getByTestId("app-layout-sidebar-shell-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("app-layout-account-pane-shell-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("article-list-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("app-layout-article-view-shell-skeleton")).toBeInTheDocument();

    releaseImportGate(lazyPaneImportGates.sidebar);
    releaseImportGate(lazyPaneImportGates.account);
    releaseImportGate(lazyPaneImportGates.articleList);
    releaseImportGate(lazyPaneImportGates.articleView);

    expect(await screen.findByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Account Pane")).toBeInTheDocument();
    expect(screen.getByText("Article List")).toBeInTheDocument();
    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByTestId("app-layout-sidebar-shell-skeleton")).not.toBeInTheDocument();
  });
});
