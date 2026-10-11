import i18n from "@/lib/i18n";

// Backend still returns this English UserVisible message; map it to locale copy for display.
const DATABASE_MAINTENANCE_BUSY_MESSAGE =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";
const API_HTML_AUTH_ERROR_MESSAGE =
  "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings.";

export function localizeUserVisibleAppErrorMessage(message: string): string {
  if (message === DATABASE_MAINTENANCE_BUSY_MESSAGE) {
    return i18n.t("errors.database_maintenance_busy");
  }

  if (message === API_HTML_AUTH_ERROR_MESSAGE) {
    return i18n.t("errors.api_html_auth");
  }

  return message;
}

export function isLocalizableUserVisibleAppErrorMessage(message: string): boolean {
  return message === DATABASE_MAINTENANCE_BUSY_MESSAGE || message === API_HTML_AUTH_ERROR_MESSAGE;
}
