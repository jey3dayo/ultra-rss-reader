import { Result } from "@praha/byethrow";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type ShowToast = (message: string) => void;

type ArticleToastActionParams = {
  showToast: ShowToast;
  successMessage: string;
};

export function openArticleInExternalBrowser(url: string, showToast: ShowToast = useUiStore.getState().showToast) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
  return openInBrowser(url, bg).then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open in browser:", error);
        showToast(error.message);
      }),
    ),
  );
}

export function copyArticleLink(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return copyToClipboard(url).then((result) =>
    Result.pipe(
      result,
      Result.inspect(() => showToast(successMessage)),
      Result.inspectError((error) => {
        console.error("Copy failed:", error);
        showToast(error.message);
      }),
    ),
  );
}

export function addArticleToReadingList(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return addToReadingList(url).then((result) =>
    Result.pipe(
      result,
      Result.inspect(() => showToast(successMessage)),
      Result.inspectError((error) => {
        console.error("Add to reading list failed:", error);
        showToast(error.message);
      }),
    ),
  );
}
