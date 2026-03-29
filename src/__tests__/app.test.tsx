import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../tests/helpers/tauri-mocks";

describe("App", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("uses full-width panes on mobile", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { container, rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(container.firstElementChild?.firstElementChild).toHaveClass("w-full");
    expect(container.innerHTML).not.toContain("w-[280px]");

    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list" });
    rerender(<AppLayout />);

    expect(container.firstElementChild?.firstElementChild).toHaveClass("w-full");
    expect(container.innerHTML).not.toContain("w-[380px]");
  });
});
