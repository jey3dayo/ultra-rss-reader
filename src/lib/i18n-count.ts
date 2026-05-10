import type { i18n as I18nInstance } from "i18next";

const countFallbackLocale = "en";

export function resolveCountLocale(locale?: string, fallbackLocale = countFallbackLocale): string {
  if (locale === undefined) {
    return fallbackLocale;
  }

  try {
    const [supportedLocale] = Intl.NumberFormat.supportedLocalesOf(locale);
    return supportedLocale ?? fallbackLocale;
  } catch {
    return fallbackLocale;
  }
}

export function normalizeDisplayCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.trunc(count);
}

export function formatDisplayCount(value: unknown, locale?: string): string {
  return new Intl.NumberFormat(resolveCountLocale(locale), {
    maximumFractionDigits: 0,
  }).format(normalizeDisplayCount(value));
}

export function formatI18nInterpolation(value: unknown, format?: string, locale?: string): unknown {
  return format === "count" ? formatDisplayCount(value, locale) : value;
}

export function registerCountFormatter(i18n: I18nInstance): void {
  i18n.services.formatter?.add("count", (value, locale) => formatDisplayCount(value, locale));
}
