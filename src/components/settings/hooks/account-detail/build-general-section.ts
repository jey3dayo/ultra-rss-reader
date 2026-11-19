import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import type { AccountGeneralSectionView } from "@/components/settings/account-detail/general-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { isValidOptionalHttpServerUrl } from "@/lib/account/server-url";
import { isFreshRssAccount, isLocalAccount } from "./account-kind";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type GeneralSectionProps = ComponentProps<typeof AccountGeneralSectionView>;

type BuildGeneralSectionParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  quarantineReason: string | null;
  isSetupFailed: boolean;
  isSetupActive: boolean;
  isQuarantined: boolean;
};

export function buildGeneralSection({
  account,
  controller,
  t,
  quarantineReason,
  isSetupFailed,
  isSetupActive,
  isQuarantined,
}: BuildGeneralSectionParams): GeneralSectionProps {
  return {
    heading: t("account.general"),
    nameLabel: t("account.description"),
    nameValue: account.name,
    editNameTitle: t("account.click_to_edit"),
    isEditingName: controller.editingName,
    isSavingName: controller.savingName,
    nameDraft: controller.nameDraft,
    nameInputRef: controller.nameInputRef,
    infoRows: [
      {
        label: t("account.type"),
        value: isFreshRssAccount(account)
          ? t("account.freshrss")
          : isLocalAccount(account)
            ? t("account.local")
            : account.kind,
      },
      ...(quarantineReason
        ? [
            {
              label: t("account.quarantine_state"),
              value: t("account.quarantine_state_value"),
            },
          ]
        : []),
      ...(!isValidOptionalHttpServerUrl(account.server_url)
        ? [
            {
              label: t("account.server_url"),
              value: account.server_url ?? "",
            },
          ]
        : []),
      ...(account.username
        ? [
            {
              label: t("account.username"),
              value: account.username,
            },
          ]
        : []),
      ...(quarantineReason
        ? [
            {
              label: t("account.quarantine_action"),
              value: t("account.quarantine_delete_action"),
            },
          ]
        : []),
      ...(isSetupFailed
        ? [
            {
              label: t("account.recovery_credentials_label"),
              value: t("account.recovery_credentials_detail"),
            },
            {
              label: t("account.recovery_server_url_label"),
              value: t("account.recovery_server_url_detail"),
            },
            {
              label: t("account.recovery_cache_label"),
              value: t("account.recovery_cache_detail"),
            },
          ]
        : []),
    ],
    onStartEditingName: controller.startEditingName,
    onNameDraftChange: controller.setNameDraft,
    onCommitName: controller.commitRename,
    onCancelName: controller.cancelRename,
    nameDirty: controller.nameDirty,
    nameSaved: controller.nameSaved,
    saveLabel: t("dirty_state.save"),
    cancelLabel: t("dirty_state.cancel"),
    unsavedLabel: t("dirty_state.unsaved_changes"),
    savedLabel: t("dirty_state.saved"),
    savingLabel: t("dirty_state.saving"),
    onNameKeyDown: controller.handleNameKeyDown,
    disabled:
      isSetupActive ||
      isQuarantined ||
      controller.testingConnection ||
      controller.credentialSavePending ||
      controller.syncSavePending,
    errorMessage: controller.renameErrorMessage,
  };
}
