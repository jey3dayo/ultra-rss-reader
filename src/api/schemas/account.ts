import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

const AccountConnectionVerificationStatusSchema = z.enum(["verified", "unverified", "error"]);
const accountSyncIntervalSecsSchema = z.number().int().finite().min(60).max(86_400);
const accountKeepReadItemsDaysSchema = z.number().int().finite().min(1).max(3650);
const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const optionalBlankStringToUndefinedSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const AccountProviderCapabilitiesSchema = z
  .object({
    supports_folders: z.boolean(),
    supports_starring: z.boolean(),
    supports_search: z.boolean(),
    supports_delta_sync: z.boolean(),
    supports_remote_state: z.boolean(),
  })
  .strict();

export const AccountDtoSchema = z
  .object({
    id: nonBlankTrimmedStringSchema,
    kind: nonBlankTrimmedStringSchema,
    name: nonBlankTrimmedStringSchema,
    display_name: optionalBlankStringToUndefinedSchema,
    icon_url: z.string().nullable().optional(),
    capabilities: AccountProviderCapabilitiesSchema.optional(),
    server_url: z.string().nullable(),
    username: z.string().nullable(),
    sync_interval_secs: accountSyncIntervalSecsSchema,
    sync_on_startup: z.boolean(),
    sync_on_wake: z.boolean(),
    keep_read_items_days: accountKeepReadItemsDaysSchema,
    connection_verification_status: AccountConnectionVerificationStatusSchema.optional(),
    connection_verified_at: IsoDateTimeStringSchema.nullable().optional(),
    connection_verification_error: z.string().nullable().optional(),
  })
  .strict();

export const AccountDtoListSchema = z.array(AccountDtoSchema);

export type AccountDto = z.output<typeof AccountDtoSchema>;
