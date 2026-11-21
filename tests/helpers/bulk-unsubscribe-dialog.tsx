import { render, screen, waitFor } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { expect, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { BulkUnsubscribeDialog } from "@/components/subscriptions-index/bulk-unsubscribe-dialog";
import { BulkUnsubscribeRunner } from "@/components/subscriptions-index/bulk-unsubscribe-runner";
import type { BulkUnsubscribeTarget } from "@/components/subscriptions-index/hooks/use-bulk-unsubscribe-feeds";
import { buildSubscriptionListRows } from "@/lib/subscriptions/subscriptions-index";
import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { createQueryWrapper } from "./create-wrapper";
import { setupTauriMocks } from "./tauri-mocks";

// Mirrors the subscriptions page: a finished run publishes its result through the store,
// and the page applies the succeeded feeds to the selection.
function BulkSettleProbe({
  accountId,
  onSettled,
}: {
  accountId: string;
  onSettled: (succeededFeedIds: readonly string[]) => void;
}) {
  useEffect(() => {
    let lastAppliedRunId = useBulkUnsubscribeStore.getState().lastSettled?.runId ?? 0;
    return useBulkUnsubscribeStore.subscribe((state) => {
      const settled = state.lastSettled;
      if (settled === null || settled.runId <= lastAppliedRunId) {
        return;
      }
      lastAppliedRunId = settled.runId;
      if (settled.accountId !== accountId) {
        return;
      }
      onSettled(settled.succeededFeedIds);
    });
  }, [accountId, onSettled]);
  return null;
}

export const BUSY_MESSAGE = "Database maintenance is unavailable while syncing. Try again after sync completes.";

export function makeTarget(feedId: string, wasKept = false): BulkUnsubscribeTarget {
  const feed: FeedDto = {
    id: feedId,
    account_id: "acc-1",
    folder_id: null,
    remote_id: null,
    title: `Feed ${feedId}`,
    url: `https://example.com/${feedId}.xml`,
    site_url: `https://example.com/${feedId}`,
    icon_url: null,
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
  };
  const [row] = buildSubscriptionListRows({
    feeds: [feed],
    candidateMap: new Map(),
    feedArticleSummaryMap: new Map(),
    folderNameById: new Map(),
  });
  if (!row) {
    throw new Error(`Failed to build subscription row for ${feedId}`);
  }
  return { row, wasKept };
}

type DeleteFeedBehavior = () => Promise<null>;

export function setupDeleteFeed(behaviors: Record<string, DeleteFeedBehavior> = {}) {
  const calls: string[] = [];
  let active = 0;
  let maxActive = 0;
  setupTauriMocks(async (cmd, args) => {
    if (cmd !== "delete_feed") {
      return undefined;
    }
    const feedId = String(args.feedId);
    calls.push(feedId);
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      return await (behaviors[feedId] ?? (() => Promise.resolve(null)))();
    } finally {
      active -= 1;
    }
  });
  return { calls, maxActive: () => maxActive };
}

export function renderDialog(
  targets: ReadonlyArray<BulkUnsubscribeTarget>,
  { withRunner = true, accountId = "acc-1" }: { withRunner?: boolean; accountId?: string } = {},
) {
  const onSettled = vi.fn();
  const onClose = vi.fn();
  const { queryClient, wrapper } = createQueryWrapper();

  function Harness() {
    const [open, setOpen] = useState(true);
    const [session, setSession] = useState(0);
    const [dialogMounted, setDialogMounted] = useState(true);
    return (
      <>
        {withRunner ? <BulkUnsubscribeRunner /> : null}
        <BulkSettleProbe accountId={accountId} onSettled={onSettled} />
        {dialogMounted ? (
          <BulkUnsubscribeDialog
            key={session}
            open={open}
            accountId={accountId}
            targets={targets}
            onClose={(outcome) => {
              onClose(outcome);
              setOpen(false);
            }}
          />
        ) : null}
        <button type="button" onClick={() => setOpen(true)}>
          reopen
        </button>
        <button type="button" onClick={() => setSession((current) => current + 1)}>
          next session
        </button>
        <button type="button" onClick={() => setDialogMounted(false)}>
          remove dialog
        </button>
      </>
    );
  }

  const { unmount } = render(<Harness />, { wrapper });
  return { onSettled, onClose, queryClient, unmount };
}

export async function confirmWithKeyboard(user: ReturnType<typeof userEvent.setup>, feedCount: number) {
  const confirmButton = await screen.findByRole("button", { name: new RegExp(`Unsubscribe from ${feedCount} feeds`) });
  await waitFor(() => expect(confirmButton).toHaveFocus());
  await user.keyboard("{Enter}");
}
