import { z } from "zod";
import {
  accountNameSchema,
  nonBlankTrimmedIdSchema,
  optionalBlankStringToUndefinedSchema,
  optionalNonBlankTrimmedStringSchema,
} from "./shared";

const localAddAccountArgs = z.object({
  kind: z.literal("Local"),
  name: accountNameSchema,
  serverUrl: optionalBlankStringToUndefinedSchema,
  appId: optionalBlankStringToUndefinedSchema,
  appKey: optionalBlankStringToUndefinedSchema,
  username: optionalBlankStringToUndefinedSchema,
  password: optionalBlankStringToUndefinedSchema,
});
const freshRssAddAccountArgs = z.object({
  kind: z.literal("FreshRss"),
  name: accountNameSchema,
  serverUrl: z.string().trim().min(1),
  appId: z.string().optional(),
  appKey: z.string().optional(),
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});
export const addAccountArgs = z.discriminatedUnion("kind", [localAddAccountArgs, freshRssAddAccountArgs]);

const syncIntervalSecsSchema = z.number().int().min(60).max(86_400);
const keepReadItemsDaysSchema = z.number().int().min(1).max(3650);

export const updateAccountSyncArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  syncIntervalSecs: syncIntervalSecsSchema,
  syncOnStartup: z.boolean(),
  syncOnWake: z.boolean(),
  keepReadItemsDays: keepReadItemsDaysSchema,
});

export const updateAccountCredentialsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  serverUrl: optionalNonBlankTrimmedStringSchema,
  username: optionalNonBlankTrimmedStringSchema,
  password: z.string().optional(),
});

export const renameAccountArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  name: accountNameSchema,
});

export const syncAccountArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const getAccountSyncStatusArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const startupSyncArgs = z.object({
  preferredAccountId: optionalBlankStringToUndefinedSchema,
});
export const testAccountConnectionArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const deleteAccountArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
