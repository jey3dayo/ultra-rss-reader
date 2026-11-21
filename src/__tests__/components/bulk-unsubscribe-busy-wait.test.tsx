import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BUSY_MESSAGE,
  confirmWithKeyboard,
  makeTarget,
  renderDialog,
  setupDeleteFeed,
} from "@tests/helpers/bulk-unsubscribe-dialog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";

const WAITING_MESSAGE =
  "Waiting for a sync or other maintenance to finish. This will continue automatically afterward.";

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function busyTimes(times: number) {
  let attempts = 0;
  return () => {
    attempts += 1;
    return attempts <= times ? Promise.reject(new Error(BUSY_MESSAGE)) : Promise.resolve(null);
  };
}

describe("BulkUnsubscribeDialog busy wait", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    useBulkUnsubscribeStore.getState().reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    showToast.mockReset();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      showToast,
      subscriptionsWorkspace: { kind: "index", accountId: "acc-1" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits out a busy feed with a growing delay, then finishes without counting busy as a failure", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed({ b: busyTimes(2) });
    const { onSettled, onClose } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);
    await waitFor(() => expect(calls).toEqual(["a", "b"]));
    expect(screen.getByText(WAITING_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText("Feed b").closest("li")).toHaveAttribute("data-status", "waiting");

    await advance(2_500);
    expect(calls).toEqual(["a", "b"]);
    await advance(500);
    expect(calls).toEqual(["a", "b", "b"]);
    expect(screen.getByText("Feed b").closest("li")).toHaveAttribute("data-status", "waiting");

    await advance(5_500);
    expect(calls).toEqual(["a", "b", "b"]);
    await advance(500);

    expect(onClose).toHaveBeenCalledWith({ allSucceeded: true });
    expect(calls).toEqual(["a", "b", "b", "b", "c"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(showToast).toHaveBeenCalledWith("Unsubscribed from 3 feeds");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries shortly after a sync-completed notice instead of waiting out the full delay or retrying at once", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed({ b: busyTimes(1) });
    const { onClose } = renderDialog([makeTarget("a"), makeTarget("b")]);

    await confirmWithKeyboard(user, 2);
    await waitFor(() => expect(calls).toEqual(["a", "b"]));

    await advance(500);
    act(() => {
      useBulkUnsubscribeStore.getState().notifySyncCompleted();
    });
    await advance(500);
    expect(calls).toEqual(["a", "b"]);

    await advance(600);
    expect(onClose).toHaveBeenCalledWith({ allSucceeded: true });
    expect(calls).toEqual(["a", "b", "b"]);
  });

  it("stops at once while waiting, leaving the waiting feed and the rest not run", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed({ b: busyTimes(Number.POSITIVE_INFINITY) });
    const { onSettled, onClose } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);
    await waitFor(() => expect(calls).toEqual(["a", "b"]));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    await advance(0);
    expect(screen.getByText("Stopped. Unsubscribed from 1; 2 not run.")).toBeInTheDocument();
    expect(useBulkUnsubscribeStore.getState().run.rows.map((row) => row.status)).toEqual([
      "done",
      "skipped",
      "skipped",
    ]);
    expect(screen.queryByText(WAITING_MESSAGE)).toBeNull();
    expect(onSettled).toHaveBeenCalledWith(["a"]);
    expect(onClose).not.toHaveBeenCalled();

    await advance(60_000);
    expect(calls).toEqual(["a", "b"]);
  });

  it("keeps waiting when the dialog unmounts, then retries after the delay and finishes in the background", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed({ b: busyTimes(1) });
    const { onSettled, onClose, queryClient } = renderDialog([makeTarget("a"), makeTarget("b")]);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await confirmWithKeyboard(user, 2);
    await waitFor(() => expect(calls).toEqual(["a", "b"]));
    // Entering the busy wait already refreshes the list with the feeds unsubscribed so far.
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "remove dialog", hidden: true }));
    await advance(100);
    expect(calls).toEqual(["a", "b"]);

    await advance(3_000);
    expect(calls).toEqual(["a", "b", "b"]);
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(["a", "b"]));
    expect(showToast).toHaveBeenCalledWith("Unsubscribed from 2 feeds");
    expect(onClose).not.toHaveBeenCalled();
  });
});
