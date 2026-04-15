# Tag Management Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーの `タグ` 見出しに右クリックメニューを追加し、`Settings` モーダルにタグ管理画面を新設して、タグの追加・編集・削除を共通部品ベースで扱えるようにする。

**Architecture:** サイドバー側は `SidebarSectionToggle` 系に「見出しコンテキストメニュー」の拡張ポイントを追加し、タグ見出し専用の menu content を差し込む。設定画面側は `SettingsCategory` と `SettingsModal` に `tags` を追加し、`TagsSettings` container / view を新設して既存の tag hooks と rename / delete dialog を再利用する。

**Tech Stack:** React 19, TypeScript, Zustand, TanStack Query, Base UI ContextMenu, Vitest, Testing Library, i18next

---

### Task 1: サイドバーのタグ見出しに右クリックメニューを追加する

**Files:**
- Create: `src/components/reader/tag-section-context-menu-view.tsx`
- Create: `src/components/reader/tag-section-context-menu.tsx`
- Modify: `src/components/shared/sidebar-section.types.ts`
- Modify: `src/components/shared/sidebar-section-toggle.tsx`
- Modify: `src/components/reader/sidebar-tag-items.types.ts`
- Modify: `src/components/reader/tag-list-view.tsx`
- Modify: `src/components/reader/sidebar-tag-section.tsx`
- Modify: `src/components/reader/sidebar.types.ts`
- Modify: `src/components/reader/sidebar-content-sections.tsx`
- Modify: `src/components/reader/use-sidebar-content-sections-props.ts`
- Modify: `src/components/reader/use-sidebar-controller-sections.ts`
- Modify: `src/components/reader/use-sidebar-context-menu-renderers.tsx`
- Test: `src/__tests__/components/tag-list-view.test.tsx`
- Test: `src/__tests__/components/tag-section-context-menu-view.test.tsx`

- [ ] **Step 1: タグ見出しメニューの failing test を追加する**

```tsx
it("opens the tag section context menu and delegates add/manage actions", async () => {
  const user = userEvent.setup();
  const onCreateTag = vi.fn();
  const onManageTags = vi.fn();

  render(
    <TagListView
      tagsLabel="Tags"
      tags={[{ id: "tag-1", name: "Later", color: "#3b82f6", articleCount: 2, isSelected: false }]}
      isOpen={true}
      onToggleOpen={vi.fn()}
      onSelectTag={vi.fn()}
      onCreateTag={onCreateTag}
      onManageTags={onManageTags}
      renderContextMenu={() => <div />}
    />,
  );

  await user.pointer({
    keys: "[MouseRight]",
    target: screen.getByRole("button", { name: "Tags" }),
  });

  await user.click(screen.getByRole("menuitem", { name: "Add tag" }));
  await user.click(screen.getByRole("menuitem", { name: "Manage tags" }));

  expect(onCreateTag).toHaveBeenCalledTimes(1);
  expect(onManageTags).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: failing を確認する**

Run: `pnpm exec vitest run src/__tests__/components/tag-list-view.test.tsx`

Expected: FAIL with missing `onCreateTag` / `onManageTags` props or missing menu items.

- [ ] **Step 3: 見出しコンテキストメニュー用の view を追加する**

```tsx
import { ContextMenu } from "@base-ui/react/context-menu";
import { useTranslation } from "react-i18next";
import { contextMenuStyles } from "./context-menu-styles";

export type TagSectionContextMenuViewProps = {
  onCreateTag: () => void;
  onManageTags: () => void;
};

export function TagSectionContextMenuView({ onCreateTag, onManageTags }: TagSectionContextMenuViewProps) {
  const { t } = useTranslation("sidebar");

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onCreateTag}>
            {t("add_tag")}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onManageTags}>
            {t("manage_tags")}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
