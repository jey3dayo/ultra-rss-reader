import { Result } from "@praha/byethrow";
import { openInBrowser } from "@/api/tauri-commands";

export async function openFeedSiteInBrowser(url: string, background: boolean): Promise<void> {
  const result = await openInBrowser(url, background);
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }
}
