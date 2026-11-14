---
type: checklist
title: Store Screenshot Capture Policy
description: Rules, fixed state, commands, and post-capture checks for the screenshots shown on the Microsoft Store listing, the README, and the landing page.
resource: urn:ultra-rss-reader:docs:store-screenshots
tags: [category/release, audience/maintainer, environment/local]
timestamp: 2026-11-14
audience: maintainer
owner: project-maintainers
---

# Store Screenshot Capture Policy

## Purpose

This document fixes how the product screenshots are produced, so they can be regenerated with one command and never show a third party's brand as the focus of the screen.

It covers every committed screenshot:

- `docs/assets/screenshots/<language>/screenshot-reader-<theme>-<os>.jpg`, used by the matching README and mirrored to `site/assets/<language>/` for the landing page
- `docs/assets/store/screenshot-reader-<theme>-windows.png`, uploaded to Partner Center for the Microsoft Store listing

`<language>` is `en` or `ja`; `<theme>` is `light` or `dark`, and `<os>` is `mac` or `windows`.

## Policy Background

A Store resubmission of v0.67.27.0 was rejected under certification policy **10.1.1.3 Inaccurate Representation**. Microsoft's note read:

> The images submitted in the Metadata advertise another product or include imagery from a product not published by you which may mislead users.

The rejected English (United States) screenshots were rendered from the English dev mock seed, whose account display name was `FreshRSS`. That name is the large heading at the top left of the sidebar, so a third-party product name became the headline of the screen.

