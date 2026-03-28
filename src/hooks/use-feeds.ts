import { listFeeds } from "@/api/tauri-commands";
import { createQuery } from "@/hooks/create-query";

export const useFeeds = createQuery("feeds", listFeeds);
