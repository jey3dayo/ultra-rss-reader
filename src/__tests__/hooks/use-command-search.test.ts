import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommandSearch } from "@/components/reader/hooks/command-palette/use-command-search";

describe("useCommandSearch", () => {
  it("returns the immediate prefix and query and exposes deferredQuery", () => {
    const { result, rerender } = renderHook(({ input }) => useCommandSearch(input), {
      initialProps: { input: "   >   refresh" },
    });

    expect(result.current.prefix).toBe(">");
    expect(result.current.query).toBe("refresh");
    expect(result.current.deferredQuery).toBe("refresh");

    rerender({ input: "@ inbox" });

    expect(result.current.prefix).toBe("@");
    expect(result.current.query).toBe("inbox");
    expect(typeof result.current.deferredQuery).toBe("string");
  });
});
