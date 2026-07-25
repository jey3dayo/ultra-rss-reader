import i18n from "@/lib/i18n";

// Backend still returns this English UserVisible message; map it to locale copy for display.
const DATABASE_MAINTENANCE_BUSY_MESSAGE =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";

export function localizeUserVisibleAppErrorMessage(message: string): string {
  if (message === DATABASE_MAINTENANCE_BUSY_MESSAGE) {
    return i18n.t("errors.database_maintenance_busy");
  }

  return message;
}

export function isLocalizableUserVisibleAppErrorMessage(message: string): boolean {
  return message === DATABASE_MAINTENANCE_BUSY_MESSAGE;
}
