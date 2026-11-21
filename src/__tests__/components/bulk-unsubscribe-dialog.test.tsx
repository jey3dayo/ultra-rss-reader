import { Result } from "@praha/byethrow";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { confirmWithKeyboard, makeTarget, renderDialog, setupDeleteFeed } from "@tests/helpers/bulk-unsubscribe-dialog";
import { createDeferred } from "@tests/helpers/deferred";
import { holdToConfirm } from "@tests/helpers/hold-to-confirm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { MOTION_HOLD_CONFIRM_DURATION_MS } from "@/constants";
import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";

describe("BulkUnsubscribeDialog", () => {
  const showToast = vi.fn();

  beforeEach(() => {
    useBulkUnsubscribeStore.getState().reset();
    showToast.mockReset();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      showToast,
      subscriptionsWorkspace: { kind: "index", accountId: "acc-1" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists kept feeds in their own section and focuses the confirm button first", async () => {
    setupDeleteFeed();
    renderDialog([makeTarget("a"), makeTarget("b", true), makeTarget("c")]);

    const dialog = await screen.findByRole("dialog");
    const keptHeading = within(dialog).getByRole("heading", { name: "Feeds excluded from review (1)" });
    const keptSection = keptHeading.closest("section");
    if (keptSection === null) {
      throw new Error("Expected the kept feeds to be grouped in their own section");
    }
    expect(within(keptSection).getByText("Feed b")).toBeInTheDocument();
    expect(within(keptSection).getByText("Excluded from review")).toBeInTheDocument();
    expect(within(keptSection).getByText("These are included in this unsubscribe.")).toBeInTheDocument();
    expect(within(keptSection).queryByText("Feed a")).toBeNull();
    expect(
      keptHeading.compareDocumentPosition(within(dialog).getByText("Feed a")) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: /Unsubscribe from 3 feeds/ })).toHaveFocus();
    });
  });

  it("pins the dialog to a single shrinkable column so a long feed title cannot widen the list past the dialog", async () => {
    setupDeleteFeed();
    renderDialog([makeTarget("a")]);

    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveClass("grid-cols-[minmax(0,1fr)]");
  });

  it("unsubscribes one feed at a time, then toasts once and closes when every feed succeeds", async () => {
    const user = userEvent.setup();
    const { calls, maxActive } = setupDeleteFeed({
      b: () => new Promise((resolve) => setTimeout(() => resolve(null), 20)),
    });
    const { onSettled, onClose, queryClient } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await confirmWithKeyboard(user, 3);

    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ allSucceeded: true }));
    expect(calls).toEqual(["a", "b", "c"]);
    expect(maxActive()).toBe(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Unsubscribed from 3 feeds");
    const invalidatedKeys = invalidateQueries.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys.length).toBeGreaterThan(0);
    expect(new Set(invalidatedKeys).size).toBe(invalidatedKeys.length);
  });

  it("keeps going after an ordinary failure, reports it, and retries only the failed feed in place", async () => {
    const user = userEvent.setup();
    let failB = true;
    const { calls } = setupDeleteFeed({
      b: () => (failB ? Promise.reject(new Error("Feed is locked")) : Promise.resolve(null)),
    });
    const { onSettled, onClose } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unsubscribed from 2. 1 could not be unsubscribed.");
    expect(alert).toHaveTextContent("Feed b: Feed is locked");
    expect(calls).toEqual(["a", "b", "c"]);
    expect(onSettled).toHaveBeenLastCalledWith(["a", "c"]);
    expect(onClose).not.toHaveBeenCalled();

    failB = false;
    await user.click(screen.getByRole("button", { name: "Retry (1)" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ allSucceeded: true }));
    expect(calls).toEqual(["a", "b", "c", "b"]);
    expect(onSettled).toHaveBeenCalledTimes(2);
    expect(onSettled).toHaveBeenLastCalledWith(["b"]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Unsubscribed from 3 feeds");
  });

  it("closes mid-run without stopping the run, and stopping from the reopened dialog ends it as cancelled", async () => {
    const user = userEvent.setup();
    const inFlight = createDeferred<null>();
    const started = createDeferred<void>();
    const { calls } = setupDeleteFeed({
      b: () => {
        started.resolve();
        return inFlight.promise;
      },
    });
    const { onSettled, onClose } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);
    await started.promise;

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({ allSucceeded: false });
    expect(calls).toEqual(["a", "b"]);

    await user.click(screen.getByRole("button", { name: "reopen" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Stopping…" })).toBeDisabled();
    expect(calls).toEqual(["a", "b"]);

    inFlight.resolve(null);

    await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument());
    expect(screen.getByText("Stopped. Unsubscribed from 2; 1 not run.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
    expect(calls).toEqual(["a", "b"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(["a", "b"]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts the result summary when a run finishes partially with the dialog closed", async () => {
    const user = userEvent.setup();
    const inFlight = createDeferred<null>();
    const started = createDeferred<void>();
    const { calls } = setupDeleteFeed({
      b: () => {
        started.resolve();
        return inFlight.promise;
      },
    });
    const { onSettled } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);
    await started.promise;

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    inFlight.reject(new Error("Feed is locked"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        message: "Unsubscribed from 2. 1 could not be unsubscribed.",
        severity: "error",
      }),
    );
    expect(calls).toEqual(["a", "b", "c"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(["a", "c"]);
  });

  it("starts again from the confirm step when reopened after a finished run", async () => {
    const user = userEvent.setup();
    setupDeleteFeed({ a: () => Promise.reject(new Error("Feed is locked")) });
    const { onClose } = renderDialog([makeTarget("a"), makeTarget("b")]);

    await confirmWithKeyboard(user, 2);
    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledWith({ allSucceeded: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "reopen" }));

    expect(await screen.findByRole("button", { name: /Unsubscribe from 2 feeds/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("starts again from the confirm step when the parent remounts the dialog over a finished run", async () => {
    const user = userEvent.setup();
    setupDeleteFeed({ a: () => Promise.reject(new Error("Feed is locked")) });
    renderDialog([makeTarget("a"), makeTarget("b")]);

    await confirmWithKeyboard(user, 2);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "next session", hidden: true }));

    expect(await screen.findByRole("button", { name: /Unsubscribe from 2 feeds/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a missing runner instead of silently ignoring the start request", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls } = setupDeleteFeed();
    renderDialog([makeTarget("a"), makeTarget("b")], { withRunner: false });

    await confirmWithKeyboard(user, 2);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("BulkUnsubscribeRunner"));
    expect(calls).toEqual([]);
    expect(screen.getByRole("button", { name: /Unsubscribe from 2 feeds/ })).toBeInTheDocument();
  });

  it("keeps the run going when the whole tree unmounts mid-way: the remaining feeds are still deleted", async () => {
    const user = userEvent.setup();
    const inFlight = createDeferred<null>();
    const started = createDeferred<void>();
    const { calls } = setupDeleteFeed({
      b: () => {
        started.resolve();
        return inFlight.promise;
      },
    });
    const { onSettled, onClose, queryClient, unmount } = renderDialog([
      makeTarget("a"),
      makeTarget("b"),
      makeTarget("c"),
    ]);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await confirmWithKeyboard(user, 3);
    await started.promise;
    unmount();
    inFlight.resolve(null);

    await waitFor(() => expect(calls).toEqual(["a", "b", "c"]));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    expect(onSettled).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("finishes the run in the background when only the dialog unmounts and the runner stays mounted", async () => {
    const user = userEvent.setup();
    const inFlight = createDeferred<null>();
    const started = createDeferred<void>();
    const { calls } = setupDeleteFeed({
      b: () => {
        started.resolve();
        return inFlight.promise;
      },
    });
    const { onSettled, onClose, queryClient } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await confirmWithKeyboard(user, 3);
    await started.promise;
    fireEvent.click(screen.getByRole("button", { name: "remove dialog", hidden: true }));
    inFlight.resolve(null);

    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(["a", "b", "c"]));
    expect(calls).toEqual(["a", "b", "c"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Unsubscribed from 3 feeds");
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
  });

  it("stops before the next feed when the displayed account changes, leaving the rest unrun", async () => {
    const user = userEvent.setup();
    const inFlight = createDeferred<null>();
    const started = createDeferred<void>();
    const { calls } = setupDeleteFeed({
      b: () => {
        started.resolve();
        return inFlight.promise;
      },
    });
    const { onSettled } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);
    await started.promise;
    act(() => {
      useUiStore.setState({ subscriptionsWorkspace: { kind: "index", accountId: "acc-2" } });
    });
    inFlight.resolve(null);

    expect(await screen.findByText("Stopped. Unsubscribed from 2; 1 not run.")).toBeInTheDocument();
    expect(calls).toEqual(["a", "b"]);
    expect(screen.getByText("Feed c").closest("li")).toHaveTextContent("Not run");
    expect(onSettled).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("finishes the run and releases the dialog when a delete throws unexpectedly", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const deleteFeedSpy = vi.spyOn(tauriCommands, "deleteFeed").mockImplementation((feedId) => {
      if (feedId === "b") {
        return Promise.reject(new Error("unexpected boom"));
      }
      return Promise.resolve(Result.succeed(null));
    });
    const { onSettled } = renderDialog([makeTarget("a"), makeTarget("b"), makeTarget("c")]);

    await confirmWithKeyboard(user, 3);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Feed b: unexpected boom");
    expect(screen.getByRole("button", { name: "Retry (2)" })).toBeInTheDocument();
    expect(deleteFeedSpy.mock.calls.map(([feedId]) => feedId)).toEqual(["a", "b"]);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(["a"]);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("unexpected error"), expect.any(Error));
  });
});

describe("BulkUnsubscribeDialog hold-to-confirm", () => {
  beforeEach(() => {
    useBulkUnsubscribeStore.getState().reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      showToast: vi.fn(),
      subscriptionsWorkspace: { kind: "index", accountId: "acc-1" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start unsubscribing when the pointer is released before the hold completes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed();
    renderDialog([makeTarget("a"), makeTarget("b")]);

    const confirmButton = await screen.findByRole("button", { name: /Unsubscribe from 2 feeds/ });
    expect(confirmButton).toHaveAccessibleDescription("Press and hold to confirm");
    await user.click(confirmButton);
    act(() => {
      vi.advanceTimersByTime(MOTION_HOLD_CONFIRM_DURATION_MS);
    });
    await act(async () => {});

    expect(calls).toEqual([]);
    expect(screen.getByRole("button", { name: /Unsubscribe from 2 feeds/ })).toBeInTheDocument();
  });

  it("starts unsubscribing only once the pointer hold reaches the hold duration", async () => {
    const { calls } = setupDeleteFeed();
    renderDialog([makeTarget("a"), makeTarget("b")]);

    const confirmButton = await screen.findByRole("button", { name: /Unsubscribe from 2 feeds/ });
    fireEvent.pointerDown(confirmButton);
    act(() => {
      vi.advanceTimersByTime(MOTION_HOLD_CONFIRM_DURATION_MS - 1);
    });
    await act(async () => {});
    expect(calls).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => expect(calls).toEqual(["a", "b"]));
  });

  it("completes a full pointer hold and runs every feed", async () => {
    const { calls } = setupDeleteFeed();
    renderDialog([makeTarget("a")]);

    holdToConfirm(await screen.findByRole("button", { name: /Unsubscribe from 1 feed/ }));

    await waitFor(() => expect(calls).toEqual(["a"]));
  });

  it("starts immediately on Enter without waiting for the hold", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { calls } = setupDeleteFeed();
    renderDialog([makeTarget("a"), makeTarget("b")]);

    await confirmWithKeyboard(user, 2);

    await waitFor(() => expect(calls).toEqual(["a", "b"]));
  });
});
