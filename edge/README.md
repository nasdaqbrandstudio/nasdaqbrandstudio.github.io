# Building Beyond the Edge

A JSON-driven landing page for Nasdaq Brand Studio's *Convergence Economy* campaign. Designed as a sibling to [The Winning Formula](https://nasdaqbrandstudio.github.io/winning-formula/) — same color palette, same typography, same iframe pattern. Different structure: this page is an editorial pillar page composed of typed content blocks rather than a video carousel.

**Live URL:** `https://nasdaqbrandstudio.github.io/edge/`

## Repository structure

Two files do all the work:

- **`index.html`** — the shell. Contains all CSS, all JavaScript renderers, and an empty `<main>` that the script populates at runtime. Designers and developers edit this. Editors don't.
- **`content.json`** — every word, image, link, quote, video, and visual style choice on the page. Editors live here.

Plus this README, a favicon set, and an `images/` directory for any custom assets referenced from the JSON.

## How to edit the page

1. Open `content.json` in any text editor (or in GitHub's web UI).
2. Change the values you want to change. Save.
3. Commit and push. GitHub Pages publishes within ~30 seconds.
4. Refresh the page. The script cache-busts on a per-minute basis, so a hard refresh isn't usually needed.

If the page goes blank after an edit, you almost certainly broke the JSON syntax. Run the file through any JSON validator (or paste into [jsonlint.com](https://jsonlint.com)) — the line number will tell you where the comma or brace went missing.

---

## How the page is composed

A **section** is a top-level slice of the page (hero, intelligence, builders, convergence). Each section has:

- a heading rhythm — `eyebrow`, `headline`, `lede`
- an optional `style` sidecar that controls how the section looks
- a `blocks` array — the content modules inside that section

A **block** is one content module within a section. Blocks have a `type` field; the renderer dispatches on it. Ten types exist (see below).

The order of sections is controlled by the top-level `sections` array. The order of blocks within a section is controlled by that section's `blocks` array. To reorder, hide, or insert, edit those arrays — no code changes needed.

```json
{
  "sections": ["hero", "intelligence", "builders", "convergence"],

  "intelligence": {
    "eyebrow": "Section I",
    "headline": "Intelligence as the new <em>operating layer.</em>",
    "lede": "...",
    "style": { "theme": "dark" },
    "blocks": [
      { "type": "quote", "...": "..." },
      { "type": "stats", "...": "..." }
    ]
  }
}
```

---

## Rich text

Most copy fields accept a small whitelist of HTML for typographic emphasis. Anything outside the whitelist is escaped (rendered as plain text), so editors can't accidentally break layout or inject anything unsafe.

**Allowed tags:**

| Tag | Use |
| --- | --- |
| `<em>…</em>` | Serif-italic accent — picks up the blue accent color. Used for headline accents like "the <em>edge.</em>" |
| `<strong>…</strong>` | Bold |
| `<u>`, `<small>`, `<mark>` | Underline, small text, highlighted |
| `<sup>`, `<sub>` | Superscript / subscript (e.g. `Metrio<sup>™</sup>`) |
| `<br>` | Line break |
| `<a href="...">…</a>` | Anchor link. `href` must start with `http(s)://`, `mailto:`, `tel:`, `/`, or `#`. Auto-rewritten to open in a new tab. |
| `<span class="rt-X">…</span>` | A styled span. See below for the class whitelist. |

**Span class whitelist:**

| Class | Effect |
| --- | --- |
| `rt-accent` | Nasdaq blue accent color |
| `rt-muted` | De-emphasized text color |
| `rt-mono` | Monospace, slightly tighter (good for tickers like NQINTELT) |
| `rt-serif-italic` | Bitter italic — magazine-style emphasis |
| `rt-highlight` | Soft blue highlight background |
| `rt-up` / `rt-down` | Green / red signal colors for data deltas |

Unknown classes are silently dropped (the span renders without a class). Quotation marks inside JSON values must be escaped: `"<span class=\"rt-accent\">word</span>"`.

---

## Per-section visual customization — the `style` sidecar

Every section accepts an optional `style` object that maps to predefined CSS classes. No inline `style=""` injection, no arbitrary colors from JSON — editors choose from a fixed palette of named treatments.

```json
"style": {
  "theme":   "dark",            // dark | light | accent | elevated
  "align":   "center",          // center | (omit for default left)
  "spacing": "loose",           // tight | (omit for default) | loose
  "bg":      "blue-70",         // blue-80 | blue-70 | blue-50 | elevated | elevated-2 | offwhite | light
  "accent":  "blue-50"          // reserved for future per-section accent overrides
}
```

| Field | Effect |
| --- | --- |
| `theme` | Bg + text color preset. `dark` is the default. `light` flips to off-white background with dark text. |
| `align` | `center` center-aligns the section head and centers the wrap content. |
| `spacing` | `tight` = ~half the vertical padding. `loose` = ~1.4× the default. |
| `bg` | Background-only override, useful when you want a light *theme* but a custom bg shade (or vice versa). |
| `accent` | Reserved for future accent recoloring. Currently a no-op. |

To flip a section from dark to light without changing any content, just set `"style": { "theme": "light" }`. The renderer adds `.theme-light` to the section wrapper; every block inside picks up the light variant via descendant CSS rules.

---

## Block field guide

Every block has a required `type` field. Everything else listed below is optional unless noted.

### `copy`
Prose block with optional headline above and attribution below. Body can be a single string or an array of strings (one paragraph per element).

```json
{
  "type": "copy",
  "layout": "centered",   // optional: "centered" | "wide"
  "headline": "Innovation hinges on <em>infrastructure.</em>",
  "body": [
    "First paragraph.",
    "Second paragraph."
  ],
  "attribution": "Doug Hamilton — Head of AI Research, Nasdaq"
}
```

### `quote`
A large pullquote with attribution and optional source link.

```json
{
  "type": "quote",
  "layout": "bare",        // optional: "bare" removes the top/bottom rules
  "text": "Robotics, and artificial intelligence generally...",
  "attribution": "Sofia Saravia",
  "title": "Nasdaq Information Services",
  "sourceUrl": "https://...",
  "sourceLabel": "Industry Report & Investment Case"
}
```

### `stats`
A grid of stat cards. Each card has a `variant`:
- `number` — eyebrow + large numeric figure + unit + supporting copy
- `insight` — eyebrow + label/headline/subLabel/body structure

```json
{
  "type": "stats",
  "cards": [
    {
      "variant": "number",
      "eyebrow": "2026 Outlook Survey",
      "number": "20",
      "unit": "%",
      "body": "of tech investments are being directed toward AI tools..."
    },
    {
      "variant": "insight",
      "eyebrow": "Maturity Gap",
      "label": "Insight",
      "headline": "71% of leaders say their organizations are still in early AI adoption.",
      "subLabel": "Why This Matters",
      "body": "Despite growing investment...",
      "source": "Source — Nasdaq 2026 AI Survey"
    }
  ]
}
```

The grid auto-fits 1 / 2 / 3 cards per row based on viewport width. Two cards (the brief's default) sit side by side on desktop.

### `image`
A standalone image with optional caption and source line. Used for charts, infographics, and illustrations.

```json
{
  "type": "image",
  "layout": "bare",                // optional: "bare" removes the dark frame
  "image": "images/nqintelt-vs-spxt.png",
  "imageAlt": "Description for screen readers",
  "caption": "The Nasdaq CTA Artificial Intelligence Index...",
  "source": "Source — Nasdaq Index Research"
}
```

### `resources`
A categorized list of links. Each item has a `kind` tag (Research, Verafin, Blogpost — anything) and a title.

```json
{
  "type": "resources",
  "title": "Further reading",
  "items": [
    { "kind": "Research", "title": "How AI is transforming the boardroom", "url": "https://..." },
    { "kind": "Verafin",  "title": "How Agentic AI is transforming...",     "url": "https://..." }
  ]
}
```

### `quote-cards`
A grid of quote cards. Each card can be a person (with `portrait`) or a brand (with `logo`). The renderer detects which by which field is populated.

```json
{
  "type": "quote-cards",
  "layout": "row-3",                  // optional: forces 3 columns on desktop
  "cards": [
    {
      "text": "The production and application of...",
      "attribution": "Jensen Huang",
      "title": "Founder & CEO, NVIDIA",
      "portrait": "images/portraits/jensen-huang.jpg",
      "sourceUrl": "https://...",
      "sourceLabel": "Source"
    },
    {
      "text": "Nasdaq's governance solution is incredibly user friendly...",
      "attribution": "Chief Financial Officer",
      "title": "JF Maddox Foundation",
      "logo": "images/logos/jfmaddox.svg"
    }
  ]
}
```

### `videos`
A grid of inline-playable video tiles. Click a tile and an iframe replaces the thumbnail in place. Supports both JWP and YouTube URLs:

- **JWP**: `https://cdn.jwplayer.com/players/{MEDIA_ID}-qeq4Z2nO.html` — the no-autoplay player ID. The script automatically swaps this to the autoplay variant (`jO5YHc4l`) at click-time.
- **YouTube**: `https://www.youtube.com/watch?v={ID}` or `https://youtu.be/{ID}`. Rewritten to embed URL with autoplay.

Thumbnails are derived automatically — JWP from `cdn.jwplayer.com/v2/media/{ID}/poster.jpg`, YouTube from `i.ytimg.com/vi/{ID}/maxresdefault.jpg`. You can override with an explicit `thumbnail` field if needed.

```json
{
  "type": "videos",
  "title": "Builder spotlights",
  "layout": "row-3",                // optional: "row-3" | "row-4"
  "tiles": [
    {
      "title": "Cerebras Bell Sizzle",
      "subtitle": "AI accelerator company rings the Nasdaq opening bell",
      "videoUrl": "https://cdn.jwplayer.com/players/abc123XY-qeq4Z2nO.html"
    },
    {
      "title": "Arm on the AI revolution",
      "subtitle": "Live from MarketSite",
      "videoUrl": "https://www.youtube.com/watch?v=abc123",
      "thumbnail": "images/custom-thumbnail.jpg"
    }
  ]
}
```

### `mosaic`
A multi-cell mosaic for image-and-text composition. Used for the "Powering the Space Economy" module. Each cell is either an image (full-bleed) or a text card (icon + headline + body). Cells can `span` two columns or two rows for variety.

```json
{
  "type": "mosaic",
  "title": "Powering the <em>new Space Economy.</em>",
  "cells": [
    { "image": "images/space/moon.jpg", "imageAlt": "..." },
    { "icon": "orbit", "headline": "Driving the future beyond Earth's orbit.", "body": "..." },
    { "image": "images/space/bell.jpg", "imageAlt": "...", "span": "2" },
    { "icon": "globe", "headline": "Bold beginnings.", "body": "..." }
  ]
}
```

Valid `span` values: `"2"` (spans two columns), `"tall"` (spans two rows). Available `icon` names: `capital`, `liquidity`, `shield`, `infrastructure`, `orbit`, `globe`, `spark`, `rocket`, `chart`. To add more, extend the `ICONS` object in `index.html`.

### `pillars`
A 2- to 4-column grid of capability pillars. Each pillar has a label, body, and optional icon.

```json
{
  "type": "pillars",
  "layout": "row-4",                // optional: "row-2" | "row-3" | "row-4"
  "pillars": [
    { "icon": "capital",        "label": "Connecting Capital",  "body": "..." },
    { "icon": "liquidity",      "label": "Liquidity & Access",  "body": "..." },
    { "icon": "shield",         "label": "Governance & Trust",  "body": "..." },
    { "icon": "infrastructure", "label": "Market Infrastructure", "body": "..." }
  ]
}
```

### `product`
A product/feature showcase card with copy on one side and an image on the other. Light treatment regardless of section theme.

```json
{
  "type": "product",
  "layout": "image-right",          // optional: omit for image-left
  "tabs": ["Sustainability Solutions", "Governance Solutions", "..."],
  "headline": "Nasdaq Metrio<sup>™</sup>",
  "body": "Collect, measure, communicate and disclose audit-grade ESG data...",
  "ctaLabel": "Learn more",
  "ctaUrl": "https://...",
  "image": "images/nasdaq-metrio.png",
  "imageAlt": "Nasdaq Metrio product interface"
}
```

---

## Common edits

**Reorder sections.** Edit the top-level `sections` array.

```json
"sections": ["hero", "convergence", "builders", "intelligence"]
```

**Hide a section temporarily.** Remove its name from the `sections` array. The data stays in the file; the renderer just doesn't pick it up.

**Flip a section to light theme.**

```json
"intelligence": {
  "style": { "theme": "light" },
  ...
}
```

**Swap a stat card for a different metric.** Find the `stats` block and edit the card's fields.

**Add a new quote card.** Find the `quote-cards` block, copy an existing card object, edit the fields.

**Insert a new resource link.** Find the `resources` block, add a new `{ "kind": "...", "title": "...", "url": "..." }` to the `items` array.

**Replace a placeholder image.** Drop the new file into the `images/` directory and point the JSON field at the new path.

---

## Failure modes

| What happened | Likely cause |
| --- | --- |
| Page loads but is completely blank | `content.json` failed to fetch (404 or CORS) — check the URL and the network tab |
| Page loads with hero only, sections missing | `content.json` parsed but a section name is in the `sections` array without matching data, OR a block referenced an unknown type — check the console |
| One block is missing, the rest render | Malformed block — check the console for a `[content] block render error` |
| All copy renders as plain text with visible `<em>` tags | A rich text field used a tag outside the whitelist — see the rich text section above |
| Image broken / shows a colored box | Image path is wrong, or the file isn't in the `images/` directory |
| Video thumbnail missing | JWP/YouTube ID is wrong, or the video is private — paste the playback URL into a browser to verify |

If a single block errors, every other block on the page still renders. The script catches per-block errors and logs them rather than blowing up the whole page.

---

# Handoff notes for the developer

## Deployment

Push to the default branch of `nasdaqbrandstudio/edge`. GitHub Pages serves from the root. Live URL: `https://nasdaqbrandstudio.github.io/edge/`.

For staging, fork the repo or rename it. Update `CONTENT_URL` in `index.html` to point at the new content.json URL.

## Embedding in the Nasdaq CMS

The page is designed to be embedded via `<iframe>`. The script broadcasts its document height to the parent window via `postMessage`. The parent listens and resizes the iframe.

```js
// On the parent page
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NASDAQ_IFRAME_HEIGHT') {
    // e.data.page identifies which sibling page is sending —
    // useful when multiple Nasdaq Brand Studio iframes are on one parent page
    if (e.data.page === 'edge') {
      const iframe = document.querySelector('iframe[data-edge]');
      if (iframe) iframe.style.height = e.data.height + 'px';
    }
  }
});
```

The message shape is `{ type: 'NASDAQ_IFRAME_HEIGHT', page: 'edge', height: number }`. Note that this differs from the Winning Formula's `TWF_HEIGHT` — the generic name plus the `page` field is intended to let a single listener route messages from multiple sibling pages.

The broadcaster sends on: initial load, `load` event, `resize` event, and any DOM mutation (debounced to one send per animation frame).

## CSP recommendations

If the embedding parent serves a Content-Security-Policy, it needs to allow:

```
frame-src   https://cdn.jwplayer.com https://www.youtube.com https://youtube.com
connect-src https://nasdaqbrandstudio.github.io
img-src     'self' https://cdn.jwplayer.com https://i.ytimg.com https://nasdaqbrandstudio.github.io data:
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com
font-src    https://fonts.gstatic.com
script-src  'self' 'unsafe-inline'
```

The `'unsafe-inline'` requirements stem from the inline `<style>` and `<script>` blocks. If the parent's CSP forbids those, extract them to separate files and add a nonce — the rest of the page logic doesn't depend on inline execution.

## Cache behavior

`content.json` is fetched with `cache: 'no-store'` and a `?t=<minute-bucketed-timestamp>` query string. That means:

- Hard refreshes always get the latest.
- Soft refreshes within the same minute hit the browser's cache.
- The user never sees a content version more than 60 seconds stale (in practice usually much less).

If editors are pushing rapid changes and need finer granularity, change `Math.floor(Date.now() / 60000)` to `Math.floor(Date.now() / 10000)` (10-second granularity) at the top of `loadContent()`.

## Repointing CONTENT_URL

The constant is at the top of the `<script>` block:

```js
var CONTENT_URL = 'content.json';
```

It's a relative URL by default. In production, GitHub Pages serves both `index.html` and `content.json` from the same origin and path, so the relative URL resolves identically to the absolute equivalent. In local development, it resolves to the file sitting alongside `index.html`. Only change this if you want to host the JSON on a different domain entirely (a CMS endpoint, an S3 bucket, etc.) — in which case set it to the absolute URL and make sure that host's CORS headers allow the iframe origin to fetch.

## Local testing

`fetch()` on a `file://` origin is **blocked in Chrome** for security reasons — opening `index.html` directly will show a blank page. To test locally, run a quick web server from the repo directory:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Firefox is more permissive with `file://` fetches but the local server approach is more reliable. If the page is blank, the first thing to check is the browser console — the script logs `[content] loaded` on success and `[content] Could not load content.json` with the reason on failure.

## The script architecture in one breath

`loadContent()` fetches the JSON, then walks the top-level `sections` array. For each name, it calls `renderSection(name, data[name])`, which creates a `<section>` element, applies the style sidecar classes from `data.style`, renders the section head (eyebrow / title / lede), then maps the `blocks` array through `renderBlock()`. `renderBlock()` dispatches on `block.type` to one of ten renderer functions, each returning an HTML string. The section element is appended to `<main id="page">`. After everything is in the DOM, `window.__rewireDynamic()` reattaches the IntersectionObserver to the new `.reveal` elements and marks any above-the-fold ones as `.in` immediately so the first paint isn't blank.

Inline video playback is a separate concern: the body has a delegated `click` and `keydown` handler that listens for `[data-video-url]` triggers. On match, `playInline()` creates an iframe, rewrites the URL if needed (JWP autoplay swap, YouTube watch→embed), and inserts it into the tile's `.vtile-thumb` element.

The postMessage broadcaster runs in its own IIFE at the bottom of the script, decoupled from the renderer.

## Pending content TODOs

Before publication, these placeholder fields need real content:

- **Quote-card text** for Adena Friedman, Nelson Griggs, Tal Cohen, Lisa Su — only Jensen Huang's quote is real. Search content.json for `"TODO"` to find them.
- **Quote-card portrait images** — `images/portraits/*.jpg` paths are set; the actual files need to be added.
- **Video URLs** — only the Arm video has a real source in the brief (YouTube). The other five tiles in the `videos` block use placeholder JWP URLs (`PLACEHOLDER-qeq4Z2nO.html`) that need to be swapped for the real media IDs.
- **Chart images** — `images/nqintelt-vs-spxt.png` and `images/ai-powerhouses-on-nasdaq.png` need to be exported from the source data and dropped in. Editors can swap these PNGs without touching the JSON.
- **Space economy mosaic images** — `images/space/*.jpg` placeholders for the moon/rocket, bell-ringing, and MarketSite-tower cells.
- **Nasdaq Metrio image** — `images/nasdaq-metrio.png` placeholder for the product showcase block.
- **All resource URLs in Section I** — currently set to `#`. Real Nasdaq.com URLs needed for each of the seven entries.
- **Source URLs on quotes** — Sofia Saravia and Jensen Huang quotes both have `sourceUrl: "#"` placeholders.

## Future extensions

The block dispatcher (`BLOCK_RENDERERS` in `index.html`) is a flat object — adding a new block type means writing one renderer function and adding one entry. The CSS for the new type goes in the `BLOCK: <type>` section of the stylesheet. The block's content goes in `content.json` under any section's `blocks` array.

The icon library (`ICONS` in `index.html`) is similarly extensible — add a new name/SVG entry and editors can reference it from any `icon` field in JSON.

The rich text whitelist (`RT_SPAN_CLASSES` and the regex replacements in `richText()`) is the single point to extend if editors need new typographic options.
