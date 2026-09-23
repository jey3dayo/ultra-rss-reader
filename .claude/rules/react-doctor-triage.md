---
paths:
  - "scripts/quality-baseline.ts"
  - "src/__tests__/scripts/quality-baseline.test.ts"
  - "src/__tests__/config/react-doctor-disable-reference-contract.node.test.ts"
  - "docs/react-doctor-*.md"
  - "mise/quality.toml"
  - "pnpm-workspace.yaml"
  - "src/components/reader/article-content-view.tsx"
  - "src/components/reader/article-list-footer.tsx"
  - "src/components/reader/article-list-item.tsx"
  - "src/components/reader/article-selection-summary.tsx"
  - "src/components/reader/article-tag-chip-list.tsx"
  - "src/components/reader/feed-edit-dialog.tsx"
  - "src/components/reader/hooks/article-list/use-article-list-data.ts"
  - "src/components/reader/hooks/article-list/use-article-list-effects.ts"
  - "src/components/reader/hooks/article-list/use-article-list-navigation.ts"
  - "src/components/reader/hooks/article-list/use-article-list-sources.ts"
  - "src/components/reader/hooks/article/use-article-tag-picker-popover.ts"
  - "src/components/reader/hooks/browser/use-browser-webview-events.ts"
  - "src/components/reader/hooks/sidebar/feed-tree-presence-output.ts"
  - "src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts"
  - "src/components/reader/hooks/sidebar/use-sidebar-feed-drag-state.ts"
  - "src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts"
  - "src/components/reader/hooks/sidebar/use-sidebar-visibility-fallback.ts"
  - "src/components/settings/hooks/account-detail/use-account-detail-credentials-editor.ts"
  - "src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts"
  - "src/components/settings/hooks/account-detail/use-account-detail-sync-controls.ts"
  - "src/components/shared/confirm-dialog-view.tsx"
  - "src/components/shared/destructive-confirm-dialog-view.tsx"
  - "src/components/storybook/ui-reference-shell-specimens.tsx"
  - "src/components/subscriptions-index/hooks/use-subscriptions-feed-dialogs.ts"
  - "src/components/subscriptions-index/subscriptions-index-page.tsx"
  - "src/components/subscriptions-index/use-subscriptions-index-state.ts"
  - "src/hooks/use-screen-snapshot.ts"
  - "src/lib/i18n/use-stable-open-translation.ts"
  - "src/stores/preferences-store.ts"
---

# React Doctor Triage

How React Doctor findings are classified, recorded, suppressed, and pinned. Toolchain-wide quality
policy, including the React Doctor scan scope, lives in [quality-policy.md](./quality-policy.md).

`paths:` is a secondary trigger, not the boundary of where this rule applies: it applies to every
React Doctor run and finding, and `quality-policy.md` and `CLAUDE.md` tell the agent to read it
before one. The source files listed are the ones this rule names or that carry an inline
`react-doctor-disable` record, so editing one loads the decision it is bound by.
`react-doctor-disable-reference-contract.node.test.ts` fails when a file with an inline record is
missing from that list.

## React Doctor Warning Categories

Classify every React Doctor warning before suppressing or fixing it:

- `must-fix`: likely bug, regression, performance hot path, or warning introduced by the current change.
- `accepted-risk`: intentional tradeoff that remains in production code; record the reason in the nearest rule, TODO, or baseline update note.
- `false-positive`: tool cannot model the local contract; record the proof near the code only when a local comment prevents future churn.
- `suppress`: last resort for unavoidable tool noise; include the warning id, scope, reason, owner, and review trigger in the suppression location.

Suppression records belong in the narrowest durable place: local code comment for one-line false positives, `.claude/rules/` for repeated project policy, or `scripts/quality-baseline.ts` only for pinned baseline count changes. Re-run the matching pinned React Doctor task after changing suppressions or baseline counts.

### No Scan Task Runs Automatically

Both React Doctor *scan* tasks — `quality:react-doctor:diff` and `quality:react-doctor:full` —
are manual (verified 2026-09-10 against the primary sources): `lefthook.yml` runs
format, `test:unit:ci`, `lint`, `test:rust`, and `build`, and mentions no `react-doctor` task. So
"gate" below and in `CLAUDE.md` names what those tasks are *for*, not something that stops a
merge: a reintroduced finding reaches `main` unless a person runs the task or an ordinary test
catches it.

