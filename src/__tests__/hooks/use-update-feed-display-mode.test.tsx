import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import type { ToastData } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { message?: string }) => `${key}:${options?.message ?? ""}`,
  }),
}));

describe("useUpdateFeedDisplaySettings", () => {
  let queryClient: QueryClient;
  let showToastMock: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    showToastMock = vi.fn();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ showToast: showToastMock });
    vi.restoreAllMocks();
  });

  function seedFeeds() {
    queryClient.setQueryData<FeedDto[]>(
      ["feeds", "acc-1"],
      [
        {
          id: "feed-1",
          account_id: "acc-1",
          folder_id: null,
          title: "Tech Blog",
          url: "https://example.com/feed.xml",
          site_url: "https://example.com",
          unread_count: 5,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      ],
    );
  }

  function createHook() {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return renderHook(() => useUpdateFeedDisplaySettings(), { wrapper });
  }

  it("optimistically updates display settings and invalidates feeds on success", async () => {
    seedFeeds();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const updateFeedDisplaySettingsSpy = vi
      .spyOn(tauriCommands, "updateFeedDisplaySettings")
      .mockResolvedValue(Result.succeed(null));
    const { result } = createHook();

    await expect(result.current("feed-1", "on", "on")).resolves.toBe(true);

    expect(updateFeedDisplaySettingsSpy).toHaveBeenCalledWith("feed-1", "on", "on");
    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "on",
        web_preview_mode: "on",
      }),
    ]);
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    });
  });

  it("rolls back display settings and shows a toast on failure", async () => {
    seedFeeds();
    vi.spyOn(tauriCommands, "updateFeedDisplaySettings").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );
    const { result } = createHook();

    await expect(result.current("feed-1", "on", "on")).resolves.toBe(false);

    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      }),
    ]);
    expect(showToastMock).toHaveBeenCalledWith("failed_to_update_display_settings:boom");
  });
});
