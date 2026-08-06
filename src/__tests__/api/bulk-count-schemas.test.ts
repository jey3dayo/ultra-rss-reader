import { parse } from "valibot";
import { describe, expect, it } from "vitest";
import {
  CountResponseSchema,
  IntResponseSchema,
  markArticlesReadArgs,
  NonnegativeIntResponseSchema,
} from "@/api/schemas";

describe("bulk and count API schemas", () => {
  it("keeps count-style responses split from general integer responses", () => {
    expect(parse(IntResponseSchema, -1)).toBe(-1);
    expect(parse(IntResponseSchema, 0)).toBe(0);
    expect(parse(CountResponseSchema, 0)).toBe(0);
    expect(parse(CountResponseSchema, 2)).toBe(2);
    expect(parse(NonnegativeIntResponseSchema, 0)).toBe(0);
    expect(CountResponseSchema).not.toBe(NonnegativeIntResponseSchema);

    expect(() => parse(CountResponseSchema, -1)).toThrow();
    expect(() => parse(CountResponseSchema, 1.5)).toThrow();
    expect(() => parse(NonnegativeIntResponseSchema, -1)).toThrow();
    expect(() => parse(NonnegativeIntResponseSchema, Number.NaN)).toThrow();
    expect(() => parse(NonnegativeIntResponseSchema, Number.POSITIVE_INFINITY)).toThrow();
  });

  it("rejects empty markArticlesReadArgs article id lists", () => {
    expect(parse(markArticlesReadArgs, { articleIds: ["a-1"] })).toEqual({
      articleIds: ["a-1"],
    });
    expect(() => parse(markArticlesReadArgs, { articleIds: [] })).toThrow();
  });
});
