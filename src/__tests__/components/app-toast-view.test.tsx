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
    expect(screen.getByRole("button", { name: "Close" }).querySelector("svg")).toHaveAttribute("viewBox", "5 5 14 14");
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
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "ml-1",
      "size-8",
      "focus-visible:border-transparent",
    );
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveClass("justify-end");
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveClass("border-0");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("justify-center");
    expect(screen.getByRole("button", { name: "Close" })).toHaveTextContent("×");
    expect(screen.getByRole("button", { name: "Close" }).querySelector("svg")).toBeNull();
  });

  it("gives update toasts an aligned action rail and clear action hierarchy", () => {
    render(
      <AppToastView
        toastMessage={{
          message: "Update ready",
          variant: "update",
          actions: [
            { label: "Restart now", onClick: vi.fn() },
            { label: "Close", onClick: vi.fn() },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    const primaryAction = screen.getByRole("button", { name: "Restart now" });
    const secondaryAction = screen.getByText("Close", { selector: "button" });

    expect(screen.getByTestId("app-toast")).toHaveClass("gap-3", "px-4", "py-3");
    expect(primaryAction.parentElement).toHaveClass("items-center", "-ml-3", "gap-3");
    expect(primaryAction).toHaveClass("text-primary", "hover:text-primary");
    expect(secondaryAction).toHaveClass("text-foreground-soft", "hover:text-foreground");
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

    expect(screen.getByText(/really\/long\/path/)).toHaveClass("min-w-0", "break-words", "leading-snug");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("shrink-0");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass(
      "min-h-8",
      "text-primary",
      "focus-visible:border-transparent",
    );
  });

  it("fits the round-stroke paint bounds to the viewport at the trailing edge of indeterminate update toasts", () => {
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
    const closeIcon = closeButton.querySelector("svg");

    expect(toast).toHaveClass("w-[min(320px,calc(100vw-2rem))]");
    expect(screen.getByText(/very long update package/)).toHaveClass("min-w-0", "break-words");
    expect(closeButton).toHaveClass("size-8", "shrink-0", "justify-end", "border-0");
    expect(closeIcon).toHaveClass("size-4");
    expect(closeIcon).toHaveAttribute("stroke-linecap", "round");
    expect(closeIcon).toHaveAttribute("stroke-width", "2");
    expect(Array.from(closeIcon?.querySelectorAll("path") ?? [], (path) => path.getAttribute("d"))).toEqual([
      "M18 6 6 18",
      "m6 6 12 12",
    ]);
    const strokeRadius = Number(closeIcon?.getAttribute("stroke-width")) / 2;
    const viewport = closeIcon?.getAttribute("viewBox")?.split(/\s+/).map(Number);
    expect(viewport).toEqual([
      6 - strokeRadius,
      6 - strokeRadius,
      18 - 6 + 2 * strokeRadius,
      18 - 6 + 2 * strokeRadius,
    ]);
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
});
