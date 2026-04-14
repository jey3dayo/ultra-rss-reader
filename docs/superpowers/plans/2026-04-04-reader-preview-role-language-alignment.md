# Reader/Preview Role And Language Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Align toolbar/menu responsibilities and remove mixed-language UI copy across the current reader/preview experience without changing the existing action wiring or undoing the in-progress `reader/preview` rename.

Architecture: Treat the current dirty `reader_only` / `reader_and_preview` / `preview_only` work as the baseline and finish the copy/i18n migration around it. Frontend copy should come from locale resources only, while Rust-owned custom menu labels should be resolved from the same `language = system | ja | en` preference semantics and rebuilt when that preference changes. Keep menu structure and internal action IDs stable; only user-visible labels, language resolution helpers, and menu refresh behavior should change.

Tech Stack: React 19, TypeScript, Zustand, i18next, Vitest, Tauri 2, Rust, cargo test, mise

---

## Guardrails

- The current working tree already contains `reader/preview` renames and preset logic. Do not revert that work or reintroduce `normal` / `widescreen` / generic `browser` wording in new code.
- Keep the existing native menu structure unless a step below explicitly changes a label. This plan is about role/language alignment, not menu IA redesign.
- Only localize app-owned custom menu labels. Predefined OS/Tauri items such as `About`, `Quit`, `Undo`, `Redo`, `Cut`, `Copy`, `Paste`, and `Select All` stay native.
- Preserve current action IDs and shortcuts even when the displayed label changes to `Reader` / `Preview` / `External Browser`.

## File Structure

- Create: `src/lib/ui-language.ts`
  Responsibility: pure frontend helper that resolves `system | ja | en` against a locale string and becomes the single place the frontend derives its UI language.
- Create: `src/__tests__/lib/ui-language.test.ts`
  Responsibility: regression tests for frontend language resolution semantics.
- Modify: `src/stores/preferences-store.ts`
  Responsibility: reuse `src/lib/ui-language.ts` instead of inlining `navigator.language.startsWith("ja")`.
- Modify: `src/lib/actions.ts`
  Responsibility: replace hardcoded sync toast strings with translated messages while keeping menu/shortcut action behavior unchanged.
- Modify: `src/components/app-shell.tsx`
  Responsibility: localize the toast dismiss label instead of shipping a hardcoded English aria-label.
- Modify: `src/components/reader/article-view.tsx`
  Responsibility: localize article-level fallback/toast strings and keep article-close vs preview-close semantics distinct.
- Modify: `src/components/reader/article-toolbar-view.tsx`
  Responsibility: render the updated article-toolbar labels and preserve the distinction between preview and external-browser actions.
- Modify: `src/components/reader/article-context-menu.tsx`
  Responsibility: localize article row context-menu labels so the right-click surface follows the same reader/preview terminology.
- Modify: `src/components/reader/browser-view.tsx`
  Responsibility: expose the preview overlay close affordance using preview-specific wording.
- Modify: `src/components/reader/display-mode-toggle-group.tsx`
  Responsibility: present the current preset controls using `Reader` / `Preview` terminology and localized labels/tooltips.
- Modify: `src/components/settings/reading-settings.tsx`
  Responsibility: show the same localized preset labels used by the toolbar, matching the in-progress `reader/preview` model.
- Modify: `src/components/settings/actions-settings.tsx`
  Responsibility: keep the settings "Actions" surface aligned with the same preview vs external-browser terminology used elsewhere.
- Modify: `src/locales/en/reader.json`
  Responsibility: own English reader/preview toolbar, overlay, toast, and empty-state copy.
- Modify: `src/locales/ja/reader.json`
  Responsibility: own Japanese reader/preview toolbar, overlay, toast, and empty-state copy without leaving English preset names behind.
- Modify: `src/locales/en/sidebar.json`
  Responsibility: keep sync-result toast copy shared between the sidebar button and `src/lib/actions.ts`.
- Modify: `src/locales/ja/sidebar.json`
  Responsibility: keep sync-result toast copy shared between the sidebar button and `src/lib/actions.ts`.
- Modify: `src/locales/en/settings.json`
  Responsibility: own English settings labels for reader/preview presets.
- Modify: `src/locales/ja/settings.json`
  Responsibility: own Japanese settings labels for reader/preview presets.
- Modify: `src/__tests__/components/article-view.test.tsx`
  Responsibility: verify localized close semantics, preview wording, and article-not-found fallback.
