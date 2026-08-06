import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { NonnegativeIntegerSchema } from "./common";

export const DatabaseInfoDtoSchema = v.pipe(
  s.strictObject({
    db_size_bytes: NonnegativeIntegerSchema,
    wal_size_bytes: NonnegativeIntegerSchema,
    shm_size_bytes: NonnegativeIntegerSchema,
    total_size_bytes: NonnegativeIntegerSchema,
  }),
  v.forward(
    v.check((value) => value.total_size_bytes === value.db_size_bytes + value.wal_size_bytes + value.shm_size_bytes),
    ["total_size_bytes"],
  ),
);

export type DatabaseInfoDto = v.InferOutput<typeof DatabaseInfoDtoSchema>;
