(function () {
  'use strict';

  // Bumped on every build. Check which file a page is actually running with:
  //   BLUEPRINT_BUILD          -> the version string
  //   BLUEPRINT_BUILD.features -> what that build supports
  var BUILD = {
    version: '2026-08-19.2101',
    features: ['languages', 'playlist-arrows', 'video-cta', 'lazy-players', 'anchors']
  };
  window.BLUEPRINT_BUILD = BUILD;

  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  var LANG = param('lang');
  var LANG_STORE = 'bp-lang';
  var LANG_AUTO = true;

  // A static page cannot see the visitor's country, but it can see the
  // languages their browser asks for. Match those against what we publish.
  function detectLanguage(list) {
    var codes = list.map(function (l) { return String(l.code).toLowerCase(); });
    var wanted = [];
    try {
      wanted = (navigator.languages && navigator.languages.length)
        ? navigator.languages.slice()
        : [navigator.language || ''];
    } catch (e) { return ''; }

    for (var i = 0; i < wanted.length; i++) {
      var tag = String(wanted[i] || '').toLowerCase();
      if (!tag) continue;
      var exact = codes.indexOf(tag);
      if (exact > -1) return list[exact].code;
      // es-MX and es-419 both fall back to es
      var base = tag.split('-')[0];
      for (var j = 0; j < codes.length; j++) {
        if (codes[j] === base || codes[j].split('-')[0] === base) return list[j].code;
      }
    }
    return '';
  }

  function storedLanguage() {
    try { return localStorage.getItem(LANG_STORE) || ''; } catch (e) { return ''; }
  }

  function rememberLanguage(code) {
    try { localStorage.setItem(LANG_STORE, code); } catch (e) {}
  }

  var CONTENT_URL = (function () {
    var q = param('content');
    var meta = document.querySelector('meta[name="blueprint-content"]');
    return q || window.BLUEPRINT_CONTENT_URL || (meta && meta.content) || 'content.json';
  })();

  var SECTION_OVERRIDE = (function () {
    var meta = document.querySelector('meta[name="blueprint-sections"]');
    var raw = (meta && meta.content) || window.BLUEPRINT_SECTIONS || '';
    return raw ? String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;
  })();

  // reassigned when ?lang= points at a different content file
  var CONTENT_BASE = (function () {
    try { return new URL(CONTENT_URL, document.baseURI).href; } catch (e) { return document.baseURI; }
  })();

  // Where images/ and videos/ live. Pinned to the DEFAULT content file and never
  // reassigned, so translations can sit in a subfolder (languages/content-ja.json)
  // without dragging asset lookups into that folder with them. Keep this separate
  // from CONTENT_BASE: pointing the page at a remote content.json should still
  // pull that deployment's assets, which is why neither uses document.baseURI.
  var ASSET_BASE = CONTENT_BASE;

  var CACHE_KEY = 'bp-content-cache-v1:' + CONTENT_BASE + (LANG ? ':' + LANG : '');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var RT_TAGS = /^(em|strong|b|i|br|sup|sub|u|small|mark)$/i;
  var RT_SPAN_CLASS = /^rt-(accent|muted|serif|light|nowrap|eyebrow)(\s+rt-(accent|muted|serif|light|nowrap|eyebrow))*$/;

  function richText(s) {
    if (s == null) return '';
    var doc = new DOMParser().parseFromString('<div>' + s + '</div>', 'text/html');
    (function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 3) return;
        if (n.nodeType !== 1) { n.remove(); return; }
        var tag = n.tagName.toLowerCase();
        var ok = RT_TAGS.test(tag)
          || (tag === 'a')
          || (tag === 'span' && RT_SPAN_CLASS.test(n.className));
        if (!ok) { n.replaceWith.apply(n, Array.prototype.slice.call(n.childNodes)); return; }
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          var keep = (tag === 'a' && a.name === 'href')
            || (tag === 'span' && a.name === 'class');
          if (!keep) n.removeAttribute(a.name);
        });
        if (tag === 'a') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer'); }
        walk(n);
      });
    })(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
  }

  function attr(o) {
    return Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== false && o[k] !== ''; })
      .map(function (k) { return k + '="' + esc(o[k]) + '"'; }).join(' ');
  }

  var CFG = {};
  var UI = {};

  // Every language, in one place. Read from languages.json beside the content
  // file so adding a language means editing that one file, not every
  // translation. config.languages still works as a fallback.
  var LANGUAGES = [];
  var LANG_DEFAULT = '';

  // anchor slug -> how to reveal it. Populated during render from the `anchor`
  // field on any feature or spotlight, so a new deep link is a JSON edit.
  var ANCHORS = {};

  // section id -> selector fn, so a deep link can drive any video list
  var VIDEO_SECTIONS = {};

  function absUrl(path, base) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path)) return path;
    if (path.indexOf('./') === 0) return chromeUrl(path.slice(2));
    try { return new URL(path, base || CONTENT_BASE).href; } catch (e) { return path; }
  }

  function chromeUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path)) return path;
    try { return new URL(path, document.baseURI).href; } catch (e) { return path; }
  }

  function imgUrl(name) {
    if (!name) return '';
    if (/^(https?:)?\/\//.test(name) || name.charAt(0) === '/') return name;
    if (name.indexOf('./') === 0) return chromeUrl(name.slice(2));
    var file = /\.(webp|png|jpe?g|svg|gif|avif|ico)$/i.test(name) ? name : name + '.webp';
    return absUrl((CFG.imagePath || 'images/') + file, ASSET_BASE);
  }

  function videoUrl(name) {
    if (!name) return '';
    if (/^(https?:)?\/\//.test(name) || name.charAt(0) === '/') return name;
    return absUrl((CFG.videoPath || 'videos/') + name, ASSET_BASE);
  }

  function bgStyle(spec) {
    if (!spec) return '';
    if (typeof spec === 'string') spec = { image: spec };
    var layers = [];
    if (spec.overlay) layers.push(spec.overlay);
    if (spec.image) layers.push('url("' + imgUrl(spec.image) + '")');
    if (!layers.length) return '';
    var out = '--bg:' + layers.join(', ') + ';';
    if (spec.hoverImage) {
      var h = [];
      if (spec.hoverOverlay || spec.overlay) h.push(spec.hoverOverlay || spec.overlay);
      h.push('url("' + imgUrl(spec.hoverImage) + '")');
      out += '--bg-hover:' + h.join(', ') + ';';
    }
    if (spec.size) out += '--bg-size:' + spec.size + ';';
    if (spec.position) out += '--bg-position:' + spec.position + ';';
    if (spec.repeat) out += '--bg-repeat:' + spec.repeat + ';';
    return out;
  }

  function bgAttrs(spec) {
    var s = bgStyle(spec);
    return s ? 'data-bg style="' + esc(s).replace(/&quot;/g, '&quot;') + '"' : '';
  }

  function jwPlayerUrl(v) {
    if (!v) return '';
    if (v.url) return v.url;
    if (v.iframe) return v.iframe;
    if (!v.jwMedia) return '';
    var player = v.playerId || (CFG.jw && CFG.jw.playerId) || '';
    return 'https://cdn.jwplayer.com/players/' + v.jwMedia + '-' + player + '.html';
  }

  // JW only serves posters at a fixed set of widths; anything else 404s.
  var JW_WIDTHS = [320, 480, 640, 720, 1280, 1920];

  function jwMediaId(v) {
    if (!v) return '';
    if (v.jwMedia) return v.jwMedia;
    // A player URL carries the media id: /players/{media}-{player}.html
    var src = v.url || v.iframe || '';
    var m = /\/players\/([A-Za-z0-9]+)-[A-Za-z0-9]+\.html/.exec(src)
         || /\/(?:videos|manifests)\/([A-Za-z0-9]+)[-.]/.exec(src);
    return m ? m[1] : '';
  }

  function jwPoster(v, width) {
    if (v && v.poster) return imgUrl(v.poster);
    var id = jwMediaId(v);
    if (!id) return '';
    var want = width || 720;
    var w = JW_WIDTHS.filter(function (x) { return x >= want; })[0] || JW_WIDTHS[JW_WIDTHS.length - 1];
    return 'https://cdn.jwplayer.com/v2/media/' + id + '/poster.jpg?width=' + w;
  }

  // Players are mounted on demand, never up front. The export put a live iframe
  // in every slot -- hero desktop, hero mobile, each article, each mobile stack
  // item -- so a player configured to autoplay would start several at once and
  // you would hear all of them. Here each slot renders a poster and mounts its
  // iframe only when asked, and mounting one unmounts whatever was playing.
  var mounted = null;

  function videoEmbed(v, extraClass) {
    var src = jwPlayerUrl(v);
    if (!src) return '';
    var poster = jwPoster(v, 1280);
    return '<div class="bp-video ' + (extraClass || '') + '" data-video="' + esc(src) + '"'
      + ' role="button" tabindex="0" aria-label="' + esc(UI.play || 'Play') + (v.title ? ': ' + esc(v.title) : '') + '">'
      + (poster ? '<img class="bp-video-poster" src="' + esc(poster) + '" alt="" loading="lazy"'
          + ' onerror="this.style.display=\'none\'">' : '')
      + '<span class="bp-video-play" aria-hidden="true">'
      + '<img src="' + esc(chromeUrl('images/play-button.svg')) + '" alt="">'
      + '</span></div>';
  }

  function unmountVideo() {
    if (!mounted) return;
    var frame = mounted.querySelector('iframe');
    if (frame) frame.remove();
    mounted.classList.remove('is-playing');
    mounted = null;
  }

  function mountVideo(box, autoplay) {
    if (!box || box.classList.contains('is-playing')) return;
    unmountVideo();
    var src = box.getAttribute('data-video');
    if (!src) return;
    if (autoplay !== false) src += (src.indexOf('?') > -1 ? '&' : '?') + 'autoplay=true';
    var frame = document.createElement('iframe');
    frame.src = src;
    frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('frameborder', '0');
    box.appendChild(frame);
    box.classList.add('is-playing');
    mounted = box;
  }

  function initVideos() {
    document.addEventListener('click', function (e) {
      var box = e.target.closest && e.target.closest('.bp-video');
      if (box) mountVideo(box);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var box = e.target.closest && e.target.closest('.bp-video');
      if (box) { e.preventDefault(); mountVideo(box); }
    });
  }

  function parseTags(tags) {
    var out = { routes: [], labels: [], headline: null };
    (tags || '').split(',').forEach(function (raw) {
      var t = raw.trim();
      if (!t) return;
      var c = t.charAt(0);
      if (c === (CFG.jw && CFG.jw.routeTag || '@')) out.routes.push(t.slice(1).toLowerCase());
      else if (c === (CFG.jw && CFG.jw.labelTag || '#')) out.labels.push(t.slice(1));
      else if (c === (CFG.jw && CFG.jw.headlineTag || '*')) out.headline = t.slice(1);
    });
    return out;
  }

  function fetchPlaylist() {
    var jw = CFG.jw || {};
    if (!jw.useLiveFeed || !jw.playlistId) return Promise.resolve(null);
    var url = 'https://cdn.jwplayer.com/v2/playlists/' + jw.playlistId;
    var mins = jw.cacheMinutes == null ? 15 : jw.cacheMinutes;
    var ck = 'bp-jw-' + jw.playlistId;
    try {
      var hit = JSON.parse(sessionStorage.getItem(ck) || 'null');
      if (hit && (Date.now() - hit.t) < mins * 60000) return Promise.resolve(hit.d);
    } catch (e) {  }

    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('JW ' + r.status); return r.json(); })
      .then(function (j) {
        var items = (j.playlist || []).map(function (m) {
          var t = parseTags(m.tags);
          return {
            jwMedia: m.mediaid,
            title: t.headline || m.title || '',
            description: m.description || '',
            duration: m.duration || 0,
            poster: (m.image || ''),
            routes: t.routes,
            labels: t.labels
          };
        });
        try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: items })); } catch (e) {}
        return items;
      })
      .catch(function (e) { console.warn('[blueprint] JW playlist unavailable, using content.json', e); return null; });
  }

  function routed(feed, route) {
    if (!feed) return null;
    var hits = feed.filter(function (v) { return v.routes.indexOf(route.toLowerCase()) !== -1; });
    return hits.length ? hits : null;
  }

  // Shown only when the language list has more than one entry, so a
  // single-language site has no toggle at all.
  function languageLabel(l) {
    return l.name || l.label || l.code.toUpperCase();
  }

  function renderLanguages() {
    var list = LANGUAGES.filter(function (l) { return l && l.code; });
    if (list.length < 2) return '';

    // Sorted for the reader, not by however the file happens to list them.
    // Accents sort naturally: Español after English, Deutsch before both.
    list = list.slice().sort(function (a, b) {
      return languageLabel(a).localeCompare(languageLabel(b), undefined, { sensitivity: 'base' });
    });
    var current = LANG || LANG_DEFAULT || list[0].code;
    var active = list.filter(function (l) { return l.code === current; })[0] || list[0];

    // A badge that opens a menu: the footprint stays one chip however many
    // languages are published.
    return '<div class="bp-lang">'
      + '<button type="button" class="bp-lang-toggle" aria-haspopup="true" aria-expanded="false"'
      + ' aria-label="' + esc(UI.language || 'Language') + '">'
      + '<span class="bp-lang-word">' + esc(UI.language || 'Language') + '</span>'
      + '<span class="bp-lang-code">' + esc(active.label || active.code.toUpperCase()) + '</span>'
      + '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1L5 5L9 1" fill="none"'
      + ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '</button>'
      + '<div class="bp-lang-menu" role="menu">'
      + list.map(function (l) {
          return '<a class="bp-lang-item' + (l.code === current ? ' is-active' : '') + '" role="menuitem"'
            + ' hreflang="' + esc(l.code) + '" href="?lang=' + encodeURIComponent(l.code) + '">'
            + esc(languageLabel(l)) + '</a>';
        }).join('')
      + '</div></div>';
  }

  function renderNav(nav) {
    if (!nav) return '';
    var items = nav.items || [];
    var mobileLinks = items.map(function (i, n) {
      return '<a href="' + esc(i.href) + '" class="mnav-item w-nav-link">' + esc(i.label) + '</a>';
    }).join('');
    var deskLinks = items.map(function (i) {
      return '<a href="' + esc(i.href) + '" class="nav-item nav-link">' + esc(i.label) + '</a>';
    }).join('');
    var dd = nav.dropdown && nav.dropdown.label
      ? '<div class="who-we-serve nav-link"><div>' + esc(nav.dropdown.label) + '</div>'
        + '<div class="menu-arrow-svg w-embed"><svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        + '<path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></div></div>'
      : '';
    var logo = nav.logo || {};
    var brand = nav.brand || {};

    return ''
      + '<nav id="home" class="nasdaq-navbar"><div class="navigation---primary-navigation">'
      + '<a href="' + esc(logo.href || '#') + '" class="w-inline-block"><img ' + attr({
          width: logo.width || 85, height: logo.height || 24, alt: logo.alt || '',
          src: imgUrl(logo.src), loading: 'eager', class: 'vectors-wrapper-4'
        }) + '></a></div></nav>'

      + '<div data-animation="default" data-collapse="medium" data-duration="400" data-easing="ease" data-easing2="ease" role="banner" class="mobile-nav w-nav">'
      + '<div class="nav-container w-container">'
      + '<a href="' + esc(brand.href || '#home') + '" class="mobile-title-nav w-nav-brand"><div class="mobile-nav-title">'
      + '<div class="subnav-home-span">' + esc(brand.line1) + '</div>'
      + '<div class="subnav-home">' + esc(brand.line2) + '</div></div></a>'
      + '<nav role="navigation" class="mobile-nav-menu w-nav-menu">' + mobileLinks + renderLanguages() + '</nav>'
      + '<div id="mobile-nav-button" class="mobile-nav-button w-nav-button">'
      + '<div class="hamburger-icon"><span></span><span></span><span></span></div></div>'
      + '</div></div>'

      + '<nav id="subnav" class="nasdaq-subnav">'
      + '<a href="' + esc(brand.href || '#home') + '" class="nav-title w-inline-block">'
      + '<div class="subnav-home-span">' + esc(brand.line1) + '</div>'
      + '<div class="subnav-home">' + esc(brand.line2) + '</div></a>'
      + '<div class="line"></div>'
      + '<div class="sections-container"><div class="sections">' + deskLinks + dd + '</div>'
      + renderLanguages() + '</div>'
      + '</nav>';
  }

  function renderHero(d, feed) {
    if (!d) return '';
    var v = d.video || {};
    var fromFeed = routed(feed, (v.route || '@hero').replace(/^@/, ''));
    if (fromFeed) v = Object.assign({}, v, fromFeed[0]);

    var bgv = d.backgroundVideo || {};
    var sources = '';
    if (bgv.mp4) sources += '<source src="' + esc(videoUrl(bgv.mp4)) + '" type="video/mp4">';
    if (bgv.webm) sources += '<source src="' + esc(videoUrl(bgv.webm)) + '" type="video/webm">';

    var scroll = function (cls) {
      return '<div class="' + cls + '"><div class="scroll">'
        + '<div class="scroll-text">' + esc(d.scrollLabel || '') + '</div>'
        + (d.scrollLottie
            ? '<div class="lottie-open" data-animation-type="lottie" data-src="' + esc(absUrl(d.scrollLottie))
              + '" data-loop="1" data-direction="1" data-autoplay="1" data-is-ix2-target="0" data-renderer="svg"'
              + ' data-default-duration="0" data-duration="2" data-loading="eager"></div>'
            : '<div class="bp-scroll-arrow" aria-hidden="true">'
              + '<svg viewBox="0 0 24 14" xmlns="http://www.w3.org/2000/svg">'
              + '<path d="M1 1L12 12L23 1" fill="none" stroke="currentColor" stroke-width="2"'
              + ' stroke-linecap="round" stroke-linejoin="round"/></svg></div>')
        + '</div></div>';
    };

    return ''
      + '<header id="' + esc(d.id || 'header') + '" class="header">'
      + '<div class="head-content-container"><div class="head-content">'
      + '<div class="header-container">'
      + '<h2 class="category">' + richText(d.eyebrow) + '</h2>'
      + '<h1 class="heading">' + richText(d.headline) + '</h1>'
      + '<div class="intro-copy"><h2 class="head-paragraph">' + richText(d.intro) + '</h2></div>'
      + '</div>'
      + scroll('scroll-container')
      + '<div class="hero-container-mobile">'
      + '<div id="hero-video-mobile" class="hero-embed-body">' + videoEmbed(v) + '</div>'
      + scroll('scroll-container-mobile')
      + '</div>'
      + '</div></div>'
      + '<div id="w-node-cd133d87-1cd7-47fd-b4ad-ddf4af54e365-51b7b3c5" class="hero-video">'
      + '<div class="overlay"></div>'
      + '<div class="background-image" ' + bgAttrs({ image: bgv.poster }) + '></div>'
      + (sources
        ? '<div class="background-video w-background-video w-background-video-atom">'
          + '<video autoplay loop muted playsinline preload="metadata" data-wf-ignore="true" data-object-fit="cover"'
          + (bgv.poster ? ' poster="' + esc(imgUrl(bgv.poster)) + '"' : '') + '>' + sources + '</video></div>'
        : '')
      + '</div>'
      + '</header>'
      + '<div class="hero-container"><div id="hero-video" class="hero-embed-body">' + videoEmbed(v) + '</div></div>';
  }
  function vsButtons(v) {
    var list = v.ctas || (v.cta ? [v.cta] : []);
    if (!list.length) return '';
    // Same two-part shape as the Solutions body link: label block plus arrow block.
    return '<div class="bp-vs-actions">'
      + list.map(function (b) {
          if (!b || !b.url) return '';
          return '<a class="bp-vs-cta" href="' + esc(b.url) + '" target="_blank" rel="noopener">'
            + '<span class="bp-vs-cta-label">' + richText(b.label || '') + '</span>'
            + '<span class="bp-vs-cta-arrow">'
            + '<img src="' + esc(chromeUrl('images/arrow-dark.svg')) + '" alt="" aria-hidden="true">'
            + '</span></a>';
        }).join('')
      + '</div>';
  }

  function vsQuote(q) {
    if (!q || !q.text) return '';
    return '<blockquote class="bp-vs-quote">'
      + '<img class="quote" src="' + esc(chromeUrl('images/quote_white.svg')) + '" loading="lazy" alt="">'
      + '<p class="paragraph-light">' + richText(q.text) + '</p>'
      + (q.name
          ? '<footer class="bp-vs-attrib">'
            + (q.headshot ? '<div class="bp-headshot" ' + bgAttrs({ image: q.headshot }) + '></div>' : '')
            + '<div class="name-container"><div class="name">' + esc(q.name) + '</div>'
            + (q.role ? '<div class="title">' + esc(q.role) + '</div>' : '') + '</div></footer>'
          : '')
      + '</blockquote>';
  }

  // One module for every video list on the page. Player on the left, playlist
  // on the right, everything about the playing video underneath it.
  function renderVideoSection(d, feed, data) {
    if (!d) return '';
    var items = (d.features || d.videos || []).slice();
    var fromFeed = routed(feed, d.route || (d.features ? 'feature' : 'spotlight'));
    if (fromFeed) {
      items = items.map(function (v, i) {
        var m = fromFeed.filter(function (x) { return x.jwMedia === jwMediaId(v.video || v); })[0] || fromFeed[i];
        return m ? Object.assign({}, v, { video: Object.assign({}, v.video || v, m) }) : v;
      });
    }
    if (!items.length) return '';

    var sid = d.id || 'videos';
    // How many videos the stacked view shows before asking to expand.
    var initialCount = d.mobileInitialCount == null ? 4 : d.mobileInitialCount;

    items.forEach(function (v, i) {
      if (v.anchor) ANCHORS[v.anchor] = { type: 'video', section: sid, index: i };
    });

    var stage = items.map(function (v, i) {
      var body = (v.body || (v.description ? [v.description] : [])).map(function (t) {
        return '<p class="bp-vs-para">' + richText(t) + '</p>';
      }).join('');
      return '<article class="bp-vs-item' + (i >= initialCount ? ' is-extra' : '')
        + (i === 0 ? ' is-active" ' : '" ')
        + (v.anchor ? 'id="' + esc(v.anchor) + '" ' : '')
        + 'data-vs-item="' + i + '">'
        + '<div class="bp-vs-player">' + videoEmbed(v.video || v) + '</div>'
        + '<div class="bp-vs-lower">'
        + '<div class="bp-vs-meta">'
        + '<h4 class="bp-vs-title">' + richText(v.title) + '</h4>'
        + (body ? '<div class="bp-vs-body">' + body + '</div>' : '')
        + vsButtons(v)
        + '</div>'
        + vsQuote(v.quote)
        + '</div>'
        + '</article>';
    }).join('');

    var rows = items.map(function (v, i) {
      var badge = v.badge || (i === 0 ? d.newBadge : '');
      var img = v.thumbnail || v.cardImage;
      var src = img ? imgUrl(img) : jwPoster(v.video || v, 480);
      return '<button type="button" class="bp-vs-row' + (i === 0 ? ' is-active' : '') + '"'
        + ' data-vs="' + i + '"' + (v.anchor ? ' data-anchor="' + esc(v.anchor) + '"' : '') + '>'
        + '<span class="bp-vs-row-media">'
        + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '')
        + '<span class="bp-vs-row-index">' + (i + 1) + '</span>'
        + (badge ? '<span class="bp-vs-badge">' + esc(badge) + '</span>' : '')
        + '</span>'
        + '<span class="bp-vs-row-meta">'
        + '<span class="bp-vs-row-title">' + richText(v.title) + '</span>'
        + '<span class="bp-vs-row-now">' + esc(d.nowPlayingLabel || 'Now playing') + '</span>'
        + '</span></button>';
    }).join('');

    // Sections whose videos carry quotes park them beside the player, where the
    // playlist would otherwise leave a column of dead space.
    var hasQuotes = items.some(function (v) { return v.quote && v.quote.text; });

    return ''
      + '<section id="' + esc(sid) + '" class="bp-vs' + (hasQuotes ? ' has-quotes' : '')
      + '" data-initial="' + initialCount + '"'
      + (d.mobileTheme ? ' data-mobile-theme="' + esc(d.mobileTheme) + '"' : '')
      + ' data-less="' + esc(d.seeLessLabel || 'See Less') + '">'
      + '<div class="bp-vs-inner">'
      + (d.headline ? '<h3 class="cs-headline">' + richText(d.headline) + '</h3>' : '')
      + (d.intro ? '<p class="bp-vs-intro">' + richText(d.intro) + '</p>' : '')
      + '<div class="bp-vs-layout">'
      + '<div class="bp-vs-stage">' + stage + '</div>'
      + '<div class="bp-vs-list">'
      + '<button type="button" class="bp-vs-list-arrow up" aria-label="' + esc(UI.prev || 'Previous') + '">'
      + '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M1 13L12 2L23 13" fill="none" stroke="currentColor"'
      + ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '<div class="bp-vs-list-scroll">' + rows + '</div>'
      + '<button type="button" class="bp-vs-list-arrow down" aria-label="' + esc(UI.next || 'Next') + '">'
      + '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M1 1L12 12L23 1" fill="none" stroke="currentColor"'
      + ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
      + '</div>'
      + '</div>'
      + (items.length > initialCount
          ? '<button type="button" class="bp-vs-more">'
            + '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M1 1L12 12L23 1" fill="none"'
            + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            + '<span>' + esc(d.seeMoreLabel || 'See More') + '</span>'
            + '</button>'
          : '')
      + '</div>'
      + (d.backgroundImage
          ? '<div class="background-image-2" '
            + bgAttrs({
                image: d.backgroundImage,
                overlay: d.backgroundOverlay || '',
                size: 'cover',
                position: '50%',
                repeat: 'no-repeat'
              }) + '></div>'
          : '')
      + '</section>';
  }

  function initVideoSections() {
    Array.prototype.slice.call(document.querySelectorAll('.bp-vs')).forEach(function (root) {
      var rows = Array.prototype.slice.call(root.querySelectorAll('.bp-vs-row'));
      var items = Array.prototype.slice.call(root.querySelectorAll('.bp-vs-item'));
      var scroller = root.querySelector('.bp-vs-list-scroll');
      if (!rows.length) return;

      // The playlist is capped against the left column so it never sets the
      // section's height itself. With a quote beside it that means the player;
      // without one it may run the full height of the player plus its copy.
      // Both are measured from the left column only, so the two cannot chase
      // each other.
      var measure = function () {
        var active = items.filter(function (a) { return a.classList.contains('is-active'); })[0] || items[0];
        if (!active) return;
        var player = active.querySelector('.bp-vs-player');
        var meta = active.querySelector('.bp-vs-lower');
        if (!player) return;
        var ph = Math.round(player.getBoundingClientRect().height);
        if (ph > 0) root.style.setProperty('--player-h', ph + 'px');
        if (meta) {
          var ch = Math.round(meta.getBoundingClientRect().bottom - player.getBoundingClientRect().top);
          if (ch > 0) root.style.setProperty('--col-h', ch + 'px');
        }
      };
      measure();
      window.addEventListener('resize', measure);
      if (window.ResizeObserver && items[0] && items[0].querySelector('.bp-vs-player')) {
        new ResizeObserver(measure).observe(items[0].querySelector('.bp-vs-player'));
      }

      function select(i, play) {
        if (i < 0 || i >= rows.length) return;
        unmountVideo();
        rows.forEach(function (r, n) { r.classList.toggle('is-active', n === i); });
        items.forEach(function (a, n) { a.classList.toggle('is-active', n === i); });
        if (typeof measure === 'function') measure();
        if (scroller) {
          var r = rows[i];
          var top = r.offsetTop - scroller.clientHeight / 2 + r.offsetHeight / 2;
          scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          setTimeout(function () { var e = new Event('scroll'); scroller.dispatchEvent(e); }, 400);
        }
        if (play) {
          var box = items[i].querySelector('.bp-video');
          if (box) mountVideo(box);
        }
      }

      // The list never shows a scrollbar. When the rows do not fit, arrows
      // appear above and below and step the list one row at a time.
      var listBox = root.querySelector('.bp-vs-list');
      var upBtn = root.querySelector('.bp-vs-list-arrow.up');
      var downBtn = root.querySelector('.bp-vs-list-arrow.down');

      function step() { return rows[0] ? rows[0].getBoundingClientRect().height : 80; }

      function syncArrows() {
        if (!scroller || !listBox) return;
        var over = scroller.scrollHeight - scroller.clientHeight;
        listBox.classList.toggle('is-scrollable', over > 2);
        if (upBtn) upBtn.disabled = scroller.scrollTop <= 1;
        if (downBtn) downBtn.disabled = scroller.scrollTop >= over - 1;
      }

      if (upBtn) upBtn.addEventListener('click', function () {
        scroller.scrollBy({ top: -step(), behavior: 'smooth' });
      });
      if (downBtn) downBtn.addEventListener('click', function () {
        scroller.scrollBy({ top: step(), behavior: 'smooth' });
      });
      if (scroller) {
        scroller.addEventListener('scroll', syncArrows, { passive: true });
        window.addEventListener('resize', syncArrows);
        if (window.ResizeObserver) new ResizeObserver(syncArrows).observe(scroller);
        setTimeout(syncArrows, 0);
      }

      rows.forEach(function (r, i) {
        r.addEventListener('click', function () {
          select(i, true);
          var slug = r.getAttribute('data-anchor');
          if (slug && location.hash !== '#' + slug) history.replaceState(null, '', '#' + slug);
          if (window.matchMedia('(max-width: 991px)').matches && items[i]) {
            items[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // See more: the stacked view shows the first few and expands on request.
      var moreBtn = root.querySelector('.bp-vs-more');
      var labels = {
        more: (moreBtn && moreBtn.querySelector('span').textContent) || 'See More',
        less: root.getAttribute('data-less') || ''
      };

      function expand(on) {
        root.classList.toggle('is-expanded', on);
        if (moreBtn) {
          moreBtn.querySelector('span').textContent = on ? (labels.less || labels.more) : labels.more;
          moreBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
        }
      }
      if (moreBtn) {
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.addEventListener('click', function () {
          expand(!root.classList.contains('is-expanded'));
        });
      }

      VIDEO_SECTIONS[root.id] = function (i) {
        select(i);
        // Stacked view has every video on the page, so jump to the one asked for
        // rather than the top of the section. A deep link past the cut has to
        // open the expanded view first or its target is display:none.
        var stacked = window.matchMedia('(max-width: 991px)').matches;
        if (stacked && items[i] && items[i].classList.contains('is-extra')) expand(true);
        var target = stacked ? items[i] : root;
        if (target) {
          requestAnimationFrame(function () {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      };
    });
  }


  var CARD_CONTAINER = { 1: 'income-gen-container', 2: 'mega-trends-container' };

  // The export used a 2-up grid only where the count filled it evenly (4 cards).
  // Anything odd or under four stacks, so no row is left half empty.
  function cardColumns(b) {
    if (b.cardColumns) return b.cardColumns;
    var n = (b.cards || []).length;
    return (n >= 4 && n % 2 === 0) ? 2 : 1;
  }

  function solLinks(links) {
    return '<div class="ancillary-link-container">'
      + (links || []).map(function (l) {
          return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" class="ancillary-link">'
            + '<div class="link-text">' + (l.eyebrow ? '<span class="rt-eyebrow">' + richText(l.eyebrow) + '</span> ' : '') + richText(l.text) + '</div>'
            + '<div class="right-click-spacer"><img src="' + esc(chromeUrl('images/arrow-transparent.svg')) + '" loading="lazy" alt="" class="arrow-spacer"></div>'
            + '<div class="right-click-desktop"><img src="' + esc(chromeUrl('images/arrow-dark.svg')) + '" loading="lazy" alt="" class="arrow-right"></div>'
            + '</a>';
        }).join('')
      + '</div>';
  }

  function solBody(b, mobile) {
    var cards = '';
    if (b.cards && b.cards.length) {
      var cls = CARD_CONTAINER[cardColumns(b)] || 'income-gen-container';
      cards = '<div class="' + cls + '">' + b.cards.map(function (c) {
        var bg = bgAttrs({ image: c.image, overlay: c.overlay || 'linear-gradient(#08062ab3, #08062ab3)', size: 'auto, cover', position: '0 0, 50%' });
        var arrow = function (hover) {
          return '<div class="' + (hover ? 'arrow-overlay-hover' : 'arrow-overlay') + '">'
            + '<div class="hover-text-block">' + esc(c.cta || 'Learn More') + '</div>'
            + '<img src="' + esc(chromeUrl('images/arrow-dark.svg')) + '" loading="lazy" alt="" class="down-arrow"></div>';
        };
        return '<div class="sol-card">'
          + '<div class="sol-card-rest" ' + bg + '><div class="block-spacer"><div class="info-card">' + richText(c.title) + '</div></div>' + arrow(false) + '</div>'
          + '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="sol-card-active" ' + bg + '>'
          + '<div class="block-spacer"><div class="info-card">' + richText(c.title) + '</div>'
          + '<div class="info-card-details">' + richText(c.body) + '</div></div>' + arrow(true) + '</a>'
          + '</div>';
      }).join('') + '</div>';
    }

    var embed = '';
    if (b.embed) {
      var h = (mobile ? b.embed.heightMobile : b.embed.height) || 460;
      var wrapOpen = mobile && b.embed.bleedMobile
        ? '<div style="margin-left:-2rem;margin-right:-2rem;width:calc(100% + 4rem);">' : '<div style="width:100%;">';
      embed = '<div class="b1-code-embed w-embed w-iframe">' + wrapOpen
        + '<iframe src="' + esc(b.embed.url) + '" style="width:100%;height:' + parseInt(h, 10) + 'px;border:0;" title="' + esc(b.embed.title || '') + '" loading="lazy"></iframe>'
        + '</div></div>';
    }

    var bodyLink = b.bodyLink
      ? '<a href="' + esc(b.bodyLink.url) + '" target="_blank" rel="noopener" class="solutions-body-link">'
        + '<div class="body-link">' + richText(b.bodyLink.text) + '</div>'
        + '<div class="click-body"><img src="' + esc(chromeUrl('images/arrow-dark.svg')) + '" loading="lazy" alt="" class="arrow-right"></div></a>'
      : '';

    return '<div class="solutions-body">'
      + '<div class="text-intro">' + richText(b.intro) + '</div>'
      + cards + embed + bodyLink
      + '</div>' + solLinks(b.links);
  }

  function renderSolutions(d) {
    if (!d) return '';
    var b = (d.buildings || []).slice(0, 5);
    if (!b.length) return '';

    var tiles = function () {
      return b.map(function (x, i) {
        var n = i + 1;
        var bg = bgAttrs({ image: x.image, overlay: 'linear-gradient(#08062a40, #08062ad9)', size: 'auto, cover', position: '0 0, 50%' });
        return '<div class="b' + n + '-container sol-building" data-sol="' + i + '" role="button" tabindex="0">'
          + '<div class="b' + n + '-active"><div class="building-' + n + '-active" ' + bg + '>'
          + '<div class="solutions-category">' + richText(x.label) + '</div></div></div>'
          + '<div class="b' + n + '-rest"><div class="building-' + n + '-rest" ' + bg + '>'
          + '<div class="solutions-category">' + richText(x.label) + '</div></div></div>'
          + '</div>';
      }).join('');
    };

    var desktopPanels = b.map(function (x, i) {
      return '<div class="solutions-b' + (i + 1) + ' sol-panel' + (i === 0 ? ' is-active' : '') + '" data-sol-panel="' + i + '" id="solution-' + esc(x.id || i) + '">'
        + solBody(x, false) + '</div>';
    }).join('');

    var mobileGroups = b.map(function (x, i) {
      var n = i + 1;
      var bg = bgAttrs({ image: x.image, overlay: 'linear-gradient(#08062a40, #08062ad9)', size: 'auto, cover', position: '0 0, 50%' });
      return '<div class="b' + n + '-container sol-building-mobile">'
        + '<div class="b' + n + '-active"><div class="building-' + n + '-active" ' + bg + '>'
        + '<div class="solutions-category">' + richText(x.label) + '</div></div></div>'
        + '<div class="solutions-b' + n + '-mobile">' + solBody(x, true) + '</div>'
        + '</div>';
    }).join('');

    return ''
      + '<section id="' + esc(d.id || 'solutions') + '" class="solutions" ' + bgAttrs(d.background) + '>'
      + '<div class="solutions-headline"><h3 class="solutions-headline">' + richText(d.headline) + '</h3>'
      + '<p class="paragraph">' + richText(d.intro) + '</p></div>'
      + (d.swipeLabel ? '<div class="solutions-scroll"><div class="text-block-12">' + esc(d.swipeLabel) + '</div>'
          + '<img src="' + esc(chromeUrl('images/arrow-blue.svg')) + '" loading="lazy" alt="" class="image-2"></div>' : '')
      + '<div class="solutions-module">'
      + '<div class="solutions-mobile"><div class="solutions-grid-mobile">' + mobileGroups + '</div></div>'
      + '<div class="solutions-container"><div class="solutions-grid">' + tiles() + '</div>' + desktopPanels + '</div>'
      + '</div></section>';
  }

  function renderCityscape(d) {
    if (!d) return '';
    return '<div class="cityscape" ' + bgAttrs({ image: d.image }) + '></div>';
  }

  function renderFooter(d) {
    if (!d) return '';
    var cols = (d.columns || []).map(function (col) {
      return '<div class="link-column">' + col.map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" class="footer-link' + (l.muted ? ' privacy-legal' : '') + '">' + esc(l.label) + '</a>';
      }).join('') + '</div>';
    }).join('');
    var social = function (mobile) {
      return (d.social || []).map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" class="' + esc(s.id) + ' w-inline-block" aria-label="' + esc(s.label) + '">'
          + '<img loading="lazy" src="' + esc(imgUrl(s.icon)) + '" alt="" class="' + esc(s.id) + '"></a>';
      }).join('');
    };
    var logo = d.logo || {};
    var year = new Date().getFullYear();
    var copy = esc(String(d.copyright || '').replace('{year}', year));

    // Desktop stacks logo, copyright and social in the right column. Below
    // 992px the export switches to its own arrangement, so that markup is kept
    // as-is and the two are swapped by media query.
    return ''
      + '<footer id="' + esc(d.id || 'footer') + '" class="footer-wrapper"><section class="footer-container">'
      + '<div class="column-container"><div class="columns">' + cols + '</div>'
      + '<div class="nasdaq-logo-container-full">'
      + '<a href="' + esc(logo.url || '#') + '" target="_blank" rel="noopener" class="nasdaq-logo-footer w-inline-block">'
      + '<img loading="lazy" src="' + esc(imgUrl(logo.src)) + '" alt="' + esc(logo.alt || '') + '" class="nasdaq-logo"></a>'
      + '<div class="copyright-inline-2">' + copy + '</div>'
      + '<div class="social-icons">' + social(false) + '</div>'
      + '</div></div>'
      + '<div class="logo-copyright-container">'
      + '<div class="nasdaq-logo-container">'
      + '<a href="' + esc(logo.url || '#') + '" target="_blank" rel="noopener" class="nasdaq-logo-footer w-inline-block">'
      + '<img loading="lazy" src="' + esc(imgUrl(logo.src)) + '" alt="' + esc(logo.alt || '') + '" class="nasdaq-logo"></a></div>'
      + '<div class="copyright-inline-2">' + copy + '</div>'
      + '<div class="social-icons">' + social(false) + '</div>'
      + '</div>'
      + '</section></footer>';
  }
  function initSolutions() {
    var wrap = document.querySelector('.solutions-container');
    if (!wrap) return;
    var tiles = Array.prototype.slice.call(wrap.querySelectorAll('.sol-building'));
    var panels = Array.prototype.slice.call(wrap.querySelectorAll('.sol-panel'));

    function select(i) {
      tiles.forEach(function (t, n) {
        var on = n === i;
        var act = t.querySelector('[class$="-active"]');
        var rest = t.querySelector('[class$="-rest"]');
        if (act) act.style.display = on ? 'flex' : 'none';
        if (rest) rest.style.display = on ? 'none' : 'flex';
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function (p, n) { p.classList.toggle('is-active', n === i); });
    }
    tiles.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
      });
    });
    select(0);
  }


  function applyFonts() {
    if (!CFG.fontsHref) return;
    if (document.querySelector('link[data-bp-fonts]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = CFG.fontsHref;
    l.setAttribute('data-bp-fonts', '');
    document.head.appendChild(l);
  }

  function applyMeta(m) {
    if (!m) return;
    if (m.title) document.title = m.title;
    var set = function (sel, val) {
      var el = document.querySelector(sel);
      if (el && val) el.setAttribute('content', val);
    };
    set('meta[name="description"]', m.description);
    set('meta[property="og:title"]', m.ogTitle || m.title);
    set('meta[property="og:description"]', m.description);
    set('meta[name="twitter:title"]', m.ogTitle || m.title);
    set('meta[name="twitter:description"]', m.description);
    if (m.ogImage) set('meta[property="og:image"]', imgUrl(m.ogImage));
    if (m.lang) {
      document.documentElement.lang = m.lang;
      document.body.classList.add('lang-' + m.lang.toLowerCase().split('-')[0]);
    }
  }

  var SECTIONS = {
    hero: renderHero,
    thoughtLeadership: renderVideoSection,
    clientSpotlights: renderVideoSection,
    solutions: renderSolutions,
    cityscape: renderCityscape
  };

  var INNER = { thoughtLeadership: 1, clientSpotlights: 1, solutions: 1, cityscape: 1 };

  function render(data, feed) {
    CFG = data.config || {};
    UI = data.ui || {};
    applyFonts();
    applyMeta(data.meta);

    var order = SECTION_OVERRIDE || data.sectionOrder || Object.keys(SECTIONS);
    var top = '', inner = '';
    order.forEach(function (key) {
      var fn = SECTIONS[key];
      if (!fn || !data[key]) return;
      var html = fn(data[key], feed, data);
      if (INNER[key]) inner += html; else top += html;
    });

    document.querySelector('.site-container').innerHTML =
      renderNav(data.nav)
      + '<main id="main" class="main-content home-wrap">'
      + top
      + '<div class="inner-container w-container">' + inner + '</div>'
      + renderFooter(data.footer)
      + '</main>';

    Array.prototype.slice.call(document.querySelectorAll('.sections .nav-item, .mobile-nav-menu .mnav-item'))
      .forEach(function (a) {
        var slug = (a.getAttribute('href') || '').replace(/^#/, '');
        if (slug && slug !== 'home' && !document.getElementById(slug) && !ANCHORS[slug]) a.remove();
      });

    document.body.classList.add('bp-ready');
    if (window.console && console.info) {
      console.info('[blueprint] build ' + BUILD.version + ' | ' + LANGUAGES.length
        + ' language(s) | showing ' + (document.documentElement.lang || 'default'));
    }
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('failed: ' + src)); };
      document.body.appendChild(s);
    });
  }

  // Replaces the w-nav script, which was the only thing webflow.js still did on
  // this page: the rebuild emits no data-w-id, so IX2, sliders, lightbox, tabs,
  // forms and CMS bindings are all dead. That was 830KB of webflow.js behind
  // 89KB of jQuery to toggle one class.
  //
  // Webflow's own implementation reparents the menu into a generated
  // .w-nav-overlay. Not reproduced -- the menu is styled as a plain panel in
  // overrides.css instead, which is fewer moving parts. The .w--open class on
  // the button is kept because the hamburger-to-X animation is keyed off it.
  function initMobileNav() {
    var nav = document.querySelector('.mobile-nav');
    if (!nav) return;
    var btn = nav.querySelector('.mobile-nav-button');
    var menu = nav.querySelector('.mobile-nav-menu');
    if (!btn || !menu) return;

    // The export renders the button as a div, so it needs the button semantics
    // Webflow used to attach at runtime.
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-label', (UI && UI.menu) || 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', menu.id || (menu.id = 'mobile-nav-menu'));

    function setOpen(on) {
      btn.classList.toggle('w--open', on);
      menu.classList.toggle('is-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    function toggle(e) {
      e.preventDefault();
      setOpen(!menu.classList.contains('is-open'));
    }

    btn.addEventListener('click', toggle);
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') toggle(e);
    });

    // Any nav link closes it. The language toggle is a <button>, so opening the
    // language list inside the menu deliberately does not close the menu.
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) setOpen(false);
    });
    // Resizing past the breakpoint leaves the panel orphaned otherwise.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 991) setOpen(false);
    });
  }

  function afterRender(data) {
    initVideos();
    initVideoSections();
    initSolutions();
    trackNavHeight();
    initAnchors();
    initLanguageMemory();
    initMobileNav();

    // animate.js only needs gsap, ScrollTrigger and Swiper, all loaded in
    // index.html. It never touched jQuery, so it no longer waits on anything.
    loadScript('js/animate.js?v=' + BUILD.version)
      .catch(function (e) { console.warn('[blueprint]', e); });
  }

  function goToAnchor(hash) {
    var slug = String(hash || '').replace(/^#/, '');
    if (!slug) return false;
    var target = ANCHORS[slug];
    if (!target) {
      // not a registered video anchor -- let it behave as a normal page anchor
      var el = document.getElementById(slug);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
      return false;
    }
    // Jumping to anything other than a feature closes an open article panel,
    // otherwise the panel covers whatever the reader just navigated to.
    if (target.type === 'video') {
      var go = VIDEO_SECTIONS[target.section];
      if (go) go(target.index);
    }
    return true;
  }

  function initLanguageMemory() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.bp-lang-item');
      if (a) {
        var code = (a.getAttribute('href') || '').split('lang=')[1];
        if (code) rememberLanguage(decodeURIComponent(code));
        return;
      }
      var btn = e.target.closest && e.target.closest('.bp-lang-toggle');
      var open = btn ? btn.parentNode : null;
      Array.prototype.slice.call(document.querySelectorAll('.bp-lang')).forEach(function (box) {
        var on = box === open && box.getAttribute('data-open') !== 'true';
        box.setAttribute('data-open', on ? 'true' : 'false');
        var t = box.querySelector('.bp-lang-toggle');
        if (t) t.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      Array.prototype.slice.call(document.querySelectorAll('.bp-lang')).forEach(function (box) {
        box.setAttribute('data-open', 'false');
        var t = box.querySelector('.bp-lang-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Measured rather than assumed, so the offset follows the bar if its height
  // ever changes.
  function trackNavHeight() {
    var update = function () {
      var bars = Array.prototype.slice.call(document.querySelectorAll('.nasdaq-subnav, .mobile-nav'));
      var visible = bars.filter(function (b) { return b.offsetParent !== null; })[0];
      var h = visible ? Math.round(visible.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty('--bp-nav-h', (h || 80) + 'px');
    };
    update();
    window.addEventListener('resize', update);
    if (window.ResizeObserver) {
      var bar = document.querySelector('.nasdaq-subnav') || document.querySelector('.mobile-nav');
      if (bar) new ResizeObserver(update).observe(bar);
    }
  }

  function initAnchors() {
    if (location.hash) setTimeout(function () { goToAnchor(location.hash); }, 400);
    window.addEventListener('hashchange', function () { goToAnchor(location.hash); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var slug = a.getAttribute('href').slice(1);
      if (!slug || !ANCHORS[slug]) return;
      e.preventDefault();
      if (location.hash !== '#' + slug) history.pushState(null, '', '#' + slug);
      goToAnchor(slug);
    });
  }

  function fail(msg) {
    var host = document.querySelector('.site-container');
    if (host) {
      host.innerHTML = '<div class="bp-error"><p>' + esc(UI.loadError || 'This page could not load its content.') + '</p>'
        + '<p style="opacity:.7;font-size:.875rem">' + esc(msg) + '</p></div>';
    }
    Array.prototype.slice.call(document.querySelectorAll('.sections .nav-item, .mobile-nav-menu .mnav-item'))
      .forEach(function (a) {
        var slug = (a.getAttribute('href') || '').replace(/^#/, '');
        if (slug && slug !== 'home' && !document.getElementById(slug) && !ANCHORS[slug]) a.remove();
      });

    document.body.classList.add('bp-ready');
    if (window.console && console.info) {
      console.info('[blueprint] build ' + BUILD.version + ' | ' + LANGUAGES.length
        + ' language(s) | showing ' + (document.documentElement.lang || 'default'));
    }
  }

  // A language is just another content file. index.html stays the same page;
  // ?lang=xx picks which JSON it loads.
  function resolveLanguage() {
    if (!LANG || LANGUAGES.length < 2) return null;
    var hit = LANGUAGES.filter(function (l) { return l.code === LANG; })[0];
    if (!hit || !hit.content) return null;
    var url = absUrl(hit.content);
    return url === CONTENT_BASE ? null : url;
  }

  // Missing or malformed is not an error -- it just means one language.
  function fetchLanguages() {
    var url;
    try { url = new URL('languages.json', ASSET_BASE).href; } catch (e) { return Promise.resolve(null); }
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        var list = Array.isArray(j) ? j : j.languages;
        if (!Array.isArray(list)) return null;
        LANG_DEFAULT = (j && j.default) || '';
        if (j && j.autoDetect === false) LANG_AUTO = false;
        return list;
      })
      .catch(function () { return null; });
  }

  function boot() {
    Promise.all([
      fetch(CONTENT_URL, { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(CONTENT_URL + ' returned ' + r.status); return r.json(); }),
      fetchLanguages()
    ])
      .then(function (both) {
        var data = both[0];
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
        CFG = data.config || {};
        UI = data.ui || {};
        LANGUAGES = both[1] || CFG.languages || [];
        LANG_DEFAULT = LANG_DEFAULT || CFG.defaultLanguage || '';

        // ?lang= wins, then whatever the visitor last chose, then the browser.
        // An explicit choice is never overridden by detection.
        if (LANG) {
          rememberLanguage(LANG);
        } else if (LANGUAGES.length > 1) {
          LANG = storedLanguage() || (LANG_AUTO ? detectLanguage(LANGUAGES) : '');
        }

        var alt = resolveLanguage();
        if (alt) {
          CONTENT_BASE = alt;
          return fetch(alt, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(alt + ' returned ' + r.status); return r.json(); })
            .then(function (translated) {
              CFG = translated.config || CFG;
              UI = translated.ui || UI;
              if (both[1]) LANGUAGES = both[1];
              return fetchPlaylist().then(function (feed) {
                render(translated, feed);
                afterRender(translated);
              });
            });
        }
        return fetchPlaylist().then(function (feed) {
          render(data, feed);
          afterRender(data);
        });
      })
      .catch(function (e) {
        console.error('[blueprint]', e);
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (x) {}
        if (cached) { render(cached, null); afterRender(cached); }
        else fail(e.message);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
