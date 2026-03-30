import { z } from "zod";

export const DatabaseInfoDtoSchema = z.object({
  db_size_bytes: z.number(),
  wal_size_bytes: z.number(),
  total_size_bytes: z.number(),
});

export type DatabaseInfoDto = z.infer<typeof DatabaseInfoDtoSchema>;