Two consequences. A fix for a React Doctor finding needs its own durable guard — an ordinary
test that fails when the fix is reverted — because the scan will not notice; a source-shape
contract test is the usual shape when the defect itself is not reachable from a sequential
test. And a stale `reactDoctorBaselines` pin fails nothing, so re-pinning after a fix lands has
to be tracked as work rather than assumed.

One `quality:` task does run in CI, and it is not a scan of the current code.
`.github/workflows/ci.yml` invokes `quality:toolchain` and `quality:react-doctor-pin`. The second
checks that the pin describes the tree it names: it materializes `scanSha` with `git archive`,
re-runs the pinned `scanCommand` and `auditScanCommand` there, and compares the totals *and* the
diagnostic identity set against the classification records. It says nothing about findings in the
PR's own code, so neither consequence above is weakened — a new finding on the branch still
reaches `main` unnoticed. What it removes is the third failure mode this file records: a pin whose
totals add up while the sets behind them disagree. Adopted 2026-09-18 under Issue #324.

### The Diff Gate Currently Runs Degraded

`quality:react-doctor:diff` prints an extra line when react-doctor sets `baselineDegraded`:

```text
React Doctor reported no baseline comparison, so this run lists every finding in the changed files rather than only new ones.
```

react-doctor's own report schema documents that state as "a `baseline` run was intended but the
base couldn't be resolved — a shallow CI checkout with no merge base, or a failed base/head
lint", and says the report then "lists every finding in the changed files (mode downgrades to
`diff`, the `baseline` block is dropped, the CI gate is skipped)". In other words a degraded run
is the `files` behaviour again, and the counts alone cannot be told apart from a real delta —
which is why the wrapper says so out loud instead of letting the numbers stand for something
they are not. The wrapper names the missing comparison rather than a cause, because the flag is
computed from `baselineDelta === undefined` and both listed causes land there indistinguishably.

Do not read a green diff gate as "no new findings" while this line appears; read it as "no
findings at all in the changed files", which is strictly stronger and therefore still safe to
gate on. Every `--scope changed` run in this repository currently degrades however the base is
given, and `--help` documents no baseline option, so the cause is not reachable from the CLI
surface. Finding it, so the gate reports what it was changed to report, is open work; the
measured attempts are in
[../../docs/react-doctor-gate-mechanics.md](../../docs/react-doctor-gate-mechanics.md).

### Recording An Accepted Risk So The Gate Can See It

`quality:react-doctor:diff` runs with `--scope changed`, so it reports only findings that are
new against `origin/main`. New means new to the scan, not worse: a finding inside a function
the change rewrote is reported even when its metrics are identical to the base. That is the
right default — rewriting a function is when to re-examine what it carries — but it means a
finding already classified as accepted risk will keep stopping the gate until the decision is
recorded somewhere the tool reads.

React Doctor has no file- or function-scoped configuration; `rules set` and `rules disable`
change a rule's severity everywhere. Turning a rule down to clear one classified finding would
hide every other instance, including ones that are genuine. So the accepted risk goes in an
inline record at the finding, which is the narrow case the repository-wide rule against inline
suppression exempts:

```ts
// react-doctor-disable-next-line <full rule id> -- accepted risk (<family>), <path to the classification record>:<line>
```

Copy the rule id exactly as the scan printed it. Not every rule carries the `react-doctor/`
prefix — `react/no-danger` in `article-content-view.tsx` is one of the existing records — and a
disable whose id does not match the reported one silently clears nothing.

The `--` reason must point at the record that holds the reasoning — the per-finding entry in
[../../docs/react-doctor-complexity-classification.md](../../docs/react-doctor-complexity-classification.md)
for complexity findings, or the owning section of this file or of
[quality-policy.md](./quality-policy.md) otherwise. An inline disable with
no such reference is not permitted: it asserts a judgement without saying who made it or why,
which is the failure mode the general rule is guarding against. Do not add one for a finding
that has not been classified yet; classify it first, or leave the gate red and say so.

