import { Check, Clock3, Trash2 } from "lucide-react";
import { useState } from "react";
import { SubscriptionsListPane } from "@/components/subscriptions-index/subscriptions-list-pane";
import { SubscriptionsOverviewSummary } from "@/components/subscriptions-index/subscriptions-overview-summary";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import {
  ControlChipButton,
  DecisionButton,
  denseDecisionButtonClassName,
  FeedDetailPanel,
  LabelChip,
  MotionNumber,
  SectionHeading,
  SurfaceCard,
} from "@/design-system";
import type { SubscriptionListGroup, SubscriptionSummaryCard } from "@/lib/subscriptions/subscriptions-index.types";
import { cn } from "@/lib/utils";
import { AnnotatedNote, ReferencePage } from "./ui-reference-canvas-specimens";

export { AnnotatedNote, ReferencePage };

const STACK_SPECIMEN_FRAME_RADIUS_CLASS = "rounded-md";

const SUMMARY_FILTER_CARDS: SubscriptionSummaryCard[] = [
  {
    filterKey: "all",
    label: "すべての購読",
    value: "163",
    caption: "現在管理しているフィード",
    tone: "neutral",
    isActive: true,
  },
  {
    filterKey: "review",
    label: "確認待ち",
    value: "12",
    caption: "継続判断が必要な候補",
    tone: "review",
    isActive: false,
  },
  {
    filterKey: "stale",
    label: "90日以上更新なし",
    value: "8",
    caption: "最近動きがない購読",
    tone: "stale",
    isActive: false,
  },
  {
    filterKey: "all",
    label: "同期状態",
    value: "Ready",
    caption: "押せない static sibling",
    tone: "neutral",
    isActive: false,
    isActionable: false,
  },
];

const SUBSCRIPTION_GROUPS: SubscriptionListGroup[] = [
  {
    key: "folder-design",
    label: "Design",
    folderId: "folder-design",
    rows: [
      {
        folderId: "folder-design",
        folderName: "Design",
        latestArticleAt: "2026-04-29T08:00:00Z",
        status: { tone: "neutral", labelKey: "normal" },
        reasonTooltipKey: null,
        feed: {
          id: "feed-cafict",
          account_id: "account-local",
          folder_id: "folder-design",
          remote_id: null,
          title: "CAFICT",
          url: "https://cafict.com/feed/",
          site_url: "https://cafict.com",
          unread_count: 5,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
      {
        folderId: "folder-design",
        folderName: "Design",
        latestArticleAt: "2026-04-21T11:30:00Z",
        status: { tone: "medium", labelKey: "review" },
        reasonTooltipKey: "review",
        feed: {
          id: "feed-99diy",
          account_id: "account-local",
          folder_id: "folder-design",
          remote_id: null,
          title: "99% DIY -DIYブログ-",
          url: "https://99diy.tokyo/feed/",
          site_url: "https://99diy.tokyo",
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
    ],
  },
  {
    key: "ungrouped",
    label: "フォルダなし",
    folderId: null,
    rows: [
      {
        folderId: null,
        folderName: null,
        latestArticleAt: null,
        status: { tone: "medium", labelKey: "stale_90d" },
        reasonTooltipKey: "stale_90d",
        feed: {
          id: "feed-archive",
          account_id: "account-local",
          folder_id: null,
          remote_id: null,
          title: "Archive notes",
          url: "https://example.com/archive.xml",
          site_url: "https://example.com",
          unread_count: 18,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      },
    ],
  },
];

export function WorkspaceFilterClusterSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace filter cluster</SectionHeading>
      <div
        data-testid="reference-workspace-filter-cluster-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-border/70 bg-surface-1/88 p-3 shadow-elevation-1",
        )}
      >
        <div className="flex flex-wrap gap-2">
          {[
            { label: "すべて", count: 163, pressed: true },
            { label: "90日以上更新なし", count: 0, pressed: false },
            { label: "未読なし", count: 163, pressed: false },
            { label: "スターなし", count: 163, pressed: false },
          ].map((item) => (
            <ControlChipButton
              key={item.label}
              pressed={item.pressed}
              size="comfortable"
              className="gap-2 rounded-md px-3.5"
            >
              <span>{item.label}</span>
              <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
                {item.count}
              </LabelChip>
            </ControlChipButton>
          ))}
          <ControlChipButton pressed={false} size="comfortable" className="rounded-md px-3.5">
            あとで確認を表示
          </ControlChipButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        密度の高いワークスペースでは、pill よりも少し角張った filter chip
        を優先する。件数バッジはさらに一段小さく角を落として、本文ラベルより控えめに扱う。
      </p>
    </SurfaceCard>
  );
}

export function MotionNumberSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Short numeric swaps</SectionHeading>
      <div
        data-testid="reference-motion-number-frame"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "grid gap-3 border border-border/70 bg-surface-1/88 p-3 shadow-elevation-1",
        )}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border/55 bg-card/48 px-3 py-2">
          <span className="truncate text-sm font-medium text-foreground">Unread queue</span>
          <MotionNumber value={27} variant="digit-pop" className="text-sm font-semibold text-foreground" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border/55 bg-card/48 px-3 py-2">
          <span className="truncate text-sm font-medium text-foreground">Search results</span>
          <MotionNumber value={8} variant="digit-pop" className="text-sm font-semibold text-foreground" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ControlChipButton pressed size="comfortable" className="gap-2 rounded-md px-3.5">
            <span>未読なし</span>
            <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
              <MotionNumber value={163} variant="digit-pop" />
            </LabelChip>
          </ControlChipButton>
          <ControlChipButton pressed={false} size="comfortable" className="gap-2 rounded-md px-3.5">
            <span>スターなし</span>
            <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
              <MotionNumber value={42} variant="digit-pop" />
            </LabelChip>
          </ControlChipButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        件数バッジ、検索結果数、同期カウントのような短い数値だけに使う。記事本文、長いタイトル、フィード名は動かさない。
      </p>
    </SurfaceCard>
  );
}

