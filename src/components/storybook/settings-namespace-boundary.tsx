import type { ReactNode } from "react";
import { useI18nResourceNamespace } from "@/lib/i18n/use-i18n-resource-namespace";

export function SettingsNamespaceBoundary({ children }: { children: ReactNode }) {
  const ready = useI18nResourceNamespace("settings");

  if (!ready) {
    return <div aria-hidden="true" className="min-h-80" />;
  }

  return children;
}
