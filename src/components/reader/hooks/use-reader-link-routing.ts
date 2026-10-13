import { AlertTriangle } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { controlCharPattern } from "@/api/schemas/commands/shared";
import { hasEncodedNewline, isValidWebPreviewUrl } from "@/api/schemas/commands/url";
import { openArticleInExternalBrowser } from "@/components/reader/article-browser-actions";
import { isHostBlockedByPolicy } from "@/lib/runtime/host-privacy";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function resolveReaderLinkUrl(href: string, baseUrl?: string | null): URL | null {
  if (!href.trim() || controlCharPattern.test(href) || hasEncodedNewline(href)) {
    return null;
  }
  try {
    const url = new URL(href, baseUrl || undefined);
    return isValidWebPreviewUrl(url.href) ? url : null;
  } catch {
    return null;
  }
}

type ReaderLinkOptions = {
  external?: boolean;
  onOpenInApp?: () => void;
};

export function useReaderLinkRouting(scopeKey: string) {
  const { t } = useTranslation("reader");
  const openLinks = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "open_links"));
  const pendingConfirmRef = useRef<(() => void) | null>(null);
  const previousScopeRef = useRef(scopeKey);

  const invalidatePendingConfirm = useCallback(() => {
    const pending = pendingConfirmRef.current;
    pendingConfirmRef.current = null;
    const store = useUiStore.getState();
    if (pending && store.confirmDialog.onConfirm === pending) {
      store.closeConfirm();
    }
  }, []);

  useLayoutEffect(() => {
    if (previousScopeRef.current !== scopeKey) {
      invalidatePendingConfirm();
      previousScopeRef.current = scopeKey;
    }
  }, [scopeKey, invalidatePendingConfirm]);

  useLayoutEffect(() => {
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (
        state.selectedArticleId !== previous.selectedArticleId ||
        state.selectedAccountId !== previous.selectedAccountId ||
        state.selection !== previous.selection ||
        state.contentMode !== previous.contentMode ||
        state.browserUrl !== previous.browserUrl ||
        state.webPreviewSessionMode !== previous.webPreviewSessionMode
      ) {
        invalidatePendingConfirm();
      } else if (!state.confirmDialog.open || state.confirmDialog.onConfirm !== pendingConfirmRef.current) {
        pendingConfirmRef.current = null;
      }
    });
    return () => {
      unsubscribe();
      invalidatePendingConfirm();
    };
  }, [invalidatePendingConfirm]);

  const openReaderLink = useCallback(
    (href: string, options: ReaderLinkOptions = {}, baseUrl?: string | null) => {
      invalidatePendingConfirm();
      const url = resolveReaderLinkUrl(href, baseUrl);
      if (!url) {
        useUiStore.getState().showToast(t("reader_link_invalid"));
        return;
      }

      if (options.external || openLinks === "default_browser") {
        void openArticleInExternalBrowser(url.href);
        return;
      }

      const navigate = () => {
        const store = useUiStore.getState();
        if (options.onOpenInApp) {
          options.onOpenInApp();
        } else {
          if (store.selectedArticleId) {
            store.setWebPreviewSessionMode("forced-on");
          }
          store.openBrowser(url.href);
        }
      };

      if (!isHostBlockedByPolicy(url.hostname, "automaticRequest")) {
        navigate();
        return;
      }

      const onConfirm = () => {
        const dialog = useUiStore.getState().confirmDialog;
        if (pendingConfirmRef.current !== onConfirm || !dialog.open || dialog.onConfirm !== onConfirm) {
          return;
        }
        pendingConfirmRef.current = null;
        navigate();
      };
      pendingConfirmRef.current = onConfirm;
      useUiStore.getState().showConfirm(t("reader_link_private_confirm", { host: url.hostname }), onConfirm, {
        actionLabel: t("reader_link_private_open"),
        variant: "warning",
        icon: AlertTriangle,
      });
    },
    [invalidatePendingConfirm, openLinks, t],
  );

  const readerLinkTitle = useCallback(
    (href: string) => {
      const url = resolveReaderLinkUrl(href);
      if (!url) {
        return t("reader_link_invalid");
      }
      if (openLinks !== "default_browser" && isHostBlockedByPolicy(url.hostname, "automaticRequest")) {
        return t("reader_link_private_tooltip", { host: url.hostname });
      }
      return t(openLinks === "default_browser" ? "site_link_open_external" : "site_link_open_in_app", {
        host: url.hostname,
      });
    },
    [openLinks, t],
  );

  return { openReaderLink, readerLinkTitle };
}