export function SummaryFilterCardsSpecimen() {
  const [activeFilter, setActiveFilter] = useState<SubscriptionSummaryCard["filterKey"]>("all");
  const cards = SUMMARY_FILTER_CARDS.map((card) => ({
    ...card,
    isActive: card.isActionable !== false && card.filterKey === activeFilter,
  }));

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Summary filter cards</SectionHeading>
      <div data-testid="reference-summary-filter-card-frame">
        <SubscriptionsOverviewSummary cards={cards} onSelectFilter={setActiveFilter} />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        card 全体が filter button になる workspace summary。active accent、badge slot、numeric typography、押せない
        static sibling の差分をここで確認してから wrapper 化する。
      </p>
    </SurfaceCard>
  );
}

export function SubscriptionGroupDisclosureSpecimen() {
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(new Set(["folder-design"]));
  const [selectedFeedId, setSelectedFeedId] = useState("feed-cafict");

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Subscription group disclosure</SectionHeading>
      <div
        data-testid="reference-subscription-group-disclosure-frame"
        className="overflow-hidden rounded-md border border-border/55"
      >
        <SubscriptionsListPane
          heading="購読一覧"
          groups={SUBSCRIPTION_GROUPS}
          selectedFeedId={selectedFeedId}
          emptyLabel="購読はありません"
          searchQuery=""
          searchLabel="購読を検索"
          searchPlaceholder="検索"
          searchClearLabel="検索をクリア"
          statusLabels={{
            normal: "確認済み",
            attention_30d: "注意",
            review: "確認待ち",
            stale_90d: "長期停止候補",
            quiet_no_unread: "見直し候補",
          }}
          reasonTooltipLabels={{
            no_articles: "記事がまだ取れていないため、見直し候補にはしていません",
            normal: "最近も動きがあります",
            attention_30d: "最終記事から30日以上たっているため注意表示です",
            review: "見直しの判断材料があります",
            stale_90d: "最終記事から90日以上たっているため長期停止候補です",
            quiet_no_unread: "最終記事から60日以上なく、未読もありません",
          }}
          formatUnreadCountLabel={(count) => `${count} unread`}
          formatLatestArticleLabel={(value) => (value ? "最終更新あり" : "更新なし")}
          isGroupExpanded={(groupKey) => expandedGroups.has(groupKey)}
          onSelectFeed={setSelectedFeedId}
          onSearchQueryChange={() => undefined}
          onToggleGroup={toggleGroup}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        folder row は disclosure button と drop target を兼ねる。aria-expanded、count chip、motion disclosure、feed row
        との余白をこの基準面で確認する。
      </p>
    </SurfaceCard>
  );
}

