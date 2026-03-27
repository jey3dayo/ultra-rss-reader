import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { listFolders } from "../api/tauri-commands";

export function useFolders(accountId: string | null) {
  return useQuery({
    queryKey: ["folders", accountId],
    queryFn: () => listFolders(accountId as string).then(Result.unwrap()),
    enabled: !!accountId,
  });
}
