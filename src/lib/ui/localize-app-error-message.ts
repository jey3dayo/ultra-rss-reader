import i18n from "@/lib/i18n";
import {
  ARTICLE_URL_CREDENTIALS_MESSAGE,
  INVALID_CLIPBOARD_TEXT_MESSAGE,
  RESPONSE_VALIDATION_MESSAGE,
  UNSUPPORTED_HTTP_URL_MESSAGE,
} from "@/lib/ui-errors";

// Backend still returns this English UserVisible message; map it to locale copy for display.
const DATABASE_MAINTENANCE_BUSY_MESSAGE =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";
const API_HTML_AUTH_ERROR_MESSAGE =
  "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings.";

// The English text stays the internal contract because error classification matches on it.
const LOCALIZED_MESSAGE_BY_ENGLISH: ReadonlyMap<string, () => string> = new Map([
  [DATABASE_MAINTENANCE_BUSY_MESSAGE, () => i18n.t("errors.database_maintenance_busy")],
  [API_HTML_AUTH_ERROR_MESSAGE, () => i18n.t("errors.api_html_auth")],
  [UNSUPPORTED_HTTP_URL_MESSAGE, () => i18n.t("errors.unsupported_http_url")],
  [ARTICLE_URL_CREDENTIALS_MESSAGE, () => i18n.t("errors.article_url_credentials")],
  [INVALID_CLIPBOARD_TEXT_MESSAGE, () => i18n.t("errors.invalid_clipboard_text")],
  [RESPONSE_VALIDATION_MESSAGE, () => i18n.t("errors.response_validation")],
]);

export function localizeUserVisibleAppErrorMessage(message: string): string {
  return LOCALIZED_MESSAGE_BY_ENGLISH.get(message)?.() ?? message;
}

export function isLocalizableUserVisibleAppErrorMessage(message: string): boolean {
  return LOCALIZED_MESSAGE_BY_ENGLISH.has(message);
}
