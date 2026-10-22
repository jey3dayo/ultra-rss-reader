import { createAccountDetailControllerStub } from "@tests/helpers/account-detail-controller-stub";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { type ComponentProps, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import { buildCredentialsSection } from "@/components/settings/hooks/account-detail/build-credentials-section";
import type { AccountDetailControllerResult } from "@/components/settings/hooks/account-detail/use-account-detail-controller";

type SectionProps = ComponentProps<typeof AccountCredentialsSectionView>;

function sectionProps(
  overrides: Partial<AccountDetailControllerResult>,
  verificationStatus?: "verified" | "unverified" | "error",
): SectionProps {
  const section = buildCredentialsSection({
    account: { ...sampleAccounts[1], kind: "FreshRss", connection_verification_status: verificationStatus },
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

  it("keeps the real cause of an Access load failure next to a password failure", () => {
    const props = sectionProps({
      cloudflareAccessStatus: "error",
      cloudflareAccessLoadFailure: { target: "cloudflare_access", cause: "not_allowed", operation: "load" },
      credentialFailure: { target: "password", cause: "write_failed", operation: "save" },
    });

    expect(props.cloudflareAccess?.failureNotice?.lines[0]).toBe(
      "Couldn’t continue because access to Keychain wasn’t allowed.",
    );
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

describe("buildCredentialsSection persisted auth failure", () => {
  it("shows the stored authentication failure with a check retry when the last verification failed", () => {
    const handleTestConnection = vi.fn(async () => true);
    const props = sectionProps({ handleTestConnection, testingConnection: true }, "error");

    expect(props.passwordFailureNotice?.lines).toEqual(["Authentication failed"]);
    expect(props.passwordFailureNotice?.retryLabel).toBe("Retry Check");
    expect(props.passwordFailureNotice?.retryDisabled).toBe(true);

    props.passwordFailureNotice?.onRetry();
    expect(handleTestConnection).toHaveBeenCalledTimes(1);
  });

  it.each(["verified", "unverified", undefined] as const)(
    "shows no failure notice when the verification status is %s",
    (status) => {
      expect(sectionProps({}, status).passwordFailureNotice).toBeUndefined();
    },
  );

  it("lets a failure from this session replace the stored authentication failure", () => {
    const props = sectionProps(
      { credentialFailure: { target: "password", cause: "canceled", operation: "save" } },
      "error",
    );

    expect(props.passwordFailureNotice?.lines).toEqual([
      "Access to Keychain was canceled. To continue, try again and allow access.",
      "Your changes are still in the form.",
    ]);
  });
});
