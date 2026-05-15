# The Winning Formula — Content Editor's Guide

This folder powers **https://nasdaqbrandstudio.github.io/winning-formula/**.

To update what appears on the live site, you only ever need to edit one file: **`content.json`**.

Don't edit `index.html` or any CSS/JS files — those are the "shell." The shell reads `content.json` on every page load and renders everything from it. This means you can update episode info, the news ticker, host bios, and even nav/footer links without touching code.

---

## How to make an edit

1. **Open `content.json`** in the GitHub web UI: <https://github.com/nasdaqbrandstudio/nasdaqbrandstudio.github.io/blob/main/winning-formula/content.json>
2. **Click the pencil ✏️ icon** at the top right of the file viewer
3. **Make your changes** (see the field guide below)
4. **Scroll down**, write a short commit message (e.g. *"Add Bradley Lord episode"*), and click **Commit changes**
5. **Wait ~1–2 minutes**, then refresh the live site

GitHub Pages caches files for up to 10 minutes. If you want to see your change immediately for QA, append `?v=123` (any number) to the site URL — that forces a fresh fetch:
`https://nasdaqbrandstudio.github.io/winning-formula/?v=123`

---

## Things to know about JSON syntax

JSON is strict. A single misplaced character can break the whole file. Some rules:

- **Wrap text in double quotes**: `"Marques Colston"` ✅, `'Marques Colston'` ❌
- **No trailing commas**: every item in a list/object can have a comma between items, but never after the last one
- **Escape double quotes inside strings**: write `\"` if you need a quote *inside* a quoted value — e.g. `"He said \"Hi\""`
- **HTML inside strings is OK** for these specific fields (see field guide below): `headline`, `pullQuote`, `subhead`. Use `<em>X</em>` for italic emphasis (this is how you get the brand serif italic accents).

If you commit something broken, the live site will fall back to whatever was last working — the page will not crash. But your edit won't appear until you fix the syntax. You can use a free validator like <https://jsonlint.com/> to check syntax before committing.

---

## Field guide

The file is organized into sections matching the page. Here's what each one controls:

### `nav` — top navigation
The four blue links across the top of the page.
- `links[].label` — visible text
- `links[].href` — destination URL

### `ticker` — the headline crawler under the nav
- `label` — the text on the badge at the far left (currently `"NEWS & UPDATES"`)
- `scrollDurationSeconds` — how long one full loop takes; higher = slower
- `items[]` — each headline that scrolls. Order = display order. Repeat as many as you like.
  - `headline` — the text shown
  - `url` — where clicking takes you (can be anywhere — nasdaq.com, episode pages, external articles)
  - `time` — small text on the right, e.g. `"12m ago"`, `"Episode"`, `"Latest"`. Optional.

### `hero` — the top hero section
- `eyebrow` — small uppercase text above the wordmark
- `intro` — paragraph of body copy
- `wordmarkFallback` — only displayed if the animated wordmark fails to load
  - `title` — `"The Winning Formula"`
  - `subtitle` — `"Presented by Mercedes-AMG Petronas Formula One Team"`

### `featured` — the "Latest Episode" module
The big episode at the top of the page below the hero.
- `eyebrow` — small uppercase text above the headline
- `headline` — the big headline. HTML allowed (use `<em>X</em>` for italic accents)
- `guest` / `guestNameMarkup` — guest name; `guestNameMarkup` is what's shown on the thumbnail and supports `<br>` line breaks
- `subtitle` — small text under the name on the thumbnail
- `thumbnail` — image URL (use the Nasdaq CDN URL)
- `thumbnailAlt` — accessibility text describing the image
- `videoUrl` — **the URL that plays the video when clicked.** This is the most important field. Paste whatever embed URL works.
- `episodeUrl` — link to the full Nasdaq episode page
- `duration` — `"24:18"` style
- `pullQuote` — large italic quote. HTML allowed.
- `body` — paragraph of body copy
- `bylineLead` — `"With Joel Kolani"` style
- `bylineMeta` — `"Recorded at Nasdaq MarketSite, Times Square"` style

### `series` — the carousel of episodes
- `eyebrow`, `headline` — section title (HTML allowed in headline)
- `filters[]` — the filter pills above the carousel. Each has a `label` (shown) and `value` (internal, lowercase, used to match episodes)
- `episodes[]` — the episode cards. **Order = display order.** Add, remove, or reorder freely.

Each episode has:
- `guest`, `guestNameMarkup`, `subtitle` — same as featured
- `thumbnail`, `thumbnailAlt`, `videoUrl`, `episodeUrl`, `duration` — same as featured
- `tag` — the small colored chip below the thumb (e.g. `"NBA"`, `"F1"`, `"USWNT"`)
- `tagClass` — which color the chip should be. Valid values:
  - `nba` (red), `nfl` (gold), `nhl` (blue), `mlb` (navy), `wnba` (orange)
  - `epl` (purple), `ten` (green), `f1` (silver), `tf` (teal)
  - `soc` (blue), `biz` (gray), `gym` (pink)
