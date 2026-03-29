import { z } from "zod";

export const FolderDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  name: z.string(),
  sort_order: z.number(),
});

export type FolderDto = z.infer<typeof FolderDtoSchema>;
