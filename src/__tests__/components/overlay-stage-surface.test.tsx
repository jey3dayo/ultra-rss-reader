import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { OverlayStageSurface } from "@/components/shared/overlay-stage-surface";

describe("OverlayStageSurface", () => {
  it("requires scope to be explicit at the type level", () => {
    // @ts-expect-error scope is required for the shell stage boundary
    const props: ComponentProps<typeof OverlayStageSurface> = { children: "Missing scope" };

    expect(props).toBeDefined();
  });

  it("separates main-stage and content-pane shell boundaries", () => {
    render(
      <>
        <OverlayStageSurface data-testid="main-stage" scope="main-stage">
          Main stage
        </OverlayStageSurface>
        <OverlayStageSurface data-testid="content-pane" scope="content-pane">
          Content pane
        </OverlayStageSurface>
      </>,
    );

    const mainStage = screen.getByTestId("main-stage");
    const contentPane = screen.getByTestId("content-pane");

    expect(mainStage).toHaveAttribute("data-overlay-shell", "stage");
    expect(mainStage).not.toHaveClass("border");
    expect(mainStage).toHaveClass("bg-background");

    expect(contentPane).toHaveAttribute("data-overlay-shell", "stage");
    expect(contentPane).toHaveClass("border");
    expect(contentPane).toHaveClass("border-border/60");
    expect(contentPane).toHaveClass("shadow-elevation-3");
  });
});
