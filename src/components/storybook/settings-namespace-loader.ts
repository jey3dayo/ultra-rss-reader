import i18n from "@/lib/i18n";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";

export async function loadSettingsNamespace() {
  await loadI18nResourceNamespace(i18n, "settings");
  return {};
}
