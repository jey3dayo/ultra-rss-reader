import * as v from "valibot";

const articleListModeSchema = v.picklist(["all", "unread", "starred"]);
export type ArticleListMode = v.InferOutput<typeof articleListModeSchema>;
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
export const paginationOffsetSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_IPC_PAGINATION_OFFSET),
);
export const paginationLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.gtValue(0),
  v.maxValue(MAX_IPC_PAGINATION_LIMIT),
);
export const textEncoder = new TextEncoder();
export const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
export const nonBlankTrimmedIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1, "Command id must not be blank"));
export const accountNameSchema = v.pipe(
  nonBlankTrimmedStringSchema,
  v.maxLength(ACCOUNT_NAME_MAX_CHARS, `Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`),
);
export const feedTitleSchema = v.pipe(
  nonBlankTrimmedStringSchema,
  v.maxLength(FEED_TITLE_MAX_CHARS, `Feed title must be ${FEED_TITLE_MAX_CHARS} characters or less`),
);
export const folderNameSchema = v.pipe(
  nonBlankTrimmedStringSchema,
  v.maxLength(FOLDER_NAME_MAX_CHARS, `Folder name must be ${FOLDER_NAME_MAX_CHARS} characters or less`),
);
export const tagNameSchema = v.pipe(
  nonBlankTrimmedStringSchema,
  v.maxLength(TAG_NAME_MAX_CHARS, `Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`),
);
export const tagColorSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^#[0-9a-fA-F]{6}$/u, TAG_COLOR_VALIDATION_MESSAGE),
  v.transform((value) => value.toLowerCase()),
);
export const optionalTagColorSchema = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }),
    v.optional(tagColorSchema),
  ),
);
export const nullableTagColorSchema = v.nullish(
  v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
    v.nullable(tagColorSchema),
  ),
);
export const optionalNonBlankTrimmedStringSchema = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((value) => (typeof value === "string" ? value.trim() : value)),
    v.pipe(v.string(), v.minLength(1)),
  ),
);
export const optionalBlankStringToUndefinedSchema = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }),
    v.optional(v.string()),
  ),
);
export const nullableBlankStringToNullSchema = v.nullable(
  v.pipe(
    v.unknown(),
    v.transform((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
    v.nullable(v.string()),
  ),
);
// biome-ignore lint/suspicious/noControlCharactersInRegex: IPC text fields must reject ASCII control characters.
export const controlCharPattern = /[\u0000-\u001f\u007f]/u;
export const whitespacePattern = /\s/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export function countGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export const oldUnreadScopeKindSchema = v.picklist(["account", "feed", "folder"]);
export const oldUnreadDaysSchema = v.union([v.literal(7), v.literal(30), v.literal(90)]);
export type OldUnreadScopeKind = v.InferOutput<typeof oldUnreadScopeKindSchema>;
export type OldUnreadDays = v.InferOutput<typeof oldUnreadDaysSchema>;

export { articleListModeSchema };
