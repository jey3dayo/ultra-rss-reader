import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

const AccountConnectionVerificationStatusSchema = v.picklist(["verified", "unverified", "error", "quarantined"]);
const accountSyncIntervalSecsSchema = v.pipe(v.number(), v.integer(), v.finite(), v.minValue(60), v.maxValue(86_400));
const accountKeepReadItemsDaysSchema = v.pipe(v.number(), v.integer(), v.finite(), v.minValue(0), v.maxValue(3650));
const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const optionalBlankStringToUndefinedSchema = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }),
    v.optional(v.string()),
  ),
);

const AccountProviderCapabilitiesSchema = s.strictObject({
  supports_folders: v.boolean(),
  supports_starring: v.boolean(),
  supports_search: v.boolean(),
  supports_delta_sync: v.boolean(),
  supports_remote_state: v.boolean(),
});

export const AccountDtoSchema = s.strictObject({
  id: nonBlankTrimmedStringSchema,
  kind: nonBlankTrimmedStringSchema,
  name: nonBlankTrimmedStringSchema,
  display_name: optionalBlankStringToUndefinedSchema,
  icon_url: v.optional(v.nullable(v.string())),
  capabilities: v.optional(AccountProviderCapabilitiesSchema),
  server_url: v.nullable(v.string()),
  username: v.nullable(v.string()),
  sync_interval_secs: accountSyncIntervalSecsSchema,
  sync_on_startup: v.boolean(),
  sync_on_wake: v.boolean(),
  keep_read_items_days: accountKeepReadItemsDaysSchema,
  connection_verification_status: v.optional(AccountConnectionVerificationStatusSchema),
  connection_verified_at: v.optional(v.nullable(IsoDateTimeStringSchema)),
  connection_verification_error: v.optional(v.nullable(v.string())),
});

export const AccountDtoListSchema = v.array(AccountDtoSchema);

export type AccountDto = v.InferOutput<typeof AccountDtoSchema>;
