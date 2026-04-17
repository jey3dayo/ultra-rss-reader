# Design System Inspired by Cursor

## Visual Theme & Atmosphere

This design system aims for warm editorial software rather than cold utility UI. The core mood is calm, crafted, and slightly premium: warm cream canvases, warm near-black text, restrained accent usage, and diffused depth that feels atmospheric instead of glossy. It should read like a thoughtfully designed reading tool, not a generic admin dashboard.

The visual density should feel intentional. Typography carries most of the hierarchy, especially through compressed display text, serif body copy for warmth, and monospace for technical moments. Surfaces should separate through tonal shifts, borders, and spacing more often than through heavy chromatic contrast.

When no exact token applies, prefer these defaults:

- Warm over cool
- Cream and brown over pure white and pure black
- Tonal separation over loud contrast
- Diffused depth over hard-edged shadow
- Editorial calm over dashboard aggressiveness

## Colors

The base palette names in this section are for Stitch-style design system description and are not a 1:1 mapping to the current CSS token names in `src/styles/global.css`.

- Primary (`#f54e00`): CTAs, active states, brand-highlight moments, key interactive emphasis
- Secondary (`#c08532`): Supporting highlights, premium accents, secondary emphasis
- Tertiary (`#cf2d56`): Hover emphasis, destructive/error-adjacent accents, expressive interaction feedback
- Neutral (`#26251e`): Text anchor, dark surfaces, border base, tonal reference for the whole system

Derived roles used across the product:

- Canvas (`#f2f1ed`): Default page background and primary warm cream surface
- Surface 100 (`#f7f7f4`): Lightest surface for popovers and subtle controls
- Surface 300 (`#ebeae5`): Muted interactive surface, default button background, list emphasis
- Surface 400 (`#e6e5e0`): Card background and secondary surface
- Surface 500 (`#e1e0db`): Selected surface, tertiary emphasis, deeper muted surface
- Text / Foreground (`#26251e`): Primary text and icon color
- Muted Foreground (`rgba(38, 37, 30, 0.74)`): Secondary text and helper copy
- Soft Foreground (`rgba(38, 37, 30, 0.58)`): Tertiary labels and lighter metadata
- Border (`oklab(0.263084 -0.00230259 0.0124794 / 0.1)`): Default border and divider tone
- Border Strong (`rgba(38, 37, 30, 0.2)`): Focused, active, or emphasized border
- Browser Overlay Loading Halo: Ambient glow behind embedded-browser loading feedback
- Browser Overlay Detail Surface: Inset support surface for technical detail inside browser overlay issue cards
- Success (`#1f8a65`): Positive state and successful completion messaging
- Unread (`#9fbbe0`): Fixed semantic accent for unread state, unread markers, and reading-context navigation
- Loading (`#9fbbe0`): Fixed semantic accent for indeterminate loading, startup progress, settings loading, and sync-progress bars
- Starred (`#facc15`): Fixed semantic accent for starred state, starred markers, and star-focused navigation

Feature and timeline accents:

- Thinking (`#dfa88f`): AI or background processing state
- Grep (`#9fc9a2`): Search and indexing state
- Read / Unread Context (`#9fbbe0`): Reading-related state, unread indicators, and reading-context navigation accents
- Loading (`#9fbbe0`): Generic loading and sync-progress feedback that needs stronger visibility than the warm accent ring
- Edit (`#c0a8dd`): Edit and mutation state

Color governance:

- If an existing semantic token can express a color, use the token instead of a literal value in code.
- If a repeated UI meaning needs a new color role, add it here and to the token layer before spreading literals in code.
- Unread and starred UI are fixed semantic roles. Define them in `DESIGN.md` and the shared token layer before using them in multiple components.
- Loading is a fixed semantic role for indeterminate progress feedback. Keep it separate from the warm `ring` accent and from unread-reading context.
- Tag palettes and provider brand colors are exceptions and should be managed as central palettes, not mixed into the base theme colors.

