import { describe, expect, it } from "vitest";
import {
  computeReaderPassiveLayoutCardOffset,
  computeReaderPassiveLayoutCommonBounds,
  computeReaderPassiveLayoutFitDelta,
  computeReaderPassiveLayoutNormalAnchorY,
  READER_PASSIVE_LAYOUT_FALLBACK_RECOVERY_HYSTERESIS_PX,
  READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX,
  resolveReaderPassiveLayoutMode,
} from "@/components/reader/lib/reader-passive-layout";

const SAFE_MARGIN = READER_PASSIVE_LAYOUT_SAFE_MARGIN_PX;
const HYSTERESIS = READER_PASSIVE_LAYOUT_FALLBACK_RECOVERY_HYSTERESIS_PX;

describe("computeReaderPassiveLayoutCommonBounds", () => {
  it("intersects two visible bodies into T=max(top), B=min(bottom)", () => {
    const common = computeReaderPassiveLayoutCommonBounds([
      { top: 40, bottom: 900 },
      { top: 60, bottom: 800 },
    ]);

    expect(common).toEqual({ top: 60, bottom: 800 });
  });

  it("uses the single body as-is when only one pane is visible", () => {
    const common = computeReaderPassiveLayoutCommonBounds([{ top: 20, bottom: 500 }]);

    expect(common).toEqual({ top: 20, bottom: 500 });
  });

  it("returns null for an empty input (no visible bodies)", () => {
    expect(computeReaderPassiveLayoutCommonBounds([])).toBeNull();
  });

  it("excludes non-finite, zero-height, and inverted bodies before intersecting", () => {
    const common = computeReaderPassiveLayoutCommonBounds([
      { top: Number.NaN, bottom: 900 },
      { top: 500, bottom: 500 },
      { top: 300, bottom: 100 },
      { top: 50, bottom: 700 },
    ]);

    expect(common).toEqual({ top: 50, bottom: 700 });
  });

  it("returns null when every body is invalid", () => {
    expect(
      computeReaderPassiveLayoutCommonBounds([
        { top: Number.POSITIVE_INFINITY, bottom: 10 },
        { top: 10, bottom: 10 },
      ]),
    ).toBeNull();
  });

  it("returns null when the intersection collapses (low pane leaves no overlap)", () => {
    // T = max(top) = 500 from the low pane, B = min(bottom) = 200 from the short pane: no overlap.
    expect(
      computeReaderPassiveLayoutCommonBounds([
        { top: 500, bottom: 900 },
        { top: 0, bottom: 200 },
      ]),
    ).toBeNull();
  });
});

describe("computeReaderPassiveLayoutNormalAnchorY", () => {
  it("is independent of any card's own content height (contract invariant)", () => {
    // The anchor is a pure function of the common region; no card height is ever an input.
    const common = { top: 100, bottom: 100 + 400 };
    const anchor = computeReaderPassiveLayoutNormalAnchorY(common);

    expect(anchor).toBe(100 + 100); // clamp(24, 0.25*400=100, 400-24=376) => 100
  });

  it("clamps the preferred 25% offset up to the safe margin for a short common region", () => {
    // H = 60: 0.25*60 = 15 < S(24), so the safe margin wins.
    const anchor = computeReaderPassiveLayoutNormalAnchorY({ top: 0, bottom: 60 });

    expect(anchor).toBe(SAFE_MARGIN);
  });

  it("uses the preferred 25% offset once H is large enough that it clears both clamps", () => {
    // H = 1000: pref = 250, which is above S(24) and below H-S(976), so neither clamp applies.
    const common = { top: 0, bottom: 1000 };
    const anchor = computeReaderPassiveLayoutNormalAnchorY(common);

    expect(anchor).toBe(250);
  });

  it("returns null when the common region is null", () => {
    expect(computeReaderPassiveLayoutNormalAnchorY(null)).toBeNull();
  });

  it("returns null when the common region is shorter than 2*S", () => {
    const common = { top: 0, bottom: 2 * SAFE_MARGIN - 1 };

    expect(computeReaderPassiveLayoutNormalAnchorY(common)).toBeNull();
  });

  it("accepts exactly 2*S as the minimum valid height", () => {
    const common = { top: 10, bottom: 10 + 2 * SAFE_MARGIN };

    expect(computeReaderPassiveLayoutNormalAnchorY(common)).not.toBeNull();
  });
});

describe("computeReaderPassiveLayoutFitDelta", () => {
  it("computes F = P - S - (Y + C)", () => {
    const fitDelta = computeReaderPassiveLayoutFitDelta({
      normalAnchorY: 100,
      cardHeight: 300,
      bodyBottom: 500,
    });

    // 500 - 24 - (100 + 300) = 76
    expect(fitDelta).toBe(500 - SAFE_MARGIN - (100 + 300));
  });
});

describe("resolveReaderPassiveLayoutMode", () => {
  it("resolves to fallback whenever fitDelta is null, regardless of current mode", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "normal", fitDelta: null })).toBe("fallback");
    expect(resolveReaderPassiveLayoutMode({ currentMode: "fallback", fitDelta: null })).toBe("fallback");
  });

  it("stays normal when F is exactly at the 0 boundary", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "normal", fitDelta: 0 })).toBe("normal");
  });

  it("falls back once F drops just under 0 (F = -epsilon)", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "normal", fitDelta: -0.001 })).toBe("fallback");
  });

  it("does not recover from fallback until F reaches the hysteresis threshold", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "fallback", fitDelta: HYSTERESIS - 0.001 })).toBe("fallback");
  });

  it("recovers from fallback exactly at F = hysteresis", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "fallback", fitDelta: HYSTERESIS })).toBe("normal");
  });

  it("stays normal for any non-negative F once already normal (no premature fallback)", () => {
    expect(resolveReaderPassiveLayoutMode({ currentMode: "normal", fitDelta: 1000 })).toBe("normal");
  });
});

describe("computeReaderPassiveLayoutCardOffset", () => {
  it("uses Y - bodyTop in normal mode", () => {
    const offset = computeReaderPassiveLayoutCardOffset({
      mode: "normal",
      normalAnchorY: 220,
      bodyTop: 40,
      bodyHeight: 800,
    });

    expect(offset).toBe(180);
  });

  it("uses the safe margin in fallback mode when the body is tall enough", () => {
    const offset = computeReaderPassiveLayoutCardOffset({
      mode: "fallback",
      normalAnchorY: 220,
      bodyTop: 40,
      bodyHeight: 800,
    });

    expect(offset).toBe(SAFE_MARGIN);
  });

  it("collapses the fallback top margin to 0 when the measured body is shorter than S", () => {
    const offset = computeReaderPassiveLayoutCardOffset({
      mode: "fallback",
      normalAnchorY: null,
      bodyTop: 40,
      bodyHeight: SAFE_MARGIN - 1,
    });

    expect(offset).toBe(0);
  });

  it("falls back to the safe-margin offset in normal mode when the anchor is unavailable", () => {
    const offset = computeReaderPassiveLayoutCardOffset({
      mode: "normal",
      normalAnchorY: null,
      bodyTop: 40,
      bodyHeight: 800,
    });

    expect(offset).toBe(SAFE_MARGIN);
  });
});
