import type { i18n } from "i18next";
import enCommon from "@/locales/en/common.json";
import enReader from "@/locales/en/reader.json";
import type enSettings from "@/locales/en/settings.json";
import enSidebar from "@/locales/en/sidebar.json";
import type enSubscriptions from "@/locales/en/subscriptions.json";
import jaCommon from "@/locales/ja/common.json";
import jaReader from "@/locales/ja/reader.json";
import type jaSettings from "@/locales/ja/settings.json";
import jaSidebar from "@/locales/ja/sidebar.json";
import type jaSubscriptions from "@/locales/ja/subscriptions.json";

export const i18nResourceLocales = ["en", "ja"] as const;
export const i18nInitialResourceNamespaces = ["common", "reader", "sidebar"] as const;
export const i18nDeferredResourceNamespaces = ["settings", "subscriptions"] as const;
export const i18nResourceNamespaces = ["common", "settings", "reader", "sidebar", "subscriptions"] as const;

type I18nResourceLocale = (typeof i18nResourceLocales)[number];
type I18nResourceNamespace = (typeof i18nResourceNamespaces)[number];
type I18nDeferredResourceNamespace = (typeof i18nDeferredResourceNamespaces)[number];

export type I18nResourceFile = {
  locale: I18nResourceLocale;
  namespace: I18nResourceNamespace;
  resourcePath: `@/locales/${I18nResourceLocale}/${I18nResourceNamespace}.json`;
};

export const i18nResourceFiles: readonly I18nResourceFile[] = i18nResourceLocales.flatMap((locale) =>
  i18nResourceNamespaces.map((namespace) => ({
    locale,
    namespace,
    resourcePath: `@/locales/${locale}/${namespace}.json`,
  })),
);

export const i18nResources = {
  en: {
    common: enCommon,
    reader: enReader,
    sidebar: enSidebar,
  },
  ja: {
    common: jaCommon,
    reader: jaReader,
    sidebar: jaSidebar,
  },
} as const;

type I18nDeferredResourceMap = {
  en: {
    settings: typeof enSettings;
    subscriptions: typeof enSubscriptions;
  };
  ja: {
    settings: typeof jaSettings;
    subscriptions: typeof jaSubscriptions;
  };
};

export type I18nDefaultResources = (typeof i18nResources)["en"] & I18nDeferredResourceMap["en"];

const i18nDeferredResourceLoaders = {
  en: {
    settings: async () => resolveJsonModuleDefault(await import("@/locales/en/settings.json")),
    subscriptions: async () => resolveJsonModuleDefault(await import("@/locales/en/subscriptions.json")),
  },
  ja: {
    settings: async () => resolveJsonModuleDefault(await import("@/locales/ja/settings.json")),
    subscriptions: async () => resolveJsonModuleDefault(await import("@/locales/ja/subscriptions.json")),
  },
} satisfies {
  readonly [Locale in I18nResourceLocale]: {
    readonly [Namespace in I18nDeferredResourceNamespace]: () => Promise<I18nDeferredResourceMap[Locale][Namespace]>;
  };
};

const i18nDeferredResourceLoadPromises = new WeakMap<i18n, Map<I18nDeferredResourceNamespace, Promise<void>>>();

function resolveJsonModuleDefault<T>(module: { default?: T } | T): T {
  return typeof module === "object" && module !== null && "default" in module ? (module.default as T) : (module as T);
}

export function hasI18nResourceNamespace(i18nInstance: i18n, namespace: I18nResourceNamespace): boolean {
  return i18nResourceLocales.every((locale) => i18nInstance.hasResourceBundle(locale, namespace));
}

export async function loadI18nResourceNamespace(i18nInstance: i18n, namespace: I18nResourceNamespace): Promise<void> {
  if (!i18nDeferredResourceNamespaces.includes(namespace as I18nDeferredResourceNamespace)) {
    return;
  }

  const deferredNamespace = namespace as I18nDeferredResourceNamespace;
  if (hasI18nResourceNamespace(i18nInstance, deferredNamespace)) {
    return;
  }

  const loadPromises =
    i18nDeferredResourceLoadPromises.get(i18nInstance) ?? new Map<I18nDeferredResourceNamespace, Promise<void>>();
  i18nDeferredResourceLoadPromises.set(i18nInstance, loadPromises);

  const existingLoadPromise = loadPromises.get(deferredNamespace);
  if (existingLoadPromise) {
    return existingLoadPromise;
  }

  const loadPromise = Promise.all(
    i18nResourceLocales.map(async (locale) => {
      if (i18nInstance.hasResourceBundle(locale, deferredNamespace)) {
        return;
      }

      const resource = await i18nDeferredResourceLoaders[locale][deferredNamespace]();
      i18nInstance.addResourceBundle(locale, deferredNamespace, resource, true, true);
    }),
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      throw error;
    })
    .finally(() => {
      loadPromises.delete(deferredNamespace);
    });

  loadPromises.set(deferredNamespace, loadPromise);
  return loadPromise;
}
