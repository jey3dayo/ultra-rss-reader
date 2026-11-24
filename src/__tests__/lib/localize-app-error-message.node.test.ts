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

  it.each([
    ["Only http:// and https:// URLs are supported", "http:// または https:// の URL のみ使用できます"],
    ["Article URLs must not include credentials", "記事の URL にユーザー名やパスワードを含めることはできません"],
    ["Invalid clipboard text", "コピーできないテキストです"],
    [
      "Requests to private/loopback addresses are not allowed",
      "プライベート / ループバックアドレスの URL は使用できません",
    ],
    ["URLs with embedded credentials are not allowed", "URL にユーザー名やパスワードを含めることはできません"],
    ["URLs must include a host", "URL にホストが含まれていません"],
  ])("localizes the frontend-owned message %j in ja and keeps English in en", async (message, japanese) => {
    const originalLanguage = i18n.language;
    try {
      await i18n.changeLanguage("ja");
      expect(isLocalizableUserVisibleAppErrorMessage(message)).toBe(true);
      expect(localizeUserVisibleAppErrorMessage(message)).toBe(japanese);

      await i18n.changeLanguage("en");
      expect(localizeUserVisibleAppErrorMessage(message)).toBe(message);
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });

  it("localizes a known message wrapped in the command validation prefix", async () => {
    const wrapped = "Command validation failed: url: Requests to private/loopback addresses are not allowed";
    const originalLanguage = i18n.language;
    try {
      await i18n.changeLanguage("ja");
      expect(isLocalizableUserVisibleAppErrorMessage(wrapped)).toBe(true);
      expect(localizeUserVisibleAppErrorMessage(wrapped)).toBe(
        "プライベート / ループバックアドレスの URL は使用できません",
      );

      await i18n.changeLanguage("en");
      expect(localizeUserVisibleAppErrorMessage(wrapped)).toBe(
        "Requests to private/loopback addresses are not allowed",
      );
    } finally {
      await i18n.changeLanguage(originalLanguage);
    }
  });

  it("leaves unknown messages unchanged", () => {
    expect(localizeUserVisibleAppErrorMessage("something else")).toBe("something else");
    expect(isLocalizableUserVisibleAppErrorMessage("something else")).toBe(false);
  });
});
