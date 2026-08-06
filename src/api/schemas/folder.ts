import * as v from "valibot";
import * as s from "@/api/schemas/validation";

const nonBlankStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
);
const folderSortOrderSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.finite());

export const FolderDtoSchema = s.strictObject({
  id: nonBlankStringSchema,
  account_id: nonBlankStringSchema,
  name: nonBlankStringSchema,
  sort_order: folderSortOrderSchema,
});

export const FolderDtoListSchema = v.array(FolderDtoSchema);

export type FolderDto = v.InferOutput<typeof FolderDtoSchema>;
