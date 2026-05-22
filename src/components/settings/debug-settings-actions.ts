import { Result } from "@praha/byethrow";
import { resetOversizedDevCredentialsStore } from "@/api/tauri-commands";

export async function resetDevCredentialsStore(): Promise<boolean> {
  return Result.unwrap(await resetOversizedDevCredentialsStore());
}
