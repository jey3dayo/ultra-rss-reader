import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("AppConfirmDialog", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("exposes an accessible name and description for the dialog", () => {
    useUiStore.getState().showConfirm("Delete this feed?", vi.fn(), { actionLabel: "Delete" });

    render(<AppConfirmDialog />, { wrapper: createWrapper() });

    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveAccessibleDescription("Delete this feed?");
  });
});
