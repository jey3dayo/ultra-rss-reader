import { beforeAll, describe, expect, it } from "vitest";
import { i18nInitialResourceNamespaces, i18nResourceNamespaces } from "@/lib/i18n-resources";
import i18n, { resetTestI18nState, testI18nResourceNamespaces } from "../../../tests/helpers/i18n-setup";

describe("test i18n setup", () => {
  describe("language isolation", () => {
    beforeAll(async () => {
      await i18n.changeLanguage("ja");
    });

    it("resets language before each test starts", () => {
      expect(i18n.language).toBe("en");
    });
  });

  it("keeps test resource namespaces aligned with app-used namespaces", () => {
    const appUsedNamespaces = [...i18nResourceNamespaces];
    const appInitialResourceNamespaces = [...i18nInitialResourceNamespaces];

    expect(testI18nResourceNamespaces).toEqual(appUsedNamespaces);
    expect(appInitialResourceNamespaces.every((namespace) => appUsedNamespaces.includes(namespace))).toBe(true);
    expect(i18n.options.ns).toEqual(appUsedNamespaces);
    expect(i18n.options.defaultNS).toBe("common");
    expect(appUsedNamespaces.filter((namespace) => !i18n.hasResourceBundle("en", namespace))).toEqual([]);
    expect(appUsedNamespaces.filter((namespace) => !i18n.hasResourceBundle("ja", namespace))).toEqual([]);
  });

  it("registers Japanese resource bundles from the shared app resource map", () => {
    for (const namespace of i18nResourceNamespaces) {
      expect(i18n.getResourceBundle("ja", namespace)).toBeDefined();
    }
  });

  it("allows a test to mutate language and resource state", async () => {
    await i18n.changeLanguage("ja");
    i18n.addResource("en", "common", "__test_leaked_key", "leaked");
    i18n.addResourceBundle("fr", "common", { __test_leaked_key: "fuite" });

    expect(i18n.language).toBe("ja");
    expect(i18n.exists("__test_leaked_key", { lng: "en", ns: "common" })).toBe(true);
    expect(i18n.hasResourceBundle("fr", "common")).toBe(true);
  });

  it("resets language and resource mutations between tests", () => {
    expect(i18n.language).toBe("en");
    expect(i18n.exists("__test_leaked_key", { lng: "en", ns: "common" })).toBe(false);
    expect(i18n.hasResourceBundle("fr", "common")).toBe(false);
  });

  it("exposes the Vitest lifecycle reset helper for explicit isolation checks", async () => {
    await i18n.changeLanguage("ja");
    i18n.addResource("en", "common", "__test_manual_reset_key", "leaked");

    await resetTestI18nState();

    expect(i18n.language).toBe("en");
    expect(i18n.exists("__test_manual_reset_key", { lng: "en", ns: "common" })).toBe(false);
  });
});
