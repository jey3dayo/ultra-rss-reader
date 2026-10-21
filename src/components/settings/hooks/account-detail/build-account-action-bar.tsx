import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { AccountActionBar } from "@/components/settings/account-detail/account-action-bar";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { isFreshRssAccount } from "./account-kind";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type BuildAccountActionBarParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  isSetupSyncing: boolean;
  isQuarantined: boolean;
};

export function buildAccountActionBar({
  account,
  controller,
  t,
  isSetupSyncing,
  isQuarantined,
}: BuildAccountActionBarParams): ReactNode {
  if (!isFreshRssAccount(account) || isSetupSyncing || isQuarantined) {
    return undefined;
  }

  return (
    <AccountActionBar
      hasUnsavedChanges={controller.dirtyState.dirty}
      running={controller.testingConnection}
      message={t("dirty_state.unsaved_changes")}
      discardLabel={t("dirty_state.discard")}
      saveAndTestLabel={t("account.save_and_test_connection")}
      testConnectionLabel={t("account.test_connection")}
      testingLabel={t("account.testing_connection")}
      connectionVerified={controller.connectionTestSucceeded && !controller.dirtyState.dirty}
      connectionVerifiedLabel={t("account.test_connection_succeeded")}
      onDiscard={controller.discardCredentialDrafts}
      onTestConnection={() => void controller.handleTestConnection()}
    />
  );
}
