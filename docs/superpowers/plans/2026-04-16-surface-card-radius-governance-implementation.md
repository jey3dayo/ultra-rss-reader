# Surface Card Radius Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `情報カード` と `セクション箱` の角丸・surface 表現を shared primitive に寄せ、`ArticleEmptyStateView` と `SettingsSection` を最初の適用先として Storybook 基準面まで揃える

**Architecture:** `src/styles/global.css` に surface role 用の radius token を追加し、`src/components/shared/surface-card.tsx` で `variant="info" | "section"` を選ぶ shared primitive を導入する。feature 側は `rounded-[...]` の値を直書きせず、`SurfaceCard` を通して役割を宣言し、Storybook の参照キャンバスと `DESIGN.md` を同じ semantic role で整合させる。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, class-variance-authority, Tailwind CSS v4, Storybook, Biome

---

## File Map

### Create

- `src/components/shared/surface-card.tsx`
  - `情報カード` / `セクション箱` を切り替える shared surface primitive
- `src/__tests__/components/surface-card.test.tsx`
  - `SurfaceCard` の variant / tone / padding 契約を検証する単体テスト
- `src/__tests__/components/settings-section.test.tsx`
  - `SettingsSection` が `section` role を使うことを検証するテスト

### Modify

- `src/styles/global.css`
  - surface role 用 radius token を追加
- `src/components/reader/article-empty-state-view.tsx`
  - bespoke な `rounded-[2rem]` shell を `SurfaceCard` に置き換える
- `src/components/reader/article-empty-state-view.stories.tsx`
  - shared role を反映したモックに更新
- `src/__tests__/components/article-empty-state-view.test.tsx`
  - `info` surface role 前提の期待値へ更新
- `src/components/settings/settings-section.tsx`
  - section wrapper を `SurfaceCard` に置き換える
- `src/components/settings/settings-components.stories.tsx`
  - `Full Settings Section` を `SettingsSection` 経由のモックに更新
- `src/components/storybook/ui-reference-settings-canvas.stories.tsx`
  - `info` / `section` の基準見本を追加
- `DESIGN.md`
  - surface role と radius governance を追記

### Read During Implementation

- `docs/superpowers/specs/2026-04-16-surface-card-radius-governance-design.md`
- `DESIGN_REVIEW.md`
- `src/components/shared/control-chip.ts`
- `src/components/ui/button.tsx`
- `src/components/shared/section-heading.tsx`

## Visual Alignment Rules

- `情報カード` は `6px family` を標準とし、過剰な丸みより読みやすさを優先する
- `セクション箱` は `8px family` を標準とし、画面構造の区切りとして穏やかな border と elevation を持たせる
- `20px` を超える radius は今回の 2 role では使わない
- gradient / border / shadow は `SurfaceCard` に閉じ込め、呼び出し側で独自に足さない
- Storybook では実コンポーネントを使って基準見本を作り、ローカル mock 用の独自クラスを増やさない

## Commit Plan

- Commit 1: `test(shared): add surface card coverage`
- Commit 2: `refactor(reader): move article empty state to surface card`
- Commit 3: `refactor(settings): move section containers to surface card`
- Commit 4: `docs(design): document surface role governance`

## Task 1: Add surface radius tokens and `SurfaceCard`

**Files:**

- Modify: `src/styles/global.css`
- Create: `src/components/shared/surface-card.tsx`
- Test: `src/__tests__/components/surface-card.test.tsx`
- Read: `src/components/shared/control-chip.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SurfaceCard } from "@/components/shared/surface-card";

describe("SurfaceCard", () => {
  it("maps info and section variants to distinct semantic surfaces", () => {
    render(
      <>
        <SurfaceCard data-testid="info-card" variant="info">
          Info
        </SurfaceCard>
        <SurfaceCard data-testid="section-card" variant="section">
          Section
        </SurfaceCard>
      </>,
    );

    const infoCard = screen.getByTestId("info-card");
    const sectionCard = screen.getByTestId("section-card");

    expect(infoCard).toHaveAttribute("data-surface-card", "info");
    expect(infoCard).toHaveClass("rounded-[var(--radius-surface-info)]");
    expect(infoCard).toHaveClass("border-border/70");

    expect(sectionCard).toHaveAttribute("data-surface-card", "section");
    expect(sectionCard).toHaveClass("rounded-[var(--radius-surface-section)]");
    expect(sectionCard).toHaveClass("border-border/60");
  });

  it("supports tone, padding, and className without changing the semantic role", () => {
    render(
      <SurfaceCard
        data-testid="success-card"
        variant="section"
        tone="success"
        padding="compact"
        className="max-w-sm"
      >
        Success
      </SurfaceCard>,
    );

    const card = screen.getByTestId("success-card");

    expect(card).toHaveAttribute("data-surface-card", "section");
    expect(card).toHaveClass("border-emerald-500/20");
    expect(card).toHaveClass("bg-emerald-500/8");
    expect(card).toHaveClass("px-3");
    expect(card).toHaveClass("py-3");
    expect(card).toHaveClass("max-w-sm");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/surface-card.test.tsx`

