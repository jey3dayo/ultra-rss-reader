import { importOpml, listFeeds } from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { createQuery } from "@/hooks/create-query";
import { invalidateOpmlImportQueries, queryKeys } from "@/lib/query/query-invalidation";

export const useFeeds = createQuery(queryKeys.feeds.root, listFeeds);

type ImportOpmlArgs = {
  accountId: string;
  opmlContent: string;
};

export const useImportOpml = createMutation(
  ({ accountId, opmlContent }: ImportOpmlArgs) => importOpml(accountId, opmlContent),
  (queryClient) => {
    invalidateOpmlImportQueries(queryClient);
  },
);
