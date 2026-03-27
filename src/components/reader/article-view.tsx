import { Result } from "@praha/byethrow";
import { Circle, Copy, Plus, Share, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useArticles, useMarkRead, useToggleStar } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import {
  useArticlesByTag,
  useArticleTags,
  useCreateTag,
  useTagArticle,
  useTags,
  useUntagArticle,
} from "@/hooks/use-tags";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { BrowserView } from "./browser-view";

function ArticleToolbar({ article }: { article: ArticleDto | null }) {
  const markRead = useMarkRead();
  const toggleStar = useToggleStar();
  const openBrowser = useUiStore((s) => s.openBrowser);
  const actionCopyLink = usePreferencesStore((s) => s.prefs.action_copy_link ?? "true");
  const actionOpenBrowser = usePreferencesStore((s) => s.prefs.action_open_browser ?? "true");
  const actionShare = usePreferencesStore((s) => s.prefs.action_share ?? "false");

  return (
    <div className="flex h-12 items-center justify-end border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => article && markRead.mutate(article.id)}
          className="text-muted-foreground"
          disabled={!article}
          aria-label="Toggle read"
        >
          <Circle className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => article && toggleStar.mutate({ id: article.id, starred: !article.is_starred })}
          className="text-muted-foreground"
          disabled={!article}
          aria-label="Toggle star"
        >
          <Star className="h-4 w-4" />
        </Button>
        {actionCopyLink === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => article?.url && navigator.clipboard.writeText(article.url)}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {actionOpenBrowser === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => article?.url && openBrowser(article.url)}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label="Open in browser"
          >
            <span className="text-xs font-bold">BR</span>
          </Button>
        )}
        {actionShare === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (article?.url) {
                Result.pipe(
                  await openInBrowser(article.url),
                  Result.inspectError((e) => console.error("Failed to open in browser:", e)),
                );
              }
            }}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label="Share article"
          >
            <Share className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={null} />
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-muted/30">
          <Star className="h-10 w-10" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Ultra RSS</h3>
        <p className="text-sm">Select an article to read</p>
      </div>
    </div>
  );
}

function ArticleTagChips({ articleId }: { articleId: string }) {
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const assignedTagIds = new Set(articleTags?.map((t) => t.id) ?? []);
  const unassignedTags = (allTags ?? []).filter((t) => !assignedTagIds.has(t.id));

  const handleCreateAndAssign = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          tagArticleMutation.mutate({ articleId, tagId: tag.id });
          setNewTagName("");
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
            className="ml-0.5 text-muted-foreground hover:text-foreground"
            aria-label={`Remove tag ${tag.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground text-muted-foreground hover:border-foreground hover:text-foreground"
          aria-label="Add tag"
        >
          <Plus className="h-3 w-3" />
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {unassignedTags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                onClick={() => {
                  tagArticleMutation.mutate({ articleId, tagId: tag.id });
                  setShowPicker(false);
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
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAssign();
                }}
                placeholder="New tag..."
                className="flex-1 rounded border-none bg-transparent px-1 py-1 text-xs outline-none placeholder:text-muted-foreground"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCreateAndAssign}
                disabled={!newTagName.trim()}
                className="h-5 w-5 text-muted-foreground"
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

function ArticleReader({ article, feedName }: { article: ArticleDto; feedName?: string }) {
  const afterReading = usePreferencesStore((s) => s.prefs.after_reading ?? "mark_as_read");
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const markRead = useMarkRead();
  const openBrowserView = useUiStore((s) => s.openBrowser);

  // Auto mark as read when article is displayed
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger only on article change and preference
  useEffect(() => {
    if (afterReading === "mark_as_read" && article && !article.is_read) {
      markRead.mutate(article.id);
    }
  }, [afterReading, article?.id]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor?.href) return;
    e.preventDefault();

    const useExternal = (cmdClickBrowser === "true" && (e.metaKey || e.ctrlKey)) || openLinks === "external";
    if (useExternal) {
      openInBrowser(anchor.href);
    } else {
      openBrowserView(anchor.href);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return (
      date
        .toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        .toUpperCase() +
      " AT " +
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={article} />
      <ScrollArea className="flex-1">
        <article className="mx-auto max-w-3xl px-8 py-8">
          {/* Date */}
          <p className="mb-2 text-xs tracking-wider text-muted-foreground">{formatDate(article.published_at)}</p>

          {/* Title */}
          <h1 className="mb-4 text-2xl font-bold leading-tight text-foreground">{article.title}</h1>

          {/* Author & Feed */}
          {(article.author || feedName) && (
            <div className="mb-4 text-sm text-muted-foreground">
              {article.author && <p className="uppercase tracking-wide">{article.author}</p>}
              {feedName && <p className="text-xs">{feedName}</p>}
            </div>
          )}

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
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: tagArticles } = useArticlesByTag(tagId);
  const { data: feeds } = useFeeds(selectedAccountId);

  if (contentMode === "browser") {
    return <BrowserView />;
  }

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }

  const allArticles = tagId ? tagArticles : articles;
  const article = allArticles?.find((a) => a.id === selectedArticleId);

  if (!article) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background text-muted-foreground">
        Article not found
      </div>
    );
  }

  const feedName = feeds?.find((f) => f.id === article.feed_id)?.title;

  return <ArticleReader article={article} feedName={feedName} />;
}
