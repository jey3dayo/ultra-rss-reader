---
type: reference
title: FreshRSS Feed Organization Push-Back — Design Spike
description: Confirms the current overwrite behavior for local feed rename/folder-move against FreshRSS sync, defines the GReader subscription/edit request shapes, and recommends an implementation mechanism for a future build plan.
resource: urn:ultra-rss-reader:docs:freshrss-feed-organization-pushback
tags: [category/reference, audience/developer, layer/backend]
timestamp: 2026-07-14
audience: developer
owner: project-maintainers
---

# FreshRSS Feed Organization Push-Back — Design Spike

This is a design/spike document (see `plans/005-freshrss-feed-organization-pushback-spike.md`, historical — not tracked in this repository's checked-in tree). It does not implement anything. It confirms current behavior, defines the remote API shape, evaluates mechanisms, and outlines a follow-up build plan.

**Problem**: on a FreshRSS (GReader protocol) account, `rename_feed` and `update_feed_folder` write only to local SQLite. Nothing pushes the change to the server. Because folder/subscription structure is re-applied from the server on every full sync, a local rename or folder move is silently overwritten on the next sync. Read/star/tag mutations already round-trip via `push_mutations` + pending-mutation queue; feed organization does not.

All line numbers below are current as of this spike (see `git log -1 --format=%H` on the branch this document was written on) and cite files under `src-tauri/src/`.

## 1. Current Overwrite Behavior (Confirmed)

### 1.1 Local-only write path today

- `rename_feed` (`src-tauri/src/commands/feed_commands.rs:324-332`) is a **synchronous** `#[tauri::command] pub fn`. It calls `rename_feed_in_db` (`feed_commands.rs:334-339`), which only calls `SqliteFeedRepository::rename` under a `db.writer()` connection. No provider is constructed, no HTTP call is made.
- `update_feed_folder` (`feed_commands.rs:341-349`) is likewise synchronous. `update_feed_folder_in_db` (`feed_commands.rs:351-373`) opens a local `unchecked_transaction`, validates the target folder, and calls `SqliteFeedRepository::update_folder`. No provider call.
- Contrast with `delete_feed`: `delete_feed` is already `pub async fn` (`feed_commands.rs:187-189`) and, for `ProviderKind::FreshRss` accounts, authenticates a `GReaderProvider` and calls `provider.delete_subscription(...)` **before** the local delete (`feed_commands.rs:274-297`, `delete_feed_after_provider_unsubscribe` at `feed_commands.rs:235-257`). This is the exact "sync fn → async fn → account-kind branch → provider push → local write" shape this spike evaluates reusing for rename/folder-move (see §3).

### 1.2 What the next full sync does to a renamed/moved feed

The authoritative FreshRSS sync path is `sync_greader_account` (`src-tauri/src/commands/sync_providers.rs:514-617`), invoked from the one production call site `src-tauri/src/commands/sync_commands.rs:489`. It runs on every full FreshRSS account sync (manual sync trigger, startup, wake, or interval — all route through the same `sync_commands.rs` entry point).

**Folder name**: the folder-sync block (`sync_providers.rs:549-596`) matches each remote folder to a local one by `remote_id`, falling back to a case-insensitive name match (`sync_providers.rs:562-573`, `folder_name_case_key` at `sync_providers.rs:871-873`), then builds:

```rust
let folder = Folder {
    id: existing_folder.map(|folder| folder.id.clone()).unwrap_or_else(FolderId::new),
    account_id: account.id.clone(),
    remote_id: Some(rf.remote_id.clone()),
    name: rf.name.clone(),          // sync_providers.rs:586 — always the server's name
    sort_order,
};
folder_repo.save(&folder)?;          // sync_providers.rs:589 — unconditional write
```

`name` is unconditionally set to `rf.name` (the server's label name) and saved every sync. There is no comparison against the existing local name. **A local folder rename is discarded on the next sync.**

**Feed title and folder assignment**: `sync_greader_feeds` (`sync_providers.rs:1025-…`) calls `provider.get_subscriptions()` then `save_greader_subscriptions` (`sync_providers.rs:777-820`):

```rust
let feed = Feed {
    id: existing.as_ref().map(|f| f.id.clone()).unwrap_or_else(FeedId::new),
    account_id: account.id.clone(),
    folder_id: resolve_greader_subscription_folder_id(
        rs.folder_remote_id.as_deref(), folder_remote_id_map, existing.as_ref(),
    ),                                // sync_providers.rs:797-801
    remote_id: Some(rs.remote_id.clone()),
    title: rs.title.clone(),         // sync_providers.rs:803 — always the server's title
    ...
};
feed_repo.save(&feed)?;              // sync_providers.rs:817 — unconditional write
```

`title` is unconditionally the server's title. **A local feed rename is discarded on the next sync.**

`resolve_greader_subscription_folder_id` (`sync_providers.rs:766-775`):

```rust
remote_folder_id
    .and_then(|remote_id| folder_remote_id_map.get(remote_id))
    .cloned()
    .or_else(|| existing_feed.and_then(|feed| feed.folder_id.clone()))
```

The server's `folder_remote_id` (from `RemoteSubscription`, populated in `get_subscriptions` from the feed's GReader category, `src-tauri/src/infra/provider/greader.rs:708-742`) wins whenever it resolves to a known local folder. The local `existing_feed.folder_id` is used **only** when the server reports no folder for that subscription, or reports one this account doesn't have locally. So: **as long as the feed remains categorized under any label server-side, a local folder move is overwritten back to the server's label on the next sync.** The only case where a local folder assignment survives is when the server genuinely has no label for that subscription — confirmed by the sibling generic-path tests `sync_account_preserves_local_folder_when_remote_subscription_has_no_folder` and `sync_account_preserves_existing_folder_when_remote_subscription_folder_is_unknown` (`src-tauri/src/service/sync_flow.rs:1717`, `:1784`).

**Conclusion**: for both rename and folder-move, the answer is **(b) overwritten by the server value**, not (a) retained or (c) left diverged — deterministically, on the very next full sync of that account.

### 1.3 Why `sync_flow.rs` isn't the operative path for FreshRSS

`sync_flow::sync_account` (`src-tauri/src/service/sync_flow.rs:19-217`) has the _same_ unconditional-overwrite pattern for title (`sync_flow.rs:119`) and folder resolution (`sync_flow.rs:98-110`), but its own doc comment says it is a "generic repository-driven sync flow used by non-delta providers and lower-level tests" and that "GReader providers require per-feed cursor persistence and multi-page delta sync, so their authoritative sync path lives in `commands::sync_providers`" (`sync_flow.rs:15-18`). The function also hard-rejects delta-sync providers at runtime: `if caps.supports_delta_sync { return Err(...) }` (`sync_flow.rs:27-32`). `ProviderKind::FreshRss.capabilities()` sets `supports_delta_sync: true` (`src-tauri/src/domain/provider.rs:191`), so calling `sync_account` with a `GReaderProvider` always errors. The overwrite behavior in §1.2 (`sync_providers.rs`) is the only path that matters for this feature.

## 2. GReader `subscription/edit` Request Shapes

### 2.1 Conventions established by existing, already-wired calls

All evidence below is from `src-tauri/src/infra/provider/greader.rs`, currently exercised by tests.

| Concern                                        | Evidence                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL                                       | `for_freshrss(server_url)` (`:322-331`) → `freshrss_api_base` (`:168-183`) normalizes to `<server>/api/greader.php`.                                                                                                                                                                                                                     |
| Auth                                           | `authenticate` POSTs `{auth_base}/accounts/ClientLogin` with body `Email=<urlencoded(username)>&Passwd=<urlencoded(password)>` (`:674-687`), parses the `Auth=<token>` response line (`:697-704`), stores it as `self.auth_token`.                                                                                                       |
| Auth header                                    | `auth_header()` returns `Authorization: GoogleLogin auth=<token>` (`:341-348`), attached to every subsequent request.                                                                                                                                                                                                                    |
| URL encoding                                   | Hand-rolled `urlencoded()` (`:979-988`) percent-encodes everything except RFC3986 unreserved bytes (`A-Za-z0-9-_.~`).                                                                                                                                                                                                                    |
| POST content type                              | `Content-Type: application/x-www-form-urlencoded` on every body-carrying POST (`:684`, `:853`, `:885`, `:943`).                                                                                                                                                                                                                          |
| Error mapping                                  | Transport errors → `DomainError::from_provider_http_error` (`map_err`, e.g. `:383`, `:428`, `:716`, `:752`, `:857`, `:889`, `:947`); non-2xx status → `DomainError::from_provider_http_response_status(status, headers)` via `ensure_success_response` (`:350-360`), chained with `.and_then(Self::ensure_success_response)` everywhere. |
| Existing `subscription/edit` use (unsubscribe) | `delete_subscription`: POST `{api_base}/reader/api/0/subscription/edit`, body `ac=unsubscribe&s=<urlencoded(remote_id)>` (`:936-948`).                                                                                                                                                                                                   |
| Existing label-add use (quickadd)              | `create_subscription`: POST `.../subscription/quickadd`, body `quickadd=<urlencoded(url)>` plus, when a folder is given, `&a=<urlencoded(LABEL_PREFIX)><urlencoded(folder_name)>` (`:872-879`), where `LABEL_PREFIX = "user/-/label/"` (`:134`).                                                                                         |
| Existing label add/remove use (entry tags)     | `push_mutations`: POST `.../reader/api/0/edit-tag`, body `i=<urlencoded(remote_entry_id)>&a=<urlencoded(state)>` to add a state/label, or `&r=<urlencoded(state)>` to remove it (`:816-862`).                                                                                                                                            |
| Label ID format                                | `normalize_label_remote_id` (`:206-217`) parses/produces IDs of the form `user/-/label/<name>`, and rejects any label containing `/` in the display name.                                                                                                                                                                                |

### 2.2 Rename and folder-move shapes (not yet implemented — inferred from the above)

These are **not** present in this codebase today; no test exercises them. They are inferred from the GReader protocol convention that this codebase already partially implements (same `subscription/edit` endpoint already used for `ac=unsubscribe`; same `a=`/`r=` label-add/remove convention already used for quickadd and edit-tag).

- **Rename**: `POST {api_base}/reader/api/0/subscription/edit`, body `ac=edit&s=<urlencoded(remote_id)>&t=<urlencoded(new_title)>`.
- **Add to folder**: `...&a=<urlencoded("user/-/label/")><urlencoded(folder_name)>` (same construction as `create_subscription`'s folder param).
- **Remove from folder**: `...&r=<urlencoded("user/-/label/")><urlencoded(folder_name)>`.
- **Move between folders** (add new label, remove old label) and **rename** can be combined into a single POST: `ac=edit&s=<remote_id>&t=<new_title>&a=user%2F-%2Flabel%2F<new>&r=user%2F-%2Flabel%2F<old>`.
- **Remove from all folders** (no target folder): only `r=` for the old label, no `a=`.
- Same headers (`Authorization: GoogleLogin auth=<token>`, `Content-Type: application/x-www-form-urlencoded`) and same error-mapping chain (`ensure_success_response` / `from_provider_http_error`) as every other write call in this file.

This is **not** a capability gap — the endpoint is already wired (unsubscribe) and `ProviderCapabilities.supports_folders` is `true` for FreshRSS (`domain/provider.rs:187-193`) — it is simply unused for this purpose. Exact request/response confirmation against a live FreshRSS server is deferred to `test:live` in the follow-up build plan (out of scope here per the spike's Scope section); see Open Question 1 in §6.

## 3. Mechanism Options and Trade-off (Recommendation: Option X)

### Option X — Trait extension + direct provider push

Add a method (e.g. `edit_subscription(remote_id, title: Option<&str>, add_folder_label: Option<&str>, remove_folder_label: Option<&str>) -> DomainResult<()>`) to `FeedProvider` (`src-tauri/src/infra/provider/traits.rs:12-32`, currently 9 methods, none of which cover rename/folder-edit). Implement it in `GReaderProvider` using §2.2's shape. Convert `rename_feed`/`update_feed_folder` to `async fn`, branch on `account.kind == ProviderKind::FreshRss`, and reuse the already-extracted `authenticated_freshrss_provider` helper (`feed_commands.rs:299-322`) — this is precisely the pattern `delete_feed_with_remote_sync_boundary` already established (`feed_commands.rs:274-297`).

**Blast radius**:

- `#[tauri::command] pub fn` → `pub async fn`. Tauri's command macro supports async fns natively and the JS-side `invoke()` already returns a Promise regardless of whether the Rust fn is sync or async, so `src/api/tauri-commands/feeds.ts` call sites are unaffected.
- Must follow the DB-lock-across-`.await` discipline already documented in `.claude/rules/rust-async-mutex.md` and already implemented by `delete_feed_after_provider_unsubscribe` (lock → read → drop; await provider; lock → write).
- `sync_providers.rs`'s provider-facing functions (`sync_greader_account`, `sync_greader_feed`, `sync_greader_feeds`, `sync_greader_account_entries`) all take the concrete `GReaderProvider` type, not `dyn FeedProvider` (`sync_providers.rs:517`, `:622`, `:699`, `:925`, `:1027`). The command layer already follows this same concrete-type pattern for `delete_feed`'s provider construction, so adding new trait methods does not force a `dyn`-dispatch refactor at the command layer — but every `FeedProvider` implementor (production: `GReaderProvider`, `LocalProvider`; test doubles: `RecordingDeleteProvider` in `feed_commands.rs` tests, several inline providers in `sync_flow.rs` tests) needs a body for the new method(s), which is a mechanical but real multi-file touch.
- Optimistic UI: `useUpdateFeedFolder` (`src/hooks/use-update-feed-folder.ts:18-65`) already applies the folder change optimistically (`onMutate`, lines 28-36) and rolls back on any command failure (`onError`, lines 41-62) — this needs **no change** under Option X; remote-push failure surfaces through the same `AppError` path local failure already does today. `renameFeed` currently has no optimistic update (`src/components/reader/feed-edit-submit.ts:56-67` awaits and shows a toast on failure) and stays that way unchanged in shape, just with added network latency.
- Effort/risk: **medium** — new trait method(s) touch several implementors and test doubles, two commands become async, but the shape is proven by `delete_feed`.

### Option Y — Pending mutation (queue, like read/star)

Add new `Mutation` variants (`domain/provider.rs:97-108` currently has only `MarkRead`/`MarkUnread`/`SetStarred`) for rename/folder-move, extend `push_mutations` in `GReaderProvider` (`greader.rs:816-862`, currently only POSTs to `/reader/api/0/edit-tag`) to branch to `/reader/api/0/subscription/edit` for the new variants, and extend the `pending_mutations` persistence to carry these.

**Blast radius**:

- The `pending_mutations` table (`src-tauri/migrations/V1__initial.sql:66-72`) is `(id, account_id, mutation_type, remote_entry_id, created_at)`, with a `UNIQUE(account_id, mutation_type, remote_entry_id)` index added specifically for read/star dedup (`src-tauri/migrations/V18__db_repository_contracts.sql:9-10`). `remote_entry_id` is an **article**-scoped identifier by name and by use: the query that decides whether a pending mutation targets a provider-managed GReader feed does `JOIN articles a ON a.remote_id = pm.remote_entry_id` (`sync_providers.rs:895-910`). A feed-remote-id or folder-label-id would never match an article's `remote_id` there — reusing this column for feed/folder targets is a semantic overload with a real correctness risk (that JOIN would silently misclassify or drop the new mutation types) unless every touch point is audited and special-cased, not just an effort increase.
- `PendingMutationType`/`PendingMutationAxis` (`src-tauri/src/repository/pending_mutation.rs:6-73`) would need a third axis threaded through `axis()`, `is_supported_by`, `replacement_type_values`, and the generic pending-push loop in `sync_flow.rs:36-54` (which pushes every pending row for any provider with `supports_remote_state`, regardless of a per-axis capability check beyond that).
- Requires a schema migration (new column, or a new parallel table) plus generalizing several call sites that currently hard-assume "pending mutation == article read/star state".
- Effort/risk: **high** — migration plus semantic overload of an existing, already-indexed, already-JOINed column; higher regression surface against the working read/star sync path.

### Recommendation: Option X

Deciding constraints:

1. `delete_feed` already proves the "sync fn → async fn → account-kind branch → concrete `GReaderProvider` push → local write" shape end-to-end for exactly this class of command (`feed_commands.rs:274-297`). Rename/folder-move are the same shape of user action.
2. Option Y requires a migration and reinterprets a column (`remote_entry_id`) whose name and JOIN semantics are article-specific (`sync_providers.rs:895-910`); forcing feed/folder targets through it is a correctness risk, not just added effort.
3. The properties that make pending-mutation queuing valuable for read/star — high volume, frequent, tolerant of eventual consistency, needs offline dedup — don't apply the same way to rename/folder-move: these are rare, single-shot, and the user is actively watching the edit dialog for a result. Option X's synchronous request/response matches the existing `submitFeedEdits` UX (`feed-edit-submit.ts`), which already reports success/failure per field via toast rather than queuing silently.

The two options are not mutually exclusive long-term: if offline resilience for rename/folder-move becomes a hard requirement later, Option Y's queue could be layered on top without discarding Option X's trait method — `push_mutations` would simply call the same `edit_subscription` provider method internally.

## 4. Folder Semantics

**Correction to this spike's own starting premise**: the plan that scoped this spike (see `plans/005-freshrss-feed-organization-pushback-spike.md`) frames this as mapping "the app's nested folder hierarchy" onto FreshRSS's flat label. That premise does not match the code. The app's folder model is **flat**, not nested:

- `Folder` (`src-tauri/src/domain/folder.rs:23-29`) is `{ id, account_id, remote_id, name, sort_order }` — no `parent_id` or any parent reference.
- The `folders` table DDL (`src-tauri/migrations/V1__initial.sql:12-19`) has no parent column; only `UNIQUE(account_id, remote_id)`.
- `create_folder_in_db` (`feed_commands.rs:126-184`) allocates folders as a single flat, sequentially-`sort_order`ed list per account.
- No `parent`/`nested`/`subfolder`/`hierarchy` concept exists anywhere in `src/` (checked by grep across `.ts`/`.tsx`).

So there is no hierarchy-to-flat-label mapping problem to design around — the app's folder unit already matches FreshRSS's flat label unit almost 1:1.

**Mapping**: `Folder.name` ↔ label display name; `Folder.remote_id` ↔ `user/-/label/<name>` (`LABEL_PREFIX`, `greader.rs:134`, `normalize_label_remote_id` at `greader.rs:206-217`).

**Asymmetry to flag for the build plan**: a local _feed_ rename maps 1:1 to one `subscription/edit` call (§2.2). A local _folder_ rename does not have a single corresponding remote call, because GReader has no "rename this label as an entity" endpoint in this dialect — a label only exists server-side as an attribute of the feeds that carry it (`get_folders`/`tag/list`, `greader.rs:744-771`, is read-only). Renaming a folder locally must fan out: for every feed currently assigned to that folder, issue `a=<new label>&r=<old label>` on `subscription/edit`. This is materially different work from a feed rename and should be a distinct code path, not an accidental one-liner extension of feed rename.

**Edge cases to flag, not solve here**:

- A folder with zero feeds has nothing to push; renaming it is purely local until a feed is added to it.
- The existing case-insensitive fallback match on sync (`folder_name_case_key`, `sync_providers.rs:871-873`, used at `:566-569`) could misinterpret a partially-pushed rename (some feeds updated, sync runs mid-way) as a "new" folder distinct from the old one. The build plan needs an explicit ordering/atomicity answer for the fan-out in the previous paragraph.
- Folder _deletion_ and its remote-label-removal semantics are out of scope for this spike (the deliverable covers rename + move only) and are flagged as a related but distinct future question.

## 5. Conflict and Failure Handling

- `ProviderOptimisticMutationConflictPolicy` (`domain/provider.rs:147-151`, FreshRSS values at `:292-296`) currently covers only `read_state`/`star_state`, both `KeepPendingLocalMutation`. Option X's direct push has no "pending" state to keep or discard — the push either succeeds inline or fails inline and returns an `AppError`, matching the existing push-before-delete ordering in `delete_feed_after_provider_unsubscribe` (`feed_commands.rs:251-256`). No new conflict-policy enum value is needed for rename/folder-move under Option X; this should be stated explicitly in the trait/command implementation so a future reader doesn't assume a gap.
- Recommended ordering: push-before-local-write for both rename and folder-move (mirroring delete), so a failed remote push never leaves local state diverged from what the user believes was saved.
- Folder move already has optimistic UI + rollback: `useUpdateFeedFolder` (`src/hooks/use-update-feed-folder.ts:18-65`) applies the change optimistically and rolls back the cached feed list on any command error, then shows `failed_to_update_folder` via toast (`:41-62`). Under Option X this needs **no change** — remote failure surfaces through the same command-level `AppError` the hook already handles.
- Rename has no optimistic UI today: `submitFeedEdits` (`feed-edit-submit.ts:56-67`) awaits `renameFeed` and shows a toast (`renameErrorMessage`) on failure, with no state to roll back. Under Option X this is unchanged in shape — same toast, possibly higher latency. Whether to add optimistic rename to match folder-move is a UX decision, not assumed here (see Open Question 3).
- User-visible failure notification reuses the existing per-field toast convention in `feed-edit-submit.ts` and the `failed_to_update_folder` i18n key already wired in `useUpdateFeedFolder`. This is a different, narrower surface than the account-level `ProviderSyncWarning` / `sidebar-sync-feedback` mechanism used for passive background sync issues (`sync_providers.rs` `ProviderSyncWarning`, `src/components/reader/sidebar-sync-feedback.ts`) — that surface is for background sync, not a direct user action, and should not be conflated with this feature's failure reporting.

## 6. Open Questions and Build Plan Outline

### Open questions

1. Exact `ac=edit&t=`/`a=`/`r=` request/response shape against a real FreshRSS server is inferred from protocol convention and this codebase's existing quickadd/edit-tag/unsubscribe calls (§2.2), not verified live. Needs `test:live` confirmation in the build plan.
2. Folder _rename_ (the entity, not a feed's folder assignment) requires fan-out across every member feed (§4). Should this be N serial calls, parallel calls, or batched? What is the partial-failure UX if some feeds succeed and others fail mid-fan-out?
3. Should `rename_feed` gain optimistic-update-with-rollback (matching `update_feed_folder`'s existing behavior) now that a network round trip is added? Not assumed by this document.
4. What should happen when `ac=edit` targets a subscription the server has already removed (e.g., unsubscribed from another client)? Delete already has a modeled answer (`ProviderDeletionRetentionPolicy`, `domain/provider.rs:130-139`); edit does not yet.
5. Should the trait expose one combined `edit_subscription(title, add_label, remove_label)` method (fewer round trips, matches GReader's ability to combine params in one POST) or two separate methods mirroring the two current UI actions (rename vs. move)? This affects round-trip count and how partial success (title succeeds, folder fails) is reported to the user.
6. Should Option Y (pending-mutation queuing) be revisited later for offline resilience? If so, it likely needs a schema migration introducing a generic target-type/target-id pair rather than reusing `remote_entry_id` (§3).

### Build plan outline (tranches)

1. **Trait extension**: add the chosen method(s) (see Open Question 5) to `FeedProvider` (`traits.rs`); stub bodies in `LocalProvider` and every test-double implementor (`feed_commands.rs` test module, `sync_flow.rs` test module).
2. **GReader implementation**: implement the method(s) in `GReaderProvider` per §2.2, following the existing `urlencoded`/`auth_header`/`ensure_success_response` conventions.
3. **Command wiring**: convert `rename_feed`/`update_feed_folder` to `async fn`, mirroring `delete_feed_with_remote_sync_boundary`; branch on `account.kind == FreshRss`; push-before-local-write.
4. **Folder-rename fan-out**: implement the per-member-feed fan-out strategy decided in Open Question 2, as a distinct path from single-feed folder move.
5. **Optimistic/rollback UI**: resolve Open Question 3; no change needed for folder move.
6. **Contract tests**: mock-server tests for the new GReader request shapes (mirroring the existing mockito pattern for unsubscribe/quickadd, e.g. `feed_commands.rs` FreshRSS delete test, `greader.rs` test module) plus command-level tests mirroring `delete_feed_command_resolves_missing_remote_id_in_freshrss_path`.
7. **`test:live` verification matrix**: confirm exact FreshRSS request/response shape for rename and folder add/remove/move against a real FreshRSS instance before release, per the conventions in `docs/release-manual-verification.md`.
