import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { DecisionButton } from "@/components/shared/decision-button";

describe("DecisionButton", () => {
  it("maps keep, defer, and delete intents to distinct styles", () => {
    render(
      <>
        <DecisionButton intent="keep">Keep</DecisionButton>
        <DecisionButton intent="defer">Later</DecisionButton>
        <DecisionButton intent="delete">Delete</DecisionButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Keep" })).toHaveClass(
      "border-state-success-border",
      "bg-state-success-surface",
      "text-state-success-foreground",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
    expect(screen.getByRole("button", { name: "Later" })).toHaveClass(
      "border-border-strong",
      "bg-surface-1/88",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
  });

  it("keeps disabled state on all intents", () => {
    render(
      <DecisionButton intent="delete" disabled>
        Delete disabled
      </DecisionButton>,
    );

    expect(screen.getByRole("button", { name: "Delete disabled" })).toBeDisabled();
  });

  it("defaults to a non-submit button inside forms", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={onSubmit}>
        <DecisionButton intent="keep">Keep</DecisionButton>
      </form>,
    );

    const button = screen.getByRole("button", { name: "Keep" });
    expect(button).toHaveAttribute("type", "button");

    await user.click(button);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
