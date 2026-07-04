import { z } from "zod";
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

const externalUrlSchema = z
  .string()
  .trim()
  .refine(
    (url) =>
      url.toLowerCase().startsWith("http://") ||
      url.toLowerCase().startsWith("https://") ||
      url.toLowerCase().startsWith("mailto:"),
    {
      message: "Only http://, https://, and mailto: URLs are supported",
    },
  )
  .refine(isValidSupportedExternalUrl, {
    message: "Only http://, https://, and mailto: URLs are supported",
  })
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "External URLs must not contain newlines",
  })
  .refine((url) => !hasEncodedNewline(url), {
    message: "External URLs must not contain encoded newlines",
  })
  .refine((url) => !controlCharPattern.test(url), {
    message: "External URLs must not contain control characters",
  })
  .refine((url) => !whitespacePattern.test(url), {
    message: "External URLs must not contain whitespace",
  })
  .refine((url) => !hasHttpUrlCredentials(url), {
    message: "External URLs must not contain credentials",
  })
  .refine((url) => !hasPrivateHttpHost(url), {
    message: "External URLs must not target private/loopback addresses",
  });
export const openExternalUrlArgs = z.object({ url: externalUrlSchema });

export const exportOpmlToFileArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  path: z.string().trim().min(1),
});
export const importOpmlArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  opmlContent: z.string().refine((value) => textEncoder.encode(value).length <= OPML_IMPORT_CONTENT_MAX_BYTES, {
    message: `OPML import file must be ${OPML_IMPORT_CONTENT_MAX_BYTES} UTF-8 bytes or less`,
  }),
});

export const setPreferenceArgs = z
  .object({
    key: z.string(),
    value: z.string().refine((value) => textEncoder.encode(value).length <= PREFERENCE_VALUE_MAX_BYTES, {
      message: `Preference value must be ${PREFERENCE_VALUE_MAX_BYTES} UTF-8 bytes or less`,
    }),
  })
  .superRefine(({ key, value }, ctx) => {
    if (!isKnownPreferenceKey(key) && key.startsWith("shortcut_") && !isShortcutPreferenceKey(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        message: `Invalid preference key: ${key}`,
      });
      return;
    }

    if (!isValidPreferenceValue(key, value)) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Invalid value for preference key: ${key}`,
      });
    }
  });

export const copyToClipboardArgs = z.object({
  text: z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: "Clipboard text must not be blank",
    })
    .refine((value) => !controlCharPattern.test(value), {
      message: "Clipboard text must not contain control characters",
    })
    .refine((value) => countGraphemes(value) <= SHARE_COMMAND_TEXT_MAX_CHARS, {
      message: `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_CHARS} graphemes or less`,
    })
    .refine((value) => textEncoder.encode(value).length <= SHARE_COMMAND_TEXT_MAX_BYTES, {
      message: `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_BYTES} UTF-8 bytes or less`,
    }),
});

export const openInBrowserArgs = z.object({
  url: readingListUrlSchema,
  background: z.boolean().optional(),
});

export const addToReadingListArgs = z.object({
  url: safariReadingListUrlSchema,
});
