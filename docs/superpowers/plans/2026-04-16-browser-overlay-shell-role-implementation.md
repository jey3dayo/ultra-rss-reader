# Browser Overlay Shell Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: browser overlay の操作 chrome と stage 境界を `shell role` として共通化し、`section` surface と責務が混ざらない状態へ揃える

Architecture: `SurfaceCard` とは別に `OverlayActionSurface` と `OverlayStageSurface` を `src/components/shared` へ追加し、browser overlay の見た目責務だけを shared へ上げる。geometry、absolute positioning、event handling は既存の browser overlay controller / presentation に残し、Storybook では shell 例外を section 見本から明示分離する。

Tech Stack: React 19, TypeScript, Vitest, Testing Library, class-variance-authority, Tailwind CSS v4, Storybook, Biome

---

## File Map

### Create

- `src/components/shared/overlay-action-surface.tsx`
  - browser overlay action chrome 用の shell primitive
- `src/components/shared/overlay-stage-surface.tsx`
  - browser overlay stage boundary 用の shell primitive
- `src/__tests__/components/overlay-action-surface.test.tsx`
  - `OverlayActionSurface` の compact / tone / explicit role 契約を検証する単体テスト
- `src/__tests__/components/overlay-stage-surface.test.tsx`
  - `OverlayStageSurface` の `scope` ごとの class contract を検証する単体テスト

### Modify

- `src/components/reader/browser-overlay-presentation.ts`
  - class string 直書きを shared shell primitive 経由へ置き換える
- `src/components/reader/browser-overlay-chrome.tsx`
  - close-only / action surface を `OverlayActionSurface` に寄せる
- `src/components/reader/browser-view.tsx`
  - top rail / stage の shell role 境界を明確にし、`OverlayStageSurface` に寄せる
- `src/components/reader/browser-view.types.ts`
  - shell presentation 用 props を class string ではなく semantic props で返すよう更新
- `src/__tests__/components/browser-overlay-presentation.test.ts`
  - presentation helper の期待値を shared shell class 契約に更新
- `src/__tests__/components/browser-overlay-chrome.test.tsx`
  - close / leading action が shell surface 経由で描画されることを検証
- `src/__tests__/components/browser-view.test.tsx`
  - stage shell と top rail の見え方 / role separation の期待値を更新
- `src/components/storybook/ui-reference-settings-canvas.stories.tsx`
  - shell example を section specimen と分離し、outer frame / dialog / context menu を shell として示す
- `DESIGN.md`
  - shell role を section と分けて明文化する

### Read During Implementation

- `docs/superpowers/specs/2026-04-16-browser-overlay-shell-role-design.md`
- `docs/superpowers/specs/2026-04-16-surface-card-radius-governance-design.md`
- `src/components/shared/surface-card.tsx`
- `src/components/ui/button.tsx`
- `src/components/shared/icon-toolbar-control.tsx`
- `src/components/ui/tooltip.tsx`

## Scope Notes

- この plan は `browser overlay` の shell role 整理だけに限定する
- tooltip 自体の redesign はしない
- dialog / context menu の実装共通化はしない。Storybook 上で `section` と分離して見せるだけに留める
- geometry 計算ロジックや browser overlay の挙動変更はしない

## Concurrency Safety

- 実装前に `git status --short` を読み、計画対象外の差分を触らない
- この repository には未コミットの別件変更が存在する前提で進める
- 各 commit ではこの plan の対象ファイルだけを `git add` する

## Commit Plan

- Commit 1: `test(shared): add browser overlay shell primitives`
- Commit 2: `refactor(reader): reuse shell primitives in overlay presentation`
- Commit 3: `docs(design): define browser overlay shell role`

## Task 1: Add shell primitives

### Files

- Create: `src/components/shared/overlay-action-surface.tsx`
- Create: `src/components/shared/overlay-stage-surface.tsx`
- Create: `src/__tests__/components/overlay-action-surface.test.tsx`
- Create: `src/__tests__/components/overlay-stage-surface.test.tsx`
- Read: `src/components/shared/surface-card.tsx`

- [ ] **Step 1: Write the failing test for `OverlayActionSurface`**

