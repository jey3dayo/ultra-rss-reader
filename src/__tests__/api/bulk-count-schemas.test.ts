import { describe, expect, it } from "vitest";
import { CountResponseSchema, markArticlesReadArgs, NonnegativeIntResponseSchema } from "@/api/schemas";

describe("bulk and count API schemas", () => {
  it("keeps count-style responses nonnegative integers", () => {
    expect(CountResponseSchema.parse(0)).toBe(0);
    expect(CountResponseSchema.parse(2)).toBe(2);
    expect(NonnegativeIntResponseSchema.parse(0)).toBe(0);
    expect(CountResponseSchema).not.toBe(NonnegativeIntResponseSchema);

    expect(() => CountResponseSchema.parse(-1)).toThrow();
    expect(() => CountResponseSchema.parse(1.5)).toThrow();
    expect(() => NonnegativeIntResponseSchema.parse(-1)).toThrow();
    expect(() => NonnegativeIntResponseSchema.parse(Number.NaN)).toThrow();
  });

  it("rejects empty markArticlesReadArgs article id lists", () => {
    expect(markArticlesReadArgs.parse({ articleIds: ["a-1"] })).toEqual({
      articleIds: ["a-1"],
    });
    expect(() => markArticlesReadArgs.parse({ articleIds: [] })).toThrow();
  });
});
