import { Circle, Star, Share } from "lucide-react";
import { Result } from "@praha/byethrow";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ArticleDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useArticles, useMarkRead, useToggleStar } from "@/hooks/use-articles";
import { useUiStore } from "@/stores/ui-store";
import { BrowserView } from "./browser-view";

function ArticleToolbar({ article }: { article: ArticleDto | null }) {
  const markRead = useMarkRead();
  const toggleStar = useToggleStar();
  const openBrowser = useUiStore((s) => s.openBrowser);

  return (
    <div className="flex h-12 items-center justify-end border-b border-border px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => article && markRead.mutate(article.id)}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          disabled={!article}
        >
          <Circle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => article && toggleStar.mutate({ id: article.id, starred: !article.is_starred })}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          disabled={!article}
        >
          <Star className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => article?.url && openBrowser(article.url)}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          disabled={!article?.url}
        >
          <span className="text-xs font-bold">BR</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            if (article?.url) {
              Result.pipe(
                await openInBrowser(article.url),
                Result.inspectError((e) => console.error("Failed to open in browser:", e)),
              );
            }
          }}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          disabled={!article?.url}
        >
          <Share className="h-4 w-4" />
        </button>
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

function ArticleReader({ article }: { article: ArticleDto }) {
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

          {/* Author */}
          {article.author && (
            <div className="mb-8 text-sm text-muted-foreground">
              <p className="uppercase tracking-wide">{article.author}</p>
            </div>
          )}

          {/* Featured Image */}
          {article.thumbnail && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
              <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-invert max-w-none text-base leading-relaxed text-foreground/90"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
            dangerouslySetInnerHTML={{ __html: article.content_sanitized }}
          />
        </article>
      </ScrollArea>
    </div>
  );
}

export function ArticleView() {
  const { contentMode, selectedArticleId, selection } = useUiStore();
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const { data: articles } = useArticles(feedId);

  if (contentMode === "browser") {
    return <BrowserView />;
  }

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }

  const article = articles?.find((a) => a.id === selectedArticleId);

  if (!article) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background text-muted-foreground">
        Article not found
      </div>
    );
  }

  return <ArticleReader article={article} />;
}
