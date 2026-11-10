import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FolderDto } from "@/api/tauri-commands";
import { EditNameDialogView } from "@/design-system";
import { normalizeRenameInput } from "@/hooks/normalize-rename-input";
import { useRenameFolder } from "@/hooks/use-folders";
import { getErrorMessage } from "@/lib/ui/errors";

type RenameFolderDialogProps = {
  folder: FolderDto;
  onClose: () => void;
};

export function RenameFolderDialog({ folder, onClose }: RenameFolderDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const renameFolder = useRenameFolder();
  const normalizedName = normalizeRenameInput(name);

  const submit = () => {
    if (inFlight.current || !normalizedName || normalizedName === folder.name) return;
    inFlight.current = true;
    setError(null);
    renameFolder.mutate(
      { folderId: folder.id, name: normalizedName },
      {
        onSuccess: onClose,
        onError: (failure) => setError(t("failed_to_rename_folder", { message: getErrorMessage(failure) })),
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };

  return (
    <EditNameDialogView
      open
      title={t("edit_folder")}
      nameLabel={t("name")}
      inputName="folder-name"
      name={name}
      loading={renameFolder.isPending}
      cancelLabel={tc("cancel")}
      submitLabel={tc("save")}
      submittingLabel={tc("saving")}
      submitDisabled={normalizedName === folder.name}
      errorMessage={error}
      onOpenChange={(open) => {
        if (!open && !inFlight.current) onClose();
      }}
      onNameChange={(value) => {
        setName(value);
        setError(null);
      }}
      onSubmit={submit}
    />
  );
}