Those `<record>.md:<line>` pointers are load-bearing and nothing in the record keeps them
true — inserting a paragraph moves every entry below it, and the disables then name body text.
`src/__tests__/config/react-doctor-disable-reference-contract.node.test.ts` requires each
pointer to land on a heading or on a table row naming the referencing file, which is a drift
guard rather than a proof: a pointer that slips onto a different heading still passes. After
editing a classification record, re-derive the line numbers rather than trusting a green run.

Inline disables are honoured by the scan, so adding one moves the full-scan counts. The
constant to re-pin is `reactDoctorBaselines.full`, which is what `runReactDoctor` compares the
report against. `reactDoctorFullScanTriageStatus.untriagedWarningCountAtScan` is derived and
needs no direct edit, but the two totals it subtracts do: decrement
`classifiedFindingCount` when the suppressed finding was in the classified complexity family,
and decrement the matching entry's `count` in `classifiedWarningFamilies` when it belonged to
one of those. Re-pinning the warning total alone leaves the stale classified count subtracting
a finding the scan no longer reports, which understates the untriaged number by one per missed
decrement. Record in the commit that the delta came from a documented disposition rather than
from findings disappearing.

Do not re-pin from a feature branch. `reactDoctorFullScanTriageStatusBase.scanSha` must name a
commit reachable from `main`, and a branch commit is not — squash-merging drops it, and the pin
then names something nobody can fetch to reproduce the measurement.

**`scanSha` names the tree the scan ran against, not a commit that agrees with this block.**
Adopted 2026-09-18. Four parts:

1. `scanSha` is the `main`-reachable commit where the pinned `pluginVersion` and `scanCommand` —
   including `auditScanCommand` — were run.
2. The raw scan totals reproduce at that tree: `warningCount`, `errorCount`, `affectedFileCount`
   and `auditWarningCount`. Re-running the pinned commands there is the check.
3. The classification metadata (`classifiedFindingCount`, `classifiedWarningFamilies`,
   `pendingJudgmentWarningFamilies` and the derived `untriagedWarningCountAtScan`) is the pinned
   diagnostics read through the **current** records, not through the records as they stood at
   `scanSha`.
4. That commit's own copy of this block is explicitly **not** part of the contract. Do not compare
   them.

Keep the field's name. `scanSha` already reads as "the commit the scan ran at"; `scanBaseSha` would
suggest a diff or merge base, which it is not.

The reading this replaced, what it cost, why it only ever held under a non-recursive interpretation,
and the consistency check this contract makes available as a PR gate are recorded in
[../../docs/react-doctor-gate-mechanics.md](../../docs/react-doctor-gate-mechanics.md).

### High Complexity React Function Findings

`no-high-complexity-react-function` reports when *either* cyclomatic or cognitive complexity exceeds 15; the plugin's condition is `cyclomatic <= 15 && cognitive <= 15 || report`. A function with cyclomatic 15 and cognitive 16 is reported on the cognitive side alone. Do not change the thresholds to make a count match.

Read the dominant metric together with nesting depth before triaging. Cyclomatic-dominant at nesting 1-2 is a flat fan of sibling guards in one return or one props object, where the rule's "extract independent branches" advice relocates terms without removing them. Cognitive-dominant at nesting 3-4 is nested or sequentially dependent logic, where the number describes real reading cost and extraction is at least meaningful.

Use the accepted-risk families below to triage repeat hits instead of re-litigating the same reasoning; only a hit that fits none of them needs a fresh decision.

