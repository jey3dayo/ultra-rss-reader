# Feed Selection Auto-Open Design

## Goal

Add a reading preference that lets users automatically open the first article when they select a feed from the sidebar.

## Scope

- Add one reading setting under `閲覧`
- Persist the setting as a boolean string preference
- Default the setting to `false`
- Apply the behavior only when selecting a feed
- Do not apply it to folders, tags, or smart views

## Approach

Reuse the existing feed landing behavior instead of inventing a second auto-open path. The new preference gates whether feed selection should call the landing flow or the existing plain `selectFeed` flow.

## UX

- Location: Settings > Reading (`閲覧`)
- Control: single switch
- Default: off
- Enabled behavior: selecting a feed opens the first visible article immediately
- Disabled behavior: selecting a feed only moves focus to the article list, as today

## Implementation Notes

- Preference schema/defaults live in `src/stores/preferences-store.ts`
- Reading settings UI lives in `src/components/settings/use-reading-settings-view-props.ts`
- Feed selection behavior should route through the existing `useFeedLanding` hook where the new preference is enabled
- Existing folder/tag/smart-view behavior stays unchanged

## Testing

- Reading settings renders the new switch
- Toggling the switch updates the stored preference
- Feed selection keeps current behavior when disabled
- Feed selection auto-opens the first article when enabled
