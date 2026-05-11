import { listFolders } from "@/api/tauri-commands";
import { createQuery } from "@/hooks/create-query";
import { queryKeys } from "@/lib/query/query-invalidation";

export const useFolders = createQuery(queryKeys.folders.root, listFolders);
