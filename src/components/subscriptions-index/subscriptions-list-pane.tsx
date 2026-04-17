import { ChevronDown, ChevronRight } from "lucide-react";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { LabelChip } from "@/components/shared/label-chip";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SubscriptionListGroup, SubscriptionListRow } from "./subscriptions-index.types";

function resolveStatusTone(labelKey: SubscriptionListRow["status"]["labelKey"]) {
  if (labelKey === "review") {
    return "warning";
  }

  if (labelKey === "stale_90d") {
    return "danger";
  }

  return "neutral";
}

export function SubscriptionsListPane({
  heading,
  groups,
  selectedFeedId,
  emptyLabel,
  statusLabels,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  isGroupExpanded,
  onSelectFeed,
  onToggleGroup,
}: {
  heading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  emptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  isGroupExpanded: (groupKey: string) => boolean;
  onSelectFeed: (feedId: string) => void;
  onToggleGroup: (groupKey: string) => void;
}) {
  const hasRows = groups.some((group) => group.rows.length > 0);
  return (
    <section
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-5 lg:min-h-0 lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/50 pb-4">
        <h2 className="font-sans text-[1.02rem] font-normal tracking-[-0.02em] text-foreground">{heading}</h2>
        {hasRows ? (
          <LabelChip tone="neutral">{groups.reduce((count, group) => count + group.rows.length, 0)}</LabelChip>
        ) : null}
      </div>
      <div className="space-y-5 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {!hasRows ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-foreground-soft">
            {emptyLabel}
          </p>
        ) : (
          groups.map((group) => {
            const expanded = isGroupExpanded(group.key);
            const groupBodyId = `subscriptions-group-panel-${group.key}`;

            return (
              <div key={group.key} className="space-y-2.5">
                <button
                  type="button"
                  data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
                  data-folder-drop-target={group.folderId ? "true" : "false"}
                  aria-expanded={expanded}
                  aria-controls={groupBodyId}
                  onClick={() => onToggleGroup(group.key)}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-[background-color,border-color,color] duration-150 hover:bg-[color:var(--subscriptions-list-row-hover)]"
                  style={{
                    borderColor: "var(--subscriptions-list-divider)",
                    backgroundColor: "var(--subscriptions-list-group-surface)",
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-foreground-soft" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-foreground-soft" />
                    )}
                    <h3 className="text-sm font-medium tracking-[-0.01em] text-foreground">{group.label}</h3>
                  </span>
                  <LabelChip tone="neutral" size="compact">
                    {group.rows.length}
                  </LabelChip>
                </button>
                {expanded ? (
                  <div id={groupBodyId} className="space-y-1.5 pl-1">
                    {group.rows.map((row) => (
                      <NavRowButton
                        key={row.feed.id}
                        selected={selectedFeedId === row.feed.id}
                        aria-pressed={selectedFeedId === row.feed.id}
                        onClick={() => onSelectFeed(row.feed.id)}
                        className={cn(
                          "items-center rounded-md border border-transparent px-3.5 py-3.5 shadow-none",
                          selectedFeedId === row.feed.id
                            ? "border-[color:var(--subscriptions-list-row-selected-border)] bg-[color:var(--subscriptions-list-row-selected-surface)] shadow-[0_8px_20px_-18px_rgba(38,37,30,0.28)]"
                            : "bg-background/15 hover:border-[color:var(--subscriptions-list-divider)] hover:bg-[color:var(--subscriptions-list-row-hover)]",
                        )}
                        leading={
                          <span
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                              selectedFeedId === row.feed.id
                                ? "bg-surface-1 text-foreground"
                                : "bg-surface-2/88 text-foreground",
                            )}
                            style={{
                              borderColor: "var(--subscriptions-list-divider)",
                              backgroundColor:
                                selectedFeedId === row.feed.id
                                  ? "var(--subscriptions-list-favicon-surface)"
                                  : "var(--subscriptions-list-favicon-surface-muted)",
                            }}
                          >
                            <FeedFavicon
                              title={row.feed.title}
                              url={row.feed.url}
                              siteUrl={row.feed.site_url}
                              size="md"
                            />
                          </span>
                        }
                        title={
                          <div className="flex items-center gap-2">
                            <span className="text-[0.95rem] font-medium tracking-[-0.02em] text-foreground">
                              {row.feed.title}
                            </span>
                          </div>
                        }
                        description={
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-foreground-soft">
                            <LabelChip tone={resolveStatusTone(row.status.labelKey)} size="compact">
                              {statusLabels[row.status.labelKey]}
                            </LabelChip>
                            <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                              •
                            </span>
                            <span>{formatUnreadCountLabel(row.feed.unread_count)}</span>
                            <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                              •
                            </span>
                            <span>{formatLatestArticleLabel(row.latestArticleAt)}</span>
                          </div>
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
