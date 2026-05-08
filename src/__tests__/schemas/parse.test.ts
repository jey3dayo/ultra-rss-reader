import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonWithSchema, parseWithSchema, safeParseJsonWithSchema } from "@/schemas/parse";

const userSchema = z.object({
  id: z.string(),
  unreadCount: z.number().int().nonnegative(),
});

describe("schema parse helpers", () => {
  it("returns parsed data when the value matches the schema", () => {
    expect(parseWithSchema(userSchema, { id: "acc-1", unreadCount: 12 })).toEqual({
      id: "acc-1",
      unreadCount: 12,
    });
  });

  it("throws a ZodError when the value does not match the schema", () => {
    expect(() => parseWithSchema(userSchema, { id: "acc-1", unreadCount: -1 })).toThrow(z.ZodError);
  });

  it("parses JSON contents through the provided schema", () => {
    expect(parseJsonWithSchema('{"id":"acc-2","unreadCount":0}', userSchema)).toEqual({
      id: "acc-2",
      unreadCount: 0,
    });
  });

  it("returns null when safe JSON parsing fails", () => {
    expect(safeParseJsonWithSchema("not-json", userSchema)).toBeNull();
    expect(safeParseJsonWithSchema('{"id":"acc-2","unreadCount":-1}', userSchema)).toBeNull();
  });
});
