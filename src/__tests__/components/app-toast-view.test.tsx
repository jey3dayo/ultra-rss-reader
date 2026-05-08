import { render, screen } from "@testing-library/react";
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
});
