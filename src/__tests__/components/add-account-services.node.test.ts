import { describe, expect, it } from "vitest";
import {
  findServiceDefinition,
  getDisabledServiceDefinitions,
  getEnabledServiceDefinitions,
} from "@/components/settings/add-account/services";
import { getAddAccountFormConfig } from "@/lib/account/add-account-form";

describe("add-account-services", () => {
  it("keeps enabled add account providers discoverable", () => {
    expect(getEnabledServiceDefinitions().map((service) => service.kind)).toEqual(["Local", "FreshRss"]);
    expect(findServiceDefinition("Local")).toEqual(
      expect.objectContaining({
        kind: "Local",
        nameKey: "account.local_feeds",
        descKey: "account.local_desc",
      }),
    );
    expect(findServiceDefinition("FreshRss")).toEqual(
      expect.objectContaining({
        kind: "FreshRss",
        nameKey: "account.freshrss",
        descKey: "account.freshrss_desc",
      }),
    );
  });

  it("ships no unavailable services in the production catalog", () => {
    // The picker can still render a disabled row (see the ServicePicker fixture test), but the
    // shipped catalog must not advertise providers the backend cannot create.
    expect(getDisabledServiceDefinitions()).toEqual([]);
  });

  it("keeps enabled service picker options aligned with credential field requirements", () => {
    const enabledProviderMatrix = getEnabledServiceDefinitions().map((service) => ({
      kind: service.kind,
      config: getAddAccountFormConfig(service.kind),
      service,
    }));

    expect(enabledProviderMatrix).toMatchObject([
      {
        kind: "Local",
        config: {
          sectionHeading: "Account",
          showServerUrl: false,
          credentialLabel: null,
          credentialName: null,
          requiresCredentials: false,
        },
        service: {
          nameKey: "account.local_feeds",
          descKey: "account.local_desc",
        },
      },
      {
        kind: "FreshRss",
        config: {
          sectionHeading: "Server",
          showServerUrl: true,
          credentialLabel: "Username",
          credentialName: "username",
          requiresCredentials: true,
        },
        service: {
          nameKey: "account.freshrss",
          descKey: "account.freshrss_desc",
        },
      },
    ]);
  });
});
