import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { isKnownPreferenceKey, isShortcutPreferenceKey, isValidPreferenceValue } from "@/schemas/preference-values";
import {
  controlCharPattern,
  countGraphemes,
  nonBlankTrimmedIdSchema,
  OPML_IMPORT_CONTENT_MAX_BYTES,
  PREFERENCE_VALUE_MAX_BYTES,
  SHARE_COMMAND_TEXT_MAX_BYTES,
  SHARE_COMMAND_TEXT_MAX_CHARS,
  textEncoder,
  whitespacePattern,
} from "./shared";
import {
  hasEncodedNewline,
  hasHttpUrlCredentials,
  hasPrivateHttpHost,
  isValidSupportedExternalUrl,
  readingListUrlSchema,
  safariReadingListUrlSchema,
} from "./url";

const externalUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (url) =>
      url.toLowerCase().startsWith("http://") ||
      url.toLowerCase().startsWith("https://") ||
      url.toLowerCase().startsWith("mailto:"),
    "Only http://, https://, and mailto: URLs are supported",
  ),
  v.check(isValidSupportedExternalUrl, "Only http://, https://, and mailto: URLs are supported"),
  v.check((url) => !url.includes("\n") && !url.includes("\r"), "External URLs must not contain newlines"),
  v.check((url) => !hasEncodedNewline(url), "External URLs must not contain encoded newlines"),
  v.check((url) => !controlCharPattern.test(url), "External URLs must not contain control characters"),
  v.check((url) => !whitespacePattern.test(url), "External URLs must not contain whitespace"),
  v.check((url) => !hasHttpUrlCredentials(url), "External URLs must not contain credentials"),
  v.check((url) => !hasPrivateHttpHost(url), "External URLs must not target private/loopback addresses"),
);
export const openExternalUrlArgs = s.object({ url: externalUrlSchema });

export const exportOpmlToFileArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  path: v.pipe(v.string(), v.trim(), v.minLength(1)),
});
export const importOpmlArgs = s.object({
  accountId: nonBlankTrimmedIdSchema,
  opmlContent: v.pipe(
    v.string(),
    v.check(
      (value) => textEncoder.encode(value).length <= OPML_IMPORT_CONTENT_MAX_BYTES,
      `OPML import file must be ${OPML_IMPORT_CONTENT_MAX_BYTES} UTF-8 bytes or less`,
    ),
  ),
});

export const setPreferenceArgs = v.pipe(
  s.object({
    key: v.string(),
    value: v.pipe(
      v.string(),
      v.check(
        (value) => textEncoder.encode(value).length <= PREFERENCE_VALUE_MAX_BYTES,
        `Preference value must be ${PREFERENCE_VALUE_MAX_BYTES} UTF-8 bytes or less`,
      ),
    ),
  }),
  v.forward(
    v.check(
      ({ key }) => !(!isKnownPreferenceKey(key) && key.startsWith("shortcut_") && !isShortcutPreferenceKey(key)),
      (issue) => {
        const key =
          typeof issue.input === "object" &&
          issue.input !== null &&
          "key" in issue.input &&
          typeof issue.input.key === "string"
            ? issue.input.key
            : undefined;
        return key === undefined ? "Invalid preference key" : `Invalid preference key: ${key}`;
      },
    ),
    ["key"],
  ),
  v.forward(
    v.check(
      ({ key, value }) => isValidPreferenceValue(key, value),
      (issue) => {
        const key =
          typeof issue.input === "object" &&
          issue.input !== null &&
          "key" in issue.input &&
          typeof issue.input.key === "string"
            ? issue.input.key
            : undefined;
        return key === undefined ? "Invalid preference value" : `Invalid value for preference key: ${key}`;
      },
    ),
    ["value"],
  ),
);

export const copyToClipboardArgs = s.object({
  text: v.pipe(
    v.string(),
    v.check((value) => value.trim().length > 0, "Clipboard text must not be blank"),
    v.check((value) => !controlCharPattern.test(value), "Clipboard text must not contain control characters"),
    v.check(
      (value) => countGraphemes(value) <= SHARE_COMMAND_TEXT_MAX_CHARS,
      `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_CHARS} graphemes or less`,
    ),
    v.check(
      (value) => textEncoder.encode(value).length <= SHARE_COMMAND_TEXT_MAX_BYTES,
      `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_BYTES} UTF-8 bytes or less`,
    ),
  ),
});

export const openInBrowserArgs = s.object({
  url: readingListUrlSchema,
  background: v.optional(v.boolean()),
});

export const addToReadingListArgs = s.object({
  url: safariReadingListUrlSchema,
});
