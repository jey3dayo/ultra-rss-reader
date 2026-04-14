import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getPreferredAccountId } from "@/components/accounts/get-preferred-account-id";
import { AccountDetail } from "@/components/settings/account-detail";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { DebugSettings } from "@/components/settings/debug-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import type { SettingsContentProps } from "@/components/settings/settings-modal.types";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { useSettingsModalViewProps } from "@/components/settings/use-settings-modal-view-props";
import { useAccounts } from "@/hooks/use-accounts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function SettingsContent({ settingsAccountId, settingsAddAccount, settingsCategory }: SettingsContentProps) {
  if (settingsAccountId) {
    return <AccountDetail />;
  }
  if (settingsAddAccount) {
    return <AddAccountForm />;
  }
  switch (settingsCategory) {
    case "appearance":
      return <AppearanceSettings />;
    case "reading":
      return <ReadingSettings />;
    case "shortcuts":
      return <ShortcutsSettings />;
    case "actions":
      return <ActionsSettings />;
    case "data":
      return <DataSettings />;
    case "debug":
      return <DebugSettings />;
    default:
      return <GeneralSettings />;
  }
}

export function SettingsModal() {
  const { t } = useTranslation("settings");
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const settingsCategory = useUiStore((s) => s.settingsCategory);
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const settingsAddAccount = useUiStore((s) => s.settingsAddAccount);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const settingsLoading = useUiStore((s) => s.settingsLoading);
  const { data: accounts } = useAccounts();
  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");

  // Wait for account data before deciding whether to restore or open the add-account flow.
  useEffect(() => {
    if (settingsCategory !== "accounts" || settingsAccountId || settingsAddAccount || !accounts) {
      return;
    }

    const nextAccountId = getPreferredAccountId(accounts, savedAccountId);
    if (nextAccountId) {
      setSettingsAccountId(nextAccountId);
    } else {
      setSettingsAddAccount(true);
    }
  }, [
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    accounts,
    savedAccountId,
    setSettingsAccountId,
    setSettingsAddAccount,
  ]);

  const viewProps = useSettingsModalViewProps({
    t,
    settingsOpen,
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    settingsLoading,
    accounts,
    content: (
      <SettingsContent
        settingsAccountId={settingsAccountId}
        settingsAddAccount={settingsAddAccount}
        settingsCategory={settingsCategory}
      />
    ),
    closeSettings,
    openSettings,
    setSettingsCategory,
    setSettingsAccountId,
    setSettingsAddAccount,
  });

  return <SettingsModalView {...viewProps} />;
}