Create `src/__tests__/components/overlay-action-surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverlayActionSurface } from "@/components/shared/overlay-action-surface";

describe("OverlayActionSurface", () => {
  it("requires an explicit shell role variant and maps compact state to the shell action surface", () => {
    render(
      <>
        <OverlayActionSurface data-testid="compact-action" compact tone="default">
          <button type="button">Compact action</button>
        </OverlayActionSurface>
        <OverlayActionSurface data-testid="regular-action" compact={false} tone="subtle">
          <button type="button">Regular action</button>
        </OverlayActionSurface>
      </>,
    );

    const compact = screen.getByTestId("compact-action");
    const regular = screen.getByTestId("regular-action");

    expect(compact).toHaveAttribute("data-overlay-shell", "action");
    expect(compact).toHaveClass("rounded-full");
    expect(compact).toHaveClass("bg-background/78");
    expect(compact).toHaveClass("size-11");

    expect(regular).toHaveAttribute("data-overlay-shell", "action");
    expect(regular).toHaveClass("rounded-full");
    expect(regular).toHaveClass("h-8");
    expect(regular).toHaveClass("px-3");
  });
});
```

- [ ] **Step 2: Write the failing test for `OverlayStageSurface`**

Create `src/__tests__/components/overlay-stage-surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OverlayStageSurface } from "@/components/shared/overlay-stage-surface";

describe("OverlayStageSurface", () => {
  it("separates main-stage and content-pane shell boundaries", () => {
    render(
      <>
        <OverlayStageSurface data-testid="main-stage" scope="main-stage">
          Main stage
        </OverlayStageSurface>
        <OverlayStageSurface data-testid="content-pane" scope="content-pane">
          Content pane
        </OverlayStageSurface>
      </>,
    );

    const mainStage = screen.getByTestId("main-stage");
    const contentPane = screen.getByTestId("content-pane");

    expect(mainStage).toHaveAttribute("data-overlay-shell", "stage");
    expect(mainStage).not.toHaveClass("border");
    expect(mainStage).toHaveClass("bg-background");

    expect(contentPane).toHaveAttribute("data-overlay-shell", "stage");
    expect(contentPane).toHaveClass("border");
    expect(contentPane).toHaveClass("border-border/60");
    expect(contentPane).toHaveClass("shadow-elevation-3");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/components/overlay-action-surface.test.tsx \
  src/__tests__/components/overlay-stage-surface.test.tsx
```

Expected: FAIL with module-not-found for the new shared files

- [ ] **Step 4: Write the minimal `OverlayActionSurface` implementation**

Create `src/components/shared/overlay-action-surface.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const overlayActionSurfaceVariants = cva(
  "pointer-events-auto rounded-full border border-border/75 bg-background/78 text-foreground shadow-elevation-2 backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-card/92 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-card/96 focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 active:scale-[0.97] active:border-border-strong active:bg-card active:shadow-elevation-1",
  {
    variants: {
      compact: {
        true: "size-11 md:size-8",
        false: "h-8 px-3 text-[0.78rem] font-medium tracking-[0.02em]",
      },
      tone: {
        default: "",
        subtle: "bg-background/72 border-border/70",
      },
    },
    defaultVariants: {
      compact: false,
      tone: "default",
    },
  },
);

type OverlayActionSurfaceProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof overlayActionSurfaceVariants>;

export function OverlayActionSurface({ compact, tone, className, ...props }: OverlayActionSurfaceProps) {
  return (
    <div
      {...props}
      data-overlay-shell="action"
      className={cn(overlayActionSurfaceVariants({ compact, tone }), className)}
    />
  );
}
```

- [ ] **Step 5: Write the minimal `OverlayStageSurface` implementation**

Create `src/components/shared/overlay-stage-surface.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const overlayStageSurfaceVariants = cva("absolute z-10 overflow-hidden bg-background", {
  variants: {
    scope: {
      "main-stage": "",
      "content-pane": "border border-border/60 shadow-elevation-3",
    },
  },
});

type OverlayStageSurfaceProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof overlayStageSurfaceVariants>;

export function OverlayStageSurface({ scope, className, ...props }: OverlayStageSurfaceProps) {
  return (
    <div
      {...props}
      data-overlay-shell="stage"
      className={cn(overlayStageSurfaceVariants({ scope }), className)}
    />
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/components/overlay-action-surface.test.tsx \
  src/__tests__/components/overlay-stage-surface.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add \
  src/components/shared/overlay-action-surface.tsx \
  src/components/shared/overlay-stage-surface.tsx \
  src/__tests__/components/overlay-action-surface.test.tsx \
  src/__tests__/components/overlay-stage-surface.test.tsx
git commit -m "test(shared): add browser overlay shell primitives"
```

