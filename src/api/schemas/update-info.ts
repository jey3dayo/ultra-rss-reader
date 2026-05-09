import { z } from "zod";

export const UpdateInfoDtoSchema = z
  .object({
    version: z.string().trim().min(1),
    body: z.string().nullable(),
    channel: z.literal("stable"),
    prerelease: z.literal(false),
    source: z.string().trim().min(1),
  })
  .strict();

export const UpdateDownloadProgressEventPayloadSchema = z
  .object({
    session_id: z.number().int().positive(),
    percent: z.number().finite().nullable(),
  })
  .passthrough();

export const UpdateReadyEventPayloadSchema = z
  .object({
    session_id: z.number().int().positive(),
  })
  .passthrough();

export type UpdateInfoDto = z.output<typeof UpdateInfoDtoSchema>;
export type UpdateDownloadProgressEventPayload = z.output<typeof UpdateDownloadProgressEventPayloadSchema>;
export type UpdateReadyEventPayload = z.output<typeof UpdateReadyEventPayloadSchema>;
