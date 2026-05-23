import { Result } from "@praha/byethrow";

export type FreshRssServerUrlValidationError = "invalid_server_url" | "server_url_credentials";

function parseHttpServerUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isValidRequiredHttpServerUrl(value: string): boolean {
  return parseHttpServerUrl(value) !== null;
}

export function isValidOptionalHttpServerUrl(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0 || isValidRequiredHttpServerUrl(value);
}

export function validateFreshRssServerUrl(value: string): Result.Result<string, FreshRssServerUrlValidationError> {
  const url = parseHttpServerUrl(value);
  if (url === null) {
    return Result.fail("invalid_server_url");
  }

  if (url.username || url.password) {
    return Result.fail("server_url_credentials");
  }

  return Result.succeed(value.trim().replace(/\/+$/, ""));
}