- `filters[]` — array of `value` strings from the `filters` list above. An episode shows up under any filter whose value is in this array. `["athlete-founder", "womens-sports"]` means the episode appears under both filters.
- `episodeMeta` — small gray text next to the chip (e.g. `"Episode · 22m"`)
- `title` — the punchy quote/title under the chip
- `description` — the longer paragraph below

### `moments` — the "Moments from the series" photo carousel
- `eyebrow`, `headline` — section title
- `autoAdvanceMs` — how often slides auto-advance (in milliseconds). 4000 = 4 seconds.
- `slides[]` — each slide. Add, remove, reorder freely.
  - `guest`, `guestLabel` — text shown in the small label
  - `photo` — full-resolution photo URL (these are the styled photoshoot stills, NOT the video thumbnails)
  - `photoAlt` — accessibility text
  - `videoUrl` — clicking the slide opens the video modal with this URL
  - `headline` — large title overlaid on the photo. HTML allowed.
  - `subhead` — supporting text under the headline

### `hosts` — "The Hosts" section
- `eyebrow`, `headline` — section title
- `people[]` — array of host cards. Currently 2 (Joel Kolani, Poppy Shen) but you can add more.
  - `name`, `title`, `bio` — text
  - `photo`, `photoAlt` — the host's headshot

### `footer` — bottom-of-page links
- `columns` — an array of column arrays. Each column is a list of `{label, href}`. To add a fourth column, add another array.
- `social[]` — social icons row. `platform` must be one of: `facebook`, `x`, `linkedin`, `instagram`, `pinterest`
- `logoHref`, `logoAlt` — the Nasdaq logo on the right
- `copyrightSuffix` — the text after the year, e.g. `", Nasdaq, Inc. All Rights Reserved."`

---

## Common edits, step-by-step

### Adding a new episode to the series carousel
Find the `series.episodes` array. Copy an existing episode block (including the curly braces and all fields). Paste it as the **first** entry in the array if you want it to appear first, or wherever you want it ordered. Update every field. Add a comma between blocks.

### Replacing the featured episode
Edit fields inside the `featured` object. Don't duplicate it — there's only ever one.

### Adding a ticker headline
In `ticker.items`, copy one of the existing `{ "headline": "...", "url": "...", "time": "..." }` blocks and edit. Order matters — top of the array shows first.

### Adding a new filter chip
1. Add a new entry to `series.filters` with a `label` and a unique `value` (use kebab-case, e.g. `"behind-the-camera"`)
2. On any episode that should appear under that filter, add the same `value` to its `filters` array

### Replacing a host
Edit the relevant entry inside `hosts.people`. Photos should be square or near-square images; the page will crop them to a circle.

---

## What happens if `content.json` is broken or unreachable

The site is built to fail gracefully:

- **Broken JSON syntax** → the page renders with whatever content was already cached, OR with the baked-in fallback markup that's hardcoded into `index.html`. No crashes, no error messages to visitors.
- **Network failure** → same as above. The previously cached JSON is used; if there isn't one, the inline fallback content shows.

This means you can never permanently break the live site by editing this file. The worst case is your latest edit doesn't appear until you fix the syntax.

---

---

## Handoff notes for the developer

This section is for the engineer who will host this site on Nasdaq's infrastructure (Akamai or wherever `nasdaq.com/winning-formula/` ultimately lives). Everything in this section is purely operational — it does not affect how the editorial team uses `content.json`.

### How the page actually works

The deployed page is a **single static HTML file** (`index.html`) plus a few media assets (the hero video, favicons). It is fully self-contained — no build step, no bundler, no framework. All JS, CSS, and Lottie animation data are inlined.

On every page load, the HTML's main `<script>` block does the following:

1. Reads a constant near the top of the script: `CONTENT_URL`
2. Fetches that URL (the JSON file in this repo)
3. Renders seven UI modules (nav, ticker, hero, featured episode, series carousel, moments carousel, hosts, footer) from the fetched data
4. If the fetch fails for any reason, the page silently falls back to inline default markup baked into the HTML — the page never errors or shows a blank section

This means the editorial team can change copy, swap episodes, update images, etc. by editing `content.json` in this GitHub repo without redeploying `index.html` to Nasdaq's servers.

### Cross-origin fetch

When `index.html` is hosted on `nasdaq.com` (or any non-`github.io` domain), the fetch crosses origins:

- Page origin: `https://www.nasdaq.com`
- JSON origin: `https://nasdaqbrandstudio.github.io`

**GitHub Pages already sends permissive CORS headers** (`Access-Control-Allow-Origin: *`) on every served file, so the cross-origin fetch is allowed by the browser by default.

### Content Security Policy

If `nasdaq.com` enforces a Content-Security-Policy header — which is standard for enterprise sites — you'll need to allow the JSON's origin in the `connect-src` directive:

```
Content-Security-Policy: connect-src 'self' https://nasdaqbrandstudio.github.io;
```

