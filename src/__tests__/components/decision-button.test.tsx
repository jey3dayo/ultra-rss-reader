import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
    );
    expect(screen.getByRole("button", { name: "Later" })).toHaveClass("border-border-strong", "bg-surface-1/88");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
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
});
