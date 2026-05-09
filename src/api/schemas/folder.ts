import { z } from "zod";

const nonBlankStringSchema = z.string().refine((value) => value.trim().length > 0);
const folderSortOrderSchema = z.number().int().nonnegative().finite();

export const FolderDtoSchema = z
  .object({
    id: nonBlankStringSchema,
    account_id: nonBlankStringSchema,
    name: nonBlankStringSchema,
    sort_order: folderSortOrderSchema,
  })
  .strict();

export const FolderDtoListSchema = z.array(FolderDtoSchema);

export type FolderDto = z.output<typeof FolderDtoSchema>;
