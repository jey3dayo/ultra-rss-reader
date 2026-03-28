import { listFolders } from "@/api/tauri-commands";
import { createQuery } from "@/hooks/create-query";

export const useFolders = createQuery("folders", listFolders);
