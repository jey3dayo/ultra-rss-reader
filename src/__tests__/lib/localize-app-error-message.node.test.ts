import { describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import {
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";

const databaseMaintenanceBusyMessage =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";

describe("localizeUserVisibleAppErrorMessage", () => {
  it("maps the known backend message to locale copy", async () => {
    await i18n.changeLanguage("ja");
    expect(isLocalizableUserVisibleAppErrorMessage(databaseMaintenanceBusyMessage)).toBe(true);
    expect(localizeUserVisibleAppErrorMessage(databaseMaintenanceBusyMessage)).toBe(
      "同期中はデータベースのメンテナンスを実行できません。同期が完了してから再試行してください。",
    );

    await i18n.changeLanguage("en");
    expect(localizeUserVisibleAppErrorMessage(databaseMaintenanceBusyMessage)).toBe(databaseMaintenanceBusyMessage);
  });

  it("leaves unknown messages unchanged", () => {
    expect(localizeUserVisibleAppErrorMessage("something else")).toBe("something else");
    expect(isLocalizableUserVisibleAppErrorMessage("something else")).toBe(false);
  });
});