export function WorkspaceActionClusterSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace action cluster</SectionHeading>
      <div
        data-testid="reference-workspace-action-cluster"
        className={cn(
          STACK_SPECIMEN_FRAME_RADIUS_CLASS,
          "border border-border/70 bg-surface-1/88 p-3 shadow-elevation-1",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <DecisionButton intent="keep" className={denseDecisionButtonClassName} aria-label="Keep selected">
            <Check className="size-4" />
            Keep selected
          </DecisionButton>
          <DecisionButton intent="defer" className={denseDecisionButtonClassName} aria-label="Defer selected">
            <Clock3 className="size-4" />
            Defer selected
          </DecisionButton>
          <DecisionButton intent="delete" className={denseDecisionButtonClassName} aria-label="Delete selected">
            <Trash2 className="size-4" />
            Delete selected
          </DecisionButton>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        dense toolbar では action width を揃え、keep / defer / delete の順で置く。destructive
        は最後に寄せ、視線の終点に置く。
      </p>
    </SurfaceCard>
  );
}

export function DetailPanelSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Detail panel</SectionHeading>
      <div data-testid="reference-detail-panel-frame" className="max-w-[34rem]">
        <FeedDetailPanel
          title="AUTOMATON"
          titleHref="https://automaton-media.com"
          badgeLabel="Review"
          badgeTone="medium"
          reasonBox={{
            title: "整理候補になった理由",
            body: "未読 0件 / スター 0件",
            tone: "medium",
          }}
          metrics={[
            { label: "フォルダ", value: "Gaming" },
            { label: "最終記事", value: "2026/04/16" },
            { label: "未読", value: 0 },
            { label: "スター", value: 0 },
          ]}
          links={[]}
          recentArticlesHeading="最近の記事"
          recentArticles={[
            {
              id: "ref-1",
              title: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。",
              publishedAt: "2026/04/16",
              url: "https://example.com/article",
            },
          ]}
          primaryAction={{
            label: "フィードを編集",
            onClick: () => {},
            ariaLabel: "フィードを編集",
          }}
          reasonChips={["一度見ておきたい購読"]}
        />
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        panel は単一 action card ではなく、title、status、reason、metrics、recent articles を束ねる detail
        surface。summary card より情報密度を高くし、primary action は末尾に閉じ込める。
      </p>
    </SurfaceCard>
  );
}