```

- [ ] **Step 4: `SidebarSectionToggle` に renderContextMenu を渡せるようにする**

```tsx
export type SidebarSectionToggleProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  renderContextMenu?: ReactNode;
};
```

```tsx
export function SidebarSectionToggle({ label, isOpen, onToggle, className, renderContextMenu }: SidebarSectionToggleProps) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      className={cn("flex w-full items-center justify-between rounded-md px-2 py-1 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/35", className)}
    >
      <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
    </button>
  );

  if (!renderContextMenu) {
    return button;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={button} />
      {renderContextMenu}
    </ContextMenu.Root>
  );
}
```

- [ ] **Step 5: タグ一覧 props と配線を追加する**

```tsx
export type SidebarTagListProps = {
  tagsLabel: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  sidebarDensity?: SidebarDensity;
  tags: SidebarTagItemsResult;
  onSelectTag: (tagId: string) => void;
  onCreateTag: () => void;
  onManageTags: () => void;
  renderContextMenu?: (tag: SidebarTagItem) => ReactNode;
};
```

```tsx
<SidebarSectionToggle
  label={tagsLabel}
  isOpen={isOpen}
  onToggle={onToggleOpen}
  renderContextMenu={<TagSectionContextMenuContent onCreateTag={onCreateTag} onManageTags={onManageTags} />}
/>
```

```tsx
const renderTagSectionContextMenu = useCallback(
  (onCreateTag: () => void, onManageTags: () => void) => (
    <TagSectionContextMenuContent onCreateTag={onCreateTag} onManageTags={onManageTags} />
  ),
  [],
);
```

- [ ] **Step 6: サイドバー controller から `openSettings("tags")` へつなぐ**

```tsx
const handleOpenTagSettings = useCallback(() => {
  openSettings("tags");
}, [openSettings]);
```

```tsx
return {
  ...,
  onCreateTag: handleOpenCreateTagDialog,
  onManageTags: handleOpenTagSettings,
};
```

- [ ] **Step 7: targeted tests を再実行する**

Run: `pnpm exec vitest run src/__tests__/components/tag-list-view.test.tsx src/__tests__/components/tag-section-context-menu-view.test.tsx`

Expected: PASS

- [ ] **Step 8: コミットする**

```bash
git add \
  src/components/shared/sidebar-section.types.ts \
  src/components/shared/sidebar-section-toggle.tsx \
  src/components/reader/tag-section-context-menu-view.tsx \
  src/components/reader/tag-section-context-menu.tsx \
  src/components/reader/sidebar-tag-items.types.ts \
  src/components/reader/tag-list-view.tsx \
  src/components/reader/sidebar-tag-section.tsx \
  src/components/reader/sidebar.types.ts \
  src/components/reader/sidebar-content-sections.tsx \
  src/components/reader/use-sidebar-content-sections-props.ts \
  src/components/reader/use-sidebar-controller-sections.ts \
  src/components/reader/use-sidebar-context-menu-renderers.tsx \
  src/__tests__/components/tag-list-view.test.tsx \
  src/__tests__/components/tag-section-context-menu-view.test.tsx
git commit -m "feat: add tag section context menu"
```

### Task 2: Settings モーダルに `タグ` カテゴリとタグ管理ビューを追加する

**Files:**
- Create: `src/components/settings/tags-settings.tsx`
- Create: `src/components/settings/tags-settings-view.tsx`
- Modify: `src/stores/ui-store.ts`
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/ja/sidebar.json`
- Test: `src/__tests__/components/settings-modal.test.tsx`
- Test: `src/__tests__/components/settings-nav-view.test.tsx`

- [ ] **Step 1: settings navigation の failing test を追加する**

```tsx
it("shows the tags settings category in navigation", async () => {
  render(<SettingsModal />, { wrapper: createWrapper() });
  expect(await screen.findByRole("button", { name: "Tags" })).toBeInTheDocument();
});

it("switches to tag settings and shows the empty state", async () => {
  const user = userEvent.setup();

  setupTauriMocks((cmd) => {
    if (cmd === "list_tags") {
      return [];
    }
    return undefined;
  });

  render(<SettingsModal />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: "Tags" }));

  expect(await screen.findByText("No tags yet.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Tag name" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument();
});
```

