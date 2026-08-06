import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { CountResponseSchema } from "./common";

export const LocalAccountSyncSettingsDtoSchema = s.object({
  account_id: v.pipe(v.string(), v.minLength(1)),
  sync_folder_path: v.pipe(v.string(), v.minLength(1)),
  sync_account_id: v.pipe(v.string(), v.minLength(1)),
  device_id: v.pipe(v.string(), v.minLength(1)),
  enabled: v.boolean(),
});
export type LocalAccountSyncSettingsDto = v.InferOutput<typeof LocalAccountSyncSettingsDtoSchema>;

export const LocalAccountSyncImportReportDtoSchema = s.object({
  loaded_operations: CountResponseSchema,
  applied_operations: CountResponseSchema,
  rejected_operations: CountResponseSchema,
  rejected_files: CountResponseSchema,
  conflicted_candidates: CountResponseSchema,
  applied: v.boolean(),
  folders_upserted: CountResponseSchema,
  feeds_upserted: CountResponseSchema,
  article_states_applied: CountResponseSchema,
  tags_upserted: CountResponseSchema,
  article_tags_added: CountResponseSchema,
  article_tags_removed: CountResponseSchema,
  mute_keywords_upserted: CountResponseSchema,
  mute_keywords_removed: CountResponseSchema,
  unmatched_article_keys: CountResponseSchema,
  skipped_removed_tags: CountResponseSchema,
  conflict_count: CountResponseSchema,
});
export type LocalAccountSyncImportReportDto = v.InferOutput<typeof LocalAccountSyncImportReportDtoSchema>;

export const LocalAccountSyncExportReportDtoSchema = s.object({
  operations_written: CountResponseSchema,
});
export type LocalAccountSyncExportReportDto = v.InferOutput<typeof LocalAccountSyncExportReportDtoSchema>;
