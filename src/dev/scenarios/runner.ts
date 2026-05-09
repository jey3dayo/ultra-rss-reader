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

function toDevScenarioActionError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Dev scenario action "${action}" failed: ${message}`);
}

async function unwrapDevScenarioAction<T>(
  action: string,
  resultPromise: Promise<Result.Result<T, unknown>>,
): Promise<T> {
  const result = await resultPromise;
  if (Result.isFailure(result)) {
    throw toDevScenarioActionError(action, result.error);
  }

  return result.value;
}

function createDefaultDevScenarioContext(): DevScenarioContext {
  return {
    ui: useUiStore.getState(),
    queryClient,
    actions: {
      executeAction,
      listAccounts: () => unwrapDevScenarioAction("listAccounts", listAccounts()),
      listFeeds: (accountId: string) => unwrapDevScenarioAction("listFeeds", listFeeds(accountId)),
      listArticles: async (feedId: string, offset?: number, limit?: number) =>
        unwrapDevScenarioAction("listArticles", listArticles(feedId, offset, limit)),
      listTags: () => unwrapDevScenarioAction("listTags", listTags()),
      getTagArticleCounts: (accountId?: string) =>
        unwrapDevScenarioAction("getTagArticleCounts", getTagArticleCounts(accountId)),
      listArticlesByTag: async (
        tagId: string,
        offset?: number,
        limit?: number,
        accountId?: string,
        mode?: "all" | "unread" | "starred",
      ) => unwrapDevScenarioAction("listArticlesByTag", listArticlesByTag(tagId, offset, limit, accountId, mode)),
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
