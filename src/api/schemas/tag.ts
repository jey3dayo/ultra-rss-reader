import { z } from "zod";

export const TagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export type TagDto = z.infer<typeof TagDtoSchema>;