- **Conditional-surface fan.** One return with N sibling optional slots and visibility guards for a single screen, panel, or card. The guards share the props they read, so extracted pieces re-receive most of the parent's props and the "what is visible when" contract leaves the one place a reader looks for it.
- **Shared primitive variant matrix.** A `src/components/shared` or design-system component whose API is optional props crossed with placement and tone variants. Splitting by variant duplicates generated-id derivation, ARIA wiring, and event plumbing — a correctness risk larger than the complexity removed. `LabeledInputRow` is the reference case.
- **Settings-view availability chain.** A settings view whose feature or action availability is decided by long boolean chains over the same flags — either a conjunction asserting that an optional feature's props were supplied as a set, or a disjunction over shared busy flags that gates actions. One view can contain both. The chain is one predicate, so moving it into a child relocates the same terms. Where the shape is prop presence, the real improvement is a props-shape change (one optional object instead of N optional props), which is a separate design decision, not a complexity fix.
- **Reader selection-union dispatch.** Hooks mapping the reader selection union onto queries and view state. The Rules of Hooks require every query to be called unconditionally before one is selected, so the arity of the union is a floor on the count; an extracted hook still calls all of them.
- **Container state-resolution chain.** Sequentially dependent derivations where each step consumes the previous. Not independent branches, so the rule's phrasing does not apply directly. A chain that also carries a large independent surface is not this family until that surface is gone, so read the dominant structure before assigning a finding here. `useAccountDetailViewProps` is the cautionary case: it was never this family, and splitting out its independent surface cleared the finding ([record, family E](../../docs/react-doctor-complexity-classification.md)).
- **Platform window-chrome matrix.** Overlay-titlebar / compact-desktop / browser-preview branching governed by `tauri-window-chrome.md`. Per-platform splitting triplicates the surface.
- **Opt-in diagnostic surface.** A lazily imported dev panel behind a preference, whose complexity is the diagnostic payload it exists to display.

A finding is `must-fix` only when it is a bug, a regression, or introduced by the current change. Render frequency alone does not promote one: a hot-path component whose complexity is conditional class selection gets *worse* under the rule's remedy, because extraction adds component instances per render. `ArticleListItem` is that case. When a hot-path finding also has a genuine render cost — missing memoization, a per-row store subscription, an unvirtualized list — record that separately; it is a different rule's concern and is not fixed by extraction.

Per-finding classifications are recorded in [../../docs/react-doctor-complexity-classification.md](../../docs/react-doctor-complexity-classification.md).

### Render-Time Ref Write Findings

`no-ref-current-in-render` reports a ref assigned during render. Classify each by **whether a
discarded render's write can be observed in a way that changes output** — by a reader outside
that render, or by a later render — not by whether the value looks stable.

The ref object is shared between the current tree and a work-in-progress render, so a render-time
assignment is visible to async continuations, DOM and window listeners, and timers before that
render commits. "A later render with the same props overwrites it" does not hold, because the
ordering is not guaranteed: an abandoned render's write can be read before the next commit
happens. Whether the ref holds a prop, state, or a derived value makes no difference — only
whether an abandoned write survives to a reader does.

That leaves two must-fix shapes, and the second is easy to mistake for safe. A ref read from
outside the render is the obvious one. A ref read only inside render is still must-fix when the
writes form a state machine across renders — `use-stable-open-translation.ts` writes a locale on
open and clears it on close, so a discarded render's write outlives it and the next render reads
a state the committed tree never produced.

A same-render reader is a false positive only when a foreign write cannot change what the reader
produces. `use-article-list-data.ts` is the one case here: its guard re-derives from a semantic
key, so a foreign write either mismatches the key and is discarded or matches it and is
equivalent. That argument depends on the key covering every field the consumer reads, so widening
the consumer means revisiting the key.

Do not use a passing test suite as evidence of a false positive. PR #241 and PR #243 were both
this rule, and in both the tests stayed green while the real screen broke.

The 2026-09-10 pass classified all 14 reported errors — 12 must-fix, 1 false positive, 1
test-only accepted risk — with the per-finding evidence and reasoning in
[../../docs/react-doctor-error-triage.md](../../docs/react-doctor-error-triage.md). The fix for a
must-fix finding is to move the ref write into a `useLayoutEffect`, so only a committed render's
value reaches the reader; group a batch of them by reader type rather than landing them all at
once. The two findings that remain in the full scan are this record's own false positive and its
test-only accepted risk, so `errorClassification.mustFix` is 0.

### Untriaged Warning Classification (Issue #249)

The first wave — `exhaustive-deps` 18 and `no-adjust-state-on-prop-change` 16 — is recorded per
finding in [../../docs/react-doctor-warning-classification-249.md](../../docs/react-doctor-warning-classification-249.md).
Read it before re-classifying anything in those two families.

Two things in it change how the remaining families should be approached.

`exhaustive-deps` is not one kind of finding. Of the 18, only one names an absent dependency;
14 name an identifier that is *already in the array* and complain about its identity churn, and
3 say the callback is defined elsewhere so dependencies cannot be checked. Counting them as one
backlog of "dependencies to add" is wrong.