## Typography

- Headline Font: `CursorGothic`, with fallbacks `CursorGothic Fallback, system-ui, Helvetica Neue, Helvetica, Arial`
- Body Font: `jjannon`, with fallbacks `Iowan Old Style, Palatino Linotype, URW Palladio L, P052, ui-serif, Georgia, Cambria, Times New Roman, Times`
- Label Font: `CursorGothic`, with fallbacks matching the headline stack
- Code Font: `berkeleyMono`, with fallbacks `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New`

Role guidance:

- Headlines should feel compressed and engineered, using negative tracking at larger sizes.
- Body copy should feel literary and warm, favoring serif rhythm for longer reading.
- Labels should stay compact and restrained, using lighter weight and spacing rather than bold saturation.
- Technical moments should switch clearly into monospace.

Detailed hierarchy:

| Role            | Font         | Size              | Weight  | Line Height    | Letter Spacing | Notes                                |
| --------------- | ------------ | ----------------- | ------- | -------------- | -------------- | ------------------------------------ |
| Display Hero    | CursorGothic | 72px (4.50rem)    | 400     | 1.10 (tight)   | -2.16px        | Maximum compression, hero statements |
| Section Heading | CursorGothic | 36px (2.25rem)    | 400     | 1.20 (tight)   | -0.72px        | Feature sections, CTA headlines      |
| Sub-heading     | CursorGothic | 26px (1.63rem)    | 400     | 1.25 (tight)   | -0.325px       | Card headings, sub-sections          |
| Title Small     | CursorGothic | 22px (1.38rem)    | 400     | 1.30 (tight)   | -0.11px        | Smaller titles, list headings        |
| Body Serif      | jjannon      | 19.2px (1.20rem)  | 500     | 1.50           | normal         | Editorial body with `"cswh"`         |
| Body Serif SM   | jjannon      | 17.28px (1.08rem) | 400     | 1.35           | normal         | Standard body text, descriptions     |
| Body Sans       | CursorGothic | 16px (1.00rem)    | 400     | 1.50           | normal/0.08px  | UI body text                         |
| Button Label    | CursorGothic | 14px (0.88rem)    | 400     | 1.00 (tight)   | normal         | Primary button text                  |
| Button Caption  | CursorGothic | 14px (0.88rem)    | 400     | 1.50           | 0.14px         | Secondary button with `"ss09"`       |
| Caption         | CursorGothic | 11px (0.69rem)    | 400-500 | 1.50           | normal         | Small captions, metadata             |
| System Heading  | system-ui    | 20px (1.25rem)    | 700     | 1.55           | normal         | System UI headings                   |
| System Caption  | system-ui    | 13px (0.81rem)    | 500-600 | 1.33           | normal         | System UI labels                     |
| System Micro    | system-ui    | 11px (0.69rem)    | 500     | 1.27 (tight)   | 0.048px        | Uppercase micro labels               |
| Mono Body       | berkeleyMono | 12px (0.75rem)    | 400     | 1.67 (relaxed) | normal         | Code blocks                          |
| Mono Small      | berkeleyMono | 11px (0.69rem)    | 400     | 1.33           | -0.275px       | Inline code, terminal                |

Typography principles:

- CursorGothic uses size and tracking for hierarchy more than weight.
- The serif body font should provide warmth and reading comfort.
- The relationship between gothic display, serif body, and mono technical text is part of the brand and should remain visible in the UI.

## Elevation

This system is low-elevation by default. Depth comes first from tonal surface shifts and warm borders, then from large-blur atmospheric shadows when emphasis is necessary.

Shadow philosophy:

- Borders should feel organic and warm, ideally using oklab-derived or warm-brown alpha values.
- Elevated surfaces should blur broadly and softly instead of casting short, sharp shadows.
- Flat and border-led surfaces are preferred for most reading and settings interfaces.

