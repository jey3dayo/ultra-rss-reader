import { Result } from "@praha/byethrow";
import { type KeyboardEvent, useRef, useState } from "react";
import { renameAccount } from "@/api/tauri-commands";
import type { UseAccountDetailNameEditorParams, UseAccountDetailNameEditorResult } from "./account-detail.types";
import { updateCachedAccount } from "./account-detail-query-cache";
import { createAccountDetailErrorToast } from "./account-detail-toast";

export function useAccountDetailNameEditor({
  account,
  queryClient,
  t,
}: UseAccountDetailNameEditorParams): UseAccountDetailNameEditorResult {
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const showRenameError = createAccountDetailErrorToast(t, "account.failed_to_rename");

  const startEditingName = () => {
    setNameDraft(account.name);
    setEditingName(true);
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  };

  const commitRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account.name) {
      setNameDraft(account.name);
      setEditingName(false);
      return;
    }

    setSavingName(true);
    let renameSucceeded = false;
    Result.pipe(
      await renameAccount(account.id, trimmed),
      Result.inspectError(showRenameError),
      Result.inspect((updated) => {
        renameSucceeded = true;
        setNameDraft(updated.name);
        updateCachedAccount(queryClient, updated);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }),
    );
    setSavingName(false);
    if (renameSucceeded) {
      setEditingName(false);
    }
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
    } else if (event.key === "Escape") {
      setEditingName(false);
    }
  };

  return {
    editingName,
    savingName,
    nameDraft,
    setNameDraft,
    nameInputRef,
    startEditingName,
    commitRename,
    handleNameKeyDown,
  };
}
