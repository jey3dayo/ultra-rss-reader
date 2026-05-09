import { createDevIntentState, resetDevIntentState } from "@tests/helpers/dev-intent";
import { describe, expect, it } from "vitest";

describe("dev intent test state helpers", () => {
  it("creates mutable state with no active intent", () => {
    const state = createDevIntentState();

    expect(state).toEqual({ intent: null });

    state.intent = "open-web-preview-url";

    expect(state.intent).toBe("open-web-preview-url");
  });

  it("resets mutable state to no active intent", () => {
    const state = createDevIntentState();
    state.intent = "open-web-preview-url";

    resetDevIntentState(state);

    expect(state).toEqual({ intent: null });
  });
});