Elevation scale:

| Level                    | Treatment                                                                   | Use                                         |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------- |
| Flat (Level 0)           | No shadow                                                                   | Page background, text blocks                |
| Border Ring (Level 1)    | `oklab(0.263 / 0.1) 0px 0px 0px 1px`                                        | Standard card/container border              |
| Border Medium (Level 1b) | `oklab(0.263 / 0.2) 0px 0px 0px 1px`                                        | Emphasized borders, active states           |
| Ambient (Level 2)        | `rgba(0,0,0,0.02) 0px 0px 16px, rgba(0,0,0,0.008) 0px 0px 8px`              | Floating elements, subtle glow              |
| Elevated Card (Level 3)  | `rgba(0,0,0,0.14) 0px 28px 70px, rgba(0,0,0,0.1) 0px 14px 32px, oklab ring` | Modals, popovers, elevated cards            |
| Focus                    | `rgba(0,0,0,0.1) 0px 4px 12px`                                              | Focus feedback for primary interactive UI   |

## Components

- Buttons: Primary buttons use a warm surface fill with dark text; secondary and tertiary actions rely on surface tone, border contrast, or transparent warm overlays. Shared action buttons should default to `rounded-md` so input, select, and button controls read as one family inside forms and settings panels. Hover states often shift text toward the tertiary accent (`#cf2d56`) rather than increasing fill saturation.
- Chips and Tags: Secondary and filter chips should read as pill elements by default. Use full-pill radius, muted warm surfaces, and restrained text contrast. Selected chips deepen through surface tone before introducing stronger chroma. In dense workspace toolbars and cleanup-style filter clusters, compact filter chips may step down to `rounded-md`, and their count badges may step down again to `rounded-sm` so the controls feel more editorial and less soft.
- Cards and Containers: Use warm cream surfaces, a warm border ring, and border-led separation by default. Shared section and info containers should default to `rounded-md` so structural surfaces stay on the same baseline as settings-form controls unless a shell role explicitly needs a larger frame. Elevated cards may use the Level 3 shadow. 20px+ radii belong to separate shell roles rather than standard cards.
- Inputs and Forms: Inputs should stay neutral and legible, with warm borders and a restrained focus treatment. Prefer border emphasis or accent-orange focus hints over cold blue rings. Shared input-like primitives should use `rounded-md`; switches remain `rounded-full`. Loading bars are the exception: they may use the dedicated loading blue when the warm ring is not legible enough.
- Settings Forms: Treat settings pages as desktop-app settings panels, not generic web forms. The canonical row is a stable left label column plus a stable right control column. Controls should resolve against one right-column endpoint so input, select, button, checkbox, switch, and segmented choice groups feel aligned as a system. Long controls may cap their width instead of stretching edge-to-edge, but compact controls must still live on the same control rail rather than floating at arbitrary intermediate positions. The desired rhythm is: section gap first, then heading-to-first-row gap, then a consistent row cadence, with a fixed label-to-control column gap.
- Settings and Review Hierarchy: In settings and feed-cleanup style workspaces, the outer shell should read as framing, account/status subsections should sit one tonal step quieter than the active editing surface, and only the primary next action should get the strongest emphasis. Avoid letting navigation rows, passive summary cards, or repeated outline buttons compete with the main review action.
- Lists and Navigation: Lists should separate items through tone and dividers rather than heavy blocks of accent color. Navigation and tab treatments should feel clean, compact, and editorial rather than dashboard-like. Smart views, context strips, filter chips, and article state icons may use the fixed unread/starred semantic colors, but the color should usually appear as icon tint or a light surface wash rather than a solid block.
- Media and Preview Surfaces: Code or browser previews may use darker surfaces, but they should still feel framed by warm borders and integrated into the cream-based system rather than floating as disconnected black panels.
- Dialog and Popup Shells: Dialogs, command palettes, and other popup shells should use named scrim roles from the token layer instead of ad hoc alpha literals. Use the standard dialog scrim for modal separation and the readable scrim only when the content behind the popup needs to stay legible as a softened surface instead of falling into darkness.
- Distinctive Components: The AI timeline remains a special component. It may use the thinking/grep/read/edit palette directly, with each state tied to a clear semantic label and a vertical connection rhythm.

