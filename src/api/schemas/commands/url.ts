import * as v from "valibot";
import { type HostPrivacyPolicy, isHostBlockedByPolicy } from "@/lib/runtime/host-privacy";
import {
  EMBEDDED_CREDENTIALS_URL_MESSAGE,
  PRIVATE_OR_LOOPBACK_URL_MESSAGE,
  UNSUPPORTED_HTTP_URL_MESSAGE,
} from "@/lib/ui-errors";
import { controlCharPattern, READING_LIST_URL_MAX_BYTES, textEncoder, whitespacePattern } from "./shared";

export function hasHttpUrlCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username.length > 0 || url.password.length > 0;
  } catch {
    return false;
  }
}

export function hasEncodedNewline(value: string): boolean {
  return /%(?:0a|0d)/iu.test(value);
}

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isValidHttpUrl(value: string): boolean {
  return parseHttpUrl(value) != null;
}

export function isValidSupportedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function hasBlockedHttpHost(value: string, policy: HostPrivacyPolicy): boolean {
  const url = parseHttpUrl(value);
  return url != null && isHostBlockedByPolicy(url.hostname, policy);
}

const httpUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (url) => url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://"),
    UNSUPPORTED_HTTP_URL_MESSAGE,
  ),
  v.check(isValidHttpUrl, UNSUPPORTED_HTTP_URL_MESSAGE),
  v.check((url) => !url.includes("\n") && !url.includes("\r"), "HTTP URLs must not contain newlines"),
);

export const webPreviewUrlSchema = v.pipe(
  httpUrlSchema,
  v.check((url) => !hasHttpUrlCredentials(url), "Web Preview URLs must not contain credentials"),
);

export function isValidWebPreviewUrl(value: string): boolean {
  return v.safeParse(webPreviewUrlSchema, value).success;
}

export const userNavigationUrlSchema = v.pipe(
  httpUrlSchema,
  v.check((url) => !hasBlockedHttpHost(url, "userNavigation"), PRIVATE_OR_LOOPBACK_URL_MESSAGE),
);

export const automaticRequestUrlSchema = v.pipe(
  httpUrlSchema,
  v.check((url) => !hasBlockedHttpHost(url, "automaticRequest"), PRIVATE_OR_LOOPBACK_URL_MESSAGE),
);

/**
 * Feed URLs the user types into the add-feed flow. Like user-provided server
 * URLs, private and loopback hosts are allowed because a self-hosted feed on
 * the local network is a supported target. Credentials stay rejected, and the
 * backend re-validates with the same policy before fetching.
 */
export const userProvidedFeedUrlSchema = v.pipe(
  httpUrlSchema,
  v.check((url) => !hasHttpUrlCredentials(url), EMBEDDED_CREDENTIALS_URL_MESSAGE),
);

export const safariReadingListUrlSchema = v.pipe(
  userNavigationUrlSchema,
  v.check(
    (url) => textEncoder.encode(url).length <= READING_LIST_URL_MAX_BYTES,
    `Reading List URL must be ${READING_LIST_URL_MAX_BYTES} UTF-8 bytes or less`,
  ),
  v.check((url) => !controlCharPattern.test(url), "Reading List URL must not contain control characters"),
  v.check((url) => !whitespacePattern.test(url), "Reading List URL must not contain whitespace"),
  v.check((url) => !hasHttpUrlCredentials(url), "Reading List URL must not contain credentials"),
);

export function normalizeHttpCommandUrl(value: string): string | null {
  const result = v.safeParse(userNavigationUrlSchema, value);

  return result.success ? result.output : null;
}
