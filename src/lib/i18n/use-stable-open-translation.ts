import type { Namespace, TFunction } from "i18next";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export function useStableOpenTranslation<Ns extends Namespace>(namespace: Ns, open: boolean): TFunction<Ns> {
  const { t, i18n } = useTranslation(namespace);
  // The captured locale is state written after the open transition commits, not a ref written
  // during render. A render-time write is visible past the render that made it even when that
  // render is discarded, so a discarded close could clear the locale a still-open surface is
  // pinned to, and the next open render would re-capture whatever language is current by then.
  const [openLanguage, setOpenLanguage] = useState<string | null>(null);

  useLayoutEffect(() => {
    // Capture once per open. Keeping the previous value when one exists is what makes the
    // language pin survive a re-run of this effect; i18n is a stable instance, but the guard
    // must not depend on that to hold.
    setOpenLanguage((previous) => (open ? (previous ?? i18n.resolvedLanguage ?? i18n.language) : null));
  }, [open, i18n]);

  return useMemo(() => {
    if (openLanguage === null) {
      return t as TFunction<Ns>;
    }

    return i18n.getFixedT(openLanguage, namespace) as TFunction<Ns>;
  }, [i18n, namespace, openLanguage, t]);
}
