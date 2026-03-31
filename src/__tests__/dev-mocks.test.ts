import { Result } from "@praha/byethrow";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrUpdateBrowserWebview } from "@/api/tauri-commands";
import { setupDevMocks } from "@/dev-mocks";

describe("setupDevMocks", () => {
  beforeEach(() => {
    clearMocks();
    delete window.__TAURI_INTERNALS__;
  });

  afterEach(() => {
    clearMocks();
  });

  it("returns a settled browser state for browser-only UI checks", async () => {
    setupDevMocks();

    const result = await createOrUpdateBrowserWebview("https://example.com/article");
    const state = Result.unwrap(result);

    expect(state).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
    });
  });
});