- Modify: `src/__tests__/components/article-toolbar-view.test.tsx`
  Responsibility: verify the toolbar view renders preview vs external-browser labels on the correct controls.
- Create: `src/__tests__/components/article-context-menu.test.tsx`
  Responsibility: verify the container-level article context menu resolves localized labels instead of leaving hardcoded English in `ArticleContextMenu`.
- Create: `src/__tests__/components/actions-settings.test.tsx`
  Responsibility: verify the settings "Actions" surface renders the updated preview/external-browser labels from i18n.
- Modify: `src/__tests__/components/browser-view.test.tsx`
  Responsibility: verify the overlay close label follows preview-specific wording.
- Modify: `src/__tests__/lib/actions.test.ts`
  Responsibility: verify action-driven toasts use translated copy and preserve existing action behavior.
- Modify: `src-tauri/Cargo.toml`
  Responsibility: add the Rust-side locale dependency used to resolve `language = system`.
- Create: `src-tauri/src/menu_i18n.rs`
  Responsibility: pure Rust helper for resolved menu language and app-owned menu labels.
- Modify: `src-tauri/src/menu.rs`
  Responsibility: build custom menu labels from `menu_i18n` instead of hardcoded English literals, while preserving IDs and predefined items.
- Modify: `src-tauri/src/commands/preference_commands.rs`
  Responsibility: rebuild the native menu after `language` changes have been persisted.
- Modify: `src-tauri/src/lib.rs`
  Responsibility: register the new Rust helper module and keep startup menu construction using the same resolver path as runtime rebuilds.

## Task 1: Lock the behavior with failing frontend tests

## Task 1 Files

- Create: `src/__tests__/lib/ui-language.test.ts`
- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/article-toolbar-view.test.tsx`
- Create: `src/__tests__/components/article-context-menu.test.tsx`
- Create: `src/__tests__/components/actions-settings.test.tsx`
- Modify: `src/__tests__/components/browser-view.test.tsx`
- Modify: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: Add a pure frontend test for resolved language semantics**

Create `src/__tests__/lib/ui-language.test.ts` with cases for:

```ts
resolveUiLanguage("system", "ja-JP") === "ja";
resolveUiLanguage("system", "en-US") === "en";
resolveUiLanguage("ja", "en-US") === "ja";
resolveUiLanguage("en", "ja-JP") === "en";
```

This guards the shared `system -> ja if locale starts with ja else en` rule before moving code.

- [ ] **Step 2: Update article and browser view tests to expect reader/preview wording**

Add or update assertions so the suite covers:

- article pane close copy maps to the article surface, not the preview overlay
- article toolbar controls render preview and external-browser labels on the intended buttons
- preview overlay close copy maps to `Web Preview` / `Webプレビュー`
- article context menu labels come from locale-backed reader/preview copy
- settings actions labels distinguish in-app preview from external browser
- the `Article not found` fallback comes from i18n instead of a hardcoded English literal
- reader/preview preset controls use the current `reader_only` / `reader_and_preview` / `preview_only` model

- [ ] **Step 3: Extend `src/__tests__/lib/actions.test.ts` to cover sync toast copy**

Mock the translation layer once and assert the `sync-all` branch requests translated messages for:

- sync already running
- partial sync failure
- sync success
- unexpected sync error

- [ ] **Step 4: Run the targeted frontend tests and confirm they fail for the new expectations**

Run:

```bash
pnpm exec vitest run src/__tests__/lib/ui-language.test.ts src/__tests__/components/article-view.test.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-context-menu.test.tsx src/__tests__/components/actions-settings.test.tsx src/__tests__/components/browser-view.test.tsx src/__tests__/lib/actions.test.ts
```

Expected: FAIL because the new helper does not exist yet and the UI still contains hardcoded or legacy wording.

## Task 2: Finish frontend language resolution and copy alignment

## Task 2 Files

- Create: `src/lib/ui-language.ts`
- Modify: `src/stores/preferences-store.ts`
- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/components/reader/article-toolbar-view.tsx`
- Modify: `src/components/reader/article-context-menu.tsx`
- Modify: `src/components/reader/browser-view.tsx`
- Modify: `src/components/reader/display-mode-toggle-group.tsx`
- Modify: `src/components/settings/reading-settings.tsx`
- Modify: `src/components/settings/actions-settings.tsx`
- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] **Step 1: Extract the frontend language resolver into `src/lib/ui-language.ts`**

Implement a small pure helper and use it from `preferences-store.ts`:

