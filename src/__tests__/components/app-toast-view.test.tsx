import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppToastView } from "@/components/shared/app-toast-view";

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