## Task 2: Move overlay presentation to shared shell primitives

### Files

- Modify: `src/components/reader/browser-overlay-presentation.ts`
- Modify: `src/components/reader/browser-overlay-chrome.tsx`
- Modify: `src/components/reader/browser-view.tsx`
- Modify: `src/components/reader/browser-view.types.ts`
- Modify: `src/__tests__/components/browser-overlay-presentation.test.ts`
- Modify: `src/__tests__/components/browser-overlay-chrome.test.tsx`
- Modify: `src/__tests__/components/browser-view.test.tsx`
- Read: `src/components/shared/overlay-action-surface.tsx`
- Read: `src/components/shared/overlay-stage-surface.tsx`

- [ ] **Step 1: Update the failing presentation test to look for the shared shell contract**

In `src/__tests__/components/browser-overlay-presentation.test.ts`, replace the current assertions with:

```tsx
it("returns semantic shell props for leading and action chrome", () => {
  expect(getBrowserOverlayLeadingActionSurfaceProps(true)).toEqual({ compact: true, tone: "default" });
  expect(getBrowserOverlayLeadingActionSurfaceProps(false)).toEqual({ compact: false, tone: "default" });
  expect(getBrowserOverlayActionSurfaceProps(true)).toEqual({ compact: true, tone: "default" });
});

it("returns the stage scope without leaking class strings", () => {
  expect(getBrowserOverlayStageSurfaceScope("main-stage")).toBe("main-stage");
  expect(getBrowserOverlayStageSurfaceScope("content-pane")).toBe("content-pane");
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/components/browser-overlay-presentation.test.ts \
  src/__tests__/components/browser-overlay-chrome.test.tsx \
  src/__tests__/components/browser-view.test.tsx
```

Expected: FAIL because the overlay files do not yet render shared shell primitives

- [ ] **Step 3: Replace class-string helpers with shared action/stage wrappers**

Update `src/components/reader/browser-overlay-presentation.ts` so it returns wrapper fragments instead of raw class strings:

```tsx
export function getBrowserOverlayLeadingActionSurfaceProps(isCompactViewer: boolean) {
  return { compact: isCompactViewer, tone: "default" as const };
}

export function getBrowserOverlayActionSurfaceProps(isCompactViewer: boolean) {
  return { compact: isCompactViewer, tone: "default" as const };
}

export function getBrowserOverlayStageSurfaceScope(scope: "content-pane" | "main-stage") {
  return scope;
}
```

Then update `src/components/reader/browser-view.types.ts`, `src/components/reader/browser-view-presentation.ts`, `src/components/reader/browser-overlay-chrome.tsx`, and `src/components/reader/browser-view.tsx` so presentation returns semantic props instead of class strings:

```tsx
type BrowserShellActionPresentation = {
  compact: boolean;
  tone: "default" | "subtle";
};

type BrowserViewPresentation = {
  geometry: BrowserViewGeometry;
  leadingActionSurface: BrowserShellActionPresentation;
  actionButtonSurface: BrowserShellActionPresentation;
  stageScope: BrowserViewScope;
};
```

```tsx
<OverlayActionSurface
  compact={controller.leadingActionSurface.compact}
  tone={controller.leadingActionSurface.tone}
  className="pointer-events-auto"
>
  <Button ... />
</OverlayActionSurface>
```

```tsx
<OverlayStageSurface
  scope={controller.stageScope}
  data-testid="browser-overlay-stage"
  ref={controller.stageRef}
  style={{
    left: `${controller.geometry.stage.left}px`,
    top: `${controller.geometry.stage.top}px`,
    right: `${controller.geometry.stage.right}px`,
    bottom: `${controller.geometry.stage.bottom}px`,
    borderRadius: `${controller.geometry.stage.radius}px`,
  }}
>
  ...
</OverlayStageSurface>
```

Keep:

- top rail geometry
- click handling
- browser host placement
- existing labels and events

- [ ] **Step 4: Update the browser overlay tests to assert shell role markup**

Add or update these expectations:

```tsx
expect(screen.getByTestId("browser-overlay-chrome").querySelector('[data-overlay-shell="action"]')).not.toBeNull();
expect(screen.getByTestId("browser-overlay-stage")).toHaveAttribute("data-overlay-shell", "stage");
expect(screen.getByTestId("browser-overlay-stage")).toHaveClass("bg-background");
```

Keep the existing behavior assertions:

