import { z } from "zod";
import { nonBlankTrimmedIdSchema, nonBlankTrimmedStringSchema } from "./shared";

export const getLocalAccountSyncSettingsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const setLocalAccountSyncSettingsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  syncFolderPath: nonBlankTrimmedStringSchema,
  enabled: z.boolean(),
});

export const exportLocalAccountSyncOperationsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

export const importLocalAccountSyncOperationsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});
