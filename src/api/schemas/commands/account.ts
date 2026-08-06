import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { unwrapObjectSchema } from "@/api/schemas/validation";
import {
  accountNameSchema,
  nonBlankTrimmedIdSchema,
  optionalBlankStringToUndefinedSchema,
  optionalNonBlankTrimmedStringSchema,
} from "./shared";

const localAddAccountArgs = s.object({
  kind: v.literal("Local"),
  name: accountNameSchema,
  serverUrl: optionalBlankStringToUndefinedSchema,
  appId: optionalBlankStringToUndefinedSchema,
  appKey: optionalBlankStringToUndefinedSchema,
  username: optionalBlankStringToUndefinedSchema,
  password: optionalBlankStringToUndefinedSchema,
});
const freshRssAddAccountArgs = s.object({
  kind: v.literal("FreshRss"),
  name: accountNameSchema,
  serverUrl: v.pipe(v.string(), v.trim(), v.minLength(1)),
  appId: v.optional(v.string()),
  appKey: v.optional(v.string()),
  username: v.pipe(v.string(), v.trim(), v.minLength(1)),
  password: v.pipe(v.string(), v.trim(), v.minLength(1)),
});
export const addAccountArgs = v.variant("kind", [
  unwrapObjectSchema(localAddAccountArgs),
  unwrapObjectSchema(freshRssAddAccountArgs),
]);

const syncIntervalSecsSchema = v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(86_400));
const keepReadItemsDaysSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3650));

export const updateAccountSyncArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  syncIntervalSecs: syncIntervalSecsSchema,
  syncOnStartup: v.boolean(),
  syncOnWake: v.boolean(),
  keepReadItemsDays: keepReadItemsDaysSchema,
});

export const updateAccountCredentialsArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  serverUrl: optionalNonBlankTrimmedStringSchema,
  username: optionalNonBlankTrimmedStringSchema,
  password: v.optional(v.string()),
});

export const renameAccountArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  name: accountNameSchema,
});

export const syncAccountArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const getAccountSyncStatusArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const startupSyncArgs = s.object({
  preferredAccountId: optionalBlankStringToUndefinedSchema,
});
export const testAccountConnectionArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const deleteAccountArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
