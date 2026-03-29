import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, Copy, ExternalLink, Globe, Mail, Plus, Share, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser, updateFeedDisplayMode } from "@/api/tauri-commands";
import { DisplayModeToggleGroup, type ReaderDisplayMode } from "@/components/reader/display-mode-toggle-group";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useAccountArticles, useArticles, useSetRead, useToggleStar } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import {
  useArticlesByTag,
  useArticleTags,
  useCreateTag,
  useTagArticle,
  useTags,
  useUntagArticle,
} from "@/hooks/use-tags";
import {
  findSelectedArticle,
  formatArticleDate,
  resolveSelectedFeedDisplayMode,
  shouldOpenExternalBrowser,
} from "@/lib/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { isWindowFullscreen, setWindowFullscreen } from "@/lib/windows";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { BrowserView } from "./browser-view";
import { contextMenuStyles } from "./context-menu-styles";

function ArticleToolbar({
  article,
  feedId,
  feedDisplayMode,
}: {
  article: ArticleDto | null;
  feedId: string | null;
  feedDisplayMode: string;
}) {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const setFocusedPane = useUiStore((s) => s.setFocusedPane);
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const qc = useQueryClient();
  const actionCopyLink = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_copy_link"));
  const actionOpenBrowser = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_open_browser"));
  const actionShare = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share"));
  const actionShareMenu = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share_menu"));
  const showSidebarButton = layoutMode !== "wide";
  const isWidescreen = feedDisplayMode === "widescreen";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isWindowFullscreen().then((result) =>
      Result.pipe(
        result,
        Result.inspect((fullscreen) => {
          if (!cancelled) {
            setIsFullscreen(fullscreen);
          }
        }),
      ),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const currentDisplayMode: ReaderDisplayMode = isFullscreen ? "fullscreen" : isWidescreen ? "widescreen" : "normal";

  const handleSetDisplayMode = async (nextMode: ReaderDisplayMode) => {
    if (!feedId) return;
    const nextFeedDisplayMode = nextMode === "normal" ? "normal" : "widescreen";
    Result.pipe(
      await updateFeedDisplayMode(feedId, nextFeedDisplayMode),
      Result.inspect(async () => {
        void qc.invalidateQueries({ queryKey: ["feeds"] });
        Result.pipe(
          await setWindowFullscreen(nextMode === "fullscreen"),
          Result.inspect(() => setIsFullscreen(nextMode === "fullscreen")),
        );
        if (nextMode !== "normal" && article?.url) {
          openBrowser(article.url);
        }
        if (nextMode === "normal") {
          closeBrowser();
        }
      }),
      Result.inspectError((e) => showToast(t("failed_to_update_display_mode", { message: e.message }))),
    );
  };

  return (
    <div data-tauri-drag-region className="flex h-12 items-center justify-between border-b border-border px-4">
      <div>
        {showSidebarButton && (
          <TooltipProvider>
            <AppTooltip
              label={t("show_sidebar")}
              children={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFocusedPane("sidebar")}
                  className="text-muted-foreground"
                  aria-label={t("show_sidebar")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              }
            />
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <AppTooltip
            label={t("toggle_read")}
            children={
              <Toggle
                pressed={article?.is_read ?? false}
                onPressedChange={(pressed) => {
                  if (!article) return;
                  setRead.mutate(
                    { id: article.id, read: pressed },
                    {
                      onSuccess: () => {
                        if (pressed) addRecentlyRead(article.id);
                      },
                    },
                  );
                }}
                disabled={!article}
                aria-label={t("toggle_read")}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
              >
                <UnreadIcon unread={!article?.is_read} className="h-3 w-3" />
              </Toggle>
            }
          />
          <AppTooltip
            label={t("toggle_star")}
            children={
              <Toggle
                pressed={article?.is_starred ?? false}
                onPressedChange={(pressed) => {
                  if (!article) return;
                  toggleStar.mutate(
                    { id: article.id, starred: pressed },
                    { onSuccess: () => showToast(pressed ? t("article_starred") : t("article_unstarred")) },
                  );
                }}
                disabled={!article}
                aria-label={t("toggle_star")}
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
              >
                <StarIcon starred={article?.is_starred ?? false} className="h-4 w-4" />
              </Toggle>
            }
          />
          <DisplayModeToggleGroup
            value={currentDisplayMode}
            onValueChange={handleSetDisplayMode}
            disabled={!feedId || !article?.url}
          />
          {actionCopyLink === "true" && (
            <AppTooltip
              label={t("copy_link")}
              children={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (article?.url) {
                      navigator.clipboard.writeText(article.url);
                      showToast(t("link_copied"));
                    }
                  }}
                  className="text-muted-foreground"
                  disabled={!article?.url}
                  aria-label={t("copy_link")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              }
            />
          )}
          {actionOpenBrowser === "true" && (
            <AppTooltip
              label={t("view_in_browser")}
              children={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => article?.url && openBrowser(article.url)}
                  className="text-muted-foreground"
                  disabled={!article?.url}
                  aria-label={t("view_in_browser")}
                >
                  <Globe className="h-4 w-4" />
                </Button>
              }
            />
          )}
          {actionShare === "true" && (
            <AppTooltip
              label={t("open_in_external_browser")}
              children={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (article?.url) {
                      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
                      Result.pipe(
                        await openInBrowser(article.url, bg),
                        Result.inspectError((e) => console.error("Failed to open in browser:", e)),
                      );
                    }
                  }}
                  className="text-muted-foreground"
                  disabled={!article?.url}
                  aria-label={t("open_in_external_browser")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              }
            />
          )}
          {actionShareMenu === "true" && (
            <Menu.Root>
              <AppTooltip
                label={t("share")}
                children={
                  <Menu.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        disabled={!article?.url}
                        aria-label={t("share")}
                      />
                    }
                  >
                    <Share className="h-4 w-4" />
                  </Menu.Trigger>
                }
              />
              <Menu.Portal>
                <Menu.Positioner sideOffset={4}>
                  <Menu.Popup className={contextMenuStyles.popup}>
                    <Menu.Item
                      className={contextMenuStyles.item}
                      onSelect={async () => {
                        if (!article?.url) return;
                        Result.pipe(
                          await copyToClipboard(article.url),
                          Result.inspect(() => showToast(t("link_copied"))),
                          Result.inspectError((e) => {
                            console.error("Copy failed:", e);
                            showToast(e.message);
                          }),
                        );
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {t("copy_link")}
                    </Menu.Item>
                    <Menu.Item
                      className={contextMenuStyles.item}
                      onSelect={async () => {
                        if (!article?.url) return;
                        Result.pipe(
                          await addToReadingList(article.url),
                          Result.inspect(() => showToast(t("added_to_reading_list"))),
                          Result.inspectError((e) => {
                            console.error("Add to reading list failed:", e);
                            showToast(e.message);
                          }),
                        );
                      }}
                    >
                      <BookmarkPlus className="mr-2 h-4 w-4" />
                      {t("add_to_reading_list")}
                    </Menu.Item>
                    <Menu.Separator className={contextMenuStyles.separator} />
                    <Menu.Item
                      className={contextMenuStyles.item}
                      onSelect={async () => {
                        if (!article?.url) return;
                        const mailto = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(article.url)}`;
                        Result.pipe(
                          await openInBrowser(mailto, false),
                          Result.inspectError((e) => console.error("Failed to open email client:", e)),
                        );
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {t("share_via_email")}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={null} feedId={null} feedDisplayMode="normal" />
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("select_article_to_read")}</p>
      </div>
    </div>
  );
}

function ArticleTagChips({ articleId }: { articleId: string }) {
  const { t } = useTranslation("reader");
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const tagOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pickerId = useId();

  const closePicker = useCallback((restoreFocus = false) => {
    setShowPicker(false);
    if (restoreFocus) {
      requestAnimationFrame(() => pickerTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker, closePicker]);

  const assignedTagIds = new Set(articleTags?.map((tag) => tag.id) ?? []);
  const unassignedTags = (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id));

  useEffect(() => {
    if (!showPicker) return;

    requestAnimationFrame(() => {
      if (unassignedTags.length > 0) {
        tagOptionRefs.current[0]?.focus();
        return;
      }
      newTagInputRef.current?.focus();
    });
  }, [showPicker, unassignedTags.length]);

  const handleCreateAndAssign = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          tagArticleMutation.mutate({ articleId, tagId: tag.id });
          setNewTagName("");
          closePicker();
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {articleTags?.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {tag.color && (
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
          <button
            type="button"
            onClick={() => untagArticleMutation.mutate({ articleId, tagId: tag.id })}
            className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("remove_tag", { name: tag.name })}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div ref={pickerRef} className="relative">
        <button
          ref={pickerTriggerRef}
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !showPicker) {
              e.preventDefault();
              e.stopPropagation();
              setShowPicker(true);
            }
            if (e.key === "Escape" && showPicker) {
              e.preventDefault();
              e.stopPropagation();
              closePicker(true);
            }
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-muted-foreground text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          aria-label={t("add_tag")}
          aria-haspopup="listbox"
          aria-expanded={showPicker}
          aria-controls={pickerId}
        >
          <Plus className="h-3 w-3" />
        </button>
        {showPicker && (
          <div
            id={pickerId}
            role="listbox"
            aria-label={t("available_tags")}
            className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg"
            onKeyDown={(e) => {
              const currentIndex = tagOptionRefs.current.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closePicker(true);
              }
              if (e.key === "ArrowDown" && unassignedTags.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                tagOptionRefs.current[nextIndex % unassignedTags.length]?.focus();
              }
              if (e.key === "ArrowUp" && unassignedTags.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                const nextIndex = currentIndex >= 0 ? currentIndex - 1 : unassignedTags.length - 1;
                tagOptionRefs.current[(nextIndex + unassignedTags.length) % unassignedTags.length]?.focus();
              }
            }}
          >
            {unassignedTags.map((tag, index) => (
              <button
                type="button"
                key={tag.id}
                ref={(element) => {
                  tagOptionRefs.current[index] = element;
                }}
                role="option"
                aria-selected="false"
                onClick={() => {
                  tagArticleMutation.mutate({ articleId, tagId: tag.id });
                  closePicker();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
              >
                {tag.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </button>
            ))}
            <div className="flex items-center gap-1 border-t border-border px-2 pt-1">
              <Input
                ref={newTagInputRef}
                name="new-tag"
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    handleCreateAndAssign();
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    closePicker(true);
                  }
                }}
                placeholder={t("new_tag_placeholder")}
                className="h-auto flex-1 rounded border-none bg-transparent px-1 py-1 text-xs shadow-none ring-0 focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCreateAndAssign}
                disabled={!newTagName.trim()}
                className="h-5 w-5 text-muted-foreground"
                aria-label={t("create_tag")}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleReader({
  article,
  feedName,
  feedDisplayMode,
}: {
  article: ArticleDto;
  feedName?: string;
  feedDisplayMode: string;
}) {
  const afterReading = usePreferencesStore((s) => s.prefs.after_reading ?? "mark_as_read");
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const openBrowserView = useUiStore((s) => s.openBrowser);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const articleUrl = article.url;

  // Auto mark as read only when a new article is opened (article.id changes).
  // Must NOT depend on article.is_read — otherwise manually marking unread
  // re-triggers this effect and immediately marks it read again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger only on article.id change
  useEffect(() => {
    if (afterReading === "mark_as_read" && article && !article.is_read) {
      setRead.mutate({ id: article.id, read: true }, { onSuccess: () => addRecentlyRead(article.id) });
    }
  }, [afterReading, article?.id]);

  useEffect(() => {
    const handleToggleRead = () => {
      const markingAsRead = !article.is_read;
      setRead.mutate(
        { id: article.id, read: markingAsRead },
        {
          onSuccess: () => {
            if (markingAsRead) addRecentlyRead(article.id);
          },
        },
      );
    };
    const handleToggleStar = () => {
      toggleStar.mutate({ id: article.id, starred: !article.is_starred });
    };
    const handleOpenInAppBrowser = () => {
      if (article.url) {
        openBrowserView(article.url);
      }
    };
    const handleOpenExternalBrowser = () => {
      if (!article.url) return;
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(article.url, bg).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => console.error("Failed to open in browser:", e)),
        ),
      );
    };
    const handleCopyLink = () => {
      if (!article.url) return;
      const showToast = useUiStore.getState().showToast;
      void copyToClipboard(article.url).then((result) =>
        Result.pipe(
          result,
          Result.inspect(() => showToast("Link copied")),
          Result.inspectError((e) => {
            console.error("Copy failed:", e);
            showToast(e.message);
          }),
        ),
      );
    };
    const handleAddToReadingList = () => {
      if (!article.url) return;
      const showToast = useUiStore.getState().showToast;
      void addToReadingList(article.url).then((result) =>
        Result.pipe(
          result,
          Result.inspect(() => showToast("Added to Reading List")),
          Result.inspectError((e) => {
            console.error("Add to reading list failed:", e);
            showToast(e.message);
          }),
        ),
      );
    };

    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openInAppBrowser, handleOpenInAppBrowser);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    return () => {
      window.removeEventListener(keyboardEvents.toggleRead, handleToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, handleToggleStar);
      window.removeEventListener(keyboardEvents.openInAppBrowser, handleOpenInAppBrowser);
      window.removeEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, handleCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    };
  }, [
    article.id,
    article.is_read,
    article.is_starred,
    article.url,
    openBrowserView,
    setRead,
    toggleStar,
    addRecentlyRead,
  ]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor?.href) return;
    e.preventDefault();

    const useExternal = shouldOpenExternalBrowser({
      openLinks,
      cmdClickBrowser,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
    });
    if (useExternal) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(anchor.href, bg);
    } else {
      openBrowserView(anchor.href);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={article} feedId={article.feed_id} feedDisplayMode={feedDisplayMode} />
      <ScrollArea className="flex-1">
        <article className="mx-auto max-w-3xl px-8 py-8">
          <div className="mb-4">
            <p className="mb-2 text-xs tracking-wider text-muted-foreground">
              {formatArticleDate(article.published_at)}
            </p>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground">
              {articleUrl ? (
                <button
                  type="button"
                  className="-mx-4 block w-[calc(100%+2rem)] rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => openBrowserView(articleUrl)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
                      void openInBrowser(articleUrl, bg);
                    }
                  }}
                >
                  {article.title}
                </button>
              ) : (
                article.title
              )}
            </h1>
            {(article.author || feedName) && (
              <div className="text-sm text-muted-foreground">
                {article.author && <p className="uppercase tracking-wide">{article.author}</p>}
                {feedName && (
                  <button
                    type="button"
                    className="cursor-pointer text-xs hover:underline"
                    onClick={() => selectFeed(article.feed_id)}
                  >
                    {feedName}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-8">
            <ArticleTagChips articleId={article.id} />
          </div>

          {/* Featured Image */}
          {article.thumbnail && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
              <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Content */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: click handler intercepts anchor navigation in sanitized HTML */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click handler intercepts anchor navigation in sanitized HTML */}
          <div
            className="prose prose-invert max-w-none text-base leading-relaxed text-foreground/90"
            onClick={handleContentClick}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
            dangerouslySetInnerHTML={{ __html: article.content_sanitized }}
          />
        </article>
      </ScrollArea>
    </div>
  );
}

export function ArticleView() {
  const contentMode = useUiStore((s) => s.contentMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const readerViewPref = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "reader_view"));
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId);
  const { data: feeds } = useFeeds(selectedAccountId);

  const selectedFeedDisplayMode = resolveSelectedFeedDisplayMode({
    selectedArticleId,
    selectionFeedId: feedId,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
    feeds,
  });

  // When reader_view is "on" or feed is widescreen, auto-open article URL in browser view
  const prevArticleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedArticleId) {
      prevArticleIdRef.current = null;
      return;
    }

    const shouldAutoOpen =
      readerViewPref === "widescreen" || readerViewPref === "fullscreen" || selectedFeedDisplayMode === "widescreen";
    if (!shouldAutoOpen || selectedArticleId === prevArticleIdRef.current || contentMode !== "reader") {
      return;
    }

    const articleResult = findSelectedArticle({
      selectedArticleId,
      feedId,
      tagId,
      articles,
      accountArticles,
      tagArticles,
    });
    if (Result.isFailure(articleResult)) {
      return;
    }

    const article = Result.unwrap(articleResult);
    prevArticleIdRef.current = selectedArticleId;
    if (article.url) {
      openBrowser(article.url);
      if (readerViewPref === "fullscreen") {
        void (async () => {
          Result.pipe(await setWindowFullscreen(true), Result.inspectError(() => {}));
        })();
      }
    }
  }, [
    selectedArticleId,
    readerViewPref,
    selectedFeedDisplayMode,
    contentMode,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
    openBrowser,
  ]);

  if (contentMode === "browser") {
    return <BrowserView />;
  }

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }

  const articleResult = findSelectedArticle({
    selectedArticleId,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
  });

  if (Result.isFailure(articleResult)) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background text-muted-foreground">
        Article not found
      </div>
    );
  }

  const article = Result.unwrap(articleResult);

  const feedName = feeds?.find((f) => f.id === article.feed_id)?.title;

  return <ArticleReader article={article} feedName={feedName} feedDisplayMode={selectedFeedDisplayMode} />;
}
