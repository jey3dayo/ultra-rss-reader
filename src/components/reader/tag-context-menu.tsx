import { ContextMenu } from "@base-ui/react/context-menu";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";

function RenameTagDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: TagDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(tag.name);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();

  useEffect(() => {
    if (open) {
      setName(tag.name);
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, tag.name]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    renameTag.mutate(
      { tagId: tag.id, name: trimmed },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          showToast(t("failed_to_rename_tag", { message }));
          setLoading(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rename_tag")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <label className="block text-sm text-muted-foreground">
            {t("name")}
            <input
              ref={inputRef}
              name="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            />
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTagDialog({
  tag,
  open,
  onOpenChange,
}: {
  tag: TagDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const showToast = useUiStore((s) => s.showToast);
  const deleteTagMutation = useDeleteTag();

  const handleConfirm = () => {
    deleteTagMutation.mutate(
      { tagId: tag.id },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          showToast(t("failed_to_delete_tag", { message }));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("delete_tag")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="confirm_delete_tag" ns="reader" values={{ name: tag.name }}>
            Are you sure you want to delete <strong>{{ name: tag.name } as never}</strong>? This tag will be removed
            from all articles.
          </Trans>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            {tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TagContextMenuContent({ tag }: { tag: TagDto }) {
  const { t } = useTranslation("reader");
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowRenameDialog(true)}>
              {t("rename_ellipsis")}
            </ContextMenu.Item>
            <ContextMenu.Separator className={contextMenuStyles.separator} />
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowDeleteDialog(true)}>
              {t("delete_ellipsis")}
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>

      <RenameTagDialog tag={tag} open={showRenameDialog} onOpenChange={setShowRenameDialog} />
      <DeleteTagDialog tag={tag} open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </>
  );
}
