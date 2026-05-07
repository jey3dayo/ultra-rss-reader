import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import { toBrowserWebviewBounds, toBrowserWebviewBoundsResult } from "@/lib/browser-webview";

describe("browser-webview helpers", () => {
  it("returns typed browser bounds for measurable rectangles", () => {
    const result = toBrowserWebviewBoundsResult(new DOMRect(10.4, 20.4, 300, 200));

    expect(Result.unwrap(result)).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
  });

  it("keeps the nullable wrapper for existing callers", () => {
    expect(toBrowserWebviewBounds(new DOMRect(10, 20, 300, 200))).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
    expect(toBrowserWebviewBounds(new DOMRect(10, 20, 0, 200))).toBeNull();
  });

  it("returns typed failures for empty browser bounds", () => {
    expect(Result.unwrapError(toBrowserWebviewBoundsResult(new DOMRect(10, 20, 0, 200)))).toBe("empty_rect");
    expect(
      Result.unwrapError(
        toBrowserWebviewBoundsResult(new DOMRect(10, 20, 300, 200), {
          unit: "physical",
          scaleFactor: 0,
        }),
      ),
    ).toBe("empty_bounds");
  });
});
