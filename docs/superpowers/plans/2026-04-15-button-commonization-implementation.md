# Button Commonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 設定画面、購読一覧、購読整理のボタン表現を用途別共通コンポーネントへ寄せ、見た目のブレを減らす

Architecture: 既存の `src/components/ui/button.tsx` は基底として維持し、その上に `NavRowButton`、`DecisionButton`、chip/button ラッパを追加する。reader 専用の `SidebarNavButton` と `IconToolbar*` は維持し、settings / subscriptions / cleanup の「似ているが別実装」のボタン群だけを段階的に置き換える。

Tech Stack: React 19, TypeScript, Vitest, Testing Library, class-variance-authority, Tailwind utility classes

---

## File Map

### Create

- `src/components/shared/nav-row-button.tsx`
  - settings / subscriptions 向けの横幅いっぱいの選択行コンポーネント
- `src/components/shared/decision-button.tsx`
  - cleanup 向けの意味付きアクションボタン
- `src/__tests__/components/nav-row-button.test.tsx`
  - `NavRowButton` 単体テスト
- `src/__tests__/components/decision-button.test.tsx`
  - `DecisionButton` 単体テスト

### Modify

- `src/components/shared/control-chip.ts`
  - chip/button ラッパか variants の拡張
- `src/components/settings/accounts-nav-view.tsx`
  - `NavRowButton` 適用
- `src/components/settings/settings-nav-view.tsx`
  - `NavRowButton` 適用
- `src/components/settings/service-picker.tsx`
  - `NavRowButton` 適用
- `src/components/subscriptions-index/subscriptions-list-pane.tsx`
  - `NavRowButton` 適用
- `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
  - chip/button ラッパ適用
- `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
  - `DecisionButton` 適用
- `src/__tests__/components/accounts-nav-view.test.tsx`
  - 選択状態クラスの更新
- `src/__tests__/components/settings-nav-view.test.tsx`
  - 選択状態クラスの更新
- `src/__tests__/components/subscriptions-index-page.test.tsx`
  - 購読一覧の行ボタンに対する期待値更新
- `src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
  - cleanup ボタンと chip 表現の期待値更新

### Read During Implementation

- `src/components/ui/button.tsx`
- `src/components/reader/sidebar-nav-button.tsx`
- `src/components/shared/icon-toolbar-control.tsx`
- `src/components/reader/sidebar-footer-actions.tsx`
- `docs/superpowers/specs/2026-04-15-button-commonization-design.md`
- `DESIGN.md`

### Visual Alignment Rules

- 実装時の見た目調整は `DESIGN.md` を参照する
- ただし reader サイドバー全体を Cursor 風に寄せるのではなく、今回の対象ボタンだけに適用する
- 特に以下を採用する
  - warm な border / surface コントラスト
  - pill 系 chip の強い丸み
  - hover と focus-visible の視覚フィードバックを省略しない
  - destructive / success を冷たくしすぎず、既存テーマ内で暖色寄りに整える
- 新しいフォント導入や大規模な配色刷新はしない

### Concurrency Safety

- 実装開始前に `rtk git status --short` を確認し、上記以外の変更が増えていないかを見る
- 他エージェントが `feed-cleanup-*` や `subscriptions-*` を触っている可能性があるため、各タスク開始前に `rtk git diff -- <target-files>` を読む
- この計画のスコープ外ファイルは編集しない

## Commit Plan

- Commit 1: `test(shared): add nav row and decision button coverage`
- Commit 2: `refactor(settings): reuse nav row button in settings navigation`
- Commit 3: `refactor(subscriptions): align list rows with nav row button`
- Commit 4: `refactor(cleanup): unify decision and filter buttons`

実際のコミット作成は、触ったファイルだけを `atomic-commit` スキルでグループ化して行う。

## Task 1: Add `NavRowButton`

### Files

- Create: `src/components/shared/nav-row-button.tsx`
- Test: `src/__tests__/components/nav-row-button.test.tsx`
- Read: `src/components/reader/sidebar-nav-button.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavRowButton } from "@/components/shared/nav-row-button";

