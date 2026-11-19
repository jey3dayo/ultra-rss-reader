import { parse, safeParse } from "valibot";
import { describe, expect, it } from "vitest";
import { DevRuntimeOptionsSchema } from "@/api/schemas/platform-info";

describe("platform-info schemas", () => {
  it("keeps dev runtime options strict so future options are explicit", () => {
    const validOptions = {
      dev_intent: "browser",
      dev_web_url: "http://localhost:1420",
      dev_window_width: 1280,
      dev_window_height: null,
    };

    expect(parse(DevRuntimeOptionsSchema, validOptions)).toEqual(validOptions);
    expect(
      safeParse(DevRuntimeOptionsSchema, {
        ...validOptions,
        future_dev_option: true,
      }).success,
    ).toBe(false);
  });
});
