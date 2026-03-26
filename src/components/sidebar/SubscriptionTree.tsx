import { useFeeds } from "../../hooks/use-feeds";
import { useUiStore } from "../../stores/ui-store";
import { FeedItem } from "./FeedItem";
import { SmartViewItem } from "./SmartViewItem";

export function SubscriptionTree() {
  const { selectedAccountId, selection } = useUiStore();
  const { data: feeds } = useFeeds(selectedAccountId);

  return (
    <div>
      <SmartViewItem
        kind="unread"
        label="Unread"
        isSelected={selection.type === "smart" && selection.kind === "unread"}
      />
      <SmartViewItem
        kind="starred"
        label="Starred"
        isSelected={selection.type === "smart" && selection.kind === "starred"}
      />
      <div
        style={{
          padding: "var(--space-sm) 0",
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          fontWeight: "bold",
        }}
      >
        Feeds
      </div>
      {feeds?.map((feed) => (
        <FeedItem key={feed.id} feed={feed} isSelected={selection.type === "feed" && selection.feedId === feed.id} />
      ))}
    </div>
  );
}
