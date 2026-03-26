import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "../api/tauri-commands";

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: listAccounts });
}
