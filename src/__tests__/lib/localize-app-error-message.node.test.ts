import { describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import {
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";

const databaseMaintenanceBusyMessage =
  "Database maintenance is unavailable while syncing. Try again after sync completes.";
const apiHtmlAuthErrorMessage =
  "Auth error: The API returned an HTML page. Check the server URL and any access gateway settings.";

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

  it("localizes the known API HTML auth error without changing its English copy", async () => {
    const originalLanguage = i18n.language;
    try {
      await i18n.changeLanguage("ja");
      expect(isLocalizableUserVisibleAppErrorMessage(apiHtmlAuthErrorMessage)).toBe(true);
      expect(localizeUserVisibleAppErrorMessage(apiHtmlAuthErrorMessage)).toBe(
        "認証エラー: サーバーから想定外の応答が返されました。サーバーURLとアクセス認証の設定を確認してください。",
      );

      await i18n.changeLanguage("en");
      expect(localizeUserVisibleAppErrorMessage(apiHtmlAuthErrorMessage)).toBe(apiHtmlAuthErrorMessage);
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });

  it("leaves unknown messages unchanged", () => {
    expect(localizeUserVisibleAppErrorMessage("something else")).toBe("something else");
    expect(isLocalizableUserVisibleAppErrorMessage("something else")).toBe(false);
  });
});
