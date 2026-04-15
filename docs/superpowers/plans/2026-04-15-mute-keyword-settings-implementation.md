# Mute Keyword Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global mute keyword rules that can be managed from Settings and immediately filter article lists, tag lists, and search results, while leaving auto-mark-read as a disabled future setting.

**Architecture:** Persist mute rules in SQLite through a dedicated repository and Tauri commands, then apply filtering before pagination inside article and tag queries. Reuse the existing Settings page shell on the frontend with a small container/view split and React Query invalidation for article-facing queries.

**Tech Stack:** Rust, rusqlite, Tauri commands, React 19, TypeScript, TanStack Query, Vitest, Biome

---

## File Structure

- Create: `src-tauri/migrations/V12__mute_keywords.sql`
- Create: `src-tauri/src/domain/mute_keyword.rs`
- Create: `src-tauri/src/repository/mute_keyword.rs`
- Create: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`
- Create: `src-tauri/src/commands/mute_keyword_commands.rs`
- Create: `src/api/schemas/mute-keyword.ts`
- Create: `src/hooks/use-mute-keywords.ts`
- Create: `src/components/settings/mute-settings.tsx`
- Create: `src/components/settings/mute-settings-view.tsx`
- Create: `src/components/settings/use-mute-settings-view-props.ts`
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/repository/mod.rs`
- Modify: `src-tauri/src/infra/db/connection.rs`
- Modify: `src-tauri/src/infra/db/sqlite_article.rs`
- Modify: `src-tauri/src/infra/db/sqlite_tag.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/commands/dto.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/api/schemas/commands.ts`
- Modify: `src/api/schemas/index.ts`
- Modify: `src/api/tauri-commands.ts`
- Modify: `src/components/settings/settings-page.types.ts`
- Modify: `src/components/settings/settings-page-view.tsx`
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/stores/ui-store.ts`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`
- Test: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`
- Test: `src-tauri/src/infra/db/sqlite_article.rs`
- Test: `src-tauri/src/infra/db/sqlite_tag.rs`
- Test: `src/__tests__/components/settings-modal.test.tsx`
- Test: `src/__tests__/components/settings-components.test.tsx`

### Task 1: Add persistence for mute keyword rules

**Files:**

- Create: `src-tauri/migrations/V8__mute_keywords.sql`
- Create: `src-tauri/src/domain/mute_keyword.rs`
- Create: `src-tauri/src/repository/mute_keyword.rs`
- Create: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/repository/mod.rs`
- Modify: `src-tauri/src/infra/db/connection.rs`
- Test: `src-tauri/src/infra/db/sqlite_mute_keyword.rs`

- [ ] **Step 1: Write failing repository tests**
- [ ] **Step 2: Run `cargo test sqlite_mute_keyword --manifest-path src-tauri/Cargo.toml` and confirm failure**
- [ ] **Step 3: Add migration, domain type, repository trait, and SQLite implementation with normalized duplicate checks**
- [ ] **Step 4: Run `cargo test sqlite_mute_keyword --manifest-path src-tauri/Cargo.toml` and confirm pass**

### Task 2: Apply mute filtering before pagination

**Files:**

- Modify: `src-tauri/src/infra/db/sqlite_article.rs`
- Modify: `src-tauri/src/infra/db/sqlite_tag.rs`
- Test: `src-tauri/src/infra/db/sqlite_article.rs`
- Test: `src-tauri/src/infra/db/sqlite_tag.rs`

- [ ] **Step 1: Write failing tests for account/feed/tag/search filtering, ASCII case-insensitive matching, and pagination-after-filter**
- [ ] **Step 2: Run `cargo test sqlite_article --manifest-path src-tauri/Cargo.toml` and `cargo test sqlite_tag --manifest-path src-tauri/Cargo.toml` and confirm failure**
- [ ] **Step 3: Implement filter SQL/helpers using `content_sanitized` with `summary` fallback and apply them before `LIMIT/OFFSET`**
- [ ] **Step 4: Re-run the same cargo tests and confirm pass**

### Task 3: Expose Tauri commands and TypeScript contracts

**Files:**

- Create: `src-tauri/src/commands/mute_keyword_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/commands/dto.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/api/schemas/mute-keyword.ts`
- Modify: `src/api/schemas/commands.ts`
- Modify: `src/api/schemas/index.ts`
- Modify: `src/api/tauri-commands.ts`

- [ ] **Step 1: Add failing TypeScript contract tests or schema assertions in existing API test files**
- [ ] **Step 2: Run the relevant Vitest file and confirm failure**
- [ ] **Step 3: Implement Tauri commands plus TS DTO/schema/invoke wrappers**
- [ ] **Step 4: Re-run the same Vitest file and confirm pass**

### Task 4: Add React Query hooks and settings UI

**Files:**

- Create: `src/hooks/use-mute-keywords.ts`
- Create: `src/components/settings/mute-settings.tsx`
- Create: `src/components/settings/mute-settings-view.tsx`
- Create: `src/components/settings/use-mute-settings-view-props.ts`
- Modify: `src/components/settings/settings-page.types.ts`
- Modify: `src/components/settings/settings-page-view.tsx`
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/stores/ui-store.ts`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`
- Test: `src/__tests__/components/settings-modal.test.tsx`
- Test: `src/__tests__/components/settings-components.test.tsx`

- [ ] **Step 1: Write failing UI tests for nav item, one-line add form, empty state, delete confirmation, and disabled auto-read row**
- [ ] **Step 2: Run `pnpm vitest run src/__tests__/components/settings-modal.test.tsx src/__tests__/components/settings-components.test.tsx` and confirm failure**
- [ ] **Step 3: Implement hooks and UI with query invalidation for `articles`, `accountArticles`, `articlesByTag`, `search`, and `tagArticleCounts`**
- [ ] **Step 4: Re-run the same Vitest command and confirm pass**

### Task 5: Verify end-to-end quality gates

**Files:**

- Modify only if verification exposes issues in the files above

- [ ] **Step 1: Run targeted Rust and Vitest suites together**
- [ ] **Step 2: Fix any failures with minimal changes**
- [ ] **Step 3: Run `mise run check`**
- [ ] **Step 4: If green, leave the branch ready for final review**

## Self-Review

- Spec coverage:
  - Global persistence, filtering scope, one-line settings UI, disabled auto-read, empty state, delete confirmation, and invalidation are all covered.
- Placeholder scan:
  - No `TODO` / `TBD` placeholders remain.
- Type consistency:
  - Plan uses `mute keyword`, `scope`, and `list/create/delete` naming consistently across backend and frontend.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-mute-keyword-settings-implementation.md`. The user already requested implementation in this session, so proceed with inline execution from Task 1.