Expected: FAIL with module-not-found for `@/components/shared/surface-card`

- [ ] **Step 3: Add global radius tokens**

Update `src/styles/global.css` in `:root` so the role radii are centrally adjustable:

```css
:root {
  color-scheme: light;
  font-family: var(--font-sans);
  --desktop-titlebar-offset: 44px;
  --radius-surface-info: 0.375rem;
  --radius-surface-section: 0.5rem;
  --background: #f2f1ed;
  --foreground: #26251e;
  /* existing tokens continue below */
}
```

- [ ] **Step 4: Write the minimal `SurfaceCard` implementation**

Create `src/components/shared/surface-card.tsx`:

```tsx
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceCardVariants = cva("border text-card-foreground", {
  variants: {
    variant: {
      info: "rounded-[var(--radius-surface-info)]",
      section: "rounded-[var(--radius-surface-section)]",
    },
    tone: {
      default: "",
      subtle: "",
      emphasis: "",
      success: "",
      danger: "",
    },
    padding: {
      compact: "px-3 py-3",
      default: "px-4 py-4 sm:px-5 sm:py-5",
      spacious: "px-7 py-7",
    },
  },
  compoundVariants: [
    {
      variant: "info",
      tone: "default",
      className:
        "border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.98))] shadow-[0_18px_48px_-36px_hsl(var(--foreground)/0.45)]",
    },
    {
      variant: "info",
      tone: "subtle",
      className: "border-border/60 bg-surface-1/85 shadow-elevation-1",
    },
    {
      variant: "info",
      tone: "emphasis",
      className: "border-border-strong bg-surface-1 shadow-elevation-1",
    },
    {
      variant: "section",
      tone: "default",
      className: "border-border/60 bg-card/36 shadow-elevation-1",
    },
    {
      variant: "section",
      tone: "subtle",
      className: "border-border/55 bg-card/24 shadow-elevation-1",
    },
    {
      variant: "section",
      tone: "emphasis",
      className: "border-border-strong bg-card/52 shadow-elevation-1",
    },
    {
      tone: "success",
      className: "border-emerald-500/20 bg-emerald-500/8 shadow-elevation-1",
    },
    {
      tone: "danger",
      className: "border-destructive/20 bg-destructive/8 shadow-elevation-1",
    },
  ],
  defaultVariants: {
    variant: "info",
    tone: "default",
    padding: "default",
  },
});

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof surfaceCardVariants>;

export function SurfaceCard({ variant, tone, padding, className, ...props }: SurfaceCardProps) {
  return (
    <div
      data-surface-card={variant ?? "info"}
      className={cn(surfaceCardVariants({ variant, tone, padding }), className)}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/surface-card.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/components/shared/surface-card.tsx src/__tests__/components/surface-card.test.tsx
git commit -m "test(shared): add surface card coverage"
```

## Task 2: Migrate `ArticleEmptyStateView` to `info` surface

**Files:**

- Modify: `src/components/reader/article-empty-state-view.tsx`
- Modify: `src/components/reader/article-empty-state-view.stories.tsx`
- Modify: `src/__tests__/components/article-empty-state-view.test.tsx`
- Read: `src/components/shared/surface-card.tsx`

- [ ] **Step 1: Extend the failing test to assert the semantic surface**

Update `src/__tests__/components/article-empty-state-view.test.tsx` with this case:

```tsx
it("uses the shared info surface instead of a bespoke rounded shell", () => {
  render(<ArticleEmptyStateView message="Select an article to read" hints={["Pick one from the list"]} />);

  const container = screen.getByText("Select an article to read").closest('[data-surface-card]');

  expect(container).toHaveAttribute("data-surface-card", "info");
  expect(container).toHaveClass("rounded-[var(--radius-surface-info)]");
  expect(container).not.toHaveClass("rounded-[2rem]");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/article-empty-state-view.test.tsx`

