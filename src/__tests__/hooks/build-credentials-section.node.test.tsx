import { createAccountDetailControllerStub } from "@tests/helpers/account-detail-controller-stub";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { type ComponentProps, isValidElement } from "react";
import { describe, expect, it } from "vitest";
import type { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import { buildCredentialsSection } from "@/components/settings/hooks/account-detail/build-credentials-section";
import type { AccountDetailControllerResult } from "@/components/settings/hooks/account-detail/use-account-detail-controller";

type SectionProps = ComponentProps<typeof AccountCredentialsSectionView>;

function sectionProps(overrides: Partial<AccountDetailControllerResult>): SectionProps {
  const section = buildCredentialsSection({
    account: { ...sampleAccounts[1], kind: "FreshRss" },
    controller: createAccountDetailControllerStub(overrides),
    t: i18n.getFixedT("en", "settings"),
    isSetupSyncing: false,
    isSetupFailed: false,
    isSetupActive: false,
    isQuarantined: false,
    credentialStoreKind: "keychain",
  });
  if (!isValidElement<SectionProps>(section)) {
    throw new Error("a FreshRSS account should render the credentials section");
  }
  return section.props;
}

describe("buildCredentialsSection failure notices", () => {
  it("keeps the Access load failure visible while a password failure is shown", () => {
    const props = sectionProps({
      cloudflareAccessStatus: "error",
      credentialFailure: { target: "password", cause: "canceled", operation: "save" },
    });

    expect(props.passwordFailureNotice?.lines[0]).toBe(
      "Access to Keychain was canceled. To continue, try again and allow access.",
    );
    expect(props.cloudflareAccess?.failureNotice?.lines[0]).toBe(
      "Couldn’t read Cloudflare Access credentials from Keychain.",
    );
    expect(props.cloudflareAccess?.failureNotice?.retryLabel).toBe("Try Again");
  });

  it("shows an Access save failure only under Access, not under the password", () => {
    const props = sectionProps({
      cloudflareAccessStatus: "ready",
      credentialFailure: { target: "cloudflare_access", cause: "write_failed", operation: "save" },
    });

    expect(props.passwordFailureNotice).toBeUndefined();
    expect(props.cloudflareAccess?.failureNotice?.retryLabel).toBe("Retry Save");
  });
});
