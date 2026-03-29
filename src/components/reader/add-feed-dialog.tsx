import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addLocalFeed,
  createFolder,
  type DiscoveredFeedDto,
  discoverFeeds,
  updateFeedFolder,
} from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFolders } from "@/hooks/use-folders";
import { useUiStore } from "@/stores/ui-store";

const NEW_FOLDER_VALUE = "__new__";

export function AddFeedDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const [url, setUrl] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeedDto[]>([]);
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const { data: folders } = useFolders(accountId);

  useEffect(() => {
    if (open) {
      setUrl("");
      setSelectedFolderId(null);
      setNewFolderName("");
      setIsCreatingFolder(false);
      setError(null);
      setSuccessMessage(null);
      setLoading(false);
      setDiscovering(false);
      setDiscoveredFeeds([]);
      setSelectedFeedUrl(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (isCreatingFolder) {
      requestAnimationFrame(() => newFolderInputRef.current?.focus());
    }
  }, [isCreatingFolder]);

  const handleFolderChange = (value: string) => {
    if (value === NEW_FOLDER_VALUE) {
      setIsCreatingFolder(true);
      setSelectedFolderId(null);
    } else {
      setIsCreatingFolder(false);
      setNewFolderName("");
      setSelectedFolderId(value || null);
    }
  };

  const handleDiscover = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setDiscovering(true);
    setError(null);
    setSuccessMessage(null);
    setDiscoveredFeeds([]);
    setSelectedFeedUrl(null);

    Result.pipe(
      await discoverFeeds(trimmed),
      Result.inspect((feeds) => {
        if (feeds.length === 0) {
          setDiscoveredFeeds([]);
          setSelectedFeedUrl(null);
          setSuccessMessage(t("feed_url_ready"));
        } else if (feeds.length === 1) {
          setDiscoveredFeeds(feeds[0].title ? feeds : []);
          setSelectedFeedUrl(feeds[0].url);
          setSuccessMessage(t("feed_detected"));
        } else {
          setDiscoveredFeeds(feeds);
          setSelectedFeedUrl(feeds[0].url);
        }
      }),
      Result.inspectError((e) => {
        setError(t("discovery_failed", { message: e.message }));
      }),
    );
    setDiscovering(false);
  };

  const getFeedUrl = (): string => {
    return selectedFeedUrl ?? url.trim();
  };

  const handleSubmit = async () => {
    const feedUrl = getFeedUrl();
    if (!feedUrl) return;
    setLoading(true);
    setError(null);

    let folderId: string | null = selectedFolderId;
    let hasError = false;

    if (isCreatingFolder && newFolderName.trim()) {
      Result.pipe(
        await createFolder(accountId, newFolderName.trim()),
        Result.inspect((folder) => {
          folderId = folder.id;
        }),
        Result.inspectError((e) => {
          hasError = true;
          setError(t("failed_to_create_folder", { message: e.message }));
          showToast(t("failed_to_create_folder", { message: e.message }));
        }),
      );
      if (hasError) {
        setLoading(false);
        return;
      }
    }

    let feedId: string | null = null;

    Result.pipe(
      await addLocalFeed(accountId, feedUrl),
      Result.inspect((feed) => {
        feedId = feed.id;
      }),
      Result.inspectError((e) => {
        hasError = true;
        setError(t("failed_to_add_feed", { message: e.message }));
      }),
    );

    if (hasError) {
      setLoading(false);
      return;
    }

    if (folderId && feedId) {
      Result.pipe(
        await updateFeedFolder(feedId, folderId),
        Result.inspectError((e) => {
          console.error("Failed to assign folder:", e);
          showToast(t("feed_added_folder_failed", { message: e.message }));
        }),
      );
    }

    qc.invalidateQueries({ queryKey: ["feeds"] });
    qc.invalidateQueries({ queryKey: ["folders"] });
    onOpenChange(false);
    setLoading(false);
  };

  const selectClassName =
    "mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const inputClassName =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  const isSubmitDisabled =
    (!url.trim() && !selectedFeedUrl) || loading || discovering || (isCreatingFolder && !newFolderName.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add_feed")}</DialogTitle>
          <DialogDescription>{t("add_feed_description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              name="feed-url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setDiscoveredFeeds([]);
                setSelectedFeedUrl(null);
              }}
              placeholder={t("feed_or_site_url")}
              className={inputClassName}
              disabled={loading || discovering}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscover}
              disabled={!url.trim() || loading || discovering}
              className="shrink-0"
            >
              {discovering ? t("discovering") : t("discover")}
            </Button>
          </div>

          {discoveredFeeds.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("feeds_found", { count: discoveredFeeds.length })}</p>
              <div className="max-h-32 overflow-y-auto rounded-md border border-input">
                {discoveredFeeds.map((feed) => (
                  <label
                    key={feed.url}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${
                      selectedFeedUrl === feed.url ? "bg-accent" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="discovered-feed"
                      value={feed.url}
                      checked={selectedFeedUrl === feed.url}
                      onChange={() => setSelectedFeedUrl(feed.url)}
                      className="accent-primary"
                    />
                    <span className="truncate">{feed.title || feed.url}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block text-sm text-muted-foreground">
            {t("folder")}
            <select
              name="feed-folder"
              value={isCreatingFolder ? NEW_FOLDER_VALUE : (selectedFolderId ?? "")}
              onChange={(e) => handleFolderChange(e.target.value)}
              className={selectClassName}
              disabled={loading}
            >
              <option value="">{t("no_folder")}</option>
              {folders?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value={NEW_FOLDER_VALUE}>{t("new_folder")}</option>
            </select>
          </label>

          {isCreatingFolder && (
            <label className="block text-sm text-muted-foreground">
              {t("folder_name")}
              <input
                ref={newFolderInputRef}
                name="new-folder-name"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t("enter_folder_name")}
                className={`mt-1 ${inputClassName}`}
                disabled={loading}
              />
            </label>
          )}

          {successMessage && !error && <p className="mt-2 text-sm text-green-400">{successMessage}</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {loading ? t("adding") : tc("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
