import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { nonBlankTrimmedIdSchema, nonBlankTrimmedStringSchema } from "./shared";

export const getLocalAccountSyncSettingsArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const setLocalAccountSyncSettingsArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  syncFolderPath: nonBlankTrimmedStringSchema,
  enabled: v.boolean(),
});

export const exportLocalAccountSyncOperationsArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const importLocalAccountSyncOperationsArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
});
