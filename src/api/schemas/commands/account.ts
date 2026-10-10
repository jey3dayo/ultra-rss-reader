import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { unwrapObjectSchema, unwrapStrictObjectSchema } from "@/api/schemas/validation";
import {
  accountNameSchema,
  nonBlankTrimmedIdSchema,
  optionalBlankStringToUndefinedSchema,
  optionalNonBlankTrimmedStringSchema,
} from "./shared";

const nonBlankSecretSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0),
);
export const cloudflareAccessUpdateSchema = v.union([
  s.strictObject({ action: v.literal("keep") }),
  s.strictObject({
    action: v.literal("replace"),
    clientId: v.pipe(v.string(), v.trim(), v.minLength(1)),
    clientSecret: nonBlankSecretSchema,
  }),
  s.strictObject({ action: v.literal("remove") }),
]);

export type CloudflareAccessUpdate = v.InferOutput<typeof cloudflareAccessUpdateSchema>;

export const getAccountCloudflareAccessArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const CloudflareAccessMetadataSchema = v.variant("status", [
  unwrapStrictObjectSchema(s.strictObject({ status: v.literal("loaded"), client_id: v.nullable(v.string()) })),
  unwrapStrictObjectSchema(s.strictObject({ status: v.literal("authorization_required") })),
]);

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

const localAddAccountArgs = s.object({
  kind: v.literal("Local"),
  name: accountNameSchema,
  serverUrl: optionalBlankStringToUndefinedSchema,
  appId: optionalBlankStringToUndefinedSchema,
  appKey: optionalBlankStringToUndefinedSchema,
  username: optionalBlankStringToUndefinedSchema,
  password: optionalBlankStringToUndefinedSchema,
  cloudflareAccess: v.optional(cloudflareAccessUpdateSchema),
});
const freshRssAddAccountArgs = s.object({
  kind: v.literal("FreshRss"),
  name: accountNameSchema,
  serverUrl: v.pipe(v.string(), v.trim(), v.minLength(1)),
  appId: v.optional(v.string()),
  appKey: v.optional(v.string()),
  username: v.pipe(v.string(), v.trim(), v.minLength(1)),
  password: v.pipe(v.string(), v.trim(), v.minLength(1)),
  cloudflareAccess: v.optional(cloudflareAccessUpdateSchema),
});
export const addAccountArgs = v.pipe(
  v.variant("kind", [unwrapObjectSchema(localAddAccountArgs), unwrapObjectSchema(freshRssAddAccountArgs)]),
  v.check(
    (input) =>
      input.cloudflareAccess?.action !== "replace" || (input.kind === "FreshRss" && isHttpsUrl(input.serverUrl)),
    "Cloudflare Access replacement requires a FreshRSS account with an HTTPS server URL",
  ),
);

const syncIntervalSecsSchema = v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(86_400));
const keepReadItemsDaysSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3650));

export const updateAccountSyncArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  syncIntervalSecs: syncIntervalSecsSchema,
  syncOnStartup: v.boolean(),
  syncOnWake: v.boolean(),
  keepReadItemsDays: keepReadItemsDaysSchema,
});

export const updateAccountCredentialsArgs = v.pipe(
  s.object({
    accountId: nonBlankTrimmedIdSchema,
    serverUrl: optionalNonBlankTrimmedStringSchema,
    username: optionalNonBlankTrimmedStringSchema,
    password: v.optional(v.string()),
    cloudflareAccess: v.optional(cloudflareAccessUpdateSchema),
  }),
  v.check(
    (input) =>
      input.cloudflareAccess?.action !== "replace" || (input.serverUrl !== undefined && isHttpsUrl(input.serverUrl)),
    "Cloudflare Access replacement requires an HTTPS server URL",
  ),
);

export const renameAccountArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  name: accountNameSchema,
});

export const syncAccountArgs = s.object({ accountId: nonBlankTrimmedIdSchema, background: v.optional(v.boolean()) });
export const getAccountSyncStatusArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const startupSyncArgs = s.object({
  preferredAccountId: optionalBlankStringToUndefinedSchema,
});
export const testAccountConnectionArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
export const deleteAccountArgs = s.object({ accountId: nonBlankTrimmedIdSchema });
