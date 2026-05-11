import type { TFunction } from "i18next";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

export function useStableOpenTranslation<Namespace extends string>(
  namespace: Namespace,
  open: boolean,
): TFunction<Namespace> {
  const { t, i18n } = useTranslation(namespace);
  const openLanguageRef = useRef<string | null>(null);

  if (open && openLanguageRef.current === null) {
    openLanguageRef.current = i18n.resolvedLanguage ?? i18n.language;
  } else if (!open && openLanguageRef.current !== null) {
    openLanguageRef.current = null;
  }

  const openLanguage = openLanguageRef.current;

  return useMemo(() => {
    if (openLanguage === null) {
      return t;
    }

    return i18n.getFixedT(openLanguage, namespace) as TFunction<Namespace>;
  }, [i18n, namespace, openLanguage, t]);
}
