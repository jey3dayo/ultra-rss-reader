"use client"

import { useState, useMemo } from "react"
import { Sidebar } from "@/components/reader/sidebar"
import { ArticleList } from "@/components/reader/article-list"
import { ArticleView } from "@/components/reader/article-view"
import { SettingsModal } from "@/components/reader/settings-modal"
import { articles, feeds, type Article } from "@/lib/mock-data"

export default function ReaderApp() {
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Calculate total unread
  const totalUnread = useMemo(() => {
    return feeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
  }, [])

  // Filter articles based on selected feed
  const filteredArticles = useMemo(() => {
    if (selectedFeed === null) {
      return articles
    }
    return articles.filter((article) => article.feedId === selectedFeed)
  }, [selectedFeed])

  // Get feed info
  const selectedFeedInfo = useMemo(() => {
    if (selectedFeed === null) {
      return { name: "All Unread", unreadCount: totalUnread }
    }
    const feed = feeds.find((f) => f.id === selectedFeed)
    return feed
      ? { name: feed.name, unreadCount: feed.unreadCount }
      : { name: "Unknown", unreadCount: 0 }
  }, [selectedFeed, totalUnread])

  const handleSelectFeed = (feedId: string | null) => {
    setSelectedFeed(feedId)
    setSelectedArticle(null)
  }

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article)
  }

  return (
    <div className="dark flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar - Feed List */}
      <Sidebar
        selectedFeed={selectedFeed}
        onSelectFeed={handleSelectFeed}
        onOpenSettings={() => setSettingsOpen(true)}
        totalUnread={totalUnread}
      />

      {/* Article List */}
      <ArticleList
        articles={filteredArticles}
        selectedArticle={selectedArticle}
        onSelectArticle={handleSelectArticle}
        feedName={selectedFeedInfo.name}
        unreadCount={selectedFeedInfo.unreadCount}
      />

      {/* Article View */}
      <ArticleView
        article={selectedArticle}
        feedName={selectedFeedInfo.name}
        totalUnread={selectedFeedInfo.unreadCount}
      />

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