## Layout Principles

### Spacing System

- Base unit: 8px
- Fine scale: 1.5px, 2px, 2.5px, 3px, 4px, 5px, 6px for micro-adjustments
- Standard scale: 8px, 10px, 12px, 14px
- Extended scale: 16px, 24px, 32px, 48px, 64px, 96px

### Grid and Container

- Max content width: approximately 1200px
- Hero sections favor centered single-column layouts with generous vertical space
- Feature sections can expand to 2-3 column grids
- Sidebar and settings layouts should keep warm section separation without harsh visual breaks
- Desktop settings forms should use a stable two-column grid: a fixed or semifixed label column on the left and a right control column with a shared endpoint.
- In settings-style forms, the control column should feel like one rail. Wide controls may stop short with a max width, but compact controls should still align to that same rail.

### Whitespace Philosophy

- Warm negative space should feel cozy rather than sterile
- Dense typography should be balanced by generous surrounding margins
- Section separation should usually come from tone and space rather than hard dividers

### Layout Stability

- Important workspace layouts should keep their geometry stable as state changes. Selection, filtering, loading, and bulk-action states should usually swap content within an existing rail instead of inserting a new structural row that pushes the main list or detail view.
- When a screen needs contextual controls such as bulk actions, filter summaries, or status messaging, prefer a persistent control rail with quieter empty or disabled states over a panel that appears and disappears. The user should feel that the interface is changing emphasis, not reflowing underneath them.
- Distinguish the content edge from the scroll edge. The right edge of cards, list rows, headers, and control rails should align to one shared content endpoint, while scrollbar gutter and overflow clearance should be handled as a separate lane rather than by ad hoc padding nudges.
- Border and divider responsibility should live in one place. Avoid combining a section border, an inner scroll lane, and last-mile padding adjustments in a way that creates double lines or drifting endpoints.
- Numeric badges, counters, and rapidly changing labels should avoid jitter. Reserve enough width, use tabular figures when repeated values update in place, and keep local state changes from changing surrounding alignment.
- Motion and feedback should reinforce continuity. Prefer opacity, tone, border, and transform changes over height or position changes that cause reflow, especially in dense workspace panels and two-pane review layouts.

### Border Radius Scale

- Micro: 1.5px
- Small: 2px
- Medium: 3px
- Standard: 4px
- Comfortable: 8px
- Featured: 10px
- Full Pill: 9999px

Surface governance:

- Reusable surfaces should go through shared primitives before feature-local radius rules.
- Shared section and info containers should use `rounded-md`.
- Shared input, select, textarea, button, and checkbox controls should use `rounded-md`.
- Shared switches should use `rounded-full`.
- Shared segmented controls, toggle groups, and radio-like choice chips should use `rounded-md` in settings-form contexts unless a pill treatment is intentionally documented for that component family.
- Dense workspace filter chips may use `rounded-md`. Their inline count badges may use `rounded-sm` when a full pill would feel too soft for the surrounding UI.
- 20px+ radii are reserved for distinct shell roles, such as modal shells, command palettes, or other app-level outer frames, not standard cards or section containers.
- Prefer radius scale utilities such as `rounded-md`, `rounded-lg`, `rounded-xl`, and `rounded-2xl` over pixel literals in component code. Do not use px radius literals for reusable shared primitives.

### Shell Roles