describe("NavRowButton", () => {
  it("renders title, description, leading, trailing, and selected state", () => {
    render(
      <NavRowButton
        tone="sidebar"
        selected
        title="Primary row"
        description="Secondary text"
        leading={<span aria-hidden="true">L</span>}
        trailing={<span aria-hidden="true">3</span>}
      />,
    );

    const button = screen.getByRole("button", { name: /Primary row/i });

    expect(button).toHaveClass("bg-sidebar-accent");
    expect(screen.getByText("Secondary text")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("forwards click and disabled state", () => {
    const onClick = vi.fn();

    render(<NavRowButton title="Disabled row" disabled onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Disabled row" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/nav-row-button.test.tsx`

Expected: FAIL with module-not-found for `@/components/shared/nav-row-button`

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavRowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "sidebar";
  selected?: boolean;
};

export function NavRowButton({
  title,
  description,
  leading,
  trailing,
  tone = "default",
  selected = false,
  className,
  type = "button",
  ...props
}: NavRowButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "group flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        tone === "sidebar"
          ? "focus-visible:bg-sidebar-accent/40"
          : "focus-visible:border-border/60 focus-visible:bg-card/40",
        tone === "sidebar"
          ? selected
            ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-transparent text-sidebar-foreground/88 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          : selected
            ? "border-border/70 bg-card/75 text-foreground"
            : "border-transparent bg-transparent text-foreground hover:border-border/50 hover:bg-card/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </button>
  );
}
```

- [ ] **Step 4: Keep `selected` as the only selection API**

Do not infer selected state from `aria-pressed` or ad-hoc `data-*` flags. Keep the final API explicit:

```tsx
type NavRowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "sidebar";
  selected?: boolean;
};

<NavRowButton selected={item.isActive} aria-pressed={item.isActive} />;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/nav-row-button.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/shared/nav-row-button.tsx src/__tests__/components/nav-row-button.test.tsx
rtk git commit -m "$(cat <<'EOF'
test(shared): add nav row button coverage
EOF
)"
```

## Task 2: Add `DecisionButton`

### Files

- Create: `src/components/shared/decision-button.tsx`
- Test: `src/__tests__/components/decision-button.test.tsx`
- Read: `src/components/shared/delete-button.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionButton } from "@/components/shared/decision-button";

describe("DecisionButton", () => {
  it("maps keep, defer, and delete intents to distinct styles", () => {
    render(
      <>
        <DecisionButton intent="keep">Keep</DecisionButton>
        <DecisionButton intent="defer">Later</DecisionButton>
        <DecisionButton intent="delete">Delete</DecisionButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Keep" })).toHaveClass(
      "bg-emerald-600/90",
    );
    expect(screen.getByRole("button", { name: "Later" })).toHaveClass(
      "bg-zinc-800",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "bg-red-950/90",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/decision-button.test.tsx`

Expected: FAIL with module-not-found for `@/components/shared/decision-button`

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DecisionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent: "keep" | "defer" | "delete";
};

const decisionIntentClassName = {
  keep: "bg-emerald-600/90 text-emerald-50 hover:bg-emerald-500",
  defer: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
  delete: "bg-red-950/90 text-red-100 hover:bg-red-900",
} as const;

export function DecisionButton({
  intent,
  className,
  type = "button",
  ...props
}: DecisionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        decisionIntentClassName[intent],
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/decision-button.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/shared/decision-button.tsx src/__tests__/components/decision-button.test.tsx
rtk git commit -m "$(cat <<'EOF'
test(shared): add decision button coverage
EOF
)"
```

## Task 3: Reuse `NavRowButton` in settings navigation

### Files

- Modify: `src/components/settings/accounts-nav-view.tsx`
- Modify: `src/components/settings/settings-nav-view.tsx`
- Modify: `src/components/settings/service-picker.tsx`
- Test: `src/__tests__/components/accounts-nav-view.test.tsx`
- Test: `src/__tests__/components/settings-nav-view.test.tsx`

- [ ] **Step 1: Update accounts navigation test to assert shared row semantics**

```tsx
expect(localButton).toHaveClass("bg-sidebar-accent");
expect(localButton).toHaveClass("rounded-md");
expect(freshRssButton).toHaveClass("hover:bg-sidebar-accent/50");
```

- [ ] **Step 2: Update settings navigation test to assert shared row semantics**

```tsx
expect(generalButton).toHaveClass("bg-sidebar-accent");
expect(appearanceButton).toHaveClass("hover:bg-sidebar-accent/50");
```

- [ ] **Step 3: Run tests to verify at least one fails**

Run: `pnpm vitest run src/__tests__/components/accounts-nav-view.test.tsx src/__tests__/components/settings-nav-view.test.tsx`

Expected: FAIL because old components do not expose the new shared class contract consistently

- [ ] **Step 4: Replace account rows with `NavRowButton`**

```tsx
import { NavRowButton } from "@/components/shared/nav-row-button";

<NavRowButton
  key={account.id}
  tone="sidebar"
  selected={account.isActive}
  onClick={() => onSelectAccount(account.id)}
  leading={
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        ACCOUNT_ICON_BG[account.kind] ?? "bg-muted",
      )}
    >
      <Rss className="h-4 w-4 text-white" />
    </span>
  }
  title={account.name}
  description={account.kind}
/>;
```

- [ ] **Step 5: Replace settings category rows with `NavRowButton`**

```tsx
import { NavRowButton } from "@/components/shared/nav-row-button";

<NavRowButton
  key={item.id}
  tone="sidebar"
  selected={item.isActive}
  onClick={() => onSelectCategory(item.id)}
  leading={
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center transition-colors",
        item.isActive
          ? "text-sidebar-accent-foreground/88"
          : "text-sidebar-foreground/62 group-hover:text-sidebar-foreground/80",
      )}
    >
      {item.icon}
    </span>
  }
  title={item.label}
/>;
```

- [ ] **Step 6: Replace service rows with `NavRowButton`**

```tsx
import { NavRowButton } from "@/components/shared/nav-row-button";

<NavRowButton
  tone="default"
  disabled={service.disabled}
  onClick={() => {
    if (!service.disabled) {
      onSelect(service.kind as AddAccountProviderKind);
    }
  }}
  leading={
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        service.iconBg,
      )}
    >
      <service.icon className="h-[18px] w-[18px] text-white" />
    </div>
  }
  title={t(service.nameKey as "account.local_feeds")}
  description={t(service.descKey as "account.local_desc")}
  trailing={<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
/>;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run src/__tests__/components/accounts-nav-view.test.tsx src/__tests__/components/settings-nav-view.test.tsx src/__tests__/components/settings-modal.test.tsx`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
rtk git add \
  src/components/settings/accounts-nav-view.tsx \
  src/components/settings/settings-nav-view.tsx \
  src/components/settings/service-picker.tsx \
  src/__tests__/components/accounts-nav-view.test.tsx \
  src/__tests__/components/settings-nav-view.test.tsx
rtk git commit -m "$(cat <<'EOF'
refactor(settings): reuse nav row button in settings navigation
EOF
)"
```

## Task 4: Reuse `NavRowButton` in subscriptions list

### Files

- Modify: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Test: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Update subscriptions page test to assert shared row structure**

```tsx
expect(selectedFeed).toHaveClass("bg-card/75");
expect(selectedFeed).toHaveClass("rounded-md");
expect(secondaryFeed).toHaveClass("hover:bg-card/30");
```

- [ ] **Step 2: Run the focused test to verify it fails after expectation tightening**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx -t "renders lightweight feed rows"`

Expected: FAIL on at least one new shared-class expectation

- [ ] **Step 3: Replace feed rows with `NavRowButton` while preserving metadata**

```tsx
import { NavRowButton } from "@/components/shared/nav-row-button";

<NavRowButton
  key={row.feed.id}
  selected={selectedFeedId === row.feed.id}
  aria-pressed={selectedFeedId === row.feed.id}
  onClick={() => onSelectFeed(row.feed.id)}
  leading={
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/90 text-sm font-medium text-foreground">
      {buildFeedAvatar(row.feed.title)}
    </span>
  }
  title={row.feed.title}
  description={
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
        {statusLabels[row.status.labelKey]}
      </span>
      <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
        {formatFolderLabel(row.folderName)}
      </span>
      <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
        {formatUnreadCountLabel(row.feed.unread_count)}
      </span>
      <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
        {formatLatestArticleLabel(row.latestArticleAt)}
      </span>
    </div>
  }
/>;
```

- [ ] **Step 4: Preserve folder drop-target wrappers and list layout**

Do not touch:

```tsx
data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
data-folder-drop-target={group.folderId ? "true" : "false"}
```

- [ ] **Step 5: Run tests to verify subscriptions page passes**

Run: `pnpm vitest run src/__tests__/components/subscriptions-index-page.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/subscriptions-index/subscriptions-list-pane.tsx src/__tests__/components/subscriptions-index-page.test.tsx
rtk git commit -m "$(cat <<'EOF'
refactor(subscriptions): align list rows with nav row button
EOF
)"
```

## Task 5: Add chip/button wrapper on top of `control-chip`

### Files

- Modify: `src/components/shared/control-chip.ts`
- Optionally Create: `src/components/shared/control-chip-button.tsx`
- Read: `src/components/reader/sidebar-footer-actions.tsx`

- [ ] **Step 1: Pick the smaller API**

Prefer a wrapper component if extending the variants would otherwise force consumers to compose the same button boilerplate repeatedly.

- [ ] **Step 2: Add a button-friendly wrapper**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { controlChipVariants } from "./control-chip";

type ControlChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  children: ReactNode;
  size?: "compact" | "comfortable";
};

export function ControlChipButton({
  pressed = false,
  size = "compact",
  className,
  type = "button",
  children,
  ...props
}: ControlChipButtonProps) {
  return (
    <button
      type={type}
      data-pressed={pressed ? "" : undefined}
      className={cn(
        controlChipVariants({ size, interaction: "toggle" }),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Run the existing chip consumers if any break**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-queue-panel.test.tsx`

Expected: either PASS immediately or fail because cleanup still uses old button classes

## Task 6: Reuse `DecisionButton` and chip wrapper in cleanup queue

### Files

- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
- Test: `src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
- Test: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Update cleanup tests to assert shared button presence**

```tsx
expect(within(queueRow).getByRole("button", { name: "Delete" })).toHaveClass(
  "bg-red-950/90",
);
expect(screen.getByRole("button", { name: "Keep selected" })).toHaveClass(
  "bg-emerald-600/90",
);
expect(screen.getByRole("button", { name: /No unread/i })).toHaveClass(
  "rounded-md",
);
```

- [ ] **Step 2: Run cleanup tests to verify they fail**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: FAIL because inline buttons still use ad-hoc classes

- [ ] **Step 3: Replace bulk action buttons with `DecisionButton`**

```tsx
import { DecisionButton } from "@/components/shared/decision-button";

<DecisionButton
  intent="keep"
  aria-label={bulkKeepActionLabel}
  onClick={onKeepSelection}
>
  <Check className="h-4 w-4" />
  {keepLabel}
</DecisionButton>;
```

Repeat for `defer` and `delete`.

- [ ] **Step 4: Replace inline row actions with `DecisionButton`**

```tsx
<DecisionButton
  intent="delete"
  onClick={(event) => {
    event.stopPropagation();
    onDeleteCandidate(candidate.feedId);
  }}
>
  <Trash2 className="h-4 w-4" />
  {deleteLabel}
</DecisionButton>
```

- [ ] **Step 5: Replace filter buttons in `feed-cleanup-overview-panel.tsx` with the chip wrapper**

Use the current cleanup API names and loop structure already present in `feed-cleanup-overview-panel.tsx`:

```tsx
<ControlChipButton
  pressed={activeFilterKeys.size === 0}
  onClick={() => {
    filterOptions.forEach((filter) => {
      if (activeFilterKeys.has(filter.key)) {
        onToggleFilter(filter.key);
      }
    });
  }}
>
  <span>{t("all_candidates")}</span>
  <span>{pendingCard?.value ?? "0"}</span>
</ControlChipButton>;

{
  filterOptions.map((filter) => (
    <ControlChipButton
      key={filter.key}
      pressed={activeFilterKeys.has(filter.key)}
      aria-label={`${filter.label} ${filterCounts[filter.key]}`}
      onClick={() => onToggleFilter(filter.key)}
    >
      <span>{filter.label}</span>
      <span>{filterCounts[filter.key]}</span>
    </ControlChipButton>
  ));
}
```

- [ ] **Step 6: Keep selection checkbox hit area and row CTA behavior unchanged**

Do not change:

```tsx
data-testid={`feed-cleanup-selection-hit-area-${candidate.feedId}`}
className="-m-2 inline-flex rounded-full p-2"
```

and keep `event.stopPropagation()` in inline decision actions.

- [ ] **Step 7: Run cleanup tests to verify they pass**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
rtk git add \
  src/components/shared/control-chip.ts \
  src/components/feed-cleanup/feed-cleanup-overview-panel.tsx \
  src/components/feed-cleanup/feed-cleanup-queue-panel.tsx \
  src/__tests__/components/feed-cleanup-queue-panel.test.tsx \
  src/__tests__/components/feed-cleanup-page.test.tsx
rtk git commit -m "$(cat <<'EOF'
refactor(cleanup): unify decision and filter buttons
EOF
)"
```

## Task 7: Full verification and browser review

### Files

- No code changes required
- Read: `tmp/screenshots/button-review-home.png`
- Read: `tmp/screenshots/button-review-subscriptions.png`
- Read: `tmp/screenshots/button-review-cleanup.png`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm vitest run \
  src/__tests__/components/nav-row-button.test.tsx \
  src/__tests__/components/decision-button.test.tsx \
  src/__tests__/components/accounts-nav-view.test.tsx \
  src/__tests__/components/settings-nav-view.test.tsx \
  src/__tests__/components/subscriptions-index-page.test.tsx \
  src/__tests__/components/feed-cleanup-queue-panel.test.tsx \
  src/__tests__/components/feed-cleanup-page.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run full quality gate**

Run: `mise run check`

Expected: format, lint, test all PASS

- [ ] **Step 3: Run browser review against the already-running app**

Open and confirm:

- `http://127.0.0.1:4173/`
- subscriptions index
- cleanup page

Check:

- settings / subscriptions row buttons share spacing and selection language
- cleanup filters read visually as chips, not full CTA buttons
- `残す / あとで確認 / 削除` share one action language
- reader sidebar still looks unchanged
- 実装したボタンの radius / border / surface tone が `DESIGN.md` の warm minimalism 方針から外れていない

- [ ] **Step 4: Use `atomic-commit` only for touched files if follow-up fixes are needed**

If verification finds issues, group only touched files and commit with `atomic-commit` guidance:

```bash
rtk git status --short
rtk git diff -- <touched-files>
rtk git log --oneline -10
```

## Self-Review

### Spec coverage

- `NavRowButton` planned: covered by Tasks 1, 3, 4
- `DecisionButton` planned: covered by Tasks 2, 6
- chip / filter reuse planned: covered by Tasks 5, 6
- `CardActionButton` deferred: explicitly left out of tasks
- browser review planned: covered by Task 7

### Placeholder scan

- No `TODO` / `TBD`
- Every task names exact files
- Every code-writing step contains concrete code blocks
- Every verification step contains explicit commands

### Type consistency

- `NavRowButton` uses `selected`, `leading`, `trailing`, `title`, `description`, `tone`
- `DecisionButton` uses `intent`
- chip wrapper uses `pressed`
- Later tasks reuse the same prop names consistently
