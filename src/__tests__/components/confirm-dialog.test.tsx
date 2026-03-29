import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("exposes an accessible name and description for the dialog", () => {
    useUiStore.getState().showConfirm("Delete this feed?", vi.fn(), "Delete");

    render(<ConfirmDialog />, { wrapper: createWrapper() });

    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveAccessibleDescription("Delete this feed?");
  });
});