- Shell roles are the app-level outer frames that contain the inner section containers.
- Use them for left rail shells, main content shells, dialog shells, context menus, command palettes, and other workspace-level surfaces that frame a screen.
- Shell roles may use 20px+ radii and slightly stronger ambient separation than section containers, but they should keep the same warm surface language.
- Section containers remain the inner structural units. Keep their `rounded-md` baseline and do not reuse shell-level framing language on them.
- In Storybook shell examples, treat the outer frame as the reusable shell pattern; the inner dialog or menu body may still use a smaller radius and should not be copied as the shell.

## Interaction and Motion

### Hover States

- Buttons shift text toward the tertiary accent (`#cf2d56`) on hover
- Links may shift toward primary or add understated underline emphasis
- Cards intensify shadow or border contrast subtly rather than jumping in scale

### Focus States

- Prefer warm border emphasis or soft depth-based focus
- Avoid cold blue default focus rings unless an accessibility layer specifically requires them

### Transitions

- Color transitions: 150ms ease
- Shadow transitions: 200ms ease
- Transform feedback should remain subtle

### Compact Action Feedback

- Small icon-only actions should acknowledge accepted clicks with a short, restrained motion cue instead of feeling silent.
- Prefer a compact single-turn icon spin for accepted refresh-like actions where text feedback would otherwise be easy to miss.
- Differentiate intent by duration:
  - Accepted action: approximately 0.8-1.0s
  - Cooldown or temporarily unavailable retry: shorter acknowledgement, approximately 0.35-0.5s
  - In-progress state: continuous spin only while work is actually active
- These cues should feel mechanical and calm, not celebratory. They are confirmation, not decoration.
- Use this pattern for compact refresh and navigation controls such as sidebar sync and in-app-browser reload, back, and forward actions.

### Expandable Sections

- Section and sidebar disclosure patterns should feel calm and mechanical, not springy or theatrical.
- Use one shared easing family for disclosure UI: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Chevron rotation, section header emphasis, and body reveal should usually complete in about 200ms.
- Expandable content should prefer layout-safe reveal patterns such as `grid-template-rows`, opacity, and a small vertical translate instead of abrupt mount/unmount swaps when the component family benefits from continuity.
- Chevron icons should rotate to communicate state, but the motion should stay compact. A quarter-turn is preferred for collapsed side-rail toggles and folder rows.
- Revealed content should move only slightly. A small upward offset while collapsing is preferred over large slide distances.
- Hover lift on expandable headers or rows may use a 1px translate at most. Disclosure UI should suggest responsiveness, not float dramatically.
- Keep disclosure surfaces interactive only when visible. Collapsed content should disable pointer interaction and expose a hidden state to accessibility APIs, for example through `aria-hidden` when appropriate.
- Preserve semantic state while animating. Header buttons should continue to own `aria-expanded`, and the controlled region should be addressable via `aria-controls`.
- Respect `prefers-reduced-motion`: keep state changes functional, but remove or minimize transform and timing-based flourish.

### Theme Transition

- Theme changes should feel soft and atmospheric rather than flashy or theatrical.
- Prefer app-wide transitions on color, border, and shadow only when switching between light and dark themes.
- Keep theme transition duration short, typically in the 150-200ms range.
- Use smooth easing that feels editorial and restrained rather than playful or bouncy.
- Avoid large transforms, blurs, zooms, or full-screen wipes for theme switching.
- Respect `prefers-reduced-motion` by removing or minimizing theme transition animation.

## Responsive Behavior

### Breakpoints

| Name          | Width      | Key Changes                                        |
| ------------- | ---------- | -------------------------------------------------- |
| Mobile        | <600px     | Single column, reduced padding, stacked navigation |
| Tablet Small  | 600-768px  | 2-column grids begin                               |
| Tablet        | 768-900px  | Expanded card grids, sidebar appears               |
| Desktop Small | 900-1279px | Full layout forming                                |
| Desktop       | >1279px    | Full layout, maximum content width                 |

### Touch Targets

- Buttons should maintain comfortable touch sizing
- Pill buttons should preserve tap-friendly proportions
- Navigation labels should stay readable at mobile sizes