Without this, the browser will block the fetch and the page will fall back to its inline defaults. Check the browser console; you'll see:

> Refused to connect to 'https://nasdaqbrandstudio.github.io/winning-formula/content.json' because it violates the following Content Security Policy directive: "connect-src ..."

If your CSP also enforces other directives, you may need to allow:

- `script-src` — `https://cdnjs.cloudflare.com` (for the Lottie animation library) and `https://cdn.jwplayer.com` (for the video player library)
- `frame-src` — `https://cdn.jwplayer.com` (for the embedded video iframe)
- `img-src` — `https://www.nasdaq.com https://cdn.jwplayer.com https://cdn.prod.website-files.com` (thumbnail/social-icon sources)
- `media-src` — `'self'` (the hero background video plays from the same origin as the page)
- `style-src` — `'self' 'unsafe-inline'` (all CSS is inlined in the `<style>` block — `'unsafe-inline'` is required)

The simplest valid CSP for this page:

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jwplayer.com;
  style-src   'self' 'unsafe-inline';
  img-src     'self' data: https://www.nasdaq.com https://cdn.jwplayer.com https://cdn.prod.website-files.com;
  media-src   'self';
  font-src    'self' data:;
  connect-src 'self' https://nasdaqbrandstudio.github.io;
  frame-src   https://cdn.jwplayer.com;
```

Tighten or relax this as your security team requires; the above is the minimum to let the page function as designed.

### Repointing the content URL

If the content JSON ever moves (different repo, different host, Akamai-backed proxy, dedicated CMS, etc.), update the `CONTENT_URL` constant near the top of the main `<script>` block in `index.html`:

```js
const CONTENT_URL = 'https://nasdaqbrandstudio.github.io/winning-formula/content.json';
```

The fetch logic doesn't care where the JSON lives — as long as the response has `Content-Type: application/json` and matches the schema documented in this README, the renderers will accept it.

### Cache behavior

The fetch includes a minute-granularity cache buster:

```js
fetch(CONTENT_URL + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })
```

This means each visitor's browser will get a fresh copy of the JSON at most once per minute. GitHub Pages itself caches files at the CDN level for ~5-10 minutes, so editorial edits propagate end-to-end in roughly 5-10 minutes worst case.

If you proxy the JSON through Akamai or a similar CDN, set your cache TTL to whatever balance of freshness vs. load makes sense for your traffic. The page handles any cache age gracefully.

### Failure modes

The site is built to never break visibly:

| Failure | Visitor experience |
|---|---|
| `content.json` unreachable (404, 500, CORS blocked, CSP blocked) | Falls back to inline default markup baked into `index.html`. Console warning is logged. |
| `content.json` has invalid JSON syntax | Same as above — fetch succeeds but parse throws, fallback engages. |
| Specific field missing from JSON | That field uses a sensible default or is omitted. Other fields render normally. |
| Lottie wordmark fails to load | Text fallback ("The Winning Formula" / "Presented by Mercedes-AMG Petronas Formula One Team") appears in Inter Medium. |
| Lottie library script blocked entirely | Same text fallback. |

Everything else is defensive coding: every renderer is wrapped in try/catch, and missing data is treated as a non-event.

### Inline assets and what they are

Inside `index.html`:

- A `<style>` block contains all CSS (~30KB)
- A `<script>` block contains a JavaScript variable `WORDMARK_JSON` (~92KB minified Lottie animation data for the hero wordmark)
- A second `<script>` block contains `MOTION_TOP_JSON` and `MOTION_BOTTOM_JSON` (~18KB combined) for the animated motion lines in the hero
- A third `<script>` block contains the main application logic (`loadContent`, all render functions, event delegation, etc.)
- A fourth `<script>` block contains the year-fill snippet, inlined inside the footer for redundancy
- One external CDN script tag (`lottie.min.js` from cdnjs)
- One external CDN script tag (`jwplayer/libraries/WXJkqpdN.js` for the video player)

If you ever need to deinline these for a build pipeline, the comments in the source mark each region clearly.

### Files in this folder

| File | Purpose | Editable? |
|---|---|---|
| `index.html` | The shell — HTML, CSS, JS, Lottie data all inlined | Only by a developer |
| `content.json` | All editorial content | By anyone with write access to this repo |
| `README.md` | This document | Optional |
| `winning-formula_1-transcode.mp4` | Hero background video, H.264 fallback | Replace as a whole file |
| `winning-formula_1-transcode.webm` | Hero background video, VP9 primary | Replace as a whole file |
| `winning-formula_1-poster-00001.jpg` | Poster frame for the hero video | Replace as a whole file |
| `favicon.ico` | Browser tab icon | Replace as a whole file |
| `webclip.png` | iOS home-screen icon | Replace as a whole file |

### Contact and questions

The editorial workflow is owned by Nasdaq Brand Studio. The site code was built in collaboration with that team. If anything in the rendering logic surprises you, the source comments inside `index.html` are a good starting point — each major section is preceded by a comment block describing its purpose and the IDs/data attributes its render function depends on.

