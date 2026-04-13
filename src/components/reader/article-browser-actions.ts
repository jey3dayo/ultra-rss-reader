import { Result } from "@praha/byethrow";
import { openInBrowser } from "@/api/tauri-commands";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function openArticleInExternalBrowser(url: string) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
  return openInBrowser(url, bg).then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open in browser:", error);
        useUiStore.getState().showToast(error.message);
      }),
    ),
  );
}
