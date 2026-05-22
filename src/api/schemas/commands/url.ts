import { z } from "zod";
import { isPrivateIpv4Host } from "@/lib/runtime/host-privacy";
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

function isPrivateIpv6Host(host: string): boolean {
  const normalized = host.replace(/^\[/u, "").replace(/\]$/u, "").split("%", 1)[0]?.toLowerCase() ?? "";
  if (!normalized.includes(":")) {
    return false;
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:7f") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:a") ||
    normalized.startsWith("::ffff:169.254.") ||
    normalized.startsWith("::ffff:a9fe:") ||
    /^::ffff:ac1[0-9a-f]:/u.test(normalized) ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:c0a8:")
  );
}

export function hasPrivateHttpHost(value: string): boolean {
  const url = parseHttpUrl(value);
  if (url == null) {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.+$/u, "");
  return host === "localhost" || isPrivateIpv4Host(host) || isPrivateIpv6Host(host);
}

export const httpCommandUrlSchema = z
  .string()
  .trim()
  .refine((url) => url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://"), {
    message: "Only http:// and https:// URLs are supported",
  })
  .refine(isValidHttpUrl, {
    message: "Only http:// and https:// URLs are supported",
  })
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "HTTP URLs must not contain newlines",
  })
  .refine((url) => !hasPrivateHttpHost(url), {
    message: "Requests to private/loopback addresses are not allowed",
  });

export const safariReadingListUrlSchema = httpCommandUrlSchema
  .refine((url) => textEncoder.encode(url).length <= READING_LIST_URL_MAX_BYTES, {
    message: `Reading List URL must be ${READING_LIST_URL_MAX_BYTES} UTF-8 bytes or less`,
  })
  .refine((url) => !controlCharPattern.test(url), {
    message: "Reading List URL must not contain control characters",
  })
  .refine((url) => !whitespacePattern.test(url), {
    message: "Reading List URL must not contain whitespace",
  })
  .refine((url) => !hasHttpUrlCredentials(url), {
    message: "Reading List URL must not contain credentials",
  });

export const readingListUrlSchema = httpCommandUrlSchema;

export function normalizeHttpCommandUrl(value: string): string | null {
  const result = httpCommandUrlSchema.safeParse(value);

  return result.success ? result.data : null;
}
