import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
import { AccountConnectionSummary } from "../account-connection-summary";
import { AccountDetailView } from "./view";

const syncIntervalOptions = [
  { value: "900", label: "Every 15 minutes" },
  { value: "3600", label: "Every hour" },
  { value: "7200", label: "Every 2 hours" },
];

const keepReadItemsOptions = [
  { value: "30", label: "One month" },
  { value: "90", label: "Three months" },
  { value: "0", label: "Forever" },
];

const meta = {
  title: "Settings/Page/AccountDetailView",
  component: AccountDetailView,
  tags: ["autodocs"],
  args: {
    title: "Personal FreshRSS",
    subtitle: "FreshRSS",
    headerSummary: <AccountConnectionSummary statusLabel="Verified" statusTone="success" detail="Today 01:06" />,
    generalSection: {
      heading: "General",
      nameLabel: "Description",
      nameValue: "Personal FreshRSS",
      editNameTitle: "Click to edit",
      isEditingName: false,
      nameDraft: "Personal FreshRSS",
      infoRows: [
        { label: "Type", value: "FreshRSS" },
        { label: "Server", value: "https://freshrss.example.com", truncate: true },
      ],
      onStartEditingName: fn(),
      onNameDraftChange: fn(),
      onCommitName: fn(),
      onNameKeyDown: fn(),
    },
    syncSection: {
      heading: "Syncing",
      syncInterval: {
        name: "sync-interval",
        label: "Sync",
        value: "3600",
        options: syncIntervalOptions,
        onChange: fn(),
      },
      syncOnStartup: {
        label: "Sync on startup",
        checked: true,
        onChange: fn(),
      },
      syncOnWake: {
        label: "Sync on wake",
        checked: true,
        onChange: fn(),
      },
      keepReadItems: {
        name: "keep-read-items",
        label: "Keep read items",
        value: "30",
        options: keepReadItemsOptions,
        onChange: fn(),
      },
      statusRows: [
        { label: "Next automatic retry", value: "Apr 13, 12:15" },
        { label: "Last sync error", value: "Network timeout while contacting FreshRSS" },
      ],
    },
    dangerZone: {
      dataHeading: "Data",
      dangerHeading: "Danger Zone",
      importLabel: "Import OPML",
      exportLabel: "Export OPML",
      deleteLabel: "Delete account",
      onImport: fn(),
      onExport: fn(),
      onRequestDelete: fn(),
    },
  },
  decorators: [
    (Story, context) => (
      <div
        className={
          context.viewMode === "docs"
            ? "mx-auto w-full max-w-[480px] bg-background p-4"
            : "mx-auto h-[820px] w-full max-w-[480px] overflow-auto bg-background p-4"
        }
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmingDelete: Story = {
  args: {
    dangerZone: {
      dataHeading: "Data",
      dangerHeading: "Danger Zone",
      importLabel: "Import OPML",
      exportLabel: "Export OPML",
      deleteLabel: "Delete",
      onImport: fn(),
      onExport: fn(),
      onRequestDelete: fn(),
    },
  },
};

export const WarningSummary: Story = {
  args: {
    headerSummary: (
      <AccountConnectionSummary
        statusLabel="Retry scheduled"
        statusTone="warning"
        detail="Network timeout while contacting FreshRSS"
      />
    ),
  },
};

export const DangerSummary: Story = {
  args: {
    headerSummary: (
      <AccountConnectionSummary statusLabel="Connection failed" statusTone="danger" detail="Credentials rejected" />
    ),
  },
};

export const SummaryWithoutDetail: Story = {
  args: {
    headerSummary: <AccountConnectionSummary statusLabel="Verified" statusTone="success" />,
  },
};

export const JapaneseLongLabelsDense: Story = {
  parameters: denseNarrowViewportParameters,
  args: {
    title: "個人用FreshRSS長い表示名の検証アカウント",
    subtitle: "FreshRSS接続設定",
    headerSummary: (
      <AccountConnectionSummary
        statusLabel="再試行を待機中"
        statusTone="warning"
        detail="FreshRSSサーバーへの接続がタイムアウトしたため、次回の自動同期で再試行します"
      />
    ),
    generalSection: {
      ...meta.args.generalSection,
      heading: "基本情報",
      nameLabel: "アカウント表示名",
      nameValue: "個人用FreshRSS長い表示名の検証アカウント",
      editNameTitle: "クリックして表示名を編集",
      nameDraft: "個人用FreshRSS長い表示名の検証アカウント",
      infoRows: [
        { label: "種類", value: "FreshRSS" },
        {
          label: "サーバーURL",
          value: "https://very-long-reader-hostname.example.test/api/greader.php",
          truncate: true,
        },
      ],
    },
    syncSection: {
      ...meta.args.syncSection,
      heading: "同期設定",
      note: "長い日本語ラベルと状態説明が狭い設定ペインで重ならないことを確認するfixture。",
      syncInterval: {
        ...meta.args.syncSection.syncInterval,
        label: "自動同期の間隔",
        options: [
          { value: "900", label: "15分ごとに同期する" },
          { value: "3600", label: "1時間ごとに同期する" },
          { value: "7200", label: "2時間ごとに同期する" },
        ],
      },
      syncOnStartup: {
        ...meta.args.syncSection.syncOnStartup,
        label: "アプリ起動時に自動同期する",
      },
      syncOnWake: {
        ...meta.args.syncSection.syncOnWake,
        label: "スリープ解除時に自動同期する",
      },
      keepReadItems: {
        ...meta.args.syncSection.keepReadItems,
        label: "既読記事を保持する期間",
        options: [
          { value: "30", label: "1か月間保持する" },
          { value: "90", label: "3か月間保持する" },
          { value: "0", label: "削除せず保持する" },
        ],
      },
      progressLabel: "同期を実行中",
      progressValue: 58,
      progressCurrentLabel: "58%",
      syncNowLabel: "今すぐ同期",
      syncingLabel: "同期しています",
      secondaryActionLabel: "接続を再確認",
      onSyncNow: fn(),
      onSecondaryAction: fn(),
      statusRows: [
        { label: "次回の自動再試行", value: "2026年5月11日 12:15" },
        {
          label: "最後の同期エラー",
          value: "FreshRSSサーバーへの接続がタイムアウトしました。ネットワーク設定を確認してください。",
        },
      ],
    },
    dangerZone: {
      ...meta.args.dangerZone,
      dataHeading: "データ",
      dangerHeading: "危険な操作",
      importLabel: "OPMLを取り込む",
      exportLabel: "OPMLを書き出す",
      deleteLabel: "このアカウントを削除",
    },
  },
};

export const DenseA11yDisabledState: Story = {
  parameters: denseNarrowViewportParameters,
  args: {
    title: "FreshRSS",
    headerSummary: (
      <AccountConnectionSummary statusLabel="接続できません" statusTone="danger" detail="認証情報が拒否されました" />
    ),
    generalSection: {
      ...meta.args.generalSection,
      disabled: true,
      isSavingName: true,
    },
    syncSection: {
      ...meta.args.syncSection,
      syncInterval: {
        ...meta.args.syncSection.syncInterval,
        disabled: true,
      },
      syncOnStartup: {
        ...meta.args.syncSection.syncOnStartup,
        disabled: true,
      },
      syncOnWake: {
        ...meta.args.syncSection.syncOnWake,
        disabled: true,
      },
      keepReadItems: {
        ...meta.args.syncSection.keepReadItems,
        disabled: true,
      },
      syncNowLabel: "Retry sync",
      syncingLabel: "Syncing",
      isSyncing: true,
      onSyncNow: fn(),
    },
    dangerZone: {
      ...meta.args.dangerZone,
      disabled: true,
    },
  },
};
