# Debug HUD Product Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** focus debug HUD を、透明感は維持したまま product UI の button / surface 文法に揃え、情報の読み順を少し整理する。

**Architecture:** `DebugHudFrame` は shell role に専念させ、`FocusDebugHudView` は情報配置に責務を絞る。HUD 専用の button class 直書きはやめて、shared button family を使うか、必要最小限の `DebugHudActionButton` wrapper に寄せる。回帰防止は `focus-debug-hud-view` と `debug-hud-frame` の既存テストを更新して担保する。

**Tech Stack:** React 19, TypeScript, class-variance-authority, Vitest, Testing Library, Tailwind utility classes, Biome, mise

---

## File Structure

- Create: `src/components/debug/debug-hud-action-button.tsx`
  - HUD 内で shared button family を薄くラップし、transparent dark overlay に馴染む tone だけを与える
- Modify: `src/components/debug/debug-hud-frame.tsx`
  - HUD 外枠の border / blur / opacity / radius を product-aligned な透明 shell に寄せる
- Modify: `src/components/debug/focus-debug-hud-view.tsx`
  - `More` / `Copy` / `Show` / `Hide` を shared button family に寄せ、`pane / mode` の読み順と block ラベルを軽く整理する
- Modify: `src/__tests__/components/focus-debug-hud-view.test.tsx`
  - button family、collapsed/expanded の情報整理、touch-safe サイズを検証する
- Modify: `src/__tests__/components/debug-hud-frame.test.tsx`
  - frame surface の tone 契約更新を反映する

## Task 1: Replace HUD-Specific Buttons With A Shared Button Family

**Files:**

- Create: `src/components/debug/debug-hud-action-button.tsx`
- Modify: `src/components/debug/focus-debug-hud-view.tsx`
- Modify: `src/__tests__/components/focus-debug-hud-view.test.tsx`

- [ ] **Step 1: Write the failing tests for shared HUD action buttons**

Update `src/__tests__/components/focus-debug-hud-view.test.tsx` so it asserts the HUD action buttons use the new shared button family instead of the old ad hoc `rounded-lg border border-white/...` classes.

```tsx
  it("renders HUD actions with the shared compact button family", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="button | label=Copy debug HUD"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    const moreButton = screen.getByRole("button", { name: "More" });
    const copyButton = screen.getByRole("button", { name: "Copy debug HUD" });

    expect(moreButton).toHaveClass("rounded-md", "h-10", "px-4");
    expect(copyButton).toHaveClass("rounded-md", "h-10", "px-4");
    expect(moreButton).not.toHaveClass("rounded-lg", "border-white/12");
    expect(copyButton).not.toHaveClass("rounded-lg", "border-white/14");
  });
```

Keep the existing accessibility and min-height tests, but change the expected height contract from `min-h-11` to the new shared button height if needed.

- [ ] **Step 2: Run the focused HUD view test and verify it fails**

Run:

```bash
pnpm exec vitest run src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: FAIL because `More` / `Copy` still render the old HUD-specific `rounded-lg` / white-border classes.

- [ ] **Step 3: Add a thin shared-button wrapper for HUD actions**

Create `src/components/debug/debug-hud-action-button.tsx`:

```tsx
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SettingsActionButton } from "@/components/settings/settings-action-button";

type DebugHudActionButtonProps = Omit<ComponentProps<typeof SettingsActionButton>, "children"> & {
  children: ReactNode;
};

export function DebugHudActionButton({
  children,
  className,
  tone = "content",
  size = "compact",
  ...props
}: DebugHudActionButtonProps) {
  return (
    <SettingsActionButton
      {...props}
      tone={tone}
      size={size}
      className={cn(
        "h-10 rounded-md border-0 bg-white/[0.06] px-4 text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.1] hover:text-white/92 focus-visible:bg-white/[0.1] focus-visible:text-white/92 focus-visible:ring-white/18",
        className,
      )}
    >
      {children}
    </SettingsActionButton>
  );
}
```

This wrapper must stay thin: shared button family + HUD tone only. Do not move HUD layout logic into it.

- [ ] **Step 4: Swap `More` / `Copy` / `Show` / `Hide` in `FocusDebugHudView`**

Update `src/components/debug/focus-debug-hud-view.tsx` to use `DebugHudActionButton` instead of feature-local `<button>` elements for:

- `More` / `Less`
- `Copy`
- `Show` / `Hide`

Use this pattern:

```tsx
import { DebugHudActionButton } from "@/components/debug/debug-hud-action-button";
```

```tsx
<DebugHudActionButton
  type="button"
  onClick={() => setExpanded((current) => !current)}
  aria-expanded={expanded}
  aria-controls={tracePanelId}
