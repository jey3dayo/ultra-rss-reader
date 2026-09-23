import { save } from "@tauri-apps/plugin-dialog";

type SaveDialogFilter = {
  name: string;
  extensions: string[];
};

export type ShowSaveDialogOptions = {
  defaultPath?: string;
  filters?: SaveDialogFilter[];
};

export async function showSaveDialog(options: ShowSaveDialogOptions): Promise<string | null> {
  return save(options);
}
