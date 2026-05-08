import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteRuntime } from "@/components/reader/hooks/command-palette/use-command-palette-runtime";
import { loadRuntimeDevScenarios } from "@/dev/scenario-runtime";

vi.mock("@/dev/scenario-runtime", () => ({
  loadRuntimeDevScenarios: vi.fn(),
}));

const loadRuntimeDevScenariosMock = vi.mocked(loadRuntimeDevScenarios);

describe("useCommandPaletteRuntime", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    loadRuntimeDevScenariosMock.mockResolvedValue([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("resets input and deferred query on close while retaining loaded dev scenarios", async () => {
    const { result, rerender } = renderHook(({ open }: { open: boolean }) => useCommandPaletteRuntime({ open }), {
      initialProps: { open: true },
    });

    await waitFor(() => {
      expect(result.current.devScenarios).toHaveLength(1);
    });

    act(() => {
      result.current.setInput("   >   settings");
    });

    await waitFor(() => {
      expect(result.current.query).toBe("settings");
      expect(result.current.deferredQuery).toBe("settings");
    });

    rerender({ open: false });

    await waitFor(() => {
      expect(result.current.input).toBe("");
      expect(result.current.query).toBe("");
      expect(result.current.deferredQuery).toBe("");
    });
    expect(result.current.devScenarios).toEqual([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);

    rerender({ open: true });

    expect(result.current.input).toBe("");
    expect(result.current.query).toBe("");
    expect(result.current.deferredQuery).toBe("");
    expect(result.current.devScenarios).toEqual([
      {
        id: "open-add-feed-dialog",
        title: "Open add feed dialog",
        keywords: ["add", "feed"],
      },
    ]);
  });
});
