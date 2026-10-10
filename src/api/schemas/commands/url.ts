import * as v from "valibot";
import { type HostPrivacyPolicy, isHostBlockedByPolicy } from "@/lib/runtime/host-privacy";
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
    "Only http:// and https:// URLs are supported",
  ),
  v.check(isValidHttpUrl, "Only http:// and https:// URLs are supported"),
  v.check((url) => !url.includes("\n") && !url.includes("\r"), "HTTP URLs must not contain newlines"),
);

export const webPreviewUrlSchema = v.pipe(
  httpUrlSchema,
  v.check((url) => !hasHttpUrlCredentials(url), "Web Preview URLs must not contain credentials"),
);

export const userNavigationUrlSchema = v.pipe(
  httpUrlSchema,
  v.check(
    (url) => !hasBlockedHttpHost(url, "userNavigation"),
    "Requests to private/loopback addresses are not allowed",
  ),
);

export const automaticRequestUrlSchema = v.pipe(
  httpUrlSchema,
  v.check(
    (url) => !hasBlockedHttpHost(url, "automaticRequest"),
    "Requests to private/loopback addresses are not allowed",
  ),
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
