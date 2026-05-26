import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { hasI18nResourceNamespace, type i18nResourceNamespaces, loadI18nResourceNamespace } from "@/lib/i18n-resources";

type I18nResourceNamespace = (typeof i18nResourceNamespaces)[number];

export function useI18nResourceNamespace(namespace: I18nResourceNamespace | null): boolean {
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(() => namespace === null || hasI18nResourceNamespace(i18n, namespace));

  useEffect(() => {
    if (namespace === null) {
      setReady(true);
      return;
    }

    if (hasI18nResourceNamespace(i18n, namespace)) {
      setReady(true);
      return;
    }

    let active = true;
    setReady(false);
    void loadI18nResourceNamespace(i18n, namespace).then(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [i18n, namespace]);

  return ready;
}
