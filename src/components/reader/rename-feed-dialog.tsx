import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed, updateFeedDisplayMode, updateFeedFolder } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFolders } from "@/hooks/use-folders";
import { useUiStore } from "@/stores/ui-store";

export function RenameDialog({
  feed,
  open,
  onOpenChange,
}: {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const [title, setTitle] = useState(feed.title);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(feed.folder_id);
  const [displayMode, setDisplayMode] = useState(feed.display_mode ?? "normal");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const { data: folders } = useFolders(feed.account_id);

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      setSelectedFolderId(feed.folder_id);
      setDisplayMode(feed.display_mode ?? "normal");
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, feed.title, feed.folder_id, feed.display_mode]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      onOpenChange(false);
      return;
    }
    setLoading(true);

    if (trimmed !== feed.title) {
      Result.pipe(
        await renameFeed(feed.id, trimmed),
        Result.inspectError((e) => showToast(t("failed_to_rename", { message: e.message }))),
      );
    }

    if (selectedFolderId !== feed.folder_id) {
      Result.pipe(
        await updateFeedFolder(feed.id, selectedFolderId),
        Result.inspectError((e) => showToast(t("failed_to_update_folder", { message: e.message }))),
      );
    }

    if (displayMode !== (feed.display_mode ?? "normal")) {
      Result.pipe(
        await updateFeedDisplayMode(feed.id, displayMode),
        Result.inspectError((e) => showToast(t("failed_to_update_display_mode", { message: e.message }))),
      );
    }

    qc.invalidateQueries({ queryKey: ["feeds"] });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit_feed")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <label className="block text-sm text-muted-foreground">
            {t("title")}
            <Input
              ref={inputRef}
              name="feed-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
              disabled={loading}
            />
          </label>

          <div className="block text-sm text-muted-foreground">
            <span className="mb-1 block">{t("display_mode")}</span>
            <Select
              name="feed-display-mode"
              value={displayMode}
              onValueChange={(v) => setDisplayMode(v ?? "normal")}
              disabled={loading}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="normal">{t("display_mode_normal")}</SelectItem>
                <SelectItem value="widescreen">{t("display_mode_widescreen")}</SelectItem>
              </SelectPopup>
            </Select>
          </div>

          {folders && folders.length > 0 && (
            <div className="block text-sm text-muted-foreground">
              <span className="mb-1 block">{t("folder")}</span>
              <Select
                name="feed-folder"
                value={selectedFolderId ?? ""}
                onValueChange={(v) => setSelectedFolderId(v || null)}
                disabled={loading}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="">{t("no_folder")}</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || loading}>
            {loading ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