The `no-adjust-state-on-prop-change` findings all sit on a setter whose argument is a constant,
and setters with computed arguments in the same effects are not reported. That regularity is
inferred from four counter-examples, not from the rule implementation, which is minified in the
shipped `dist`. Do not build a classification on it.

### Untriaged Warning Classification, Second Wave (Issue #300)

The second wave — 21 findings across nine rules — is recorded per finding in
[../../docs/react-doctor-warning-classification-300.md](../../docs/react-doctor-warning-classification-300.md).
Three were fixed, three are false positives, fifteen are accepted risk, and none was must-fix.
Read that record before re-classifying anything in those families. Five things in it change how
a later pass should work.

**Run `react-doctor rules explain <rule id>` before classifying, once per rule id.** The
one-line message the scan prints is neither the rule's full claim nor its remedy set, and
reasoning from it alone produced every wrong premise in the #300 draft. Three distinct kinds:

- A message can name more than one symptom. `prefer-use-sync-external-store` says "stale **or**
  torn values"; the draft refuted tearing by counting readers and treated the rule as answered.
  That is the one disposition the independent review overturned. Record a verdict per symptom.
- The remedies you remember may belong to a different rule. `no-pass-data-to-parent` and
  `no-pass-live-state-to-parent` cite two different React docs sections and both ask for the
  *owner* to move up (or for the hook to return the value); the draft argued against derive-during-
  render, `key` reset, and update-in-the-event — which are `no-adjust-state-on-prop-change`'s
  remedies — across all eleven findings whose remedy it argued. The twelfth,
  `use-sidebar-feed-drag-state.ts`, is a false positive on the rule's target rather than its
  remedy, so no remedy analysis applied to it.
- A remedy can pre-empt the defence you were about to write. `no-adjust-state-on-prop-change`
  says "Avoid tracking the previous prop in more state, which preserves the duplication", which
  is exactly the previous-prop-tracker argument the draft used to excuse a `no-derived-state`
  finding. Such a finding can still be accepted risk, but because the fix is a design change —
  not because the rule is wrong.

**Suppressing one rule can unmask a paired one.** `no-derived-state` and
`no-derived-state-effect` describe the same state from the declaration side and the effect side,
and react-doctor reports only one at a time; disabling the first revealed the second at the
`useEffect(` line. Nineteen disables moved the total by seventeen, which is the only reason it
was noticed. So after adding disables, check that the total moved by exactly the number added —
but a shortfall has two possible causes and they need different fixes. Either a paired rule took
the finding's place, or a disable did not fire at all: a rule id spelled differently from what the
scan printed, a comment above the wrong line, or a comment the reporting position does not sit
under. Locate the remaining findings before concluding which it was; reading a shortfall as
shadowing hides a suppression that silently records nothing. `--no-respect-inline-disables` shows
only `no-derived-state`, so this shadowing lives in the rule engine rather than in disable
handling, and that is the only pair measured here — do not assume every rule has one.

**Two stacked `react-doctor-disable-next-line` comments on one line both take effect.** Verified
by measurement: a line firing two rules, given one comment per rule, dropped both. The second
comment is two lines above the code and is still honoured. `react-doctor why` says "add one
immediately above this line", which reads as a limit of one and is not.

**A `warningCount` pin is net of every inline disable, so it cannot distinguish a fixed finding
from a silenced one.** Record the `--no-respect-inline-disables` total from the same scan
alongside it. At the #300 landing the two were 31 and 73.

**A classified count that no longer matches the scan silently understates the untriaged
total, and this happened twice in #300 — the second time after the rule below was written.**
`require-pnpm-hardening` stayed registered at 1 after both the finding and the rule itself were
gone (0.9.14 removed the rule), while `prefer-use-sync-external-store` was classified in this
file on 2026-09-08 and never registered at all; the two errors cancelled, so the derived
untriaged count read 20 against 21 real findings. Then the re-pin subtracted all 25 rows of the
complexity record and reported 0 untriaged, because **the record's 25 and the scan's 25 are
different sets**: #279 suppressed one row so the scan no longer reports it, and the scan reports
the `useAccountDetailViewProps` outlier the record deliberately excludes. Equal totals, one
finding hidden.

