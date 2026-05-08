import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCommandPaletteHandlers } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";

const { addToHistoryMock, executeActionMock } = vi.hoisted(() => ({
  addToHistoryMock: vi.fn(),
  executeActionMock: vi.fn(),
}));

vi.mock("@/components/reader/hooks/command-palette/use-command-history", () => ({
  addToHistory: addToHistoryMock,
}));

vi.mock("@/lib/actions", () => ({
  executeAction: executeActionMock,
}));

function createHandlers(overrides: Partial<Parameters<typeof useCommandPaletteHandlers>[0]> = {}) {
  const { result } = renderHook(() =>
    useCommandPaletteHandlers({
      closePalette: vi.fn(),
      openShortcutsHelp: vi.fn(),
      showToast: vi.fn(),
      selectedAccountId: "acc-1",
      isSyncing: false,
      selectFeedFromCurrentContext: vi.fn(),
      selectTagFromCurrentContext: vi.fn(),
      selectArticle: vi.fn(),
      openFeedLanding: vi.fn(),
      ...overrides,
    }),
  );
  return result.current;
}

describe("useCommandPaletteHandlers", () => {
  it("opens shortcuts help without dispatching or writing command history", () => {
    const closePalette = vi.fn();
    const openShortcutsHelp = vi.fn();
    const handlers = createHandlers({ closePalette, openShortcutsHelp });

    handlers.handleActionSelect("open-shortcuts-help");

    expect(openShortcutsHelp).toHaveBeenCalledOnce();
    expect(closePalette).toHaveBeenCalledOnce();
    expect(addToHistoryMock).not.toHaveBeenCalled();
    expect(executeActionMock).not.toHaveBeenCalled();
  });
});
