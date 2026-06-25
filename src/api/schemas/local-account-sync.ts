import { z } from "zod";
import { CountResponseSchema } from "./common";

export const LocalAccountSyncSettingsDtoSchema = z.object({
  account_id: z.string().min(1),
  sync_folder_path: z.string().min(1),
  sync_account_id: z.string().min(1),
  device_id: z.string().min(1),
  enabled: z.boolean(),
});
export type LocalAccountSyncSettingsDto = z.output<typeof LocalAccountSyncSettingsDtoSchema>;

export const LocalAccountSyncImportReportDtoSchema = z.object({
  loaded_operations: CountResponseSchema,
  applied_operations: CountResponseSchema,
  rejected_operations: CountResponseSchema,
  rejected_files: CountResponseSchema,
  conflicted_candidates: CountResponseSchema,
  applied: z.boolean(),
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
export type LocalAccountSyncImportReportDto = z.output<typeof LocalAccountSyncImportReportDtoSchema>;

export const LocalAccountSyncExportReportDtoSchema = z.object({
  operations_written: CountResponseSchema,
});
export type LocalAccountSyncExportReportDto = z.output<typeof LocalAccountSyncExportReportDtoSchema>;
