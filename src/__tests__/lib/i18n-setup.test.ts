import { beforeAll, describe, expect, it } from "vitest";
import { i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";
import i18n, { testI18nResourceNamespaces } from "../../../tests/helpers/i18n-setup";

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
    const appResourceNamespaces = Object.keys(i18nResources.en) as typeof appUsedNamespaces;

    expect(testI18nResourceNamespaces).toEqual(appUsedNamespaces);
    expect(appResourceNamespaces).toEqual(appUsedNamespaces);
    expect(i18n.options.ns).toEqual(appUsedNamespaces);
    expect(i18n.options.defaultNS).toBe("common");
    expect(appUsedNamespaces.filter((namespace) => !i18n.hasResourceBundle("en", namespace))).toEqual([]);
    expect(appUsedNamespaces.filter((namespace) => !i18n.hasResourceBundle("ja", namespace))).toEqual([]);
    expect(appResourceNamespaces.filter((namespace) => !testI18nResourceNamespaces.includes(namespace))).toEqual([]);
    expect(testI18nResourceNamespaces.filter((namespace) => !appResourceNamespaces.includes(namespace))).toEqual([]);
  });

  it("registers Japanese resource bundles from the shared app resource map", () => {
    for (const namespace of i18nResourceNamespaces) {
      expect(i18n.getResourceBundle("ja", namespace)).toEqual(i18nResources.ja[namespace]);
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
});