export function WorkspaceTwoPaneSpecimen() {
  const entries = [
    {
      id: "automaton",
      title: "AUTOMATON",
      href: "https://automaton-media.com",
      folder: "Gaming",
      latestArticle: "2026/04/16",
      unread: 0,
      starred: 0,
      status: "Review",
      statusTone: "medium" as const,
      article: "SIE新作高難度3D弾幕ローグライトシューター『SAROS』開発者インタビュー。",
    },
    {
      id: "publickey",
      title: "Publickey",
      href: "https://www.publickey1.jp",
      folder: "Engineering",
      latestArticle: "2026/04/28",
      unread: 2,
      starred: 1,
      status: "Watch",
      statusTone: "low" as const,
      article: "クラウドネイティブな開発環境とフロントエンド基盤の最新動向。",
    },
    {
      id: "nhk",
      title: "NHKニュース",
      href: "https://www3.nhk.or.jp/news/",
      folder: "News",
      latestArticle: "2026/04/30",
      unread: 4,
      starred: 0,
      status: "Normal",
      statusTone: "neutral" as const,
      article: "国内外の主要ニュースを短く確認するための定点観測フィード。",
    },
  ];
  const [selectedEntryId, setSelectedEntryId] = useState(entries[0].id);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];

  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Workspace two-pane</SectionHeading>
      <div
        data-testid="reference-workspace-two-pane-frame"
        className="grid gap-4 rounded-md border border-border/70 bg-card/30 p-3 shadow-none lg:grid-cols-[minmax(0,1fr)_480px]"
      >
        <div className="space-y-3">
          <div className="rounded-md border border-border/70 bg-surface-1/88 p-3 shadow-none">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/70 bg-background/90 p-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">要確認</p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-foreground">6</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/90 p-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">90日停止</p>
                <p className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-foreground">1</p>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-surface-1/84 p-3 shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-sans text-sm font-medium text-foreground">Queue</h4>
              <LabelChip tone="neutral" size="compact">
                3
              </LabelChip>
            </div>
            <div className="space-y-2">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={entry.id === selectedEntryId}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={cn(
                    "motion-static-hover-surface w-full rounded-md border border-border/70 bg-background/86 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                    entry.id === selectedEntryId &&
                      "border-border-strong bg-surface-2/82 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
                  )}
                >
                  <p className="font-sans text-sm text-foreground">{entry.title}</p>
                  <p className="mt-1 font-serif text-xs leading-[1.45] text-foreground/72">
                    選択中の feed に応じて detail pane を更新する二段構成。
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div
          key={selectedEntry.id}
          data-testid="reference-workspace-two-pane-detail"
          {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
          className={cn(
            MOTION_CONTENT_SWAP_CLASS_NAME,
            "rounded-md border border-border/70 bg-surface-1/84 p-3 shadow-none",
          )}
        >
          <FeedDetailPanel
            title={selectedEntry.title}
            titleHref={selectedEntry.href}
            badgeLabel={selectedEntry.status}
            badgeTone={selectedEntry.statusTone}
            reasonBox={{
              title: "整理候補になった理由",
              body: `未読 ${selectedEntry.unread}件 / スター ${selectedEntry.starred}件`,
              tone: selectedEntry.statusTone,
            }}
            metrics={[
              { label: "フォルダ", value: selectedEntry.folder },
              { label: "最終記事", value: selectedEntry.latestArticle },
              { label: "未読", value: selectedEntry.unread },
              { label: "スター", value: selectedEntry.starred },
            ]}
            links={[]}
            recentArticlesHeading="最近の記事"
            recentArticles={[
              {
                id: `ref-${selectedEntry.id}`,
                title: selectedEntry.article,
                publishedAt: selectedEntry.latestArticle,
                url: "https://example.com/article",
              },
            ]}
            primaryAction={{
              label: "フィードを編集",
              onClick: () => {},
              ariaLabel: "フィードを編集",
            }}
            reasonChips={["一度見ておきたい購読"]}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

export function AnnouncementCardsSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Announcement cards</SectionHeading>
      <div className="flex flex-wrap items-center gap-4">
        <div
          data-testid="reference-announcement-card-pending"
          className={cn(
            STACK_SPECIMEN_FRAME_RADIUS_CLASS,
            "flex items-center gap-4 border border-border/55 bg-surface-1/72 px-4 py-3 shadow-none",
          )}
        >
          <span className="inline-flex min-w-12 justify-center rounded-md border border-border/70 bg-background px-3 py-2 font-sans text-2xl font-medium text-foreground">
            163
          </span>
          <div>
            <p className="font-sans text-base text-foreground">確認待ち</p>
            <p className="font-serif text-sm text-muted-foreground">これから判断する購読</p>
          </div>
        </div>
        <div
          data-testid="reference-announcement-card-decided"
          className={cn(
            STACK_SPECIMEN_FRAME_RADIUS_CLASS,
            "flex items-center gap-4 border border-state-success-border/70 bg-state-success-surface/68 px-4 py-3 shadow-none",
          )}
        >
          <span className="inline-flex min-w-12 justify-center rounded-md border border-state-success-border bg-state-success-surface px-3 py-2 font-sans text-2xl font-medium text-state-success-foreground">
            0
          </span>
          <div>
            <p className="font-sans text-base text-foreground">判断済み</p>
            <p className="font-serif text-sm text-muted-foreground">すでに対応した購読</p>
          </div>
        </div>
      </div>
      <p className="mt-3 font-serif text-xs leading-[1.45] text-foreground/72">
        announcement card は押せる summary card と混ぜない。hover affordance、action chip、active badge を持たない
        passive surface として扱う。
      </p>
    </SurfaceCard>
  );
}
