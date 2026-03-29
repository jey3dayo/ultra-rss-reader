import { z } from "zod";

export const UpdateInfoDtoSchema = z.object({
  version: z.string(),
  body: z.string().nullable(),
});

export type UpdateInfoDto = z.infer<typeof UpdateInfoDtoSchema>;
