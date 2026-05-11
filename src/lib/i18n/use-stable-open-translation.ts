import type { Namespace, TFunction } from "i18next";
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

export function useStableOpenTranslation<Ns extends Namespace>(
  namespace: Ns,
  open: boolean,
): TFunction<Ns> {
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
      return t as TFunction<Ns>;
    }

    return i18n.getFixedT(openLanguage, namespace) as TFunction<Ns>;
  }, [i18n, namespace, openLanguage, t]);
}
