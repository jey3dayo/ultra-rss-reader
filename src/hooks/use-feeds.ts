import { listFeeds } from "@/api/tauri-commands";
import { createQuery } from "@/hooks/create-query";
import { queryKeys } from "@/lib/query/query-invalidation";

export const useFeeds = createQuery(queryKeys.feeds.root[0], listFeeds);
