import { describe, expect, it } from "vitest";
import { EXCEPTION_SEMANTIC_TONE_TOKENS, exceptionSemanticToneRoles } from "@/constants/exception-palettes";

describe("exception semantic tone tokens", () => {
  it("maps semantic roles to the shared state token names", () => {
    expect(exceptionSemanticToneRoles).toEqual(["danger", "warning", "success", "neutral"]);
    expect(EXCEPTION_SEMANTIC_TONE_TOKENS).toEqual({
      danger: {
        border: "state-danger-border",
        surface: "state-danger-surface",
        foreground: "state-danger-foreground",
      },
      warning: {
        border: "state-warning-border",
        surface: "state-warning-surface",
        foreground: "state-warning-foreground",
      },
      success: {
        border: "state-success-border",
        surface: "state-success-surface",
        foreground: "state-success-foreground",
      },
      neutral: {
        border: "border",
        surface: "surface-1",
        foreground: "foreground-soft",
      },
    });
  });
});
