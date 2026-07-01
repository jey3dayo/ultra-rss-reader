import { z } from "zod";
import { NonnegativeIntegerSchema } from "./common";

export const DatabaseInfoDtoSchema = z
  .strictObject({
    db_size_bytes: NonnegativeIntegerSchema,
    wal_size_bytes: NonnegativeIntegerSchema,
    shm_size_bytes: NonnegativeIntegerSchema,
    total_size_bytes: NonnegativeIntegerSchema,
  })
  .refine((value) => value.total_size_bytes === value.db_size_bytes + value.wal_size_bytes + value.shm_size_bytes, {
    path: ["total_size_bytes"],
  });

export type DatabaseInfoDto = z.output<typeof DatabaseInfoDtoSchema>;
