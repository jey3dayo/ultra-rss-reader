import { z } from "zod";

const STABLE_SEMVER_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const UpdateInfoDtoSchema = z.strictObject({
  version: z.string().trim().regex(STABLE_SEMVER_VERSION_PATTERN),
  body: z.string().nullable(),
  channel: z.literal("stable"),
  prerelease: z.literal(false),
  source: z.string().trim().min(1),
});

export const UpdateDownloadProgressEventPayloadSchema = z.looseObject({
  session_id: z.number().int().positive(),
  percent: z.number().finite().nullable(),
});

export const UpdateReadyEventPayloadSchema = z.looseObject({
  session_id: z.number().int().positive(),
});

export type UpdateInfoDto = z.output<typeof UpdateInfoDtoSchema>;