```ts
export type UiLanguagePreference = "system" | "ja" | "en";
export type ResolvedUiLanguage = "ja" | "en";

export function resolveUiLanguage(
  preference: UiLanguagePreference,
  locale: string | undefined,
): ResolvedUiLanguage {
  if (preference === "ja" || preference === "en") return preference;
  return locale?.toLowerCase().startsWith("ja") ? "ja" : "en";
}
```

`preferences-store.ts` should keep owning `i18n.changeLanguage(...)`, but it should stop duplicating the resolution rule inline.

- [ ] **Step 2: Replace the remaining hardcoded reader/preview copy in UI components**

Update the touched components so every user-visible label comes from locale keys:

- article pane fallback (`article not found`)
- article copy/share success toasts
- article toolbar labels for close / preview / external browser
- article context-menu actions (`Mark as Read/Unread`, `Star/Unstar`, preview/browser actions)
- preview overlay close text
- display preset labels/tooltips
- settings actions labels for preview vs external browser
- any remaining `Browser` label that actually means in-app preview

Do not rename the internal preset IDs; only align the displayed copy with the approved `Reader` / `Preview` model.

- [ ] **Step 3: Update locale resources for both English and Japanese**

At minimum, add or correct keys for:

- `Reader only` / `Reader + Preview` / `Preview only`
- `settings.actions.open_in_browser` with preview-specific wording
- `settings.actions.open_in_external_browser` with external-browser wording
- `Open Web Preview`
- `Open in External Browser`
- `Close article`
- `Close Web Preview`
- `Web preview unavailable`
- `Link copied`
- `Added to Reading List`
- `Article not found`

Japanese values must be natural Japanese, for example:

```json
"reader_only": "記事のみ",
"reader_and_preview": "記事 + プレビュー",
"preview_only": "プレビューのみ"
```

- [ ] **Step 4: Re-run the same targeted frontend tests and confirm they pass**

Run:

```bash
pnpm exec vitest run src/__tests__/lib/ui-language.test.ts src/__tests__/components/article-view.test.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-context-menu.test.tsx src/__tests__/components/actions-settings.test.tsx src/__tests__/components/browser-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the frontend copy/language resolution slice**

```bash
git add src/lib/ui-language.ts src/__tests__/lib/ui-language.test.ts src/stores/preferences-store.ts src/components/reader/article-view.tsx src/components/reader/article-toolbar-view.tsx src/components/reader/article-context-menu.tsx src/components/reader/browser-view.tsx src/components/reader/display-mode-toggle-group.tsx src/components/settings/reading-settings.tsx src/components/settings/actions-settings.tsx src/locales/en/reader.json src/locales/ja/reader.json src/locales/en/settings.json src/locales/ja/settings.json src/__tests__/components/article-view.test.tsx src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-context-menu.test.tsx src/__tests__/components/actions-settings.test.tsx src/__tests__/components/browser-view.test.tsx
git commit -m "feat: align reader preview copy across frontend surfaces"
```

## Task 3: Localize non-component UI strings and keep action behavior stable

## Task 3 Files

- Modify: `src/lib/actions.ts`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/__tests__/lib/actions.test.ts`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/ja/sidebar.json`

- [ ] **Step 1: Replace hardcoded sync toasts in `src/lib/actions.ts` with translated lookups**

Use the existing i18n instance from a non-React context and reuse the sync keys that already live in `sidebar.json`, so the sidebar sync button and `executeAction("sync-all")` stay aligned. Keep the action IDs and behavior unchanged.

Suggested shape:

```ts
import i18n from "@/lib/i18n";

store.showToast(i18n.t("sidebar:sync_completed"));
```

Keep all four sync outcomes localized through the shared sidebar namespace instead of creating duplicate reader-specific keys. Add a dedicated message-bearing key for the unexpected error branch, for example:

```json
"sync_failed_with_message": "Sync failed: {{message}}"
```

and the Japanese equivalent.

- [ ] **Step 2: Localize the toast dismiss label in `src/components/app-shell.tsx`**

Replace the hardcoded `"Dismiss"` aria-label with localized copy. Prefer the existing `common.close` key unless a more specific common key is needed.

- [ ] **Step 3: Re-run the action tests and confirm the new i18n wiring passes**

Run:

```bash
pnpm exec vitest run src/__tests__/lib/actions.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit the shared-action/toast slice**