So `classifiedFindingCount` means "findings this scan reports that the record has a row for",
not "rows in the record". When re-pinning, set every count to what that scan reports and check
it by listing the findings, not by checking the totals agree. Never delete an entry — the entry
is the record of the decision, the count is only what the arithmetic needs — and carry a finding
nothing dispositions in `pendingJudgmentWarningFamilies` so it stays inside the untriaged total.

### Prop Callback In Effect Findings

`no-prop-callback-in-effect` reports an effect that calls a prop callback, and describes the cost
as "your parent re-renders on every local state change … just to stay in sync". Check whether the
effect actually mirrors state continuously before accepting that reading.

Standing accepted risk:

- `feed-edit-dialog.tsx` — the stale-account close. When the selected account no longer owns the
  feed being edited and no save or unsubscribe is in flight, the dialog calls `onOpenChange(false)`
  to hand control back to its owner. It fires on one transition, not on every local state change,
  and asking the owner to close is the only channel a controlled dialog has. The alternative —
  having the page derive staleness and clear `editTargetFeed` itself — was evaluated and rejected
  by independent review on 2026-09-11: the page cannot see the dialog's busy state without
  duplicating internal pending, an effect-delivered notification has a window before it arrives,
  and a save-loading-only signal misses the unsubscribe path entirely. The `operationActive`
  dependency is what makes the close wait for an in-flight operation and re-evaluate when it
  settles; do not remove it to quiet the rule.

### Loading Flag Reset Findings

`no-loading-flag-reset-outside-finally` reports that a busy flag is reset "only on the success
path". Check what the code actually does before accepting that reading; on 2026-09-08 all four
findings had a reset the rule's message did not describe, and the four did not share one verdict.

A **conditional** reset inside `finally` is not the shape the rule describes and must not be
made unconditional. `use-account-detail-sync-controls.ts` guards its reset with a
selected-account generation check so a stale request cannot clear the flag a newer request
owns. When the guard is false the stale owner's responsibility is ended by the `account.id`
change effect — which owns the generation bump and the ref/state reset — or by unmount, not by
"the next request will reset it anyway". Removing the guard is a regression, not a fix. That
effect is passive, so this does not claim commit-boundary freshness; that is a separate concern
from the rule's success-only claim.

A reset duplicated across `try` and `catch` is also not success-only, but it is still worth
consolidating into `finally`: work inside `catch` — error formatting, translation, a toast — can
itself throw and skip the reset, and a third path added later is easy to miss.

Do not classify a whole rule's findings in one verdict because they share a rule id.

### Adjust State On Prop Change Findings

`no-adjust-state-on-prop-change` reports an effect that calls `setState` in response to a prop,
and offers three remedies: derive during render, reset with a `key`, or update the state in the
event that changes the prop. Check which of the three is actually available before treating the
finding as a defect; where none is, the effect is the mechanism, not a mistake.

Standing accepted risk:

- `feed-edit-dialog.tsx` — the stale-account effect calls `setUnsubscribeOpen(false)` when the
  edited feed's account is no longer selected. None of the three remedies reaches it: the flag is
  opened by a user click so it cannot be derived during render; a `key` reset would remount the
  dialog and discard an in-flight save or unsubscribe, which is the very thing the surrounding
  guard exists to protect; and the event that changes the account lives outside this component.
  Leaving the flag set is not an option — the confirmation is a sibling, and owners such as
  `FeedContextMenuContent` keep the dialog mounted with `open={false}`, so the confirmation for
  the departed account would stay on screen. Reviewed 2026-09-11.

- `confirm-dialog-view.tsx` — the hold-to-confirm effect calls `cancelHold()` when `enabled`
  goes false. Disabling the button detaches its pointer handlers, so a release can no longer
  end the press; without the reset a later re-enable resumes a progress fill with no timer
  behind it. None of the three remedies reaches that: `holding` drives an imperative
  `setTimeout` and a CSS fill rather than rendered output, so it cannot be derived; a `key`
  reset would remount the dialog and drop focus; and the prop is owned by the caller, so the
  event that changes it is outside this component. What the rule describes as the cost — the
  disabled button showing its fill for the frame before the effect runs — is reasoning from
  the render order, not something observed on screen. The candidate improvement is to gate the
  *visual* state on `enabled && holding` while leaving the timer teardown in the effect, which
  would shorten that window without removing the reset; that is a state-ownership change to
  code outside the change that surfaced this, so it belongs in its own pass. Reviewed
  2026-09-09.

