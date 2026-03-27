import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [title, setTitle] = useState(feed.title);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, feed.title]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === feed.title) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    Result.pipe(
      await renameFeed(feed.id, trimmed),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        onOpenChange(false);
      }),
      Result.inspectError((e) => showToast(`Failed to rename: ${e.message}`)),
    );
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Feed</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <label className="mb-1 block text-sm text-muted-foreground">
            Title
            <input
              ref={inputRef}
              name="feed-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            />
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
