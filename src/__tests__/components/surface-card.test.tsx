import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { SurfaceCard } from "@/components/shared/surface-card";

describe("SurfaceCard", () => {
  it("requires an explicit variant in the component API", () => {
    // @ts-expect-error SurfaceCard requires a semantic variant.
    const props: ComponentProps<typeof SurfaceCard> = { children: "Missing variant" };

    expect(props.children).toBe("Missing variant");
  });

  it("maps info and section variants to distinct semantic surfaces on the rounded-md baseline", () => {
    render(
      <>
        <SurfaceCard data-testid="info-card" variant="info">
          Info
        </SurfaceCard>
        <SurfaceCard data-testid="section-card" variant="section">
          Section
        </SurfaceCard>
      </>,
    );

    const infoCard = screen.getByTestId("info-card");
    const sectionCard = screen.getByTestId("section-card");

    expect(infoCard).toHaveAttribute("data-surface-card", "info");
    expect(infoCard).toHaveClass("motion-contextual-surface");
    expect(infoCard).toHaveClass("rounded-md");
    expect(infoCard).toHaveClass("border-border/70");

    expect(sectionCard).toHaveAttribute("data-surface-card", "section");
    expect(sectionCard).toHaveClass("motion-contextual-surface");
    expect(sectionCard).toHaveClass("rounded-md");
    expect(sectionCard).toHaveClass("border-border/60");
  });

  it("supports tone, padding, and className without changing the semantic role", () => {
    render(
      <>
        <SurfaceCard data-testid="success-card" variant="section" tone="success" padding="compact" className="max-w-sm">
          Success
        </SurfaceCard>
        <SurfaceCard data-testid="danger-card" variant="section" tone="danger" padding="compact">
          Danger
        </SurfaceCard>
      </>,
    );

    const card = screen.getByTestId("success-card");
    const dangerCard = screen.getByTestId("danger-card");

    expect(card).toHaveAttribute("data-surface-card", "section");
    expect(card).toHaveClass("border-state-success-border");
    expect(card).toHaveClass("bg-state-success-surface");
    expect(card).toHaveClass("text-state-success-foreground");
    expect(card).toHaveClass("px-3");
    expect(card).toHaveClass("py-3");
    expect(card).toHaveClass("max-w-sm");
    expect(dangerCard).toHaveClass("border-state-danger-border");
    expect(dangerCard).toHaveClass("bg-state-danger-surface");
    expect(dangerCard).toHaveClass("text-state-danger-foreground");
  });
});
