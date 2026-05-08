# Tag Settings Reader Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `Settings > タグ` の `保存済みタグ` 一覧を reader 寄せの軽い行デザインへ更新し、記事数を出さずに編集・削除導線だけを残す。

Architecture: `TagsSettingsView` の保存済みタグ一覧だけを専用 row markup に差し替え、作成フォーム・mutation・dialog の責務はそのまま維持する。sidebar の `TagListView` は流用せず、settings 側で必要な視覚言語だけを取り込む。回帰防止は view 単体テスト、`SettingsModal` の結合テスト、Storybook fixture で固める。

Tech Stack: React 19, TypeScript, Vitest, Testing Library, Storybook 10, Tailwind utility classes, Biome, mise

---

## File Structure

- Modify: `src/components/settings/tags-settings-view.tsx`
  - 保存済みタグ行を `小さい色ドット + タグ名 + 右端の編集/削除` 構成へ差し替える
- Create: `src/components/settings/tags-settings-view.stories.tsx`
  - `Settings/Page` 配下で `TagsSettingsView` の既定状態と空状態を確認できる fixture を追加する
- Modify: `src/__tests__/components/tags-settings-view.test.tsx`
  - compact row の見た目契約と旧 large swatch の削除を検証する
- Modify: `src/__tests__/components/settings-modal.test.tsx`
  - 実際の `SettingsModal` 経由でも compact row が表示され、既存の作成・編集・削除導線が維持されることを確認する
- Create: `src/__tests__/components/tags-settings-view.stories.test.tsx`
  - Storybook fixture が `Settings/Page` として成立し、reader 寄せ row を描画できることを確認する

## Task 1: Lock The Compact Tag Row Contract

### Files

- Modify: `src/__tests__/components/tags-settings-view.test.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`
- Modify: `src/components/settings/tags-settings-view.tsx`

- [ ] **Step 1: Write the failing view test for the compact saved-tag row**

Replace `src/__tests__/components/tags-settings-view.test.tsx` with the following assertions so the test suite stops expecting the old `h-8 w-8` swatch and instead locks the new compact row contract:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagsSettingsView } from "@/components/settings/tags-settings-view";