- close action still calls `handleCloseOverlay`
- scrim click still closes only in `content-pane`
- top rail still renders in `main-stage`

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/components/browser-overlay-presentation.test.ts \
  src/__tests__/components/browser-overlay-chrome.test.tsx \
  src/__tests__/components/browser-view.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  src/components/reader/browser-overlay-presentation.ts \
  src/components/reader/browser-overlay-chrome.tsx \
  src/components/reader/browser-view.tsx \
  src/components/reader/browser-view.types.ts \
  src/__tests__/components/browser-overlay-presentation.test.ts \
  src/__tests__/components/browser-overlay-chrome.test.tsx \
  src/__tests__/components/browser-view.test.tsx
git commit -m "refactor(reader): reuse shell primitives in overlay presentation"
```

## Task 3: Document shell role and separate shell examples in Storybook

### Files

- Modify: `src/components/storybook/ui-reference-settings-canvas.stories.tsx`
- Modify: `DESIGN.md`

- [ ] **Step 1: Add a failing test or explicit review checkpoint for Storybook shell separation**

Because this repository does not have Storybook snapshot tests, create an explicit manual-check block in the plan execution notes before code changes:

```md
Manual red check:
- `ui-reference-settings-canvas` still mixes shell examples and section specimens
- left rail outer frame, main content outer frame, dialog surface, and context menu are not labeled as shell examples
```

- [ ] **Step 2: Update Storybook to separate shell examples from section specimens**

In `src/components/storybook/ui-reference-settings-canvas.stories.tsx`, add a shell-focused specimen block and relabel the existing outer-frame examples:

```tsx
function ShellRoleSpecimen() {
  return (
    <SurfaceCard variant="section">
      <SectionHeading className="mb-2">Shell examples</SectionHeading>
      <p className="font-serif text-sm leading-[1.45] text-foreground/72">
        Overlay, modal, and outer-frame surfaces are shell roles. They are exceptions to the 8px section language.
      </p>
    </SurfaceCard>
  );
}
```

Render it near the reference area where dialog / context menu are already shown, and update visible labels:

```tsx
<SectionHeading className="mb-2">Shell dialog</SectionHeading>
<SectionHeading className="mb-2">Shell context menu</SectionHeading>
```

Also add a short note near the left rail and main content outer frame that these are shell examples, not section containers.

- [ ] **Step 3: Update `DESIGN.md` to define shell role more explicitly**

Add language like this to the `Components` and `Surface governance` sections:

```md
- **Shell Roles**: Overlay chrome, modal shells, command palettes, and app-level outer frames are shell roles rather than cards. They may use larger radii, blur, and higher floating elevation when they frame or protect another surface.
```

```md
- Shell roles are distinct outer surfaces. They are allowed to exceed the standard section radius language when the interface is framing embedded content, modal context, or app-level chrome.
```

- [ ] **Step 4: Run formatting and full verification**

Run:

```bash
pnpm exec markdownlint-cli2 DESIGN.md docs/superpowers/specs/2026-04-16-browser-overlay-shell-role-design.md docs/superpowers/plans/2026-04-16-browser-overlay-shell-role-implementation.md
pnpm exec biome check --write src/components/storybook/ui-reference-settings-canvas.stories.tsx DESIGN.md
mise run check
```

Expected:

- markdownlint passes
- Biome passes
- `mise run check` passes

- [ ] **Step 5: Commit**

```bash
git add \
  src/components/storybook/ui-reference-settings-canvas.stories.tsx \
  DESIGN.md \
  docs/superpowers/plans/2026-04-16-browser-overlay-shell-role-implementation.md
git commit -m "docs(design): define browser overlay shell role"
```

## Spec Coverage Checklist

- browser overlay を shell role として定義:
  - Task 3 `DESIGN.md`
- `OverlayActionSurface` の導入:
  - Task 1
  - Task 2 integration
- `OverlayStageSurface` の導入:
  - Task 1
  - Task 2 integration
- geometry / positioning を caller に残す:
  - Task 2 implementation constraints
- Storybook の shell 例外分離:
  - Task 3

## Placeholder Scan

- `TODO`, `TBD`, “similar to” は未使用
- 各 code step に実コードを記載
- verification command はすべて具体化済み

## Type Consistency Check

- shell primitive 名は全タスクで `OverlayActionSurface` / `OverlayStageSurface`
- scope 名は `main-stage | content-pane`
- `SurfaceCard` とは責務を分離し、shell を混ぜない
