import { describe, expect, it } from "vitest";
import { i18nResourceNamespaces, i18nResources } from "@/lib/i18n-resources";
import i18n, { testI18nResourceNamespaces } from "../../../tests/helpers/i18n-setup";

describe("test i18n setup", () => {
  it("keeps test resource namespaces aligned with app-used namespaces", () => {
    const appUsedNamespaces = [...i18nResourceNamespaces];
    const appResourceNamespaces = Object.keys(i18nResources.en) as typeof appUsedNamespaces;

    expect(testI18nResourceNamespaces).toEqual(appUsedNamespaces);
    expect(appResourceNamespaces).toEqual(appUsedNamespaces);
    expect(i18n.options.ns).toEqual(appUsedNamespaces);
    expect(i18n.options.defaultNS).toBe("common");
    expect(appUsedNamespaces.filter((namespace) => !i18n.hasResourceBundle("en", namespace))).toEqual([]);
    expect(appResourceNamespaces.filter((namespace) => !testI18nResourceNamespaces.includes(namespace))).toEqual([]);
    expect(testI18nResourceNamespaces.filter((namespace) => !appResourceNamespaces.includes(namespace))).toEqual([]);
  });
});
