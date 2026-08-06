import { integer, isoTimestamp, minValue, number, object, parse, picklist, pipe, string, ValiError } from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS,
  PARSE_JSON_WITH_SCHEMA_OR_NULL_CALLER_OWNERS,
  parseJsonWithSchema,
  parseJsonWithSchemaOrNull,
  parseWithSchema,
  safeParseJsonWithSchema,
} from "@/schemas/parse";

const userSchema = object({
  id: string(),
  unreadCount: pipe(number(), integer(), minValue(0)),
});
const FROZEN_TEST_NOW = new Date("2026-04-15T00:00:00.000Z");

function toPosixPath(path: string) {
  return path.replaceAll("\\", "/");
}

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

  it("throws a ValiError when the value does not match the schema", () => {
    expect(() => parseWithSchema(userSchema, { id: "acc-1", unreadCount: -1 })).toThrow(ValiError);
  });

  it("keeps malformed JSON as a throwing parse helper failure", () => {
    expect(() => parseJsonWithSchema("not-json", userSchema)).toThrow(SyntaxError);
  });

  it("keeps schema failures as throwing parse helper failures", () => {
    expect(() => parseJsonWithSchema('{"id":"acc-2","unreadCount":-1}', userSchema)).toThrow(ValiError);
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
    expect(schemaInvalidError).toBeInstanceOf(ValiError);
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

  it("keeps nullable JSON parse production callsites inventoried by fallback owner", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join, relative } = await import("node:path");
    const sourceRoot = join(process.cwd(), "src");
    const sourceFiles: string[] = [];
    const ignoredSegments = new Set(["__tests__"]);

    async function collectSourceFiles(directory: string): Promise<void> {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!ignoredSegments.has(entry.name)) {
            await collectSourceFiles(absolutePath);
          }
          continue;
        }

        if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          sourceFiles.push(absolutePath);
        }
      }
    }

    await collectSourceFiles(sourceRoot);

    const callCountEntries = await Promise.all(
      sourceFiles.map(async (sourceFile) => {
        const contents = await readFile(sourceFile, "utf8");
        const relativePath = toPosixPath(relative(process.cwd(), sourceFile));
        const callCount = contents
          .split("\n")
          .filter((line) => line.includes("parseJsonWithSchemaOrNull("))
          .filter((line) => !line.includes("export function parseJsonWithSchemaOrNull")).length;
        return callCount > 0 ? { relativePath, callCount } : undefined;
      }),
    );
    const callCounts = new Map(
      callCountEntries
        .filter((entry) => entry !== undefined)
        .map(({ relativePath, callCount }) => [relativePath, callCount]),
    );

    expect(Object.fromEntries(callCounts)).toEqual(
      Object.fromEntries(
        PARSE_JSON_WITH_SCHEMA_OR_NULL_CALLER_OWNERS.map((owner) => [owner.callsite, owner.callCount]),
      ),
    );
  });

  it("keeps non-nullable fallback owners off the nullable JSON helper inventory", () => {
    expect(JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS.commandHistory).toMatchObject({
      fallbackBoundary: "explicit cleanup",
      nullableParseHelper: false,
    });
    expect(JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS.preferencesLoad).toMatchObject({
      fallbackBoundary: "backend load failure",
      nullableParseHelper: false,
    });
    expect(JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS.diagnostics).toMatchObject({
      fallbackBoundary: "throwing/schema error surface",
      nullableParseHelper: false,
    });
    expect(JSON_SCHEMA_FALLBACK_BOUNDARY_OWNERS.storageCleanup).toMatchObject({
      fallbackBoundary: "schema contract",
      nullableParseHelper: false,
    });
  });

  it("keeps date fixtures relative to a frozen clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TEST_NOW);

    const dateFixtureSchema = object({
      publishedAt: pipe(string(), isoTimestamp()),
      relativeDay: picklist(["past", "future"]),
    });

    expect(
      parse(dateFixtureSchema, {
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
