(function () {
  'use strict';

  var CONTENT_URL = (function () {
    var q = null;
    try { q = new URLSearchParams(location.search).get('content'); } catch (e) {}
    var meta = document.querySelector('meta[name="blueprint-content"]');
    return q || window.BLUEPRINT_CONTENT_URL || (meta && meta.content) || 'content.json';
  })();

  var CONTENT_BASE = (function () {
    try { return new URL(CONTENT_URL, document.baseURI).href; } catch (e) { return document.baseURI; }
  })();

  var CACHE_KEY = 'bp-content-cache-v1:' + CONTENT_BASE;

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

  // anchor slug -> how to reveal it. Populated during render from the `anchor`
  // field on any feature or spotlight, so a new deep link is a JSON edit.
  var ANCHORS = {};

  function absUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//.test(path)) return path;
    if (path.indexOf('./') === 0) return chromeUrl(path.slice(2));
    try { return new URL(path, CONTENT_BASE).href; } catch (e) { return path; }
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
    return absUrl((CFG.imagePath || 'images/') + file);
  }

  function videoUrl(name) {
    if (!name) return '';
    if (/^(https?:)?\/\//.test(name) || name.charAt(0) === '/') return name;
    return absUrl((CFG.videoPath || 'videos/') + name);
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

  function jwPoster(v, width) {
    if (v && v.poster) return imgUrl(v.poster);
    if (!v || !v.jwMedia) return '';
    return 'https://cdn.jwplayer.com/v2/media/' + v.jwMedia + '/poster.jpg?width=' + (width || 720);
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
      + (poster ? '<img class="bp-video-poster" src="' + esc(poster) + '" alt="" loading="lazy">' : '')
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

      + '<div data-animation="default" data-collapse="tiny" data-duration="400" data-easing="ease" data-easing2="ease" role="banner" class="mobile-nav w-nav">'
      + '<div class="nav-container w-container">'
      + '<a href="' + esc(brand.href || '#home') + '" class="mobile-title-nav w-nav-brand"><div class="mobile-nav-title">'
      + '<div class="subnav-home-span">' + esc(brand.line1) + '</div>'
      + '<div class="subnav-home">' + esc(brand.line2) + '</div></div></a>'
      + '<nav role="navigation" class="mobile-nav-menu w-nav-menu">' + mobileLinks + '</nav>'
      + '<div id="mobile-nav-button" class="mobile-nav-button w-nav-button"><div class="hamburger-icon w-icon-nav-menu"></div></div>'
      + '</div></div>'

      + '<nav id="subnav" class="nasdaq-subnav">'
      + '<a href="' + esc(brand.href || '#home') + '" class="nav-title w-inline-block">'
      + '<div class="subnav-home-span">' + esc(brand.line1) + '</div>'
      + '<div class="subnav-home">' + esc(brand.line2) + '</div></a>'
      + '<div class="line"></div>'
      + '<div class="sections-container"><div class="sections">' + deskLinks + dd + '</div></div>'
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
            : '')
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

  function tlQuote(q, bg, mobile) {
    if (!q) return '';
    var head = '<div class="headshot-container' + (mobile ? '-mobile' : '') + '">'
      + '<div class="bp-headshot" ' + bgAttrs({ image: q.headshot }) + '></div>'
      + '<div class="name-container"><div class="name">' + esc(q.name) + '</div>'
      + '<div class="title">' + esc(q.role) + '</div></div></div>';
    var body = '<div class="quote-outer-container' + (mobile ? '-mobile' : '') + '"><div class="quote-center-container">'
      + '<div class="quote-container"><img src="' + esc(chromeUrl('images/quote_white.svg')) + '" loading="lazy" alt="" class="quote">'
      + '<p class="paragraph-light">' + richText(q.text) + '</p></div></div></div>';
    return '<div class="quote-wrap' + (mobile ? '-mobile' : '') + '" ' + bgAttrs({ image: bg, overlay: 'linear-gradient(#08062ae6, #08062ae6)', size: 'auto, cover', position: '0 0, 50%' }) + '>'
      + '<div class="call-out-container' + (mobile ? '-mobile' : '') + '">'
      + (mobile ? body + head : head + body)
      + '</div></div>';
  }

  function renderThoughtLeadership(d, feed) {
    if (!d) return '';
    var features = (d.features || []).slice();
    var fromFeed = routed(feed, 'feature');
    if (fromFeed) {
      features = features.map(function (f, i) {
        var m = fromFeed.filter(function (v) { return v.jwMedia === (f.video && f.video.jwMedia); })[0] || fromFeed[i];
        return m ? Object.assign({}, f, { video: Object.assign({}, f.video, m), title: f.title || m.title }) : f;
      });
    }
    if (!features.length) return '';

    features.forEach(function (f, i) {
      if (f.anchor) ANCHORS[f.anchor] = { type: 'feature', index: i };
    });

    var mobile = features.map(function (f, i) {
      return '<div class="' + (i === 0 ? 'tl-article-1-mobile' : 'tl-article-2-mobile') + '"'
        + (f.anchor ? ' id="' + esc(f.anchor) + '-mobile"' : '')
        + (i === 0 ? ' data-first-mobile' : '') + '>'
        + '<h3 class="tl-headline">' + richText(f.title) + '</h3>'
        + '<div class="thought-leadership-video">' + videoEmbed(f.video) + '</div>'
        + '<div class="tl-video-text">'
        + (f.body || []).map(function (p) { return '<p class="tl-intro">' + richText(p) + '</p>'; }).join('')
        + '</div>'
        + tlQuote(f.quote, d.quoteBackground, true)
        + '</div>';
    }).join('');

    var cards = features.map(function (f, i) {
      var media = f.cardVideo
        ? '<div class="card-video w-embed"><video autoplay muted loop playsinline preload="none" style="width:100%;height:100%;object-fit:cover;display:block;">'
          + '<source src="' + esc(f.cardVideo) + '" type="video/mp4"></video></div>'
        : '';
      return '<div class="tl-card" data-tl-index="' + i + '"'
        + (f.anchor ? ' data-anchor="' + esc(f.anchor) + '"' : '')
        + ' role="button" tabindex="0" aria-label="' + esc(f.title) + '">'
        + '<div class="image-overlay"></div>'
        + '<div class="card-inner"><div class="card-details-wrapper">'
        + (f.cardNote ? '<div class="title-wrapper"><div class="highlights">' + richText(f.cardNote) + '</div></div>' : '')
        + '<h2 class="main-heading"><strong>' + richText(f.title) + '</strong></h2>'
        + '</div></div>'
        + '<div class="image-wrapper">' + media
        + '<div class="tl-card-image" ' + bgAttrs({ image: f.cardImage, size: 'cover', position: '50%' }) + '></div>'
        + '</div></div>';
    }).join('');

    var articles = features.map(function (f, i) {
      return '<div class="tl-article" data-tl-article="' + i + '"'
        + (f.anchor ? ' id="' + esc(f.anchor) + '"' : '') + '>'
        + '<a href="#" class="button-close" aria-label="' + esc(UI.close || 'Close') + '">✕</a>'
        + '<div class="container-article"><div class="inner-container-2">'
        + '<div class="header-row"><h1 class="heading-2"><strong class="headline-1">' + richText(f.title) + '</strong></h1></div>'
        + '<div class="video-container">' + videoEmbed(f.video) + '</div>'
        + (f.body || []).map(function (p, n) {
            return '<p class="' + (n === 0 ? 'first-line' : 'paragraph-3') + '">' + richText(p) + '</p>';
          }).join('')
        + '<div class="divider-div"></div>'
        + tlQuote(f.quote, d.quoteBackground, false)
        + '</div></div></div>';
    }).join('');

    return ''
      + '<header id="' + esc(d.id || 'thought-leadership') + '" class="tl-container">'
      + '<div class="tl-articles-mobile">' + mobile + '</div>'
      + '<div class="tl-module-container">'
      + '<div class="headline-container-2">'
      + '<div class="headline-2">' + richText(d.headline) + '</div>'
      + (d.cue ? '<div class="text-block-15">' + esc(d.cue) + '</div>' : '')
      + '</div>'
      + '<div class="portraits-container"><div class="section-2" style="--tl-count:' + features.length
      + ';--tl-expanded:' + esc(d.expandedWidth || '65%') + '">'
      + '<div class="section-content tl-panel">' + articles + '</div>'
      + cards
      + '</div></div>'
      + '<div class="background-image-2" ' + bgAttrs({ image: d.backgroundImage }) + '></div>'
      + '</div></header>';
  }

  function renderClientSpotlights(d, feed) {
    if (!d) return '';
    var videos = (d.videos || []).slice();
    var fromFeed = routed(feed, 'spotlight');
    if (fromFeed) videos = fromFeed;
    if (!videos.length) return '';

    videos.forEach(function (v, i) {
      if (v.anchor) ANCHORS[v.anchor] = { type: 'spotlight', index: i };
    });
    d.__videos = videos;

    return ''
      + '<section id="' + esc(d.id || 'client-spotlights') + '" class="client-spotlights-archive">'
      + '<h3 class="cs-headline">' + richText(d.headline) + '</h3>'
      + '<div class="video-group-playlist"><div id="video-player-section">'
      + '<div class="desktop-tablet-view">'
      + '<div class="main-video-wrapper" id="main-video-container"><iframe id="main-video-iframe" src="" allowfullscreen allow="autoplay; fullscreen"></iframe></div>'
      + '<div style="margin-top:2rem;"><h3 id="video-title"></h3><p id="video-description"></p></div>'
      + '<div class="playlist-carousel">'
      + '<button class="carousel-nav prev" id="prev-btn" aria-label="' + esc(UI.prev || 'Previous') + '"><svg viewBox="0 0 35.8 61.4"><path d="M30.4,5.7L5.4,30.7l25,25"></path></svg></button>'
      + '<div class="carousel-wrapper"><div class="playlist-container" id="playlist-container"></div></div>'
      + '<button class="carousel-nav next" id="next-btn" aria-label="' + esc(UI.next || 'Next') + '"><svg viewBox="0 0 35.8 61.4"><path d="M5.4,55.7l25-25L5.4,5.7"></path></svg></button>'
      + '<div class="carousel-indicators" id="carousel-indicators"></div>'
      + '</div></div>'
      + '<div class="mobile-video-stack" id="mobile-video-stack"></div>'
      + '<div class="see-more-container" id="see-more-container">'
      + '<div class="see-more-arrow"><svg viewBox="0 0 60.7 33"><path d="M5.7,5.3l25,25L55.7,5.3"></path></svg></div>'
      + '<div class="see-more-text">' + esc(d.seeMoreLabel || 'SEE MORE') + '</div>'
      + '</div>'
      + '</div></div></section>';
  }

  var CARD_CONTAINER = { 1: 'income-gen-container', 2: 'mega-trends-container' };

  // The export used a 2-up grid only where the count filled it evenly (4 cards).
  // Everything else stacked. An odd count or fewer than four falls back to a stack
  // so no row is left half empty.
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
    return ''
      + '<footer id="' + esc(d.id || 'footer') + '" class="footer-wrapper"><section class="footer-container">'
      + '<div class="column-container"><div class="columns">' + cols + '</div>'
      + '<div class="social-icons-container"><div class="social-icons-mobile">' + social(true) + '</div></div>'
      + '<div class="nasdaq-logo-container-full"><a href="' + esc(logo.url || '#') + '" target="_blank" rel="noopener" class="nasdaq-logo-footer w-inline-block">'
      + '<img loading="lazy" src="' + esc(imgUrl(logo.src)) + '" alt="' + esc(logo.alt || '') + '" class="nasdaq-logo"></a></div></div>'
      + '<div class="logo-copyright-container">'
      + '<div class="nasdaq-logo-container"><img loading="lazy" src="' + esc(imgUrl(logo.src)) + '" alt="" class="nasdaq-logo"></div>'
      + '<div class="social-copyright-container"><div class="social-icons">' + social(false) + '</div>'
      + '<div class="copyright-inline-2">' + esc(String(d.copyright || '').replace('{year}', year)) + '</div>'
      + '</div></div></section></footer>';
  }

  function initThoughtLeadership() {
    var stage = document.querySelector('.section-2');
    if (!stage) return;
    var cards = Array.prototype.slice.call(stage.querySelectorAll('.tl-card'));
    var panel = stage.querySelector('.tl-panel');
    var articles = Array.prototype.slice.call(stage.querySelectorAll('.tl-article'));
    if (!cards.length) return;

    if (cards.length === 1) stage.classList.add('no-hover');

    var moduleEl = stage.closest('.tl-module-container');
    function hover(i) {
      cards.forEach(function (c, n) { c.classList.toggle('is-hovered', n === i); });
      if (moduleEl) moduleEl.classList.toggle('is-active', i >= 0);
    }
    function open(i) {
      stage.classList.add('is-open');
      articles.forEach(function (a, n) { a.classList.toggle('is-active', n === i); });
      panel.classList.add('is-open');
      panel.scrollTop = 0;
      document.body.classList.add('bp-panel-open');
    }
    function close() {
      stage.classList.remove('is-open');
      panel.classList.remove('is-open');
      document.body.classList.remove('bp-panel-open');
    }

    cards.forEach(function (c, i) {
      c.addEventListener('mouseenter', function () { hover(i); });
      c.addEventListener('focus', function () { hover(i); });
      c.addEventListener('click', function () { open(i); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });
    stage.addEventListener('mouseleave', function () { hover(-1); });
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest('.button-close');
      if (btn) { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    window.__bpCloseFeature = close;

    window.__bpOpenFeature = function (i) {
      if (i < 0 || i >= cards.length) return;
      if (window.innerWidth < 992) {
        var block = document.querySelectorAll('.tl-articles-mobile > div')[i];
        if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      var host = document.querySelector('.tl-module-container');
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      stage.classList.remove('is-rest');
      hover(i);
      open(i);
    };

    stage.classList.add('is-rest');
    cards[0].classList.add('is-titled');
    stage.addEventListener('mouseenter', function () { stage.classList.remove('is-rest'); }, { once: true });
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

  function initClientSpotlights(data) {
    var d = data.clientSpotlights;
    if (!d) return;
    var videos = d.__videos || d.videos || [];
    if (!videos.length || !document.getElementById('playlist-container')) return;

    var current = 0, offset = 0, perSlide = 3, mobile = false, expanded = false;
    var INITIAL = d.mobileInitialCount || 4;

    var els = {
      list: document.getElementById('playlist-container'),
      prev: document.getElementById('prev-btn'),
      next: document.getElementById('next-btn'),
      dots: document.getElementById('carousel-indicators'),
      frame: document.getElementById('main-video-iframe'),
      title: document.getElementById('video-title'),
      desc: document.getElementById('video-description'),
      stack: document.getElementById('mobile-video-stack'),
      more: document.getElementById('see-more-container')
    };

    var isMobile = function () { return window.innerWidth < 768; };
    var maxOffset = function () { return Math.max(0, videos.length - perSlide); };

    function drawCarousel() {
      els.list.innerHTML = '';
      for (var i = offset; i < Math.min(offset + perSlide, videos.length); i++) {
        (function (i) {
          var v = videos[i];
          var item = document.createElement('div');
          item.className = 'playlist-item' + (i === current ? ' active' : '');
          item.innerHTML = '<div class="playlist-item-thumbnail-wrapper"><div class="playlist-item-thumbnail">'
            + '<img src="' + esc(jwPoster(v, 720)) + '" alt="' + esc(v.title) + '" loading="lazy">'
            + '<div class="now-playing-overlay">' + esc(d.nowPlayingLabel || 'NOW PLAYING') + '</div>'
            + '</div></div><div class="playlist-item-title-container"><div class="playlist-item-title">' + esc(v.title) + '</div></div>';
          item.onclick = function () { load(i); };
          els.list.appendChild(item);
        })(i);
      }
      els.prev.disabled = offset <= 0;
      els.next.disabled = offset >= maxOffset();
      Array.prototype.forEach.call(els.dots.children, function (dot, n) {
        dot.classList.toggle('active', n === offset);
      });
    }

    function drawDots() {
      els.dots.innerHTML = '';
      for (var i = 0; i <= maxOffset(); i++) {
        (function (i) {
          var dot = document.createElement('div');
          dot.className = 'indicator' + (i === offset ? ' active' : '');
          dot.onclick = function () { offset = i; drawCarousel(); };
          els.dots.appendChild(dot);
        })(i);
      }
    }

    function load(i) {
      current = i;
      var v = videos[i];
      var src = jwPlayerUrl(v);
      els.frame.src = src + (src.indexOf('?') > -1 ? '&' : '?') + 'autoplay=true';
      els.title.textContent = v.title || '';
      els.desc.textContent = v.description || '';
      if (i < offset) offset = i;
      else if (i >= offset + perSlide) offset = Math.min(i - perSlide + 1, maxOffset());
      drawCarousel();
    }

    function drawStack() {
      els.stack.innerHTML = '';
      videos.forEach(function (v, i) {
        var box = document.createElement('div');
        box.className = 'cs-video ' + (i < INITIAL ? 'visible' : 'hidden');
        box.innerHTML = videoEmbed(v, 'client-video-embed')
          + '<div class="client-video-details"><h3 class="cs-video-title">' + esc(v.title) + '</h3>'
          + '<p class="text-intro">' + esc(v.description || '') + '</p></div>';
        els.stack.appendChild(box);
      });
      els.more.style.display = videos.length > INITIAL ? 'flex' : 'none';
    }

    function toggleMore() {
      expanded = !expanded;
      Array.prototype.forEach.call(els.stack.children, function (box, i) {
        if (i < INITIAL) return;
        box.classList.toggle('hidden', !expanded);
        box.classList.toggle('visible', expanded);
      });
      els.more.querySelector('.see-more-text').textContent = expanded
        ? (d.seeLessLabel || 'SEE LESS') : (d.seeMoreLabel || 'SEE MORE');
      els.more.classList.toggle('expanded', expanded);
    }

    window.__bpSelectSpotlight = function (i) {
      if (i < 0 || i >= videos.length) return;
      if (isMobile()) {
        if (!expanded && i >= INITIAL) toggleMore();
        var box = els.stack.children[i];
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        load(i);
        var rail = document.querySelector('.client-spotlights-archive');
        if (rail) rail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    els.prev.onclick = function () { if (offset > 0) { offset--; drawCarousel(); } };
    els.next.onclick = function () { if (offset < maxOffset()) { offset++; drawCarousel(); } };
    els.more.onclick = toggleMore;

    if (d.autoAdvance !== false) {
      window.addEventListener('message', function (e) {
        if (e.origin !== 'https://cdn.jwplayer.com') return;
        try {
          var msg = JSON.parse(e.data);
          if (msg.event === 'complete' && current + 1 < videos.length) load(current + 1);
        } catch (err) {  }
      });
    }

    function sync() {
      var now = isMobile();
      if (now !== mobile) {
        mobile = now;
        if (mobile) { drawStack(); expanded = false; }
        else { els.more.style.display = 'none'; drawDots(); load(current); }
      }
    }
    mobile = isMobile();
    perSlide = d.itemsPerSlide || 3;
    if (mobile) drawStack(); else { drawDots(); load(0); }
    window.addEventListener('resize', sync);
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
    thoughtLeadership: renderThoughtLeadership,
    clientSpotlights: renderClientSpotlights,
    solutions: renderSolutions,
    cityscape: renderCityscape
  };

  var INNER = { thoughtLeadership: 1, clientSpotlights: 1, solutions: 1, cityscape: 1 };

  function render(data, feed) {
    CFG = data.config || {};
    UI = data.ui || {};
    applyFonts();
    applyMeta(data.meta);

    var order = data.sectionOrder || Object.keys(SECTIONS);
    var top = '', inner = '';
    order.forEach(function (key) {
      var fn = SECTIONS[key];
      if (!fn || !data[key]) return;
      var html = fn(data[key], feed);
      if (INNER[key]) inner += html; else top += html;
    });

    document.querySelector('.site-container').innerHTML =
      renderNav(data.nav)
      + '<main id="main" class="main-content home-wrap">'
      + top
      + '<div class="inner-container w-container">' + inner + '</div>'
      + renderFooter(data.footer)
      + '</main>';

    document.body.classList.add('bp-ready');
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('failed: ' + src)); };
      document.body.appendChild(s);
    });
  }

  function afterRender(data) {
    initVideos();
    initThoughtLeadership();
    initSolutions();
    initClientSpotlights(data);
    initAnchors();

    loadScript('js/vendor/jquery.min.js')
      .then(function () { return loadScript('js/webflow.js'); })
      .then(function () { return loadScript('js/animate.js'); })
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
    if (target.type !== 'feature' && window.__bpCloseFeature) window.__bpCloseFeature();
    if (target.type === 'feature' && window.__bpOpenFeature) window.__bpOpenFeature(target.index);
    if (target.type === 'spotlight' && window.__bpSelectSpotlight) window.__bpSelectSpotlight(target.index);
    return true;
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
    document.body.classList.add('bp-ready');
  }

  function boot() {
    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(CONTENT_URL + ' returned ' + r.status); return r.json(); })
      .then(function (data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
        CFG = data.config || {};
        UI = data.ui || {};
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
