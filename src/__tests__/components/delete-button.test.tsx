import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeleteButton } from "@/components/shared/delete-button";

describe("DeleteButton", () => {
  it("renders a shared delete action with the common marker", () => {
    render(<DeleteButton>Delete</DeleteButton>);

    const button = screen.getByRole("button", { name: "Delete" });

    expect(button).toHaveAttribute("data-delete-button");
  });
});
