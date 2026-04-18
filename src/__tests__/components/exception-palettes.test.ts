import { describe, expect, it } from "vitest";
import { PROVIDER_ICON_BG_CLASS, TAG_COLOR_PRESETS } from "@/components/shared/exception-palettes";

describe("exception palettes", () => {
  it("keeps the tag palette centralized", () => {
    expect(TAG_COLOR_PRESETS).toEqual([
      "#cf7868",
      "#c88d62",
      "#b59a64",
      "#5f9670",
      "#5f9695",
      "#6f8eb8",
      "#8c79b2",
      "#b97a90",
      "#726d66",
    ]);
  });

  it("keeps provider brand colors centralized", () => {
    expect(PROVIDER_ICON_BG_CLASS).toEqual({
      Local: "bg-orange-500",
      FreshRss: "bg-[#0062BE]",
      Fever: "bg-gray-500",
      Feedly: "bg-[#2BB24C]",
    });
  });
});
