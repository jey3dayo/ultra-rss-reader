import { describe, expect, it } from "vitest";
import { DatabaseInfoDtoSchema } from "@/api/schemas/database-info";

describe("DatabaseInfoDtoSchema", () => {
  it("accepts nonnegative integer byte sizes with a total covering db and wal sizes", () => {
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100,
        wal_size_bytes: 20,
        total_size_bytes: 120,
      }).success,
    ).toBe(true);
  });

  it("rejects negative, fractional, and inconsistent byte sizes", () => {
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: -1,
        wal_size_bytes: 20,
        total_size_bytes: 20,
      }).success,
    ).toBe(false);
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100.5,
        wal_size_bytes: 20,
        total_size_bytes: 121,
      }).success,
    ).toBe(false);
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100,
        wal_size_bytes: 20,
        total_size_bytes: 119,
      }).success,
    ).toBe(false);
  });
});
