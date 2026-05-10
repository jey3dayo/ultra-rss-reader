import { z } from "zod";

const STABLE_SEMVER_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const UpdateInfoDtoSchema = z
  .object({
    version: z.string().trim().regex(STABLE_SEMVER_VERSION_PATTERN),
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
