import { ContextMenu } from "@base-ui/react/context-menu";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDeleteTag, useRenameTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";

const TAG_COLOR_PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

function EditTagDialog({
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
  const [color, setColor] = useState<string | null>(tag.color);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showToast = useUiStore((s) => s.showToast);
  const renameTag = useRenameTag();

  useEffect(() => {
    if (open) {
      setName(tag.name);
      setColor(tag.color);
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, tag.name, tag.color]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      onOpenChange(false);
      return;
    }
    const nameChanged = trimmed !== tag.name;
    const colorChanged = color !== tag.color;
    if (!nameChanged && !colorChanged) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    renameTag.mutate(
      { tagId: tag.id, name: trimmed, color },
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
          <DialogTitle>{t("edit_tag")}</DialogTitle>
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
            <Input
              ref={inputRef}
              name="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              disabled={loading}
            />
          </label>
          <div className="space-y-1.5">
            <span className="block text-sm text-muted-foreground">{t("color")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                title={t("no_color")}
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-[box-shadow]",
                  color === null
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-muted-foreground/30 hover:border-muted-foreground/60",
                )}
                onClick={() => setColor(null)}
              >
                <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">✕</span>
              </button>
              {TAG_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-[box-shadow]",
                    color === c
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-muted-foreground/40",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
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
              {t("edit_ellipsis")}
            </ContextMenu.Item>
            <ContextMenu.Separator className={contextMenuStyles.separator} />
            <ContextMenu.Item className={contextMenuStyles.item} onClick={() => setShowDeleteDialog(true)}>
              {t("delete_ellipsis")}
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>

      <EditTagDialog tag={tag} open={showRenameDialog} onOpenChange={setShowRenameDialog} />
      <DeleteTagDialog tag={tag} open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </>
  );
}
