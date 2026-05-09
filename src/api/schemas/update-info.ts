import { z } from "zod";

export const UpdateInfoDtoSchema = z.object({
  version: z.string().trim().min(1),
  body: z.string().nullable(),
});

export type UpdateInfoDto = z.output<typeof UpdateInfoDtoSchema>;
