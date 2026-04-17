import { useEffect, useMemo, useState } from "react";
import type { SubscriptionListRow } from "./subscriptions-index.types";

export function useSubscriptionsIndexState(rows: SubscriptionListRow[]) {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCandidatesOnly, setShowCandidatesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"title" | "updated_at" | "unread_count">("title");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredRows = rows.filter((row) => {
      if (showCandidatesOnly && row.status.tone === "neutral") {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return (
        row.feed.title.toLowerCase().includes(normalizedQuery) ||
        (row.folderName ?? "").toLowerCase().includes(normalizedQuery)
      );
    });

    return [...filteredRows].sort((left, right) => {
      if (sortKey === "updated_at") {
        return (Date.parse(right.latestArticleAt ?? "") || 0) - (Date.parse(left.latestArticleAt ?? "") || 0);
      }

      if (sortKey === "unread_count") {
        return right.feed.unread_count - left.feed.unread_count;
      }

      return left.feed.title.localeCompare(right.feed.title);
    });
  }, [rows, searchQuery, showCandidatesOnly, sortKey]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      if (selectedFeedId !== null) {
        setSelectedFeedId(null);
      }
      return;
    }

    if (selectedFeedId === null || !visibleRows.some((row) => row.feed.id === selectedFeedId)) {
      setSelectedFeedId(visibleRows[0]?.feed.id ?? null);
    }
  }, [selectedFeedId, visibleRows]);

  const selectedRow = visibleRows.find((row) => row.feed.id === selectedFeedId) ?? null;

  return {
    searchQuery,
    selectedFeedId,
    selectedRow,
    showCandidatesOnly,
    sortKey,
    visibleRows,
    isGroupExpanded: (groupKey: string) => expandedGroups[groupKey] ?? true,
    setSearchQuery,
    setSelectedFeedId,
    setShowCandidatesOnly,
    setSortKey,
    toggleGroup: (groupKey: string) =>
      setExpandedGroups((current) => ({
        ...current,
        [groupKey]: !(current[groupKey] ?? true),
      })),
  };
}