- [ ] **Step 2: failing を確認する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/settings-nav-view.test.tsx`

Expected: FAIL because `tags` nav and `TagsSettings` content do not exist yet.

- [ ] **Step 3: `SettingsCategory` と nav wiring を追加する**

```ts
export type SettingsCategory =
  | "general"
  | "appearance"
  | "mute"
  | "reading"
  | "tags"
  | "shortcuts"
  | "actions"
  | "data"
  | "debug"
  | "accounts";
```

```tsx
const settingsCategoryByNavId: Record<string, SettingsCategory> = {
  general: "general",
  appearance: "appearance",
  mute: "mute",
  reading: "reading",
  tags: "tags",
  shortcuts: "shortcuts",
  actions: "actions",
  data: "data",
  debug: "debug",
};
```

```tsx
{
  id: "tags",
  label: t("nav.tags"),
  icon: <Tag className="h-5 w-5" />,
  isActive: settingsCategory === "tags" && !settingsAccountId && !settingsAddAccount,
},
```

- [ ] **Step 4: `TagsSettingsView` の骨格を追加する**

```tsx
export function TagsSettingsView({
  title,
  addHeading,
  emptyState,
  tagNameLabel,
  tagNameValue,
  createLabel,
  tags,
  onTagNameChange,
  onCreate,
  onEdit,
  onDelete,
}: TagsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="tags-settings-root">
      <SettingsSection heading={addHeading} className="mb-6">
        <LabeledInputRow
          label={tagNameLabel}
          name="tag_name"
          type="text"
          value={tagNameValue}
          onChange={onTagNameChange}
          actionLabel={createLabel}
          onAction={onCreate}
        />
      </SettingsSection>

      <SettingsSection heading={savedHeading}>
        {tags.length === 0 ? (
          <p className="border-b border-border py-3 text-sm text-muted-foreground">{emptyState}</p>
        ) : (
          tags.map((tag) => (
            <LabeledControlRow key={tag.id} label={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color ?? "transparent" }} />{tag.name}</span>}>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(tag.id)}>Edit</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onDelete(tag.id)}>Delete</Button>
              </div>
            </LabeledControlRow>
          ))
        )}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
```

- [ ] **Step 5: `SettingsModal` から `TagsSettings` を描画する**

```tsx
switch (settingsCategory) {
  case "tags":
    return <TagsSettings />;
  case "appearance":
    return <AppearanceSettings />;
  ...
}
```

- [ ] **Step 6: locale を追加する**

```json
"nav": {
  "general": "General",
  "appearance": "Appearance",
  "mute": "Mute",
  "reading": "Reading",
  "tags": "Tags"
}
```

```json
"tags": {
  "heading": "Tags",
  "add_heading": "New tag",
  "name": "Tag name",
  "name_placeholder": "Later",
  "create": "Create tag",
  "saved": "Existing tags",
  "empty_state": "No tags yet.",
  "manage_from_sidebar": "Manage tags"
}
```

- [ ] **Step 7: targeted tests を再実行する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/settings-nav-view.test.tsx`

Expected: PASS

- [ ] **Step 8: コミットする**

```bash
git add \
  src/stores/ui-store.ts \
  src/components/settings/tags-settings.tsx \
  src/components/settings/tags-settings-view.tsx \
  src/components/settings/use-settings-modal-view-props.tsx \
  src/components/settings/settings-modal.tsx \
  src/locales/en/settings.json \
  src/locales/ja/settings.json \
  src/locales/en/sidebar.json \
  src/locales/ja/sidebar.json \
  src/__tests__/components/settings-modal.test.tsx \
  src/__tests__/components/settings-nav-view.test.tsx
git commit -m "feat: add tag settings category"
```

### Task 3: タグ管理の create / edit / delete と削除後フォールバックを実装する

**Files:**
- Create: `src/components/settings/create-tag-dialog-view.tsx`
- Modify: `src/components/settings/tags-settings.tsx`
- Modify: `src/components/settings/tags-settings-view.tsx`
- Modify: `src/components/reader/tag-context-menu.tsx`
- Modify: `src/hooks/use-tags.ts`
- Modify: `src/components/reader/use-sidebar-visibility-fallback.ts`
- Modify: `tests/helpers/tauri-mocks.ts`
- Test: `src/__tests__/components/settings-modal.test.tsx`
- Test: `src/__tests__/components/tag-context-menu-view.test.tsx`

