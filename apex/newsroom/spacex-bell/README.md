# SpaceX at Nasdaq — Content Guide

One self-contained `index.html` that reads `content.json` on every load and renders every module. Update copy, swap image/video URLs, and reorder cards **without touching code**. Copy is currently lorem-ipsum placeholder — replace it with real text.

```
spacex-bell/
├─ index.html       ← the shell (HTML + CSS + JS). Developer-only.
├─ content.json     ← all copy + image/video URLs. Edit this.
├─ favicon.ico
├─ webclip.png
└─ README.md
```

**Page order:** Hero → Article (collapsible) → Photo slideshow + gallery link → Embedded video → Newsroom articles. (No footer.)

All images and videos are referenced by **URL** in `content.json` — there is no local images folder to manage.

---

## Editing — `content.json`

Strict JSON: double-quote text, no trailing commas. `<em>X</em>` gives the brand serif italic accent in any `*.headline` / `hero.titleMarkup`.

### `subnav` — sticky section nav
`label` (left-side text) and `items[]` of `{ label, target }`, where `target` is a section id (`article`, `slideshow`, `broll`, `resources`). The bar is pinned to the top of the page, scroll-spy highlights the current section, and clicking jumps to it. Remove `subnav` (or empty `items`) to hide it.

### `hero`
`eyebrow`, `titleMarkup`, `intro`, `video.mp4` (background video) / `video.poster`.

### `article` — the on-page story, behind a "Read the article" dropdown
- `eyebrow`, `headline`, `dek`, `meta` — always visible. `toggleLabel` — the button text.
- `blocks[]` — the body that expands. Each block is one of:
  - `{ "type": "p", "text": "…" }`
  - `{ "type": "image", "src": "https://…/photo.jpg", "alt": "…", "caption": "…" }`
  - `{ "type": "video", "videoUrl": "https://…", "poster": "https://…", "caption": "…" }`
- Order = display order; add or remove blocks freely.

### `slideshow` — the photo marquee
`eyebrow`, `headline`, `autoAdvanceMs`, `galleryUrl` + `galleryCta` (the "View the full gallery" button — **set `galleryUrl`**), and `slides[]` of `{ photo, alt, label, headline, subhead }` where `photo` is an image URL.

### `broll` — the embedded video
`eyebrow`, `headline`, `lede`, `videoUrl` (the main/featured player), `galleryUrl` + `galleryCta` (the "View the full video gallery" link), and `more[]` — a carousel of additional video cards beneath the featured player, each `{ videoUrl, poster, title, meta }`.
- `autoload: true` embeds the featured player immediately so it loads on page load (use a JW Player autoplay player URL, e.g. the `-jO5YHc4l` player). Omit it to show a click-to-play poster instead.
- `poster` optional — JW Player URLs derive a thumbnail automatically; the carousel cards play inline on click.
- Featured pull-quote (to the right of the video, Winning Formula style): `quoteEyebrow`, `quote`, `quoteName`, `quoteRole`. Leave any blank to hide it.

### `resources` — newsroom articles at the bottom
`links[]` of `{ kind, title, description, href, cta }`. The three Nasdaq links are wired to their real URLs.

---

## Image & video URLs

- **Images** (hero poster, slideshow slides, article photos): any image URL. Currently pointed at the Nasdaq Brand Studio header stills.
- **Videos** (hero, article clip, embedded video): a JW Player link — either a media file `https://cdn.jwplayer.com/videos/{MEDIA_ID}-{KEY}.mp4` or a player page `https://cdn.jwplayer.com/players/{MEDIA_ID}-{PLAYER_ID}.html`. The thumbnail is derived automatically; the clip plays inline on click.

---

## Offline preview vs. hosted

`index.html` keeps an inline copy of `content.json` (in `window.__SPACEX_CONTENT__`) so it renders when opened locally. When hosted it fetches the real `content.json`, which always wins. If you edit `content.json`, mirror the change into that inline block to keep the local preview accurate.

---

## Developer notes
- No build step; deploy the folder as-is. `CONTENT_URL = './content.json'`, fetched with a per-minute cache-buster, inline fallback on any failure.
- **CSP (if enforced):** `img-src 'self' https://cdn.jwplayer.com https://nasdaqbrandstudio.github.io`; `frame-src`/`media-src https://cdn.jwplayer.com`; `script-src 'self' 'unsafe-inline' https://cdn.jwplayer.com`; `style-src 'self' 'unsafe-inline'`; `connect-src` wherever `content.json` is served.
- Uses `--gutter: 7.5%`; adjust (and add a `max-width` on `.wrap`) to match a specific Nasdaq layout container. Port the TWF iframe height-broadcaster if embedding via `<iframe>`.
