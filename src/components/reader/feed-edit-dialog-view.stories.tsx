import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FeedEditDialogView } from "./feed-edit-dialog-view";

const meta = {
  title: "Reader/Dialog/FeedEditDialogView",
  component: FeedEditDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Tech Blog",
    loading: false,
    displayMode: "standard",
    displayModeOptions: [
      { value: "default", label: "Default" },
      { value: "standard", label: "Standard" },
      { value: "preview", label: "Preview" },
    ],
    urlFields: [
      {
        key: "website-url",
        label: "Website URL",
        value: "https://example.com",
        copyLabel: "Copy Website URL",
        onCopy: fn(),
      },
      {
        key: "feed-url",
        label: "Feed URL",
        value: "https://example.com/feed.xml",
        copyLabel: "Copy Feed URL",
        onCopy: fn(),
      },
    ],
    folderSelectProps: {
      labelId: "folder-story-label",
      label: "Folder",
      value: "folder-1",
      options: [
        { value: "", label: "No folder" },
        { value: "folder-1", label: "Work" },
        { value: "folder-2", label: "Personal" },
      ],
      canCreateFolder: true,
      disabled: false,
      isCreatingFolder: false,
      newFolderOptionLabel: "New folder",
      newFolderLabel: "Folder name",
      newFolderName: "",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
    },
    labels: {
      title: "Edit Feed",
      titleField: "Title",
      displayMode: "Display Mode",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving",
      unsubscribe: "Unsubscribe",
      unsubscribeAction: "Unsubscribe…",
      feedInformation: "Feed information",
      unsubscribeDescription: "Articles from this feed will also be deleted.",
    },
    onOpenChange: fn(),
    onTitleChange: fn(),
    onDisplayModeChange: fn(),
    onSubmit: fn(),
    onRequestUnsubscribe: fn(),
  },
} satisfies Meta<typeof FeedEditDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Japanese: Story = {
  args: {
    title: "窓際のトットちゃん",
    displayMode: "default",
    displayModeOptions: [
      { value: "default", label: "既定の表示" },
      { value: "standard", label: "リーダー" },
      { value: "preview", label: "Webプレビュー" },
    ],
    urlFields: [
      {
        key: "website-url",
        label: "サイトURL",
        value: "https://example.com",
        copyLabel: "サイトURLをコピー",
        onCopy: fn(),
      },
      {
        key: "feed-url",
        label: "フィードのURL",
        value: "https://example.com/rss.xml",
        copyLabel: "フィードのURLをコピー",
        onCopy: fn(),
      },
    ],
    folderSelectProps: {
      labelId: "folder-story-label-ja",
      label: "フォルダ",
      value: "folder-comic-manga",
      options: [
        { value: "", label: "フォルダなし" },
        { value: "folder-comic-manga", label: "Comic - Manga RSS" },
      ],
      canCreateFolder: true,
      disabled: false,
      isCreatingFolder: false,
      newFolderOptionLabel: "新規フォルダ…",
      newFolderLabel: "フォルダ名",
      newFolderName: "",
      newFolderPlaceholder: "フォルダ名を入力",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
    },
    labels: {
      title: "フィードを編集",
      titleField: "タイトル",
      displayMode: "記事の表示",
      cancel: "キャンセル",
      save: "保存",
      saving: "保存中…",
      unsubscribe: "購読解除",
      unsubscribeAction: "購読解除…",
      feedInformation: "フィード情報",
      unsubscribeDescription: "このフィードの記事も削除されます。",
    },
  },
};
