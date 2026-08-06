import * as v from "valibot";
import * as s from "@/api/schemas/validation";

const STABLE_SEMVER_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const UpdateInfoDtoSchema = s.strictObject({
  version: v.pipe(v.string(), v.trim(), v.regex(STABLE_SEMVER_VERSION_PATTERN)),
  body: v.nullable(v.string()),
  channel: v.literal("stable"),
  prerelease: v.literal(false),
  source: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

export const UpdateDownloadProgressEventPayloadSchema = s.looseObject({
  session_id: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  percent: v.nullable(v.pipe(v.number(), v.finite())),
});

export const UpdateReadyEventPayloadSchema = s.looseObject({
  session_id: v.pipe(v.number(), v.integer(), v.gtValue(0)),
});

export type UpdateInfoDto = v.InferOutput<typeof UpdateInfoDtoSchema>;
