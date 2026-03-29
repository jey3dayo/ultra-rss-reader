import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addLocalFeed,
  createFolder,
  type DiscoveredFeedDto,
  discoverFeeds,
  updateFeedFolder,
} from "@/api/tauri-commands";
import { useFolders } from "@/hooks/use-folders";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialogView } from "./add-feed-dialog-view";

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
  const folderLabelId = useId();
  const folderOptions = [
    { value: "", label: t("no_folder") },
    ...((folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })) ?? []),
    { value: NEW_FOLDER_VALUE, label: t("new_folder") },
  ];

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

  const isSubmitDisabled =
    (!url.trim() && !selectedFeedUrl) || loading || discovering || (isCreatingFolder && !newFolderName.trim());

  const discoveredFeedOptions = discoveredFeeds.map((feed) => ({
    value: feed.url,
    label: feed.title || feed.url,
  }));

  return (
    <AddFeedDialogView
      open={open}
      onOpenChange={onOpenChange}
      url={url}
      onUrlChange={(nextUrl) => {
        setUrl(nextUrl);
        setDiscoveredFeeds([]);
        setSelectedFeedUrl(null);
      }}
      onDiscover={handleDiscover}
      discovering={discovering}
      loading={loading}
      discoveredFeedsFoundLabel={
        discoveredFeeds.length > 0 ? t("feeds_found", { count: discoveredFeeds.length }) : null
      }
      discoveredFeedOptions={discoveredFeedOptions}
      selectedFeedUrl={selectedFeedUrl ?? ""}
      onSelectedFeedUrlChange={setSelectedFeedUrl}
      folderSelectProps={{
        labelId: folderLabelId,
        label: t("folder"),
        value: isCreatingFolder ? NEW_FOLDER_VALUE : (selectedFolderId ?? ""),
        options: folderOptions,
        disabled: loading,
        isCreatingFolder,
        newFolderLabel: t("folder_name"),
        newFolderName,
        newFolderPlaceholder: t("enter_folder_name"),
        onValueChange: handleFolderChange,
        onNewFolderNameChange: setNewFolderName,
        newFolderInputRef,
      }}
      error={error}
      successMessage={successMessage}
      isSubmitDisabled={isSubmitDisabled}
      labels={{
        title: t("add_feed"),
        description: t("add_feed_description"),
        urlPlaceholder: t("feed_or_site_url"),
        discover: t("discover"),
        discovering: t("discovering"),
        cancel: tc("cancel"),
        add: tc("add"),
        adding: t("adding"),
      }}
      inputRef={inputRef}
      onSubmit={handleSubmit}
    />
  );
}
