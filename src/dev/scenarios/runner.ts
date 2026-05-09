import { Result } from "@praha/byethrow";
import {
  getTagArticleCounts,
  listAccounts,
  listArticles,
  listArticlesByTag,
  listFeeds,
  listTags,
} from "@/api/tauri-commands";
import { cancelOpenWebPreviewUrlScenarioReplay } from "@/dev/scenarios/helpers";
import { getDevScenario } from "@/dev/scenarios/registry";
import type { DevScenarioContext, DevScenarioId } from "@/dev/scenarios/types";
import { executeAction } from "@/lib/actions";
import { queryClient } from "@/lib/query/query-client";
import { useUiStore } from "@/stores/ui-store";

type RunDevScenarioOptions = {
  context?: DevScenarioContext;
};

function createDefaultDevScenarioContext(): DevScenarioContext {
  return {
    ui: useUiStore.getState(),
    queryClient,
    actions: {
      executeAction,
      listAccounts: async () => listAccounts().then(Result.unwrap()),
      listFeeds: async (accountId: string) => listFeeds(accountId).then(Result.unwrap()),
      listArticles: async (feedId: string, offset?: number, limit?: number) =>
        listArticles(feedId, offset, limit).then(Result.unwrap()),
      listTags: async () => listTags().then(Result.unwrap()),
      getTagArticleCounts: async (accountId?: string) => getTagArticleCounts(accountId).then(Result.unwrap()),
      listArticlesByTag: async (
        tagId: string,
        offset?: number,
        limit?: number,
        accountId?: string,
        mode?: "all" | "unread" | "starred",
      ) => listArticlesByTag(tagId, offset, limit, accountId, mode).then(Result.unwrap()),
    },
  };
}

export async function runDevScenario(id: DevScenarioId, options?: RunDevScenarioOptions): Promise<void> {
  const context = options?.context ?? createDefaultDevScenarioContext();
  const scenario = getDevScenario(id);
  if (!scenario) {
    context.ui.showToast(`Unknown dev scenario "${id}".`);
    return;
  }

  cancelOpenWebPreviewUrlScenarioReplay();
  await scenario.run(context);
}