The word "FreshRSS" is not forbidden as such. The problem was a third-party product name acting as the sign of the screen. Mentioning a compatible service in running text is fine. Issue [#657](https://github.com/jey3dayo/ultra-rss-reader/issues/657) records the investigation, and [#660](https://github.com/jey3dayo/ultra-rss-reader/issues/660) covers the Windows captures.

## Data Rules

- Capture only from the language-specific store fixtures (`src/dev/store-screenshot-fixtures.ts` for English or `src/dev/store-screenshot-fixtures-ja.ts` for Japanese), selected with `VITE_DEV_MOCK_LOCALE=store` or `store-ja`. They are the only data the capture loads. Never capture a real account, real data, or a real server.
- The everyday English demo seed (`src/dev/mock-data-demo-en.ts`) is built on top of the English fixtures and adds only articles that other dev checks need. Edit those extras freely; editing the fixtures changes the matching language's store images.
- Do not capture the everyday Japanese seed (`src/dev/mock-data.ts`). It contains real site names and is the default data of everyday development and many tests.
- The English and Japanese fixture account display names are `Personal` and `個人用`. A display name is whatever the user types when adding an account, so neutral names are faithful pictures of the product.
- Seed feeds and articles use `example.com` hosts only. Guard tests in `src/__tests__/dev/store-screenshot-fixtures.node.test.ts` check both fixture sets for third-party product names and off-example URLs.

## Brand Rules

- Do not make a third-party product name, logo, or wordmark the focus of an image. The account display name in the sidebar header must stay neutral.
- Do not show real sites' article text, logos, or favicons. Demo content is fictional.
- Naming a compatible service in a description is allowed. Using it as a sign inside an image is not.
- Do not add logos or marketing text on top of a screenshot, as the Store guidelines require.

## Fixed State

`scripts/capture-store-screenshots.ts` is the source of truth for every value. This list names the items and why each one is fixed.

| Item | Why it is fixed |
| --- | --- |
| Seed locale `store` or `store-ja` | Same language-specific data on every machine and OS from dedicated fixtures |
| Scenario `open-unread-showcase-article` | Opens the Unread smart view with a fixed article as a preview, so the read state and the unread badges do not change while capturing |
| Preferences `theme: "system"`, `debug_agentation_visibility: "off"` | `system` lets the browser color scheme switch dark and light; the dev-only Agentation toolbar stays out of the image |
| Preference `startup_folder_expansion: "restore_previous"` and a pre-seeded expanded-folder key | The Dev folder is open in the sidebar without a click. Clicking a folder row also selects it and leaves the Unread view |
| Account sync time | The screenshot fixtures report a recent successful sync, so the sidebar shows a time instead of the never-synced label |
| Viewport and device scale factor | Output is 3200 × 1800, the size of the previous screenshots and within the Store desktop limits |
| Browser locale (`en-US` or `ja-JP`) and time zone | Date and number formats do not depend on the machine |
| Fixed clock | The seed's relative dates and the "Today" group do not depend on the capture day; the time is later than every seed article published today |
| Reduced motion | No frame is captured mid-transition |
| External requests blocked | Favicons fall back to initials; no real logo or network state leaks in |

## Composition

The state above fixes what is true; the composition decides what looks good in a listing. Keep these when editing the fixtures:

- The showcase article has a heading, a quote, and a list, and its text fits the reader pane with room to spare. The Store listing must not show text cut off at the bottom of the article.
- The showcase article has no thumbnail. The reader pane draws an article thumbnail as a large hero image that pushes the text out of view.
- Other unread articles carry the abstract SVG thumbnails in `src/dev/assets/demo-thumbnails/`. They are imported with the `?no-inline` suffix because article thumbnails accept only `http(s)` URLs or absolute paths, and vite would otherwise inline small files as `data:` URIs. They contain no text, logos, or real imagery.
- The last row of the article list sits under the translucent filter bar and is cut there by design. That is the normal look of a scroll pane, so it is not a defect.

The capture runs in a browser, not in the Tauri window, so the native window chrome (title bar, traffic lights) is not part of the image. What the image shows is the app screen drawn by Chromium on the capture OS.

Before writing any file, the script inspects the live page and fails if any of these does not hold: the sidebar heading matches the selected language's store fixture and no page text matches `FreshRSS`; the article heading is the localized showcase article; the Unread or 未読 smart view is selected; only the Dev or 開発 folder is expanded; the article text does not overflow the reader pane; the `html` theme matches the color scheme; no Agentation toolbar or toast is visible; no page error occurred.

## Platforms And File Names

The app ships for macOS and Windows and draws with each OS's system fonts, so the two OSes look different and both are real. We capture one set per OS and use each where it fits.

| File | Captured on | Used by |
| --- | --- | --- |
| `docs/assets/screenshots/en/screenshot-reader-{light,dark}-mac.jpg` (and the `site/assets/en/` copy) | macOS | English README and landing page |
| `docs/assets/screenshots/en/screenshot-reader-{light,dark}-windows.jpg` (and the `site/assets/en/` copy) | Windows 11 | English landing page |
| `docs/assets/screenshots/ja/screenshot-reader-{light,dark}-mac.jpg` (and the `site/assets/ja/` copy) | macOS | Japanese README and landing page |
| `docs/assets/screenshots/ja/screenshot-reader-{light,dark}-windows.jpg` (and the `site/assets/ja/` copy) | Windows 11 | Optional Japanese Windows landing-page image |
| `docs/assets/store/screenshot-reader-{light,dark}-windows.png` | Windows 11 | Microsoft Store listing (PNG is required) |

- The script picks the OS suffix from `process.platform` (`darwin` → `mac`, `win32` → `windows`). There is no file name without a suffix.
- Publishing is supported on macOS and Windows only. macOS writes JPG only; English Windows writes JPG and the Store PNG at its established path. Japanese Windows writes localized JPGs only.
- Each README shows the macOS image for its language. The Japanese landing page uses Japanese macOS images and the existing English Windows images until Japanese Windows captures are available.
- The Store PNG path is fixed for the English Microsoft Store listing and is not language-scoped.
- What stays equal across OSes is the state and the composition. Pixels differ because the fonts differ.

## Capture Procedure

Prerequisites: dependencies installed (`pnpm install`) and the Playwright Chromium (`pnpm exec playwright install chromium`). On Windows, use Windows 11.

```bash
pnpm run capture:screenshots -- --lang en        # English trial into tmp/screenshots/store/en/
pnpm run capture:screenshots -- --lang ja        # Japanese trial into tmp/screenshots/store/ja/
pnpm run capture:screenshots:publish -- --lang ja # Japanese files for the running OS
pnpm run capture:screenshots:publish             # English files for the running OS
```

- The script starts its own vite on port 4173 with the arguments of `mise run app:dev:browser`. If that port is taken, pass another one: `pnpm run capture:screenshots -- --port 4180`. Other servers are never stopped or reused.
- A trial run writes both PNG and JPG on every OS and is never committed.
- `--lang` defaults to `en`. Publish copies each JPG to the matching `site/assets/<language>/` folder; `docs/assets/screenshots/<language>/` is the source of truth.
- Re-run the trial after any change to the fixtures, the scenario, or the app UI, and look at the images before publishing.

## Asset Management

- The committed files are the source of truth. Upload to Partner Center from the committed PNG files, not from a trial run.
- Never commit anything from `tmp/screenshots/`.
- To add an OS to the landing page, copy the existing `<picture data-platform="mac" data-active>` in the `.screenshot-frame` of `site/index.html` and `site/ja/index.html`, place it right after, and change the `data-platform` value, the `-mac` in the image paths, and the OS name in `alt`. Remove `data-active` from the copy: the page script decides which picture is active.

```html
<picture data-platform="windows">
  <source srcset="assets/en/screenshot-reader-dark-windows.jpg" media="(prefers-color-scheme: dark)" />
  <img src="assets/en/screenshot-reader-light-windows.jpg" width="1600" height="900" alt="Ultra RSS Reader on Windows: ..." />
</picture>
```

The platform switch appears by itself once two or more `<picture data-platform>` elements exist. `site/ja/index.html` uses `../assets/ja/` paths and a Japanese `alt`.

## Post-Capture Checklist

Review each generated image in a clean browser or image viewer before committing.

- [ ] No third-party product name, logo, or wordmark is the focus of the screen
- [ ] No real site content, logo, or favicon is visible
- [ ] No personal information is visible
- [ ] The UI is the current version
- [ ] No text is cut off in the article pane, and the sidebar shows a sync time
- [ ] No date or time in the image lies in the future of the fixed clock
- [ ] The text uses the capture OS's system font (SF on macOS, Segoe UI Variable on Windows)
- [ ] The size is 3200 × 1800
- [ ] The file name suffix matches the OS the image was captured on
