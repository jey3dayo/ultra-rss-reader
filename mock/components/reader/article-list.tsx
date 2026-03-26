"use client"

import { CheckCircle, Search, X, Star, Filter } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { type Article } from "@/lib/mock-data"
import Image from "next/image"

interface ArticleListProps {
  articles: Article[]
  selectedArticle: Article | null
  onSelectArticle: (article: Article) => void
  feedName: string
  unreadCount: number
}

export function ArticleList({
  articles,
  selectedArticle,
  onSelectArticle,
  feedName,
  unreadCount,
}: ArticleListProps) {
  // Group articles by date
  const groupedArticles = articles.reduce(
    (groups, article) => {
      const group = article.dateGroup
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(article)
      return groups
    },
    {} as Record<string, Article[]>
  )

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return (
    <div className="flex h-full w-[380px] flex-col border-r border-border bg-card">
      {/* Header Toolbar */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <CheckCircle className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <Search className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feed Title */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">{feedName}</h2>
        <p className="text-xs text-muted-foreground">{unreadCount} Unread Items</p>
      </div>

      {/* Article List */}
      <ScrollArea className="flex-1">
        <div className="pb-4">
          {Object.entries(groupedArticles).map(([dateGroup, groupArticles]) => (
            <div key={dateGroup}>
              {/* Date Group Header */}
              <div className="sticky top-0 bg-card px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {dateGroup}
                </span>
              </div>

              {/* Articles in Group */}
              {groupArticles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className={cn(
                    "relative flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors",
                    selectedArticle?.id === article.id
                      ? "border-l-accent bg-accent/10"
                      : "border-l-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      {/* Feed Name */}
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/20 text-[9px] font-medium text-accent">
                          {article.feedIcon}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {article.feedName}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                        {article.title}
                      </h3>

                      {/* Summary */}
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {article.summary}
                      </p>
                    </div>

                    {/* Thumbnail */}
                    {article.thumbnail && (
                      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded">
                        <Image
                          src={article.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Time */}
                  <div className="absolute right-4 top-3 text-xs text-muted-foreground">
                    {formatTime(article.date)}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Toolbar */}
      <div className="flex h-10 items-center justify-center gap-4 border-t border-border bg-card">
        <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
          <Star className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          UNREAD
        </button>
        <button className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground">
          <Filter className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
