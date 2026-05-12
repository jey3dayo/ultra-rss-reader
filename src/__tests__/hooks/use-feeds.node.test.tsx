import { Result } from "@praha/byethrow";
import "@testing-library/react/dont-cleanup-after-each";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { useImportOpml } from "@/hooks/use-feeds";
import {
  type QueryInvalidationFailure,
  queryKeys,
  setQueryInvalidationFailureReporterForDiagnostics,
} from "@/lib/query/query-invalidation";

setupBrowserTestDom();

describe("useImportOpml", () => {
  let restoreInvalidationFailureReporter: (() => void) | null = null;

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    restoreInvalidationFailureReporter?.();
    restoreInvalidationFailureReporter = null;
    vi.restoreAllMocks();
  });

  it("keeps OPML import successful when post-import query invalidation fails", async () => {
    const { queryClient, wrapper } = createQueryWrapper({
      queryClientConfig: { defaultOptions: { mutations: { retry: false } } },
    });
    const importedFeeds: FeedDto[] = [
      {
        id: "feed-imported",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Imported Feed",
        url: "https://example.com/feed.xml",
        site_url: "https://example.com",
        unread_count: 0,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ];
    const failures: QueryInvalidationFailure[][] = [];
    restoreInvalidationFailureReporter = setQueryInvalidationFailureReporterForDiagnostics((reportedFailures) => {
      failures.push([...reportedFailures]);
    });
    const invalidationError = new Error("invalidate failed");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(invalidationError);
    const importOpmlSpy = vi.spyOn(tauriCommands, "importOpml").mockResolvedValue(Result.succeed(importedFeeds));

    const { result } = renderHook(() => useImportOpml(), { wrapper });

    await expect(
      result.current.mutateAsync({
        accountId: "acc-1",
        opmlContent: "<opml><body /></opml>",
      }),
    ).resolves.toEqual(importedFeeds);

    expect(importOpmlSpy).toHaveBeenCalledWith("acc-1", "<opml><body /></opml>");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
    await waitFor(() => {
      expect(failures).toEqual([
        [
          { actionOwner: "opml-import", queryKey: queryKeys.feeds.root, error: invalidationError },
          { actionOwner: "opml-import", queryKey: queryKeys.folders.root, error: invalidationError },
        ],
      ]);
    });

    restoreInvalidationFailureReporter();
    restoreInvalidationFailureReporter = null;
  });
});
