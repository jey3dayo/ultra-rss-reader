import { z } from "zod";

const nonBlankStringSchema = z.string().refine((value) => value.trim().length > 0);

export const FolderDtoSchema = z.object({
  id: nonBlankStringSchema,
  account_id: nonBlankStringSchema,
  name: nonBlankStringSchema,
  sort_order: z.number().int().nonnegative(),
});

export const FolderDtoListSchema = z.array(FolderDtoSchema);

export type FolderDto = z.output<typeof FolderDtoSchema>;
