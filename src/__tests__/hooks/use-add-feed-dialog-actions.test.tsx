import { Result } from "@praha/byethrow";
import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import { useAddFeedDialogActions } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions";
import i18n from "@/lib/i18n";

vi.mock("@/api/tauri-commands", () => ({
  addLocalFeed: vi.fn(),
  createFolder: vi.fn(),
  discoverFeeds: vi.fn(),
  updateFeedFolder: vi.fn(),
}));

const t = i18n.getFixedT("en", "reader");

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe("useAddFeedDialogActions", () => {
  beforeEach(() => {
    vi.mocked(addLocalFeed).mockReset();
    vi.mocked(discoverFeeds).mockReset();
    vi.mocked(updateFeedFolder).mockReset();
  });

  it("normalizes manual URLs before discovery", async () => {
    vi.mocked(discoverFeeds).mockResolvedValue(
      Result.succeed([{ url: "https://example.com/feed.xml", title: "Example Feed" }]),
    );

    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url: " https://example.com ",
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveryRequestId: null,
          discoveredFeeds: [],
          selectedFeedUrl: null,
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: true,
          urlHint: null,
          urlHintTone: "muted",
          isSubmitDisabled: false,
          isDiscoverDisabled: false,
          discoveredFeedOptions: [],
        },
        trimmedUrl: "https://example.com",
        folderSelection: {
          selectedFolderId: null,
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient: new QueryClient(),
        onOpenChange: vi.fn(),
        showToast: vi.fn(),
        t,
      }),
    );

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(discoverFeeds).toHaveBeenCalledWith("https://example.com");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "discover-single",
        feeds: [{ url: "https://example.com/feed.xml", title: "Example Feed" }],
      }),
    );
  });

  it.each([
    "not-a-url",
    "//example.com/feed.xml",
    "https://[malformed",
  ])("keeps malformed manual URL failures on the invalid URL copy without discovering: %s", async (url) => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url,
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveryRequestId: null,
          discoveredFeeds: [],
          selectedFeedUrl: null,
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: false,
          urlHint: t("invalid_feed_url"),
          urlHintTone: "error",
          isSubmitDisabled: true,
          isDiscoverDisabled: true,
          discoveredFeedOptions: [],
        },
        trimmedUrl: url,
        folderSelection: {
          selectedFolderId: null,
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient: new QueryClient(),
        onOpenChange: vi.fn(),
        showToast: vi.fn(),
        t,
      }),
    );

    await act(async () => {
      await result.current.handleDiscover();
    });

    expect(discoverFeeds).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-invalid-url-error",
      error: t("invalid_feed_url"),
    });
  });

  it("ignores stale discovery responses after a newer URL discovery starts", async () => {
    const firstDiscovery = createDeferred<Awaited<ReturnType<typeof discoverFeeds>>>();
    const secondDiscovery = createDeferred<Awaited<ReturnType<typeof discoverFeeds>>>();
    vi.mocked(discoverFeeds).mockReturnValueOnce(firstDiscovery.promise).mockReturnValueOnce(secondDiscovery.promise);

    const dispatch = vi.fn();
    const createProps = (url: string, trimmedUrl: string) => ({
      accountId: "account-1",
      state: {
        url,
        error: null,
        successMessage: null,
        loading: false,
        discovering: false,
        discoveryRequestId: null,
        discoveredFeeds: [],
        selectedFeedUrl: null,
      },
      dispatch,
      derived: {
        hasManualUrl: true,
        isManualUrlValid: true,
        urlHint: null,
        urlHintTone: "muted" as const,
        isSubmitDisabled: false,
        isDiscoverDisabled: false,
        discoveredFeedOptions: [],
      },
      trimmedUrl,
      folderSelection: {
        selectedFolderId: null,
        isCreatingFolder: false,
        newFolderName: "",
      },
      queryClient: new QueryClient(),
      onOpenChange: vi.fn(),
      showToast: vi.fn(),
      t,
    });
    const { result, rerender } = renderHook(
      ({ url, trimmedUrl }) => useAddFeedDialogActions(createProps(url, trimmedUrl)),
      {
        initialProps: {
          url: "https://old.example.com",
          trimmedUrl: "https://old.example.com",
        },
      },
    );

    const firstRequest = result.current.handleDiscover();
    rerender({
      url: "https://new.example.com",
      trimmedUrl: "https://new.example.com",
    });
    const secondRequest = result.current.handleDiscover();

    await act(async () => {
      secondDiscovery.resolve(Result.succeed([{ url: "https://new.example.com/feed.xml", title: "New Feed" }]));
      await secondRequest;
    });
    await act(async () => {
      firstDiscovery.resolve(Result.succeed([{ url: "https://old.example.com/feed.xml", title: "Old Feed" }]));
      await firstRequest;
    });

    expect(discoverFeeds).toHaveBeenNthCalledWith(1, "https://old.example.com");
    expect(discoverFeeds).toHaveBeenNthCalledWith(2, "https://new.example.com");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "discover-single",
        feeds: [{ url: "https://new.example.com/feed.xml", title: "New Feed" }],
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "discover-single",
        feeds: [{ url: "https://old.example.com/feed.xml", title: "Old Feed" }],
      }),
    );
  });

  it("ignores a discovery response after the URL changes before another discovery starts", async () => {
    const discovery = createDeferred<Awaited<ReturnType<typeof discoverFeeds>>>();
    vi.mocked(discoverFeeds).mockReturnValue(discovery.promise);

    const dispatch = vi.fn();
    const createProps = (url: string, trimmedUrl: string) => ({
      accountId: "account-1",
      state: {
        url,
        error: null,
        successMessage: null,
        loading: false,
        discovering: false,
        discoveryRequestId: null,
        discoveredFeeds: [],
        selectedFeedUrl: null,
      },
      dispatch,
      derived: {
        hasManualUrl: true,
        isManualUrlValid: true,
        urlHint: null,
        urlHintTone: "muted" as const,
        isSubmitDisabled: false,
        isDiscoverDisabled: false,
        discoveredFeedOptions: [],
      },
      trimmedUrl,
      folderSelection: {
        selectedFolderId: null,
        isCreatingFolder: false,
        newFolderName: "",
      },
      queryClient: new QueryClient(),
      onOpenChange: vi.fn(),
      showToast: vi.fn(),
      t,
    });
    const { result, rerender } = renderHook(
      ({ url, trimmedUrl }) => useAddFeedDialogActions(createProps(url, trimmedUrl)),
      {
        initialProps: {
          url: "https://old.example.com",
          trimmedUrl: "https://old.example.com",
        },
      },
    );

    const request = result.current.handleDiscover();
    rerender({
      url: "https://new.example.com",
      trimmedUrl: "https://new.example.com",
    });

    await act(async () => {
      discovery.resolve(Result.succeed([{ url: "https://old.example.com/feed.xml", title: "Old Feed" }]));
      await request;
    });

    expect(discoverFeeds).toHaveBeenCalledWith("https://old.example.com");
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "start-discover" }));
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "discover-single",
        feeds: [{ url: "https://old.example.com/feed.xml", title: "Old Feed" }],
      }),
    );
  });

  it("adds the selected discovered feed and assigns the selected folder", async () => {
    vi.mocked(addLocalFeed).mockResolvedValue(
      Result.succeed({
        id: "feed-new",
        account_id: "account-1",
        folder_id: null,
        remote_id: null,
        title: "Example Feed",
        url: "https://example.com/atom.xml",
        site_url: "https://example.com",
        unread_count: 0,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      }),
    );
    vi.mocked(updateFeedFolder).mockResolvedValue(Result.succeed(null));

    const dispatch = vi.fn();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient();

    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url: " https://example.com ",
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveryRequestId: null,
          discoveredFeeds: [
            { url: "https://example.com/rss.xml", title: "RSS" },
            { url: "https://example.com/atom.xml", title: "Atom" },
          ],
          selectedFeedUrl: "https://example.com/atom.xml",
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: true,
          urlHint: null,
          urlHintTone: "muted",
          isSubmitDisabled: false,
          isDiscoverDisabled: false,
          discoveredFeedOptions: [
            { value: "https://example.com/rss.xml", label: "RSS" },
            { value: "https://example.com/atom.xml", label: "Atom" },
          ],
        },
        trimmedUrl: "https://example.com",
        folderSelection: {
          selectedFolderId: "folder-1",
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient,
        onOpenChange,
        showToast: vi.fn(),
        t,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(addLocalFeed).toHaveBeenCalledWith("account-1", "https://example.com/atom.xml");
    expect(updateFeedFolder).toHaveBeenCalledWith("feed-new", "folder-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignores repeated submit calls while the first add feed request is in flight", async () => {
    const addFeed = createDeferred<Awaited<ReturnType<typeof addLocalFeed>>>();
    vi.mocked(addLocalFeed).mockReturnValue(addFeed.promise);

    const dispatch = vi.fn();
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url: "https://example.com/feed.xml",
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveryRequestId: null,
          discoveredFeeds: [],
          selectedFeedUrl: null,
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: true,
          urlHint: null,
          urlHintTone: "muted",
          isSubmitDisabled: false,
          isDiscoverDisabled: false,
          discoveredFeedOptions: [],
        },
        trimmedUrl: "https://example.com/feed.xml",
        folderSelection: {
          selectedFolderId: null,
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient: new QueryClient(),
        onOpenChange,
        showToast: vi.fn(),
        t,
      }),
    );

    const firstSubmit = result.current.handleSubmit();
    const secondSubmit = result.current.handleSubmit();

    await vi.waitFor(() => {
      expect(addLocalFeed).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      addFeed.resolve(
        Result.succeed({
          id: "feed-new",
          account_id: "account-1",
          folder_id: null,
          remote_id: null,
          title: "Example Feed",
          url: "https://example.com/feed.xml",
          site_url: "https://example.com",
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        }),
      );
      await firstSubmit;
      await secondSubmit;
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-loading",
      loading: true,
    });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "set-loading",
      loading: false,
    });
  });

  it("clears loading and keeps the submit error when adding a feed fails", async () => {
    vi.mocked(addLocalFeed).mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "network down",
      }),
    );

    const dispatch = vi.fn();
    const showToast = vi.fn();
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient();

    const { result } = renderHook(() =>
      useAddFeedDialogActions({
        accountId: "account-1",
        state: {
          url: "https://example.com/feed.xml",
          error: null,
          successMessage: null,
          loading: false,
          discovering: false,
          discoveryRequestId: null,
          discoveredFeeds: [],
          selectedFeedUrl: null,
        },
        dispatch,
        derived: {
          hasManualUrl: true,
          isManualUrlValid: true,
          urlHint: null,
          urlHintTone: "muted",
          isSubmitDisabled: false,
          isDiscoverDisabled: false,
          discoveredFeedOptions: [],
        },
        trimmedUrl: "https://example.com/feed.xml",
        folderSelection: {
          selectedFolderId: null,
          isCreatingFolder: false,
          newFolderName: "",
        },
        queryClient,
        onOpenChange,
        showToast,
        t,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "set-loading",
      loading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-submit-error",
      error: t("failed_to_add_feed", { message: "network down" }),
    });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "set-loading",
      loading: false,
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