>
  {expanded ? "Less" : "More"}
</DebugHudActionButton>
```

```tsx
<DebugHudActionButton
  type="button"
  aria-label="Copy debug HUD"
  onClick={onCopyClick}
  onPointerDown={onCopyPointerDown}
  className="gap-2"
>
  <Copy className="size-3.5" />
  Copy
</DebugHudActionButton>
```

```tsx
<DebugHudActionButton
  type="button"
  onClick={() => setShowGeometry((current) => !current)}
  aria-expanded={showGeometry}
  aria-controls={geometryPanelId}
  className="px-3 text-[10px] uppercase tracking-[0.16em]"
>
  {showGeometry ? "Hide" : "Show"}
</DebugHudActionButton>
```

- [ ] **Step 5: Re-run the HUD view test and verify it passes**

Run:

```bash
pnpm exec vitest run src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: PASS. The buttons should now use the shared compact button family with HUD-specific tones.

- [ ] **Step 6: Commit the HUD button unification**

Run:

```bash
git add src/components/debug/debug-hud-action-button.tsx src/components/debug/focus-debug-hud-view.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
git commit -m "refactor: align debug hud actions with shared buttons"
```

## Task 2: Align HUD Shell And Inner Surfaces With Product Overlay Language

**Files:**

- Modify: `src/components/debug/debug-hud-frame.tsx`
- Modify: `src/components/debug/focus-debug-hud-view.tsx`
- Modify: `src/__tests__/components/debug-hud-frame.test.tsx`

- [ ] **Step 1: Write the failing frame test for the quieter overlay shell**

Update `src/__tests__/components/debug-hud-frame.test.tsx` to assert the new shell language instead of the old heavy white-border contract.

```tsx
  it("renders the panel surface as a quieter transparent shell", () => {
    render(
      <DebugHudFrame as="section" surface="panelCollapsed">
        Panel
      </DebugHudFrame>,
    );

    const frame = screen.getByText("Panel");

    expect(frame.tagName).toBe("SECTION");
    expect(frame).toHaveClass("pointer-events-auto");
    expect(frame).toHaveClass("rounded-[22px]");
    expect(frame).toHaveClass("border-white/8");
    expect(frame).toHaveClass("backdrop-blur-xl");
    expect(frame).not.toHaveClass("hover:opacity-35");
  });
```

- [ ] **Step 2: Run the frame test and verify it fails**

Run:

```bash
pnpm exec vitest run src/__tests__/components/debug-hud-frame.test.tsx
```

Expected: FAIL because the current shell still uses the old `rounded-2xl`, `backdrop-blur-md`, and stronger opacity behavior.

- [ ] **Step 3: Update `DebugHudFrame` to the new shell contract**

Replace the `panelCollapsed` and `panelExpanded` variant strings in `src/components/debug/debug-hud-frame.tsx` with a quieter product-aligned shell.

```tsx
      panelCollapsed:
        "pointer-events-auto rounded-[22px] border border-white/8 bg-black/60 opacity-90 backdrop-blur-xl shadow-[0_18px_42px_rgba(0,0,0,0.28)] hover:border-white/12 hover:bg-black/64 focus-within:border-white/14 focus-within:bg-black/68 focus-within:opacity-100",
      panelExpanded:
        "pointer-events-auto rounded-[22px] border border-white/10 bg-black/72 opacity-96 backdrop-blur-xl shadow-[0_22px_48px_rgba(0,0,0,0.34)] hover:border-white/14 hover:bg-black/74 focus-within:border-white/16 focus-within:bg-black/78 focus-within:opacity-100",
```

Keep `strip` and `stripCompact` unchanged unless the updated tests force a change.

- [ ] **Step 4: Reduce the inner card separation in `FocusDebugHudView`**

Update inner cards in `src/components/debug/focus-debug-hud-view.tsx` so they feel closer to product cards and less like a second HUD system:

```tsx
className="rounded-2xl border border-white/7 bg-white/[0.035] px-3 py-3"
```

Apply the same direction to:

- collapsed summary card
- expanded focused element card
- geometry card
- trace / recent events cards

Do not remove transparency or monospace treatment. Only reduce the “HUD inside HUD” feeling by narrowing the shell-to-card contrast.

- [ ] **Step 5: Re-run frame and HUD tests**

Run:

