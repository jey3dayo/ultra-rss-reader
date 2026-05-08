import { Result } from "@praha/byethrow";
import { copyToClipboard } from "@/api/tauri-commands";

type CopyValueToClipboardCallbacks = {
  onSuccess: () => void;
  onError: (message: string, error: { message: string }) => void;
};

export async function copyValueToClipboard(
  value: string,
  { onSuccess, onError }: CopyValueToClipboardCallbacks,
): Promise<void> {
  if (!value) {
    return;
  }

  Result.pipe(
    await copyToClipboard(value),
    Result.inspect(onSuccess),
    Result.inspectError((error) => {
      onError(error.message, error);
    }),
  );
}
