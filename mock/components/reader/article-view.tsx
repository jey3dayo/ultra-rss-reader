"use client"

import { Circle, Star, Type, List, Share } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Article } from "@/lib/mock-data"
import Image from "next/image"

interface ArticleViewProps {
  article: Article | null
  feedName?: string
  totalUnread?: number
}

export function ArticleView({ article, feedName, totalUnread }: ArticleViewProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).toUpperCase() + " AT " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Empty state
  if (!article) {
    return (
      <div className="flex h-full flex-1 flex-col bg-background">
        {/* Header Toolbar */}
        <div className="flex h-12 items-center justify-end border-b border-border px-4">
          <div className="flex items-center gap-2">
            <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <Circle className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <Star className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <span className="text-xs font-bold">BR</span>
            </button>
            <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <List className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
              <Share className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Empty State Content */}
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-muted/30">
            <Star className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-medium text-foreground">{feedName || "FreshRSS"}</h3>
          <p className="text-sm">{totalUnread?.toLocaleString() || 0} unread items</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header Toolbar */}
      <div className="flex h-12 items-center justify-end border-b border-border px-4">
        <div className="flex items-center gap-2">
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <Circle className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <Star className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <span className="text-xs font-bold">BR</span>
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <List className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <Share className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Article Content */}
      <ScrollArea className="flex-1">
        <article className="mx-auto max-w-3xl px-8 py-8">
          {/* Date */}
          <p className="mb-2 text-xs tracking-wider text-muted-foreground">
            {formatDate(article.date)}
          </p>

          {/* Title */}
          <h1 className="mb-4 text-2xl font-bold leading-tight text-foreground">
            {article.title}
          </h1>

          {/* Author & Feed */}
          <div className="mb-8 text-sm text-muted-foreground">
            <p className="uppercase tracking-wide">{article.author}</p>
            <p>{article.feedName}</p>
          </div>

          {/* Featured Image */}
          {article.thumbnail && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
              <Image
                src={article.thumbnail}
                alt=""
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            {article.content.split("\n\n").map((paragraph, index) => (
              <p
                key={index}
                className="mb-4 text-base leading-relaxed text-foreground/90"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </ScrollArea>
    </div>
  )
}
