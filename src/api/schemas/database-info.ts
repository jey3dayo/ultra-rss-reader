import { z } from "zod";

export const DatabaseInfoDtoSchema = z
  .object({
    db_size_bytes: z.number().int().nonnegative(),
    wal_size_bytes: z.number().int().nonnegative(),
    total_size_bytes: z.number().int().nonnegative(),
  })
  .refine((value) => value.total_size_bytes >= value.db_size_bytes + value.wal_size_bytes, {
    path: ["total_size_bytes"],
  });

export type DatabaseInfoDto = z.output<typeof DatabaseInfoDtoSchema>;
