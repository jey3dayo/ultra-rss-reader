import { z } from "zod";

export const UpdateInfoDtoSchema = z
  .object({
    version: z.string().trim().min(1),
    body: z.string().nullable(),
  })
  .strict();

export const UpdateDownloadProgressEventPayloadSchema = z
  .object({
    percent: z.number().finite().nullable(),
  })
  .passthrough();

export type UpdateInfoDto = z.output<typeof UpdateInfoDtoSchema>;
export type UpdateDownloadProgressEventPayload = z.output<typeof UpdateDownloadProgressEventPayloadSchema>;
