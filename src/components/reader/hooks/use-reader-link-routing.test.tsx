import { Result } from "@praha/byethrow";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openInBrowser } from "@/api/tauri-commands";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { useReaderLinkRouting } from "@/components/reader/hooks/use-reader-link-routing";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/api/tauri-commands", () => ({ openInBrowser: vi.fn() }));
const openInBrowserMock = vi.mocked(openInBrowser);

describe("reader link navigation", () => {
  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState(), selectedArticleId: "article-1", contentMode: "reader" });
    usePreferencesStore.setState({ prefs: { open_links: "in_app" } });
    openInBrowserMock.mockResolvedValue(Result.succeed(null));
  });

  it.each(["false", "true"])("preserves external background preference %s", async (background) => {
    usePreferencesStore.setState({ prefs: { open_links: "default_browser", open_links_background: background } });
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    await act(async () => result.current.openReaderLink("https://example.com/from-content"));
    expect(openInBrowserMock).toHaveBeenCalledWith("https://example.com/from-content", background === "true");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it.each([
    "localhost",
    "router",
    "publisher.local",
    "127.0.0.1",
    "192.168.1.20",
    "10.0.0.1",
    "172.16.0.1",
    "169.254.1.1",
    "0.0.0.0",
    "100.64.0.1",
    "[::1]",
    "[fc00::1]",
    "[fe80::1]",
  ])("requires explicit acceptance before opening %s in-app", (host) => {
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    const url = `http://${host}/private?token=secret#hidden`;
    act(() => result.current.openReaderLink(url));
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().confirmDialog).toMatchObject({ open: true, variant: "warning" });
    expect(useUiStore.getState().confirmDialog.message).toContain(host);
    expect(useUiStore.getState().confirmDialog.message).not.toMatch(/token|secret|hidden|\/private/);
    expect(result.current.readerLinkTitle(url)).not.toMatch(/token|secret|hidden|\/private/);
    act(() => useUiStore.getState().confirmDialog.onConfirm?.());
    expect(useUiStore.getState().browserUrl).toBe(url);
    expect(openInBrowserMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://user:secret@example.com/path",
    "file:///private",
    "javascript:alert(1)",
    "https://example.com/\tsecret",
    "\nhttps://example.com/path",
    "https://example.com/%0asecret",
    "https://example.com/\u007fsecret",
  ])("rejects invalid links before parsing or showing a confirmation: %j", (url) => {
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    act(() => result.current.openReaderLink(url));
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
    expect(openInBrowserMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage?.message).not.toContain("secret");
  });

  it("does not let confirmation cancel bypass the routing policy", () => {
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    render(<AppConfirmDialog />);
    act(() => result.current.openReaderLink("http://localhost/private?token=secret"));
    const cancelled = useUiStore.getState().confirmDialog.onConfirm;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => cancelled?.());
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
  });

  it("navigates only the latest accepted intent and drops a previous prompt", () => {
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    act(() => result.current.openReaderLink("http://localhost/old"));
    const stale = useUiStore.getState().confirmDialog.onConfirm;
    act(() => result.current.openReaderLink("http://localhost/latest"));
    act(() => stale?.());
    expect(useUiStore.getState().browserUrl).toBeNull();
    act(() => useUiStore.getState().confirmDialog.onConfirm?.());
    expect(useUiStore.getState().browserUrl).toBe("http://localhost/latest");
  });

  it.each(["article", "scope", "close", "toggle", "navigation", "dismiss"])(
    "invalidates a pending private link after %s changes",
    (change) => {
      const { result } = renderHook(() => useReaderLinkRouting("article-1"));
      act(() => result.current.openReaderLink("http://localhost/stale"));
      const stale = useUiStore.getState().confirmDialog.onConfirm;
      act(() => {
        const store = useUiStore.getState();
        if (change === "article") store.selectArticle("article-2");
        if (change === "scope") store.selectFeedFromCurrentContext("feed-2");
        if (change === "close") store.clearArticle();
        if (change === "toggle") store.setWebPreviewSessionMode("forced-on");
        if (change === "navigation") store.openBrowser("https://example.com/latest");
        if (change === "dismiss") store.closeConfirm();
      });
      act(() => stale?.());
      expect(useUiStore.getState().browserUrl).not.toBe("http://localhost/stale");
    },
  );

  it("invalidates prompts after unmount and feature identity changes", () => {
    const { result, rerender, unmount } = renderHook(({ scope }) => useReaderLinkRouting(scope), {
      initialProps: { scope: "article-1" },
    });
    act(() => result.current.openReaderLink("http://localhost/old"));
    const old = useUiStore.getState().confirmDialog.onConfirm;
    rerender({ scope: "article-2" });
    act(() => old?.());
    expect(useUiStore.getState().browserUrl).toBeNull();
    act(() => result.current.openReaderLink("http://localhost/unmounted"));
    const unmounted = useUiStore.getState().confirmDialog.onConfirm;
    unmount();
    act(() => unmounted?.());
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("keeps the existing external private-host policy without an in-app override", async () => {
    const { result } = renderHook(() => useReaderLinkRouting("article-1"));
    await act(async () => result.current.openReaderLink("http://192.168.1.20/private", { external: true }));
    expect(openInBrowserMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
    await act(async () => result.current.openReaderLink("http://publisher.local/private", { external: true }));
    expect(openInBrowserMock).toHaveBeenCalledWith("http://publisher.local/private", false);
  });
});