- `use-subscriptions-feed-dialogs.ts` — the stale-target effect calls `setDeleteTargetFeed(null)`
  when the target feed's account is no longer selected and no delete is in flight. None of the
  three remedies reaches it: the target records a user's click on a specific feed, so no prop
  it could be derived from exists; the finding is in a hook, so there is no component to `key`,
  and keying the page would discard the list state `useSubscriptionsIndexState` restores from
  `scopedIndexReturnState`; and `selectedAccountId` is owned by `useUiStore`, so the event that
  changes it is outside this hook. Leaving the target set is the Issue #299 defect itself — the
  delete dialog for the departed account stays on screen. The `deletePending` dependency is what
  makes the clear re-evaluate when a **failed** delete settles, which is that fix; do not remove
  it to quiet the rule.

  This finding is a relocation artifact, not new code. The same effect sat in
  `subscriptions-index-page.tsx` before #317 and was not reported there. Measured on 2026-09-18
  by scanning both source forms in one run: the page form (a component taking no props) reports
  0 of this rule, the hook form reports 1. The rule treats the hook's arguments as the changing
  prop, so extraction is what made it applicable. Reviewed 2026-09-18.

### Iteration And Lookup Shape Findings

`js-combine-iterations` and `js-set-map-lookups` describe shape, not cost. A `src/` path is not
by itself evidence of a hot path, and rewriting a small fixed-size lookup into a per-render
`Set` makes the code do more work. Classify each site by the size of what it iterates and by
how often the surrounding code runs, and do not report a shape rewrite as a measured
performance win.

Standing accepted risk:

- `article-list-footer.tsx` — the reported spread-lookup is over the small fixed set of list
  modes. `disabledModes.includes(...)` stays; building a `Set` on every render has no basis at
  that size. Reviewed 2026-09-08.
- `use-account-detail-danger-zone.ts` — the reported filter-then-map runs once after an account
  is deleted. A single pass is possible while preserving order and the first-element fallback,
  but the frequency does not justify the churn. Reviewed 2026-09-08.
- `feed-tree-presence-output.ts` (three sites) — `buildOutput` resolves the sidebar tree through
  `order.map(resolve).filter(isDefined)` for a folder's children, for the folder list, and for
  the unfoldered list. It runs inside a `useMemo` keyed on the presence state and the logical
  maps, so it re-runs whenever the logical tree changes at all, including an unread count moving
  during `j`/`k` reading — more often than "only when a row leaves". What it iterates is the
  visible tree, tens of entries, and the second pass is over an already-cheap projection whose
  cost is dwarfed by React reconciling the same rows. `filter(isDefined)` is also what narrows
  the type; a single-pass `reduce` or `for...of` trades that for a manual push loop with no
  measured win. Reviewed 2026-09-11.

A nested membership test is a different case: a `filter` whose predicate scans an array for
each element is quadratic in the two sizes, and building the membership `Set` once inside the
same function removes that without changing the contract. Keep the original array whenever a
later step derives ordering from it.

### Behavioural Single Findings

These three were classified on 2026-09-08 and are not mechanical fixes.

- `no-self-updating-effect` (`use-subscriptions-index-state.ts`) — the effect converges: the
  next run returns early once `layoutGeneration` and `viewportHeight` agree. Already carried an
  accepted-risk comment, and that classification is inherited. Being self-updating is not by
  itself a reason to rewrite it.
- `prefer-use-sync-external-store` (`subscriptions-index-page.tsx`) — **this 2026-09-08 accepted
  risk was overturned on 2026-09-18 and the site now uses `useSyncExternalStore`.** Two of its
  premises were wrong. Migrating did not need the value promoted to a shared store: `subscribe`
  takes `window.addEventListener("resize", onStoreChange)` directly, and the existing
  module-scope `getViewportHeight` already served as `getSnapshot`. And "absent an observed
  defect" understated the rule, whose message names *stale* values as well as torn ones — the
  hand-rolled form reads `window.innerHeight` during the first render but only subscribes in a
  passive effect, so a resize in between is lost no matter how few readers there are. Counting
  readers answers the tearing half and leaves the staleness half untouched.
