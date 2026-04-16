import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { SurfaceCard } from "@/components/shared/surface-card";

describe("SurfaceCard", () => {
  it("keeps the shared card radii aligned to the rounded-md baseline", () => {
    const globalCss = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

    expect(globalCss).toMatch(/--radius-surface-info:\s*0\.5rem;/);
    expect(globalCss).toMatch(/--radius-surface-section:\s*0\.5rem;/);
  });

  it("requires an explicit variant in the component API", () => {
    // @ts-expect-error SurfaceCard requires a semantic variant.
    const props: ComponentProps<typeof SurfaceCard> = { children: "Missing variant" };

    expect(props.children).toBe("Missing variant");
  });

  it("maps info and section variants to distinct semantic surfaces", () => {
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
    expect(infoCard).toHaveClass("rounded-[var(--radius-surface-info)]");
    expect(infoCard).toHaveClass("border-border/70");

    expect(sectionCard).toHaveAttribute("data-surface-card", "section");
    expect(sectionCard).toHaveClass("rounded-[var(--radius-surface-section)]");
    expect(sectionCard).toHaveClass("border-border/60");
  });

  it("supports tone, padding, and className without changing the semantic role", () => {
    render(
      <SurfaceCard data-testid="success-card" variant="section" tone="success" padding="compact" className="max-w-sm">
        Success
      </SurfaceCard>,
    );

    const card = screen.getByTestId("success-card");

    expect(card).toHaveAttribute("data-surface-card", "section");
    expect(card).toHaveClass("border-emerald-500/20");
    expect(card).toHaveClass("bg-emerald-500/8");
    expect(card).toHaveClass("px-3");
    expect(card).toHaveClass("py-3");
    expect(card).toHaveClass("max-w-sm");
  });
});
