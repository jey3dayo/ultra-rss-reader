export function buildFeedMarkAllReadConfirmation(params: {
  feedId: string;
  unreadCount: number;
  onConfirmRead: (feedId: string) => void;
}) {
  const { feedId, unreadCount, onConfirmRead } = params;

  return {
    count: unreadCount,
    scope: "feed" as const,
    onConfirm: () => onConfirmRead(feedId),
  };
}
