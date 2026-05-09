import { describe, expect, it } from "vitest";
import { type DatabaseInfoDto, DatabaseInfoDtoSchema } from "@/api/schemas/database-info";

const getDatabaseInfoResponseFixture = {
  db_size_bytes: 4096,
  wal_size_bytes: 8192,
  shm_size_bytes: 32768,
  total_size_bytes: 45056,
} satisfies DatabaseInfoDto;

describe("DatabaseInfoDtoSchema", () => {
  it("parses a get_database_info read-only command response fixture", () => {
    expect(DatabaseInfoDtoSchema.parse(getDatabaseInfoResponseFixture)).toEqual(getDatabaseInfoResponseFixture);
  });

  it("accepts nonnegative integer byte sizes with a total covering db and wal sizes", () => {
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100,
        wal_size_bytes: 20,
        shm_size_bytes: 30,
        total_size_bytes: 150,
      }).success,
    ).toBe(true);
  });

  it("rejects negative, fractional, and inconsistent byte sizes", () => {
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: -1,
        wal_size_bytes: 20,
        shm_size_bytes: 0,
        total_size_bytes: 20,
      }).success,
    ).toBe(false);
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100.5,
        wal_size_bytes: 20,
        shm_size_bytes: 0,
        total_size_bytes: 121,
      }).success,
    ).toBe(false);
    expect(
      DatabaseInfoDtoSchema.safeParse({
        db_size_bytes: 100,
        wal_size_bytes: 20,
        shm_size_bytes: 0,
        total_size_bytes: 119,
      }).success,
    ).toBe(false);
  });
});
