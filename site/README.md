# site/

Static product landing page for Ultra RSS Reader, deployed to Cloudflare Pages at
`ultra-rss.jey3dayo.net`.

## Deployment

Cloudflare Pages project `ultra-rss-reader`, account `4e7695e2370bc9cef6ae9f2802517dd3`.
Deploys are direct uploads, not a GitHub integration, so a push to `main` does not
publish anything on its own:

```bash
dotenvx run -- mise run deploy:site
```

The repository also deploys the site automatically through
`.github/workflows/deploy-site.yml` when a push to `main` changes `site/**`. The
workflow can also be started with `workflow_dispatch`, uses the
`CLOUDFLARE_API_TOKEN` GitHub Actions secret, and checks both public language pages
after deployment, retrying transient edge propagation failures.

The custom domain needs a DNS record that Cloudflare does not create on its own:
a proxied `CNAME` from `ultra-rss` to `ultra-rss-reader.pages.dev` in the
`jey3dayo.net` zone. Attaching the domain to the project (`POST .../pages/projects/
ultra-rss-reader/domains`) only registers it; without that record the domain stays
`pending` and never issues a certificate.

`CLOUDFLARE_API_TOKEN` in `.env` carries Account/Cloudflare Pages Edit plus
Zone/DNS Edit scoped to `jey3dayo.net`. It cannot enumerate accounts, so the
account ID above has to be passed explicitly.

Web Analytics is enabled from the Pages project settings in the dashboard, which
injects the beacon at the edge — deliberately not in the HTML.

## Design constraints

- Plain HTML with inline CSS. No React, no Tailwind, no build tool, no external CDN
  dependency. The only script is the inline download-button logic in each page.
- No build command. Cloudflare Pages serves this directory as-is; `site/` is the
  configured output directory.
- Two pages: `index.html` (EN) and `ja/index.html` (JA), cross-linked with
  `hreflang` and an on-page language switch. No `Accept-Language` redirect.

## Assets

`site/assets/` contains copies of files that already live elsewhere in the repo:

- `app-icon.png` — a 256x256 downscale of `assets/app-icon.png`, which is a
  1254x1254 master weighing about 2.2 MB. The page renders the icon at 96 CSS
  pixels, so shipping the master would make the icon the heaviest asset on a
  page whose whole job is loading fast. Regenerate with
  `sips -Z 256 assets/app-icon.png --out site/assets/app-icon.png`.
- `screenshot-reader-light.jpg` and `screenshot-reader-dark.jpg` copied from
  `docs/assets/`.

**`docs/assets/` and `assets/app-icon.png` are the source of truth.** When those
files change, re-copy (and for the icon, re-downscale) them into `site/assets/`
as well. This directory is intentionally out of the Vite build and out of
`docs/`, so nothing keeps the copies in sync automatically.

## Analytics

Cloudflare Web Analytics is enabled from the Cloudflare Pages dashboard, not by an
inline script in these pages. Do not add a Cloudflare Analytics `<script>` tag
here; the dashboard injects it automatically for the deployed project.

## Local preview

Open `index.html` or `ja/index.html` directly in a browser (`file://` works for
layout checks). The GitHub Releases API fetch used for OS-aware download links
fails under `file://` due to CORS; the download button falls back to the
`releases/latest` link in that case, same as it does for API failures or rate
limiting in a deployed context.