describe("TagsSettingsView", () => {
  it("uses softened helper tones for intro and empty state", () => {
    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue=""
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={vi.fn()}
        createDisabled={true}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Use tags to organize related articles.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("No tags yet.")).toHaveClass("text-foreground-soft");
  });

  it("renders saved tags as compact identity rows with right-aligned actions", () => {
    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue=""
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={vi.fn()}
        createDisabled={false}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[
          { id: "tag-1", name: "Fav", color: "#cf7868" },
          { id: "tag-2", name: "Gray", color: null },
        ]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const favRow = screen.getByTestId("tags-settings-row-tag-1");
    expect(within(favRow).getByText("Fav")).toBeInTheDocument();
    expect(within(favRow).getByTestId("tags-settings-color-dot-tag-1")).toHaveClass("h-2.5", "w-2.5", "rounded-full");
    expect(within(favRow).getByRole("button", { name: "Edit Fav" })).toHaveClass("size-8");
    expect(within(favRow).getByRole("button", { name: "Delete Fav" })).toHaveClass("size-8");

    const grayRow = screen.getByTestId("tags-settings-row-tag-2");
    expect(within(grayRow).queryByTestId("tags-settings-color-dot-tag-2")).toBeNull();
    expect(screen.queryByTestId("tags-settings-swatch-tag-1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the view test and verify it fails against the current large-swatch UI**

Run:

```bash
pnpm exec vitest run src/__tests__/components/tags-settings-view.test.tsx
```

Expected: FAIL because `tags-settings-row-tag-1` / `tags-settings-color-dot-tag-1` do not exist and the current buttons still use `size-9`.

- [ ] **Step 3: Write the failing settings-modal integration assertions**

Update the existing `switches to tags settings and creates a tag from the add row` and `renames and deletes saved tags while preserving color state` cases in `src/__tests__/components/settings-modal.test.tsx` to assert the compact row contract instead of the old large swatch:

```tsx
    expect(await screen.findByText("Later")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-created")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-created")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-swatch-tag-created")).toBeNull();
    expect(nameInput).toHaveValue("");
```

```tsx
    expect(await screen.findByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-1")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-1")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-color-dot-tag-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-swatch-tag-1")).toBeNull();
```

- [ ] **Step 4: Run the integration file and verify it also fails before implementation**

Run:

```bash
pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx
```

Expected: FAIL in the tag settings assertions because the rendered DOM still exposes `tags-settings-swatch-*` and does not render `tags-settings-row-*` / `tags-settings-color-dot-*`.

- [ ] **Step 5: Implement the compact saved-tag row in `TagsSettingsView`**

Replace the saved-tag list block inside `src/components/settings/tags-settings-view.tsx` with a compact identity row. Keep the create section unchanged.

```tsx
      <SettingsSection heading={savedHeading} surface="flat">
        {tags.length === 0 ? (
          <p className="border-b border-border py-3 text-sm text-foreground-soft">{emptyState}</p>
        ) : (
          <div className="border-t border-border/70">
            {tags.map((tag) => (
              <div
                key={tag.id}
                data-testid={`tags-settings-row-${tag.id}`}
                className="motion-contextual-surface flex min-h-[44px] items-center justify-between gap-3 border-b border-border/70 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {tag.color ? (
                    <span
                      aria-hidden="true"
                      data-testid={`tags-settings-color-dot-${tag.id}`}
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  ) : null}
                  <span className="truncate text-[14px] leading-[1.35] text-[color:var(--form-row-label)]">{tag.name}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="subtle"
                    className="size-8"
                    aria-label={editAriaLabel(tag.name)}
                    onClick={() => onEdit(tag.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </SettingsActionButton>
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="danger"
                    className="size-8"
                    aria-label={deleteAriaLabel(tag.name)}
                    onClick={() => onDelete(tag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </SettingsActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
```

Important implementation notes:

- remove the old `tags-settings-swatch-*` test ids entirely
- do not introduce article counts
- do not import `TagListView` or `SidebarNavButton`
- keep `TagColorPicker`, create flow, and dialog wiring unchanged

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```bash
pnpm exec vitest run src/__tests__/components/tags-settings-view.test.tsx src/__tests__/components/settings-modal.test.tsx
```

Expected: PASS. The compact row tests should pass, and the existing create / rename / delete flows in `SettingsModal` should still pass.

- [ ] **Step 7: Commit the compact row change**

Run:

```bash
git add src/components/settings/tags-settings-view.tsx src/__tests__/components/tags-settings-view.test.tsx src/__tests__/components/settings-modal.test.tsx
git commit -m "feat: align tag settings rows with reader tags"
```

## Task 2: Add A Stable Storybook Fixture For The New Settings Row

### Files

- Create: `src/components/settings/tags-settings-view.stories.tsx`
- Create: `src/__tests__/components/tags-settings-view.stories.test.tsx`

- [ ] **Step 1: Write the failing Storybook fixture**

Create `src/components/settings/tags-settings-view.stories.tsx` with a default state and an empty state so the compact row can be reviewed without opening the full modal:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TagsSettingsView } from "./tags-settings-view";

const meta = {
  title: "Settings/Page/TagsSettingsView",
  component: TagsSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Tags",
    addHeading: "New tag",
    intro: "Use tags to group related articles.",
    nameLabel: "Tag name",
    nameValue: "",
    namePlaceholder: "News",
    colorLabel: "Color",
    colorValue: "#8c79b2",
    colorOptions: ["#cf7868", "#b59a64", "#5f9670", "#6f8eb8", "#8c79b2"],
    noColorLabel: "No color",
    colorOptionAriaLabel: (color: string) => `Color ${color}`,
    createLabel: "Create",
    onNameChange: fn(),
    onColorChange: fn(),
    onCreate: fn(),
    createDisabled: false,
    savedHeading: "Saved tags",
    emptyState: "No tags yet.",
    tags: [
      { id: "tag-1", name: "Fav", color: "#b59a64" },
      { id: "tag-2", name: "Gray", color: null },
      { id: "tag-3", name: "news", color: "#8c79b2" },
    ],
    editLabel: "Edit",
    editAriaLabel: (name: string) => `Edit ${name}`,
    deleteLabel: "Delete",
    deleteAriaLabel: (name: string) => `Delete ${name}`,
    onEdit: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagsSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    tags: [],
    createDisabled: true,
  },
};
```

- [ ] **Step 2: Write the failing story test**

Create `src/__tests__/components/tags-settings-view.stories.test.tsx` so the Storybook fixture is exercised in CI:

```tsx
import { cleanup, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import tagsSettingsMeta, { Default, Empty } from "@/components/settings/tags-settings-view.stories";
import { renderStory } from "../../../tests/helpers/render-story";

describe("TagsSettingsView stories", () => {
  it("renders the default story with compact saved-tag rows", () => {
    renderStory(tagsSettingsMeta, Default);

    expect(screen.getByRole("heading", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-1")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-1")).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("renders the empty story without saved-tag rows", () => {
    cleanup();
    renderStory(tagsSettingsMeta, Empty);

    expect(screen.getByText("No tags yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-row-tag-1")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the story test and verify it fails before the files exist**

Run:

```bash
pnpm exec vitest run src/__tests__/components/tags-settings-view.stories.test.tsx
```

Expected: FAIL with module resolution errors until the story file and story test file are created.

- [ ] **Step 4: Save both files and rerun the story test**

Run:

```bash
pnpm exec vitest run src/__tests__/components/tags-settings-view.stories.test.tsx
```

Expected: PASS. The default story should expose compact rows and the empty story should hide them.

- [ ] **Step 5: Commit the Storybook fixture**

Run:

```bash
git add src/components/settings/tags-settings-view.stories.tsx src/__tests__/components/tags-settings-view.stories.test.tsx
git commit -m "test: add tags settings story coverage"
```

## Task 3: Run The Repository Quality Gate

### Files

- Modify: none expected
- Verify: current branch state after Tasks 1-2

- [ ] **Step 1: Format the touched files**

Run:

```bash
pnpm exec biome format --write src/components/settings/tags-settings-view.tsx src/components/settings/tags-settings-view.stories.tsx src/__tests__/components/tags-settings-view.test.tsx src/__tests__/components/tags-settings-view.stories.test.tsx src/__tests__/components/settings-modal.test.tsx
```

Expected: files are rewritten in place only if formatting drift exists.

- [ ] **Step 2: Run the focused frontend test slice**

Run:

```bash
pnpm exec vitest run src/__tests__/components/tags-settings-view.test.tsx src/__tests__/components/tags-settings-view.stories.test.tsx src/__tests__/components/settings-modal.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the repository check gate required by this repo**

Run:

```bash
mise run check
```

Expected: formatter, lint, typecheck, and configured test checks pass with exit code 0.

- [ ] **Step 4: Commit any final polish required by format or check**

If any files changed during formatting or check fixes, run:

```bash
git add src/components/settings/tags-settings-view.tsx src/components/settings/tags-settings-view.stories.tsx src/__tests__/components/tags-settings-view.test.tsx src/__tests__/components/tags-settings-view.stories.test.tsx src/__tests__/components/settings-modal.test.tsx
git commit -m "chore: polish tag settings alignment"
```

If no files changed, mark this step complete without creating an extra commit.