```bash
git add src/lib/actions.ts src/components/app-shell.tsx src/__tests__/lib/actions.test.ts src/locales/en/sidebar.json src/locales/ja/sidebar.json
git commit -m "feat: localize shared action and toast copy"
```

## Task 4: Localize native menu labels and rebuild them on language changes

## Task 4 Files

- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/menu_i18n.rs`
- Modify: `src-tauri/src/menu.rs`
- Modify: `src-tauri/src/commands/preference_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the Rust locale source and a pure label resolver**

Add a small locale dependency to `src-tauri/Cargo.toml` and use it as the backend source for `system` resolution:

```toml
sys-locale = "0.3"
```

Then create `src-tauri/src/menu_i18n.rs` so custom menu copy can be unit-tested without constructing a Tauri app. The helper should expose:

```rust
pub enum ResolvedMenuLanguage {
    En,
    Ja,
}

pub fn resolve_menu_language(preference: Option<&str>, system_locale: Option<&str>) -> ResolvedMenuLanguage
pub fn labels(language: ResolvedMenuLanguage) -> MenuLabels
```

`resolve_menu_language` must follow the same rule as the frontend helper:

- explicit `ja` -> Japanese
- explicit `en` -> English
- `system` or missing value -> Japanese only when the locale starts with `ja`, otherwise English

- [ ] **Step 2: Add unit tests for the Rust resolver before wiring it into `menu.rs`**

Cover:

- `Some("ja")`
- `Some("en")`
- `Some("system")` with `ja-JP`
- `Some("system")` with `en-US`
- `None` with a non-Japanese locale

Also assert the app-owned labels use `Reader` / `Preview` / `External Browser` wording instead of the old `Reader` / `Browser` ambiguity for in-app preview items.

- [ ] **Step 3: Refactor `src-tauri/src/menu.rs` to consume the label helper**

Move every app-owned custom label out of hardcoded English literals and into the `MenuLabels` struct. Keep predefined items native and keep all menu IDs unchanged.

The relabeled custom items should include at least:

- app submenu title
- settings/check for updates
- view filters and toggles
- accounts/subscriptions labels
- item menu entries for in-app preview vs external browser
- share menu labels

- [ ] **Step 4: Rebuild the native menu when the `language` preference changes**

Update `set_preference` in `src-tauri/src/commands/preference_commands.rs` so that, after persisting `language`, it rebuilds the current menu from the stored preferences and swaps it onto the app.

Plan the command signature change explicitly so the rebuild is implementable:

```rust
#[tauri::command]
pub fn set_preference(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError>
```

Keep the rebuild path shared with startup as much as possible. A good shape is:

```rust
pub fn rebuild(app: &AppHandle, prefs: &HashMap<String, String>) -> tauri::Result<()>
```

called from both `lib.rs` setup and the language-preference update path after re-reading persisted preferences.

- [ ] **Step 5: Run focused Rust verification**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml menu_i18n
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: PASS

- [ ] **Step 6: Commit the native menu localization slice**

```bash
git add src-tauri/Cargo.toml src-tauri/src/menu_i18n.rs src-tauri/src/menu.rs src-tauri/src/commands/preference_commands.rs src-tauri/src/lib.rs
git commit -m "feat: localize native menu labels from language preference"
```

## Task 5: Verify the integrated experience end to end

## Task 5 Files

- Modify if needed: touched test files from Tasks 1-4 only

- [ ] **Step 1: Run the full local quality gate**

Run:

```bash
mise run check
```

Expected: format, lint, and tests all pass.

- [ ] **Step 2: Run a browser-mode UI smoke check for frontend language surfaces**

Run:

```bash
mise run app:dev:browser
```

Then manually verify in the browser build:

- switching `language` between `ja`, `en`, and `system` updates reader/settings copy
- preset labels show `記事のみ` / `記事 + プレビュー` / `プレビューのみ` in Japanese
- the article pane and preview overlay use distinct close wording
- `Web preview unavailable` fallback is localized

- [ ] **Step 3: Run a native app smoke check for menu rebuild behavior**

Run:

```bash
mise run app:dev
```

Then manually verify in the desktop app:

- custom native menu labels start in the resolved language for `ja`, `en`, and `system`
- changing the language preference updates the custom menu labels without restarting
- `Open Web Preview` and `Open in External Browser` do not swap meanings
- menu actions still trigger the same existing flows

- [ ] **Step 4: Make a final cleanup commit only if the verification steps changed tracked files**

```bash
git add -A
git commit -m "chore: finalize reader preview language alignment"
```
