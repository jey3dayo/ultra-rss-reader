import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppToastView } from "@/design-system";

describe("AppToastView", () => {
  it.each([
    { progress: 0, scale: "scaleX(0)" },
    { progress: 43, scale: "scaleX(0.43)" },
    { progress: 100, scale: "scaleX(1)" },
  ])("renders $progress% progress", ({ progress, scale }) => {
    render(<AppToastView toastMessage={{ message: "Downloading", progress }} onClose={vi.fn()} />);

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveStyle({ transform: scale });
    expect(screen.getByRole("button", { name: "Close" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("clamps numeric progress scale and keeps null progress indeterminate", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AppToastView toastMessage={{ message: "Downloading", progress: -10 }} onClose={onClose} />,
    );

    const progressBar = screen.getByTestId("app-toast").querySelector(".bg-primary");
    expect(progressBar).toHaveStyle({ transform: "scaleX(0)" });
    expect(progressBar).not.toHaveClass("rounded-full");
    expect(progressBar?.parentElement).toHaveClass("rounded-full", "overflow-hidden");

    rerender(<AppToastView toastMessage={{ message: "Downloading", progress: 120 }} onClose={onClose} />);

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveStyle({ transform: "scaleX(1)" });

    rerender(<AppToastView toastMessage={{ message: "Downloading", progress: null }} onClose={onClose} />);

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveClass("w-1/3", "animate-indeterminate");
  });

  it("keeps fixed toast above modal and browser overlay layers", () => {
    render(<AppToastView toastMessage={{ message: "Saved" }} onClose={vi.fn()} />);

    expect(screen.getByTestId("app-toast")).toHaveClass("fixed", "z-[100]");
  });

  it("uses compact bottom-right density for transient toasts", () => {
    render(<AppToastView toastMessage={{ message: "Saved" }} onClose={vi.fn()} />);

    expect(screen.getByTestId("app-toast")).toHaveClass(
      "max-w-[min(22rem,calc(100vw-2rem))]",
      "rounded-md",
      "px-3",
      "py-2",
    );
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("size-8", "focus-visible:border-transparent");
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveClass("justify-end");
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveClass("border-0");
    const icon = screen.getByRole("button", { name: "Close" }).querySelector("svg");
    expect(icon).toHaveAttribute("viewBox", "2 2 20 20");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("stroke-width", "1.5");
  });

  it("renders two-action decision toasts as a right-aligned action pair without a corner dismiss", () => {
    render(
      <AppToastView
        toastMessage={{
          message: "Update ready",
          variant: "update",
          actions: [
            { label: "Restart now", onClick: vi.fn() },
            { label: "Later", onClick: vi.fn() },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    const pair = screen.getByTestId("app-toast-action-pair");
    const buttons = Array.from(pair.querySelectorAll("button"));

    expect(screen.getByTestId("app-toast")).toHaveClass("gap-3", "px-4", "py-3");
    expect(pair).toHaveClass("justify-end");
    expect(buttons.map((button) => button.textContent)).toEqual(["Later", "Restart now"]);
    expect(buttons[0]).toHaveAttribute("data-action-role", "secondary");
    expect(buttons[1]).toHaveAttribute("data-action-role", "primary");
    expect(buttons[1]).toHaveClass("text-primary-foreground", "rounded-md");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("keeps the corner dismiss and leading text action for single-action toasts", () => {
    render(
      <AppToastView
        toastMessage={{ message: "Sync failed", actions: [{ label: "Retry", onClick: vi.fn() }] }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByTestId("app-toast-action-pair")).toBeNull();
  });

  it("keeps long toast messages from pushing dismiss and actions out of the row", () => {
    render(
      <AppToastView
        toastMessage={{
          message: "https://example.com/really/long/path/that/should/wrap/instead/of/pushing/the/dismiss/button",
          actions: [{ label: "Retry", onClick: vi.fn() }],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/really\/long\/path/)).toHaveClass("min-w-0", "break-words");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("shrink-0");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("min-h-8", "focus-visible:border-transparent");
  });

  it("keeps dismiss and indeterminate progress available with a long update message", () => {
    render(
      <AppToastView
        toastMessage={{
          message: "Downloading a very long update package while keeping the progress status readable",
          variant: "update",
          progress: null,
        }}
        onClose={vi.fn()}
        position="static"
      />,
    );

    const toast = screen.getByTestId("app-toast");
    const closeButton = screen.getByRole("button", { name: "Close" });
    const progressTrack = toast.querySelector(".animate-indeterminate")?.parentElement;

    expect(toast).toHaveClass("w-[min(320px,calc(100vw-2rem))]");
    expect(screen.getByText(/very long update package/)).toHaveClass("min-w-0", "break-words");
    expect(closeButton).toHaveClass("size-8", "shrink-0");
    expect(progressTrack).toHaveClass("h-1.5", "w-full");
  });

  it("focuses the progress dismiss button with Tab and dismisses with Enter, Space, or pointer without canceling", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const cancelDownload = vi.fn();

    render(
      <AppToastView
        toastMessage={{
          message: "Downloading",
          progress: 43,
          actions: [{ label: "Cancel download", onClick: cancelDownload }],
        }}
        onClose={onClose}
      />,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveClass("size-8", "focus-visible:ring-3", "focus-visible:ring-ring/60");

    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancelDownload).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(cancelDownload).not.toHaveBeenCalled();

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(3);
    expect(cancelDownload).not.toHaveBeenCalled();
  });

  it("keeps recovery toast actions and dismiss reachable from the keyboard", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onClose = vi.fn();

    render(
      <AppToastView
        toastMessage={{
          message: "Sync failed",
          actions: [{ label: "Retry", onClick: onRetry }],
        }}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("size-8");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("min-h-8");

    await user.tab();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders disabled toast actions as disabled buttons", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <AppToastView
        toastMessage={{
          message: "Update available",
          actions: [{ label: "Update now", onClick: onUpdate, disabled: true }],
        }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Update now" }));

    expect(screen.getByRole("button", { name: "Update now" })).toBeDisabled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { severity: "error" as const, border: "border-state-danger-border", icon: "text-state-danger-foreground" },
    { severity: "warning" as const, border: "border-state-warning-border", icon: "text-state-warning-foreground" },
  ])("marks $severity toasts with a state border and a decorative icon", ({ severity, border, icon }) => {
    render(<AppToastView toastMessage={{ message: "Sync failed", severity }} onClose={vi.fn()} />);

    const toast = screen.getByTestId("app-toast");
    const severityIcon = screen.getByTestId("app-toast-severity-icon");
    expect(toast).toHaveClass(border);
    expect(toast).not.toHaveClass("border-border");
    expect(severityIcon).toHaveClass(icon, "shrink-0");
    expect(severityIcon).toHaveAttribute("aria-hidden", "true");
    expect(toast).not.toHaveAttribute("role");
  });

  it.each([undefined, "info" as const, "success" as const])(
    "keeps the neutral border and no icon for severity %s",
    (severity) => {
      render(<AppToastView toastMessage={{ message: "Saved", severity }} onClose={vi.fn()} />);

      const toast = screen.getByTestId("app-toast");
      expect(screen.queryByTestId("app-toast-severity-icon")).toBeNull();
      expect(toast).toHaveClass("border-border");
      expect(toast.className).not.toMatch(/state-(danger|warning)/);
    },
  );
});
