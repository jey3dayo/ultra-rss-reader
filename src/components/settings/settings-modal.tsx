import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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

  // Auto-select first account when navigating to accounts section via menu
  useEffect(() => {
    if (settingsCategory === "accounts" && !settingsAccountId && !settingsAddAccount) {
      if (accounts && accounts.length > 0) {
        setSettingsAccountId(accounts[0].id);
      } else {
        setSettingsAddAccount(true);
      }
    }
  }, [settingsCategory, settingsAccountId, settingsAddAccount, accounts, setSettingsAccountId, setSettingsAddAccount]);

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
