import { Result } from "@praha/byethrow";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleStatusToast, ArticleToastActionParams } from "./article-actions.types";

type ArticleBrowserToastOperation = () => ReturnType<typeof copyToClipboard>;
type OpenExternalBrowserParams = {
  background: boolean;
  showToast: ArticleStatusToast;
  errorLabel: string;
};

function runToastOperation(
  operation: ArticleBrowserToastOperation,
  { showToast, successMessage }: ArticleToastActionParams,
  errorLabel: string,
) {
  return operation().then((result) =>
    Result.pipe(
      result,
      Result.inspect(() => showToast(successMessage)),
      Result.inspectError((error) => {
        console.error(`${errorLabel}:`, error);
        showToast(error.message);
      }),
    ),
  );
}

export function openArticleInExternalBrowser(
  url: string,
  showToast: ArticleStatusToast = useUiStore.getState().showToast,
) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";

  return openUrlInExternalBrowser(url, {
    background: bg,
    showToast,
    errorLabel: "Failed to open in browser",
  });
}

export function openUrlInExternalBrowser(
  url: string,
  { background, showToast, errorLabel }: OpenExternalBrowserParams,
) {
  return openInBrowser(url, background).then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error(`${errorLabel}:`, error);
        showToast(error.message);
      }),
    ),
  );
}

export function copyArticleLink(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return runToastOperation(() => copyToClipboard(url), { showToast, successMessage }, "Copy failed");
}

export function addArticleToReadingList(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return runToastOperation(() => addToReadingList(url), { showToast, successMessage }, "Add to reading list failed");
}