Expected: FAIL because the rendered shell does not yet expose `data-surface-card="info"`

- [ ] **Step 3: Replace the bespoke shell with `SurfaceCard`**

Update `src/components/reader/article-empty-state-view.tsx`:

```tsx
import { SurfaceCard } from "@/components/shared/surface-card";
import type { ArticleEmptyStateViewProps } from "./article-view.types";

const EMPTY_HINTS: string[] = [];

export function ArticleEmptyStateView({ message, hints = EMPTY_HINTS }: ArticleEmptyStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
      <SurfaceCard variant="info" padding="spacious" className="max-w-xl text-left text-muted-foreground">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">Reader</p>
        <p className="text-left text-[1.35rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
          {message}
        </p>
        {hints.length > 0 ? (
          <ul className="mt-5 list-disc space-y-2.5 border-t border-border/60 pt-5 pl-5 text-left text-sm leading-6 marker:text-primary/80">
            {hints.map((hint) => (
              <li key={hint} className="leading-6">
                {hint}
              </li>
            ))}
          </ul>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
```

- [ ] **Step 4: Update the Storybook mock to show the shared role**

Update `src/components/reader/article-empty-state-view.stories.tsx`:

```tsx
export const Default: Story = {
  args: {
    message: "Select an article to read",
    hints: [
      "Pick one from the list to start reading.",
      "Press / when you already know what you want.",
      "Open Web Preview when the article reads better on the site.",
    ],
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/__tests__/components/article-empty-state-view.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/reader/article-empty-state-view.tsx src/components/reader/article-empty-state-view.stories.tsx src/__tests__/components/article-empty-state-view.test.tsx
git commit -m "refactor(reader): move article empty state to surface card"
```

## Task 3: Migrate `SettingsSection` and add Storybook reference specimens

**Files:**

- Modify: `src/components/settings/settings-section.tsx`
- Create: `src/__tests__/components/settings-section.test.tsx`
- Modify: `src/components/settings/settings-components.stories.tsx`
- Modify: `src/components/storybook/ui-reference-settings-canvas.stories.tsx`
- Read: `src/components/shared/section-heading.tsx`

- [ ] **Step 1: Write the failing test for `SettingsSection`**

Create `src/__tests__/components/settings-section.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsSection } from "@/components/settings/settings-section";

describe("SettingsSection", () => {
  it("wraps content in the shared section surface", () => {
    render(
      <SettingsSection heading="General" note="Warm note">
        <div>Section body</div>
      </SettingsSection>,
    );

    const card = screen.getByText("General").closest('[data-surface-card]');

    expect(card).toHaveAttribute("data-surface-card", "section");
    expect(card).toHaveClass("rounded-[var(--radius-surface-section)]");
    expect(screen.getByText("Section body")).toBeInTheDocument();
    expect(screen.getByText("Warm note")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/settings-section.test.tsx`

Expected: FAIL because `SettingsSection` still renders a bespoke `rounded-[24px]` wrapper

- [ ] **Step 3: Replace the section wrapper with `SurfaceCard`**

Update `src/components/settings/settings-section.tsx`:

```tsx
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/shared/section-heading";
import { SurfaceCard } from "@/components/shared/surface-card";

type SettingsSectionProps = {
  heading: string;
  children: ReactNode;
  note?: string;
  className?: string;
  headingClassName?: string;
  contentClassName?: string;
};

export function SettingsSection({
  heading,
  children,
  note,
  className,
  headingClassName,
  contentClassName,
}: SettingsSectionProps) {
  return (
    <section className={className}>
      <SurfaceCard variant="section">
        <SectionHeading className={headingClassName}>{heading}</SectionHeading>
        <div className={contentClassName}>{children}</div>
        {note ? <p className="mt-1.5 font-serif text-xs leading-[1.45] text-foreground/56 sm:mt-2">{note}</p> : null}
      </SurfaceCard>
    </section>
  );
}
```

- [ ] **Step 4: Update Storybook to use the real section component**

In `src/components/settings/settings-components.stories.tsx`, import `SettingsSection` and replace `FullSettingsSection`:

```tsx
import { SettingsSection } from "./settings-section";

export const FullSettingsSection: SectionHeadingStory = {
  name: "Full Settings Section",
  args: { children: "Account" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <SettingsSection heading="Account" note="Rows stay flat while the section shell defines the structure.">
        <SettingsRow label="Server" type="text" value="https://freshrss.example.com" />
        <SettingsRow label="Username" type="text" value="admin" />
        <SettingsRow label="Auto-sync" type="switch" checked={true} />
        <SettingsRow label="Sync interval" type="select" value="15 min" />
      </SettingsSection>
    </div>
  ),
};
```

In `src/components/storybook/ui-reference-settings-canvas.stories.tsx`, add a role specimen and render it near the top of the main column:

```tsx
import { SurfaceCard } from "@/components/shared/surface-card";

function SurfaceRoleSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Surface roles</SectionHeading>
      <div className="grid gap-3 md:grid-cols-2">
        <SurfaceCard variant="info" padding="compact" className="text-left text-muted-foreground">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-soft">Info</p>
          <p className="font-serif text-sm leading-[1.45]">For empty states, notices, and short reading-oriented cards.</p>
        </SurfaceCard>
        <SurfaceCard variant="section" padding="compact" className="text-left text-muted-foreground">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-soft">Section</p>
          <p className="font-serif text-sm leading-[1.45]">For larger layout containers such as settings and overview blocks.</p>
        </SurfaceCard>
      </div>
    </SurfaceCard>
  );
}

// inside the main column, before <ValidationRowSpecimen />
<SurfaceRoleSpecimen />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/components/settings-section.test.tsx src/__tests__/components/surface-card.test.tsx src/__tests__/components/article-empty-state-view.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/settings-section.tsx src/__tests__/components/settings-section.test.tsx src/components/settings/settings-components.stories.tsx src/components/storybook/ui-reference-settings-canvas.stories.tsx
git commit -m "refactor(settings): move section containers to surface card"
```

## Task 4: Document the governance rules and run full verification

**Files:**

- Modify: `DESIGN.md`
- Read: `docs/superpowers/specs/2026-04-16-surface-card-radius-governance-design.md`

- [ ] **Step 1: Update `DESIGN.md` with semantic role guidance**

Expand the `Components` and `Border Radius Scale` sections with explicit surface governance:

```md
- **Cards and Containers**: Split surface treatment into two roles. `Info Cards` use the 6px family for empty states, notices, and short reading surfaces. `Section Containers` use the 8px family for settings sections and larger structural groups. Do not treat 20px+ corner radii as the default language for either role.
```

```md
### Radius Governance

- `Info Cards` default to the 6px family
- `Section Containers` default to the 8px family
- 20px+ radii are reserved for separate shell roles such as modal chrome, not standard cards
- Reusable surfaces should be implemented through shared primitives before adding feature-local radius rules
```

- [ ] **Step 2: Verify Markdown formatting**

Run: `pnpm exec markdownlint-cli2 DESIGN.md docs/superpowers/specs/2026-04-16-surface-card-radius-governance-design.md docs/superpowers/plans/2026-04-16-surface-card-radius-governance-implementation.md`

Expected: PASS with no output

- [ ] **Step 3: Run the full project check**

Run: `mise run check`

Expected: PASS with format, lint, and test all succeeding

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md docs/superpowers/plans/2026-04-16-surface-card-radius-governance-implementation.md
git commit -m "docs(design): document surface role governance"
```

## Spec Coverage Checklist

- `情報カード` / `セクション箱` の role 分離:
  - Task 1 `SurfaceCard`
  - Task 4 `DESIGN.md`
- `20px` 超の角丸を標準から外す運用:
  - Task 1 token 化
  - Task 4 governance 追記
- `ArticleEmptyStateView` の shared 化:
  - Task 2
- `SettingsSection` の shared 化:
  - Task 3
- Storybook 基準面への反映:
  - Task 2 story
  - Task 3 reference canvas

## Placeholder Scan

- `TODO` / `TBD` / “similar to” は未使用
- すべての code step に実コードを記載済み
- すべての verification step に実コマンドと期待結果を記載済み

## Type Consistency Check

- shared primitive 名は全タスクで `SurfaceCard`
- semantic role 名は全タスクで `variant="info" | "section"`
- token 名は全タスクで `--radius-surface-info` / `--radius-surface-section`