- [ ] **Step 1: タグ管理操作の failing test を追加する**

```tsx
it("creates a tag from tag settings", async () => {
  const user = userEvent.setup();
  render(<SettingsModal />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: "Tags" }));
  await user.type(screen.getByRole("textbox", { name: "Tag name" }), "Follow up");
  await user.click(screen.getByRole("button", { name: "Create tag" }));

  await waitFor(() => {
    expect(screen.getByText("Tag created")).toBeInTheDocument();
  });
});

it("opens the shared rename and delete dialogs from tag settings rows", async () => {
  const user = userEvent.setup();
  render(<SettingsModal />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: "Tags" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(await screen.findByRole("dialog", { name: "Edit Tag" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByRole("dialog", { name: "Delete Tag" })).toBeInTheDocument();
});
```

- [ ] **Step 2: failing を確認する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx`

Expected: FAIL because `TagsSettings` has no mutation wiring and no dialogs yet.

- [ ] **Step 3: `TagsSettings` container で tag hooks と toast を配線する**

```tsx
export function TagsSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((state) => state.showToast);
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const renameTagMutation = useRenameTag();
  const deleteTagMutation = useDeleteTag();
  const [name, setName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagDto | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagDto | null>(null);

  const handleCreate = async () => {
    try {
      await createTagMutation.mutateAsync({ name: name.trim() });
      setName("");
      setCreateDialogOpen(false);
      showToast(t("tags.create_success"));
    } catch (error) {
      showToast(t("tags.create_failed", { message: getErrorMessage(error) }));
    }
  };

  return <TagsSettingsView ... />;
}
```

- [ ] **Step 4: 新規作成ダイアログを追加し、サイドバー見出しメニューからも再利用できるようにする**

```tsx
export function CreateTagDialogView({
  open,
  name,
  loading,
  onOpenChange,
  onNameChange,
  onSubmit,
}: CreateTagDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tag</DialogTitle>
        </DialogHeader>
        <StackedInputField label="Name" name="tag-name" type="text" value={name} onChange={onNameChange} />
        <DialogFooter>
          <FormActionButtons
            cancelLabel="Cancel"
            submitLabel="Create"
            submittingLabel="Creating"
            loading={loading}
            submitDisabled={!name.trim() || loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: rename / delete dialog の shared 利用と色プリセット共有を整理する**

```ts
export const TAG_COLOR_PRESETS = [
  "#cf7868",
  "#c88d62",
  "#b59a64",
  "#5f9670",
  "#5f9695",
  "#6f8eb8",
  "#8c79b2",
  "#b97a90",
  "#726d66",
];
```

```tsx
<RenameTagDialogView
  open={editingTag !== null}
  name={renameName}
  color={renameColor}
  loading={renameTagMutation.isPending}
  colorOptions={TAG_COLOR_PRESETS}
  onOpenChange={(open) => !open && setEditingTag(null)}
  onSubmit={handleRenameSubmit}
/>
```

- [ ] **Step 6: 削除後の tag selection fallback test を追加し、最小実装する**

```tsx
if (selection.type === "tag" && tagsLoaded && tags.every((tag) => tag.id !== selection.tagId)) {
  if (showSidebarUnread) {
    selectSmartView("unread");
  } else {
    selectAll();
  }
}
```

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/sidebar.test.tsx`

Expected: FAIL first, then PASS after fallback implementation.

- [ ] **Step 7: targeted tests を再実行する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/tag-context-menu-view.test.tsx`

Expected: PASS

- [ ] **Step 8: コミットする**

```bash
git add \
  src/components/settings/create-tag-dialog-view.tsx \
  src/components/settings/tags-settings.tsx \
  src/components/settings/tags-settings-view.tsx \
  src/components/reader/tag-context-menu.tsx \
  src/hooks/use-tags.ts \
  src/components/reader/use-sidebar-visibility-fallback.ts \
  tests/helpers/tauri-mocks.ts \
  src/__tests__/components/settings-modal.test.tsx \
  src/__tests__/components/sidebar.test.tsx \
  src/__tests__/components/tag-context-menu-view.test.tsx
git commit -m "feat: implement tag management flows"
```

### Task 4: 品質ゲートを通して仕上げる

**Files:**
- Modify: `src/components/settings/tags-settings.tsx` (if lint/type/test fixes are needed)
- Modify: `src/components/settings/tags-settings-view.tsx` (if layout/a11y fixes are needed)
- Modify: `src/components/reader/tag-list-view.tsx` (if interaction fixes are needed)
- Test: `src/__tests__/components/tag-list-view.test.tsx`
- Test: `src/__tests__/components/tag-section-context-menu-view.test.tsx`
- Test: `src/__tests__/components/settings-modal.test.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: 変更周辺の targeted test をまとめて実行する**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/components/tag-list-view.test.tsx \
  src/__tests__/components/tag-section-context-menu-view.test.tsx \
  src/__tests__/components/settings-nav-view.test.tsx \
  src/__tests__/components/settings-modal.test.tsx \
  src/__tests__/components/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 2: format を実行する**

Run: `mise run format`

Expected: command succeeds and rewrites only intended files.

- [ ] **Step 3: lint を実行する**

Run: `mise run lint`

Expected: PASS with no TypeScript / Biome errors.

- [ ] **Step 4: full test を実行する**

Run: `mise run test`

Expected: PASS

- [ ] **Step 5: full quality gate を実行する**

Run: `mise run check`

Expected: PASS

- [ ] **Step 6: 最終コミットを作る**

```bash
git add \
  src/components/shared/sidebar-section.types.ts \
  src/components/shared/sidebar-section-toggle.tsx \
  src/components/reader/tag-section-context-menu-view.tsx \
  src/components/reader/tag-section-context-menu.tsx \
  src/components/reader/sidebar-tag-items.types.ts \
  src/components/reader/tag-list-view.tsx \
  src/components/reader/sidebar-tag-section.tsx \
  src/components/reader/sidebar.types.ts \
  src/components/reader/sidebar-content-sections.tsx \
  src/components/reader/use-sidebar-content-sections-props.ts \
  src/components/reader/use-sidebar-controller-sections.ts \
  src/components/reader/use-sidebar-context-menu-renderers.tsx \
  src/components/settings/create-tag-dialog-view.tsx \
  src/components/settings/tags-settings.tsx \
  src/components/settings/tags-settings-view.tsx \
  src/components/settings/use-settings-modal-view-props.tsx \
  src/components/settings/settings-modal.tsx \
  src/stores/ui-store.ts \
  src/hooks/use-tags.ts \
  src/components/reader/tag-context-menu.tsx \
  src/components/reader/use-sidebar-visibility-fallback.ts \
  src/locales/en/settings.json \
  src/locales/ja/settings.json \
  src/locales/en/sidebar.json \
  src/locales/ja/sidebar.json \
  src/__tests__/components/tag-list-view.test.tsx \
  src/__tests__/components/tag-section-context-menu-view.test.tsx \
  src/__tests__/components/settings-nav-view.test.tsx \
  src/__tests__/components/settings-modal.test.tsx \
  src/__tests__/components/sidebar.test.tsx \
  src/__tests__/components/tag-context-menu-view.test.tsx \
  tests/helpers/tauri-mocks.ts
git commit -m "feat: add tag management settings"
```

## Self-Review

- Spec coverage:
  - タグ見出し右クリックメニュー: Task 1
  - `タグを追加` / `タグを管理` の 2 項目: Task 1
  - Settings の `tags` カテゴリ追加: Task 2
  - 設定画面での追加・編集・削除: Task 3
  - 既存 dialog / hook / 共通コンポーネント再利用: Task 2-3
  - 削除後の安全な fallback: Task 3
  - DoD の quality gate: Task 4
- Placeholder scan:
  - `TODO` / `TBD` / “appropriate” / “similar to” は未使用
  - 各コード変更 step に具体的なコード片を記載済み
- Type consistency:
  - `SettingsCategory` は `tags`
  - サイドバー見出し操作は `onCreateTag` / `onManageTags`
  - 設定画面 component は `TagsSettings` / `TagsSettingsView`