- `prefer-html-dialog` (`ui-reference-shell-specimens.tsx`) — a motion specimen absolutely
  positioned inside a fixed 210px frame. A native `dialog` with `showModal` changes top-layer,
  focus, and overlay behavior, so it is not a mechanical substitution. Accepted risk for a
  display surface with no real modal contract; if it ever becomes a keyboard-operable target,
  audit its accessibility requirements separately rather than exempting it for being a story.

### Lazy Ref Init Findings

`rerender-lazy-ref-init` suggests `useRef(null)` plus initialisation on first render. That form
writes `ref.current` during render, which fires `no-ref-current-in-render` — an error. Applying
it to two sites on 2026-09-08 traded 2 warnings for 2 errors (14 → 16), so it was reverted.

`useState` with an initialiser function is not a general substitute: it captures once, so a
value that must follow props goes stale. Decide who owns the state and what lifetime it needs
before touching these; do not change code to trade one rule for another, and do not record them
as accepted risk without that decision.

Both sites were resolved on 2026-09-18 under #300, and the remedy differed between them even
though the rule was the same. The deciding fact is **where the ref is read**, so read that
before picking a form.

- Read during render, never written (`article-tag-chip-list.tsx`): a mount-time snapshot that
  must *not* follow props. `useState(() => …)` is correct here — following props would delete
  the entrance animation the snapshot exists to gate. `useMemo` is not, because React may
  discard it and recompute from the current props.
- Read only inside the effect that also writes it (`use-article-list-navigation.ts`): the
  initial value exists only so the effect's first run returns early, so a `null` sentinel
  removes it. The one behavioural difference — a generation counter incremented once at mount —
  is unobservable because that counter is only compared against a value captured inside a
  callback.

Neither remedy added an error; measured with the full scan before and after. Do not carry
forward the earlier conclusion that this rule cannot be addressed — that applied to the
rule's *own* suggested form, not to every alternative.

### Supply Chain Hardening Findings

`require-pnpm-hardening` asks for `trustPolicy`. Adopting `no-downgrade` is a supply-chain
policy decision, not a lint fix, and belongs to its own preflight rather than a React Doctor
triage pass. The preflight must record which packages the policy rejects and why, run against
the current manifest and lockfile in an isolated scratch checkout — never by editing `main` or
global configuration to observe the effect — and confirm the rejection condition against a
controlled fixture or upstream test. A successful frozen install does not demonstrate that a
future update's weakened trust signal would be caught.

That preflight ran under <https://github.com/jey3dayo/ultra-rss-reader/issues/264>. The
measurements are below; the decision it produced is here.

#### Decision: adopted on 2026-09-10

`pnpm-workspace.yaml` sets `trustPolicy: no-downgrade` with one entry in
`trustPolicyExclude`. Exclusions follow the Dependency Advisory Policy in
[quality-policy.md](./quality-policy.md): never anonymous,
always with the package, the reason, and the date, recorded here as well as at the setting.

Current exclusions:

- `semver@6.3.1` — reached transitively through `@babel/core` and
  `@babel/helper-compilation-targets`. `pnpm why semver --prod` returns no match, so it never
  reaches the shipped bundle. Remove this entry once Babel widens its `semver` range; verify
  with `pnpm install --frozen-lockfile --no-trust-lockfile` after dropping it. Registered
  2026-09-10.

`--no-trust-lockfile` is what re-runs the check when the cached verdict would otherwise be
reused, so use it whenever the point is to observe the policy rather than to install. Measured
2026-09-10: with the exclusion the repository's 1102 lockfile entries pass; replacing the
exclusion with a name that matches nothing fails with `ERR_PNPM_TRUST_DOWNGRADE` naming
`semver@6.3.1`, which is how this entry is known to be load-bearing rather than decorative.

Two exclusion mechanisms exist and only the first is used here. `trustPolicyExclude` names
specific packages or versions. `trustPolicyIgnoreAfter` skips the check for anything published
longer ago than a given duration, which would silently cover packages nobody reviewed, so it is
deliberately left unset.

The measured reproduction log for this preflight is in
[../../docs/pnpm-trust-policy-preflight.md](../../docs/pnpm-trust-policy-preflight.md).
