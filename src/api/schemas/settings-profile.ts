import { z } from "zod";
import { PreferencesDtoSchema } from "./preferences";

const accountKindSchema = z.enum(["Local", "FreshRss"]);
const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const optionalStringSchema = z.string().nullable();
const syncIntervalSecsSchema = z.number().int().finite().min(60).max(86_400);
const keepReadItemsDaysSchema = z.number().int().finite().min(0).max(3650);
const tagColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())
  .nullable();
const muteKeywordScopeSchema = z.enum(["title", "body", "title_and_body"]);

export const SettingsProfileAccountSchema = z.strictObject({
  source_id: nonBlankTrimmedStringSchema,
  kind: accountKindSchema,
  name: nonBlankTrimmedStringSchema,
  server_url: optionalStringSchema,
  username: optionalStringSchema,
  sync_interval_secs: syncIntervalSecsSchema,
  sync_on_startup: z.boolean(),
  sync_on_wake: z.boolean(),
  keep_read_items_days: keepReadItemsDaysSchema,
});

export const SettingsProfileTagSchema = z.strictObject({
  name: nonBlankTrimmedStringSchema,
  color: tagColorSchema,
});

export const SettingsProfileMuteKeywordSchema = z.strictObject({
  keyword: nonBlankTrimmedStringSchema,
  scope: muteKeywordScopeSchema,
});

export const SettingsProfileSchema = z.strictObject({
  version: z.literal(1),
  exported_at: nonBlankTrimmedStringSchema,
  content_type: z.literal("application/vnd.ultra-rss-reader.settings-profile+json"),
  preferences: PreferencesDtoSchema,
  accounts: z.array(SettingsProfileAccountSchema),
  tags: z.array(SettingsProfileTagSchema),
  mute_keywords: z.array(SettingsProfileMuteKeywordSchema),
});

const nonnegativeCountSchema = z.number().int().finite().nonnegative();

export const SettingsProfileImportResultSchema = z.strictObject({
  accounts_created: nonnegativeCountSchema,
  accounts_updated: nonnegativeCountSchema,
  preferences_imported: nonnegativeCountSchema,
  preferences_skipped: nonnegativeCountSchema,
  tags_created: nonnegativeCountSchema,
  tags_updated: nonnegativeCountSchema,
  mute_keywords_created: nonnegativeCountSchema,
  mute_keywords_skipped: nonnegativeCountSchema,
});

export type SettingsProfile = z.output<typeof SettingsProfileSchema>;
export type SettingsProfileImportResult = z.output<typeof SettingsProfileImportResultSchema>;