### Collapsing Strategy

- Hero text scales proportionally while preserving tracking character
- Horizontal navigation may collapse to compact controls on mobile
- Multi-column cards collapse to single column cleanly
- Timeline or preview layouts can switch from horizontal emphasis to vertical stacking
- Mobile settings navigation may collapse into more compact controls, but settings content should keep priority over navigation chrome so the first editable rows remain visible without excessive scrolling.

## Do's and Don'ts

- Do keep the entire system warm-toned, using cream, brown, orange, gold, and muted semantic accents as the default language.
- Do use the existing semantic token layer when a background, border, text, or elevation role already exists.
- Do introduce new meaning-based color roles in the design system before duplicating literals in multiple components.
- Do keep corner language consistent: pills for chips and filters, `rounded-md` defaults for shared info cards, section containers, and buttons, and smaller radii only for compact utility details.
- Do maintain accessible contrast, especially for body text and interactive labels.
- Don't use pure white or pure black as primary surfaces unless a component explicitly needs a true contrast moment.
- Don't overuse the primary accent; reserve it for the most important action or highlight on a surface.
- Don't mix warm editorial surfaces with arbitrary cool gray or utility palette colors unless they are an approved semantic or exception palette.
- Don't treat tag colors or provider brand colors as theme colors; manage them as exception palettes.

## UI Reference Mapping

- `Typography` -> `UI Reference/Foundations Canvas`
- `Colors`, semantic surfaces, and feature accents -> `UI Reference/Foundations Canvas`
- `Inputs and Forms` -> `UI Reference/Input Controls Canvas`
- `Cards and Containers`, `Shell Roles` -> `UI Reference/Shell & Overlay Canvas`
- `Lists and Navigation` -> `UI Reference/Navigation & Collections Canvas`
- Dense workspace filters, action clusters, detail panels, and two-pane composition -> `UI Reference/View Specimens Canvas`

## Appendix

### Exception Palettes

#### Tag Palette

Tags use a shared data palette rather than theme-base colors. These values are intentionally warm or muted so they sit inside the product without becoming competing brand accents.

- `#cf7868`: warm coral
- `#c88d62`: warm ochre
- `#b59a64`: muted gold
- `#5f9670`: muted green
- `#5f9695`: muted teal
- `#6f8eb8`: muted blue
- `#8c79b2`: muted lavender
- `#b97a90`: muted rose
- `#726d66`: warm gray

These colors currently appear in tag settings, tag rename flows, and the migration palette refresh. They should stay centrally managed and must not be mixed into the base `Colors` section.

#### Provider and Service Brand Accents

Provider and service icon backgrounds may use brand or near-brand colors as explicit exceptions:

- Local feeds: warm orange accent (`bg-orange-500` in current implementation)
- Fever: neutral gray placeholder (`bg-gray-500` in current implementation)
- FreshRSS: `#0062BE`
- Inoreader: `#1875F3`

These colors should be centralized as provider brand tokens or a dedicated exception map, not treated as part of the core UI palette.

### Agent Prompt Guide

#### Quick Color Reference

- Primary CTA: `#ebeae5` background with `#26251e` text
- Page background: `#f2f1ed`
- Primary text: `#26251e`
- Secondary text: `rgba(38, 37, 30, 0.55)`
- Brand accent: `#f54e00`
- Hover / expressive accent: `#cf2d56`
- Success: `#1f8a65`
- Unread semantic accent: `#9fbbe0`
- Starred semantic accent: `#facc15`
- Default border: `oklab(0.263084 -0.00230259 0.0124794 / 0.1)` with warm rgba fallback

#### Example Prompt Framing

- Describe warm cream surfaces, not generic white UI
- Mention typography roles explicitly when a screen needs strong hierarchy
- If a component needs darker media or preview framing, keep the surrounding shell warm and integrated
- Prefer semantic roles and interaction intent over listing many arbitrary literals
