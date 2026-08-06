import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { PreferencesDtoSchema } from "./preferences";

const accountKindSchema = v.picklist(["Local", "FreshRss"]);
const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const optionalStringSchema = v.nullable(v.string());
const syncIntervalSecsSchema = v.pipe(v.number(), v.integer(), v.finite(), v.minValue(60), v.maxValue(86_400));
const keepReadItemsDaysSchema = v.pipe(v.number(), v.integer(), v.finite(), v.minValue(0), v.maxValue(3650));
const tagColorSchema = v.nullable(
  v.pipe(
    v.string(),
    v.regex(/^#[0-9a-fA-F]{6}$/u),
    v.transform((value) => value.toLowerCase()),
  ),
);
const muteKeywordScopeSchema = v.picklist(["title", "body", "title_and_body"]);

export const SettingsProfileAccountSchema = s.strictObject({
  source_id: nonBlankTrimmedStringSchema,
  kind: accountKindSchema,
  name: nonBlankTrimmedStringSchema,
  server_url: optionalStringSchema,
  username: optionalStringSchema,
  sync_interval_secs: syncIntervalSecsSchema,
  sync_on_startup: v.boolean(),
  sync_on_wake: v.boolean(),
  keep_read_items_days: keepReadItemsDaysSchema,
});

export const SettingsProfileTagSchema = s.strictObject({
  name: nonBlankTrimmedStringSchema,
  color: tagColorSchema,
});

export const SettingsProfileMuteKeywordSchema = s.strictObject({
  keyword: nonBlankTrimmedStringSchema,
  scope: muteKeywordScopeSchema,
});

export const SettingsProfileSchema = s.strictObject({
  version: v.literal(1),
  exported_at: nonBlankTrimmedStringSchema,
  content_type: v.literal("application/vnd.ultra-rss-reader.settings-profile+json"),
  preferences: PreferencesDtoSchema,
  accounts: v.array(SettingsProfileAccountSchema),
  tags: v.array(SettingsProfileTagSchema),
  mute_keywords: v.array(SettingsProfileMuteKeywordSchema),
});

const nonnegativeCountSchema = v.pipe(v.number(), v.integer(), v.finite(), v.minValue(0));

export const SettingsProfileImportResultSchema = s.strictObject({
  accounts_created: nonnegativeCountSchema,
  accounts_updated: nonnegativeCountSchema,
  preferences_imported: nonnegativeCountSchema,
  preferences_skipped: nonnegativeCountSchema,
  tags_created: nonnegativeCountSchema,
  tags_updated: nonnegativeCountSchema,
  mute_keywords_created: nonnegativeCountSchema,
  mute_keywords_skipped: nonnegativeCountSchema,
});

export type SettingsProfile = v.InferOutput<typeof SettingsProfileSchema>;
export type SettingsProfileImportResult = v.InferOutput<typeof SettingsProfileImportResultSchema>;
