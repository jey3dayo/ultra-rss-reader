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

- **Primary** (`#f54e00`): CTAs, active states, brand-highlight moments, key interactive emphasis
- **Secondary** (`#c08532`): Supporting highlights, premium accents, secondary emphasis
- **Tertiary** (`#cf2d56`): Hover emphasis, destructive/error-adjacent accents, expressive interaction feedback
- **Neutral** (`#26251e`): Text anchor, dark surfaces, border base, tonal reference for the whole system

Derived roles used across the product:

- **Canvas** (`#f2f1ed`): Default page background and primary warm cream surface
- **Surface 100** (`#f7f7f4`): Lightest surface for popovers and subtle controls
- **Surface 300** (`#ebeae5`): Muted interactive surface, default button background, list emphasis
- **Surface 400** (`#e6e5e0`): Card background and secondary surface
- **Surface 500** (`#e1e0db`): Selected surface, tertiary emphasis, deeper muted surface
- **Text / Foreground** (`#26251e`): Primary text and icon color
- **Muted Foreground** (`rgba(38, 37, 30, 0.74)`): Secondary text and helper copy
- **Soft Foreground** (`rgba(38, 37, 30, 0.58)`): Tertiary labels and lighter metadata
- **Border** (`oklab(0.263084 -0.00230259 0.0124794 / 0.1)`): Default border and divider tone
- **Border Strong** (`rgba(38, 37, 30, 0.2)`): Focused, active, or emphasized border
- **Success** (`#1f8a65`): Positive state and successful completion messaging

Feature and timeline accents:

- **Thinking** (`#dfa88f`): AI or background processing state
- **Grep** (`#9fc9a2`): Search and indexing state
- **Read** (`#9fbbe0`): Reading, inspection, or passive information state
- **Edit** (`#c0a8dd`): Edit and mutation state

Color governance:

- If an existing semantic token can express a color, use the token instead of a literal value in code.
- If a repeated UI meaning needs a new color role, add it here and to the token layer before spreading literals in code.
- Tag palettes and provider brand colors are exceptions and should be managed as central palettes, not mixed into the base theme colors.

## Typography

- **Headline Font**: `CursorGothic`, with fallbacks `CursorGothic Fallback, system-ui, Helvetica Neue, Helvetica, Arial`
- **Body Font**: `jjannon`, with fallbacks `Iowan Old Style, Palatino Linotype, URW Palladio L, P052, ui-serif, Georgia, Cambria, Times New Roman, Times`
- **Label Font**: `CursorGothic`, with fallbacks matching the headline stack
- **Code Font**: `berkeleyMono`, with fallbacks `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New`

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

- **Buttons**: Primary buttons use a warm surface fill with dark text; secondary and tertiary actions rely on surface tone, border contrast, or transparent warm overlays. Primary radius is 8px. Hover states often shift text toward the tertiary accent (`#cf2d56`) rather than increasing fill saturation.
- **Chips and Tags**: Secondary and filter chips should read as pill elements. Use full-pill radius, muted warm surfaces, and restrained text contrast. Selected chips deepen through surface tone before introducing stronger chroma.
- **Cards and Containers**: Use warm cream surfaces, a warm border ring, and border-led separation by default. Standard structural cards and section containers default to 8px radius; `Info Cards` are the smaller 6px role for reading, notice, and state surfaces. Elevated cards may use the Level 3 shadow. 20px+ radii belong to separate shell roles rather than standard cards.
- **Inputs and Forms**: Inputs should stay neutral and legible, with warm borders and a restrained focus treatment. Prefer border emphasis or accent-orange focus hints over cold blue rings.
- **Lists and Navigation**: Lists should separate items through tone and dividers rather than heavy blocks of accent color. Navigation and tab treatments should feel clean, compact, and editorial rather than dashboard-like.
- **Media and Preview Surfaces**: Code or browser previews may use darker surfaces, but they should still feel framed by warm borders and integrated into the cream-based system rather than floating as disconnected black panels.
- **Distinctive Components**: The AI timeline remains a special component. It may use the thinking/grep/read/edit palette directly, with each state tied to a clear semantic label and a vertical connection rhythm.

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

### Whitespace Philosophy

- Warm negative space should feel cozy rather than sterile
- Dense typography should be balanced by generous surrounding margins
- Section separation should usually come from tone and space rather than hard dividers

### Border Radius Scale

- Micro: 1.5px
- Small: 2px
- Medium: 3px
- Standard: 4px
- Info Card: 6px default
- Comfortable: 8px
- Featured: 10px
- Full Pill: 9999px

Surface governance:

- Reusable surfaces should go through shared primitives before feature-local radius rules.
- `Info Cards` use 6px by default. Stay within a tight 6-8px range only when a shared primitive needs a documented variant.
- `Section Containers` use 8px by default. Treat 8-10px as the narrow upper range for shared structural variants, not feature-local drift.
- 20px+ radii are reserved for distinct shell roles, such as modal shells, command palettes, or other app-level outer frames, not standard cards or section containers.

### Shell Roles

- Shell roles are the app-level outer frames that contain the inner section containers.
- Use them for left rail shells, main content shells, dialog shells, context menus, command palettes, and other workspace-level surfaces that frame a screen.
- Shell roles may use 20px+ radii and slightly stronger ambient separation than section containers, but they should keep the same warm surface language.
- Section containers remain the inner structural units. Keep their 8px default radius and do not reuse shell-level framing language on them.
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

## Do's and Don'ts

- Do keep the entire system warm-toned, using cream, brown, orange, gold, and muted semantic accents as the default language.
- Do use the existing semantic token layer when a background, border, text, or elevation role already exists.
- Do introduce new meaning-based color roles in the design system before duplicating literals in multiple components.
- Do keep corner language consistent: pills for chips and filters, 6px defaults for info cards, 8px defaults for section containers and buttons, and smaller radii only for compact utility details.
- Do maintain accessible contrast, especially for body text and interactive labels.
- Don't use pure white or pure black as primary surfaces unless a component explicitly needs a true contrast moment.
- Don't overuse the primary accent; reserve it for the most important action or highlight on a surface.
- Don't mix warm editorial surfaces with arbitrary cool gray or utility palette colors unless they are an approved semantic or exception palette.
- Don't treat tag colors or provider brand colors as theme colors; manage them as exception palettes.

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
- Default border: `oklab(0.263084 -0.00230259 0.0124794 / 0.1)` with warm rgba fallback

#### Example Prompt Framing

- Describe warm cream surfaces, not generic white UI
- Mention typography roles explicitly when a screen needs strong hierarchy
- If a component needs darker media or preview framing, keep the surrounding shell warm and integrated
- Prefer semantic roles and interaction intent over listing many arbitrary literals
