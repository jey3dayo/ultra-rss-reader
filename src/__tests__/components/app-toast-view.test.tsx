import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppToastView } from "@/design-system";

describe("AppToastView", () => {
  it("clamps numeric progress width and keeps null progress indeterminate", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AppToastView toastMessage={{ message: "Downloading", progress: -10 }} onClose={onClose} />,
    );

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveStyle({ width: "0%" });

    rerender(<AppToastView toastMessage={{ message: "Downloading", progress: 120 }} onClose={onClose} />);

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveStyle({ width: "100%" });

    rerender(<AppToastView toastMessage={{ message: "Downloading", progress: null }} onClose={onClose} />);

    expect(screen.getByTestId("app-toast").querySelector(".bg-primary")).toHaveClass("w-1/3", "animate-pulse");
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
    expect(screen.getByRole("button", { name: "Retry" })).toHaveClass("min-h-8", "focus-visible:border-transparent");
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