```bash
pnpm exec vitest run src/__tests__/components/debug-hud-frame.test.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: PASS. The shell and inner cards should now match the quieter overlay contract.

- [ ] **Step 6: Commit the shell alignment**

Run:

```bash
git add src/components/debug/debug-hud-frame.tsx src/components/debug/focus-debug-hud-view.tsx src/__tests__/components/debug-hud-frame.test.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
git commit -m "style: align debug hud shell surfaces"
```

## Task 3: Lightly Reorder Information For Faster Reading

**Files:**

- Modify: `src/components/debug/focus-debug-hud-view.tsx`
- Modify: `src/__tests__/components/focus-debug-hud-view.test.tsx`

- [ ] **Step 1: Write the failing test for the lighter information hierarchy**

Extend `src/__tests__/components/focus-debug-hud-view.test.tsx` with assertions for the new reading order:

```tsx
  it("surfaces pane and mode as compact badges in the header", () => {
    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="empty"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="div | role=option | label=Focused row"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    expect(screen.getByText("pane=list")).toBeInTheDocument();
    expect(screen.getByText("mode=empty")).toBeInTheDocument();
    expect(screen.queryByText("pane=list mode=empty")).toBeNull();
  });

  it("labels the expanded summary and trace areas explicitly", async () => {
    const user = userEvent.setup();

    render(
      <FocusDebugHudView
        focusedPane="list"
        contentMode="reader"
        selectedArticleId="article-1"
        browserCloseInFlight={false}
        pendingBrowserCloseAction={null}
        activeElementDescription="div | role=option | label=Focused row"
        browserGeometryRows={[]}
        traces={["12:00:00.000 raw-key Enter"]}
        onCopyClick={vi.fn()}
        onCopyPointerDown={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByText("Focused element")).toBeInTheDocument();
    expect(screen.getByText("Recent events")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the HUD view test and verify it fails**

Run:

```bash
pnpm exec vitest run src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: FAIL because the current header still renders `pane=list mode=...` as one line and the block labels have not been updated.

- [ ] **Step 3: Implement the lighter hierarchy in `FocusDebugHudView`**

Make these focused changes:

1. Replace the single header status line with two compact badges:

```tsx
<div className="mt-2 flex flex-wrap gap-1.5">
  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/58">
    pane={focusedPane}
  </span>
  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/58">
    mode={contentMode}
  </span>
</div>
```

1. In expanded mode, rename the first card eyebrow to `Focused element`.

```tsx
<div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/42">Focused element</div>
```

1. Rename `Trace` to `Recent events` in both expanded and collapsed event areas.

1. Keep `closing` / `pending` pills visible, but use the same quieter badge treatment already used for pane/mode.

Do not rename the underlying data values or remove any technical lines.

- [ ] **Step 4: Re-run the HUD view test and verify it passes**

Run:

```bash
pnpm exec vitest run src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: PASS. The header should show separate `pane` and `mode` badges, and the cards should expose the new labels.

- [ ] **Step 5: Commit the information cleanup**

Run:

```bash
git add src/components/debug/focus-debug-hud-view.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
git commit -m "feat: refine debug hud information hierarchy"
```

## Task 4: Run The Quality Gate For The HUD Changes

**Files:**

- Verify: `src/components/debug/debug-hud-action-button.tsx`
- Verify: `src/components/debug/debug-hud-frame.tsx`
- Verify: `src/components/debug/focus-debug-hud-view.tsx`
- Verify: `src/__tests__/components/debug-hud-frame.test.tsx`
- Verify: `src/__tests__/components/focus-debug-hud-view.test.tsx`

- [ ] **Step 1: Format the touched HUD files**

Run:

```bash
pnpm exec biome format --write src/components/debug/debug-hud-action-button.tsx src/components/debug/debug-hud-frame.tsx src/components/debug/focus-debug-hud-view.tsx src/__tests__/components/debug-hud-frame.test.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: files are rewritten only if formatting drift exists.

- [ ] **Step 2: Run the focused HUD tests**

Run:

```bash
pnpm exec vitest run src/__tests__/components/debug-hud-frame.test.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run the repository quality gate**

Run:

```bash
mise run check
```

Expected: formatter, lint, types, rust tests, and vitest all pass with exit code 0.

- [ ] **Step 4: Commit any final polish if formatting or check required updates**

If any files changed during Step 1 or Step 3, run:

```bash
git add src/components/debug/debug-hud-action-button.tsx src/components/debug/debug-hud-frame.tsx src/components/debug/focus-debug-hud-view.tsx src/__tests__/components/debug-hud-frame.test.tsx src/__tests__/components/focus-debug-hud-view.test.tsx
git commit -m "chore: polish debug hud alignment"
```

If no files changed, mark this step complete without creating an extra commit.
