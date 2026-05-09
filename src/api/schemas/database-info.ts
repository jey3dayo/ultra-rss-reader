import { z } from "zod";

export const DatabaseInfoDtoSchema = z
  .object({
    db_size_bytes: z.number().int().nonnegative().finite(),
    wal_size_bytes: z.number().int().nonnegative().finite(),
    shm_size_bytes: z.number().int().nonnegative().finite(),
    total_size_bytes: z.number().int().nonnegative().finite(),
  })
  .strict()
  .refine((value) => value.total_size_bytes === value.db_size_bytes + value.wal_size_bytes + value.shm_size_bytes, {
    path: ["total_size_bytes"],
  });

export type DatabaseInfoDto = z.output<typeof DatabaseInfoDtoSchema>;
