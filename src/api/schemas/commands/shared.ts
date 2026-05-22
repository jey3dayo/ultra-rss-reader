import { z } from "zod";

const articleListModeSchema = z.enum(["all", "unread", "starred"]);
export type ArticleListMode = z.output<typeof articleListModeSchema>;
export const MAX_IPC_PAGINATION_LIMIT = 200;
export const MAX_IPC_PAGINATION_OFFSET = 10_000;
export const ACCOUNT_NAME_MAX_CHARS = 100;
export const FEED_TITLE_MAX_CHARS = 200;
export const FOLDER_NAME_MAX_CHARS = 100;
export const TAG_NAME_MAX_CHARS = 50;
export const SHARE_COMMAND_TEXT_MAX_CHARS = 2048;
export const SHARE_COMMAND_TEXT_MAX_BYTES = SHARE_COMMAND_TEXT_MAX_CHARS * 4;
export const READING_LIST_URL_MAX_BYTES = 16 * 1024;
export const PREFERENCE_VALUE_MAX_BYTES = 1024;
export const OPML_IMPORT_CONTENT_MAX_BYTES = 4 * 1024 * 1024;
export const BROWSER_WEBVIEW_BOUNDS_MAX_VALUE = 10_000;
export const TAG_COLOR_VALIDATION_MESSAGE = "Color must be a valid hex color (e.g. #ff0000)";
export const paginationOffsetSchema = z.number().int().nonnegative().max(MAX_IPC_PAGINATION_OFFSET);
export const paginationLimitSchema = z.number().int().positive().max(MAX_IPC_PAGINATION_LIMIT);
export const textEncoder = new TextEncoder();
export const nonBlankTrimmedStringSchema = z.string().trim().min(1);
export const nonBlankTrimmedIdSchema = z.string().trim().min(1, { message: "Command id must not be blank" });
export const accountNameSchema = nonBlankTrimmedStringSchema.max(ACCOUNT_NAME_MAX_CHARS, {
  message: `Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`,
});
export const feedTitleSchema = nonBlankTrimmedStringSchema.max(FEED_TITLE_MAX_CHARS, {
  message: `Feed title must be ${FEED_TITLE_MAX_CHARS} characters or less`,
});
export const folderNameSchema = nonBlankTrimmedStringSchema.max(FOLDER_NAME_MAX_CHARS, {
  message: `Folder name must be ${FOLDER_NAME_MAX_CHARS} characters or less`,
});
export const tagNameSchema = nonBlankTrimmedStringSchema.max(TAG_NAME_MAX_CHARS, {
  message: `Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`,
});
export const tagColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, TAG_COLOR_VALIDATION_MESSAGE)
  .transform((value) => value.toLowerCase());
export const optionalTagColorSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, tagColorSchema.optional());
export const nullableTagColorSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, tagColorSchema.nullish());
export const optionalNonBlankTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1).optional(),
);
export const optionalBlankStringToUndefinedSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());
export const nullableBlankStringToNullSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().nullable());
// biome-ignore lint/suspicious/noControlCharactersInRegex: IPC text fields must reject ASCII control characters.
export const controlCharPattern = /[\u0000-\u001f\u007f]/u;
export const whitespacePattern = /\s/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export function countGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export const oldUnreadScopeKindSchema = z.enum(["account", "feed", "folder"]);
export const oldUnreadDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export type OldUnreadScopeKind = z.infer<typeof oldUnreadScopeKindSchema>;
export type OldUnreadDays = z.infer<typeof oldUnreadDaysSchema>;

export { articleListModeSchema };
