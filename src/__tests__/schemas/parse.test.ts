import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  parseJsonWithSchema,
  parseJsonWithSchemaOrNull,
  parseWithSchema,
  safeParseJsonWithSchema,
} from "@/schemas/parse";

const userSchema = z.object({
  id: z.string(),
  unreadCount: z.number().int().nonnegative(),
});
const FROZEN_TEST_NOW = new Date("2026-04-15T00:00:00.000Z");

function relativeIsoDate(daysFromFrozenNow: number): string {
  const date = new Date(FROZEN_TEST_NOW);
  date.setUTCDate(date.getUTCDate() + daysFromFrozenNow);
  return date.toISOString();
}

describe("schema parse helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns parsed data when the value matches the schema", () => {
    expect(parseWithSchema(userSchema, { id: "acc-1", unreadCount: 12 })).toEqual({
      id: "acc-1",
      unreadCount: 12,
    });
  });

  it("throws a ZodError when the value does not match the schema", () => {
    expect(() => parseWithSchema(userSchema, { id: "acc-1", unreadCount: -1 })).toThrow(z.ZodError);
  });

  it("keeps malformed JSON as a throwing parse helper failure", () => {
    expect(() => parseJsonWithSchema("not-json", userSchema)).toThrow(SyntaxError);
  });

  it("keeps schema failures as throwing parse helper failures", () => {
    expect(() => parseJsonWithSchema('{"id":"acc-2","unreadCount":-1}', userSchema)).toThrow(z.ZodError);
  });

  it("keeps throwing JSON parse helper error categories distinguishable by callers", () => {
    let malformedJsonError: unknown;
    let schemaInvalidError: unknown;

    try {
      parseJsonWithSchema("not-json", userSchema);
    } catch (error) {
      malformedJsonError = error;
    }

    try {
      parseJsonWithSchema('{"id":"acc-2","unreadCount":-1}', userSchema);
    } catch (error) {
      schemaInvalidError = error;
    }

    expect(malformedJsonError).toBeInstanceOf(SyntaxError);
    expect(schemaInvalidError).toBeInstanceOf(z.ZodError);
  });

  it("parses JSON contents through the provided schema", () => {
    expect(parseJsonWithSchema('{"id":"acc-2","unreadCount":0}', userSchema)).toEqual({
      id: "acc-2",
      unreadCount: 0,
    });
  });

  it("returns null when nullable JSON parsing sees malformed JSON", () => {
    expect(parseJsonWithSchemaOrNull("not-json", userSchema)).toBeNull();
  });

  it("returns null when nullable JSON parsing sees a schema failure", () => {
    expect(parseJsonWithSchemaOrNull('{"id":"acc-2","unreadCount":-1}', userSchema)).toBeNull();
  });

  it("leaves null fallback behavior to the caller", () => {
    expect(
      safeParseJsonWithSchema("not-json", userSchema) ?? {
        id: "fallback",
        unreadCount: 0,
      },
    ).toEqual({
      id: "fallback",
      unreadCount: 0,
    });
    expect(
      parseJsonWithSchemaOrNull('{"id":"acc-2","unreadCount":-1}', userSchema) ?? {
        id: "fallback",
        unreadCount: 0,
      },
    ).toEqual({
      id: "fallback",
      unreadCount: 0,
    });
  });

  it("keeps the safe JSON helper as the nullable fallback boundary", () => {
    expect(safeParseJsonWithSchema("not-json", userSchema)).toBeNull();
    expect(safeParseJsonWithSchema('{"id":"acc-2","unreadCount":-1}', userSchema)).toBeNull();
    expect(safeParseJsonWithSchema('{"id":"acc-2","unreadCount":0}', userSchema)).toEqual({
      id: "acc-2",
      unreadCount: 0,
    });
  });

  it("keeps date fixtures relative to a frozen clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TEST_NOW);

    const dateFixtureSchema = z.object({
      publishedAt: z.string().datetime({ offset: true }),
      relativeDay: z.enum(["past", "future"]),
    });

    expect(
      dateFixtureSchema.parse({
        publishedAt: relativeIsoDate(-1),
        relativeDay: "past",
      }),
    ).toEqual({
      publishedAt: "2026-04-14T00:00:00.000Z",
      relativeDay: "past",
    });
    expect(new Date(relativeIsoDate(1)).getTime()).toBeGreaterThan(Date.now());
  });
});
