/* =============================================================================
 * Blueprint of Tomorrow — render.js
 * One IIFE. Loads content JSON, renders sections, initialises video, carousel,
 * anchors, language memory, and mobile nav, then loads animate.js.
 * ============================================================================= */
(function () {
  'use strict';

  /* -- Constants ------------------------------------------------------------- */

  var SITE = 'BLUEPRINT';
  var LANG_KEY = 'bp-lang';
  var CACHE_KEY = 'bp-content-cache';
  var BUILD_VERSION = '2026-10-01.1200';

  window[SITE + '_BUILD'] = {
    version: BUILD_VERSION,
    features: ['content-json', 'multi-language', 'jw-player', 'gsap', 'swiper']
  };

  /* -- Utilities ------------------------------------------------------------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'dataset') for (var d in attrs[k]) node.dataset[d] = attrs[k][d];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }
    return node;
  }

  /* Rich-text sanitizer: allows specific inline tags and span classes. */
  var ALLOWED_TAGS = ['em', 'strong', 'b', 'i', 'br', 'sup', 'sub', 'u', 'small', 'mark', 'a'];
  var ALLOWED_SPAN_CLASSES = ['rt-accent', 'rt-serif', 'rt-muted', 'rt-light', 'rt-nowrap', 'rt-eyebrow'];

  function sanitizeRichText(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    walkSanitize(tmp);
    return tmp.innerHTML;
  }

  function walkSanitize(parent) {
    var nodes = Array.prototype.slice.call(parent.childNodes);
    nodes.forEach(function (node) {
      if (node.nodeType === 1) { // Element
        var tag = node.tagName.toLowerCase();
        if (tag === 'span') {
          // Only allow known classes
          var cls = (node.className || '').split(/\s+/).filter(function (c) {
            return ALLOWED_SPAN_CLASSES.indexOf(c) !== -1;
          });
          if (cls.length === 0) {
            // Replace with children
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
            return;
          }
          node.className = cls.join(' ');
        } else if (tag === 'a') {
          // Keep href only, force target=_blank
          var href = node.getAttribute('href');
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
          // Remove all other attributes
          Array.prototype.slice.call(node.attributes).forEach(function (attr) {
            if (attr.name !== 'href' && attr.name !== 'target' && attr.name !== 'rel') {
              node.removeAttribute(attr.name);
            }
          });
        } else if (ALLOWED_TAGS.indexOf(tag) === -1) {
          // Replace unknown element with its children
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          return;
        }
        // Recurse
        walkSanitize(node);
      } else if (node.nodeType === 8) {
        // Remove comments
        parent.removeChild(node);
      }
    });
  }

  /* Asset path resolver */
  var ASSET_BASE = 'https://nasdaqbrandstudio.github.io/blueprint/';

  function resolveImage(name) {
    if (!name) return '';
    if (name.indexOf('http') === 0 || name.indexOf('//') === 0) return name;
    if (name.indexOf('./') === 0) return name.slice(2); // akamai-relative
    // Bare name: resolve against GitHub images folder
    var hasExt = /\.\w{2,5}$/.test(name);
    return ASSET_BASE + 'images/' + name + (hasExt ? '' : '.webp');
  }

  function resolveContentImage(name) {
    // Content images always resolve against the default content file's folder
    return resolveImage(name);
  }

  /* Escaping for text content */
  function esc(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* -- Fetch helpers --------------------------------------------------------- */

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function cacheJSON(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getCachedJSON() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  /* -- Content URL resolution ------------------------------------------------ */

  function resolveContentURL() {
    // 1. ?content= in the URL (for previews)
    var params = new URLSearchParams(location.search);
    var preview = params.get('content');
    if (preview) return preview;
    // 2. window.<SITE>_CONTENT_URL
    if (window[SITE + '_CONTENT_URL']) return window[SITE + '_CONTENT_URL'];
    // 3. <site>-content meta tag
    var meta = document.querySelector('meta[name="blueprint-content"]');
    if (meta && meta.content) return meta.content;
    // 4. fallback
    return 'content.json';
  }

  /* Derive the base folder from the content URL */
  function deriveAssetBase(contentURL) {
    if (!contentURL || contentURL.indexOf('http') !== 0) {
      ASSET_BASE = location.origin + location.pathname.replace(/[^/]*$/, '');
      return;
    }
    var path = contentURL;
    // Strip the filename, keep the folder
    ASSET_BASE = path.replace(/[^/]*$/, '');
  }

  /* -- Language resolution --------------------------------------------------- */

  function resolveLanguage(languages, defaultLang) {
    // 1. ?lang= in the URL
    var params = new URLSearchParams(location.search);
    var langParam = params.get('lang');
    if (langParam) {
      var match = languages.find(function (l) { return l.code === langParam; });
      if (match) return match.code;
    }
    // 2. Last choice from localStorage
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved) {
        var m2 = languages.find(function (l) { return l.code === saved; });
        if (m2) return m2.code;
      }
    } catch (e) {}
    // 3. Browser language (falls back to base code)
    var browser = (navigator.language || '').toLowerCase();
    if (browser) {
      var base = browser.split('-')[0];
      var m3 = languages.find(function (l) { return l.code === browser; }) ||
               languages.find(function (l) { return l.code === base; });
      if (m3) return m3.code;
    }
    // 4. Default
    return defaultLang || 'en';
  }

  function saveLanguage(code) {
    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  }

  /* ========================================================================== *
   * RENDER FUNCTIONS — one per section, producing the export's exact markup
   * ========================================================================== */

  /* -- Nav ------------------------------------------------------------------- */

  function renderNav(data) {
    var nav = data.nav;
    var frag = document.createDocumentFragment();

    /* Top navbar with Nasdaq logo */
    var navbar = el('nav', { id: 'home', class: 'nasdaq-navbar' });
    var navInner = el('div', { class: 'navigation---primary-navigation' });
    var logoLink = el('a', { href: nav.logo.href, class: 'w-inline-block' });
    logoLink.appendChild(el('img', {
      width: nav.logo.width, height: nav.logo.height,
      alt: nav.logo.alt, src: resolveImage(nav.logo.src),
      loading: 'lazy', class: 'vectors-wrapper-4'
    }));
    navInner.appendChild(logoLink);
    navbar.appendChild(navInner);
    frag.appendChild(navbar);

    /* Mobile nav */
    var mobileNav = el('div', {
      'data-animation': 'default', 'data-collapse': 'tiny',
      'data-duration': '400', 'data-easing': 'ease', 'data-easing2': 'ease',
      role: 'banner', class: 'mobile-nav w-nav'
    });
    var navContainer = el('div', { class: 'nav-container w-container' });
    var mobileBrand = el('a', { href: nav.brand.href, class: 'mobile-title-nav w-nav-brand' });
    var mobileTitle = el('div', { class: 'mobile-nav-title' });
    mobileTitle.appendChild(el('div', { class: 'subnav-home-span', text: nav.brand.line1 }));
    mobileTitle.appendChild(el('div', { class: 'subnav-home', text: nav.brand.line2 }));
    mobileBrand.appendChild(mobileTitle);
    navContainer.appendChild(mobileBrand);

    var mobileMenu = el('nav', { role: 'navigation', class: 'mobile-nav-menu w-nav-menu' });
    nav.items.forEach(function (item, i) {
      var cls = ['mnav-thought-leadership', 'mnav-client-spotlights', 'mnav-solutions'];
      mobileMenu.appendChild(el('a', {
        href: item.href, class: (cls[i] || 'mnav-link') + ' w-nav-link', text: item.label
      }));
    });
    navContainer.appendChild(mobileMenu);

    var navButton = el('div', { id: 'mobile-nav-button', class: 'mobile-nav-button w-nav-button' });
    navButton.appendChild(el('div', { class: 'hamburger-icon w-icon-nav-menu' }));
    navContainer.appendChild(navButton);
    mobileNav.appendChild(navContainer);
    frag.appendChild(mobileNav);

    /* Subnav */
    var subnav = el('nav', { id: 'subnav', class: 'nasdaq-subnav' });
    var titleLink = el('a', { href: nav.brand.href, class: 'nav-title w-inline-block' });
    titleLink.appendChild(el('div', { class: 'subnav-home-span', text: nav.brand.line1 }));
    titleLink.appendChild(el('div', { class: 'subnav-home', text: nav.brand.line2 }));
    subnav.appendChild(titleLink);
    subnav.appendChild(el('div', { class: 'line' }));

    var sectionsContainer = el('div', { class: 'sections-container' });
    var sections = el('div', { class: 'sections' });
    nav.items.forEach(function (item, i) {
      var ids = ['nav-thought-leadership', 'nav-client-spotlights', 'nav-solutions'];
      var cls = ['nav-thought-leadership', 'nav-client-spotlights', 'nav-solutions'];
      sections.appendChild(el('a', { href: item.href, id: ids[i], class: cls[i], text: item.label }));
    });

    /* Who We Serve dropdown */
    if (nav.dropdown && nav.dropdown.label) {
      var wws = el('div', { class: 'who-we-serve nav-link' });
      wws.appendChild(el('div', { text: nav.dropdown.label }));
      var arrowWrap = el('div', { class: 'menu-arrow-svg w-embed' });
      arrowWrap.innerHTML = '<svg id="menu-arrow" data-name="menu-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 284.39 147.17"><defs><style>.cls-1{fill:currentColor;}</style></defs><polygon class="cls-1" points="0 0 284.39 0 142.19 147.17 0 0"></polygon></svg>';
      wws.appendChild(arrowWrap);
      sections.appendChild(wws);
    }

    sectionsContainer.appendChild(sections);
    subnav.appendChild(sectionsContainer);
    frag.appendChild(subnav);

    return frag;
  }

  /* -- Hero ------------------------------------------------------------------ */

  function renderHero(data) {
    var hero = data.hero;
    var frag = document.createDocumentFragment();

    /* main-content wrapper */
    var main = el('main', { id: 'main', class: 'main-content home-wrap' });

    /* header */
    var header = el('header', { id: hero.id || 'header', class: 'header' });
    var headContentContainer = el('div', { class: 'head-content-container' });
    var headContent = el('div', { class: 'head-content' });

    /* header-container with eyebrow, headline, intro */
    var headerContainer = el('div', { class: 'header-container' });
    headerContainer.appendChild(el('h2', { class: 'category', text: hero.eyebrow }));
    var heading = el('h1', { class: 'heading' });
    heading.innerHTML = sanitizeRichText(hero.headline);
    headerContainer.appendChild(heading);

    var introCopy = el('div', { class: 'intro-copy' });
    introCopy.appendChild(el('h2', { class: 'head-paragraph', html: sanitizeRichText(hero.intro) + '<br>' }));
    headerContainer.appendChild(introCopy);
    headContent.appendChild(headerContainer);

    /* scroll container */
    var scrollContainer = el('div', { class: 'scroll-container' });
    var scroll = el('div', { class: 'scroll' });
    scroll.appendChild(el('div', { class: 'scroll-text', text: hero.scrollLabel }));
    scroll.appendChild(el('div', { class: 'lottie-open' }));
    scrollContainer.appendChild(scroll);
    headContent.appendChild(scrollContainer);

    /* hero-container-mobile with video */
    var heroMobile = el('div', { class: 'hero-container-mobile' });
    var heroVideoMobile = el('div', { id: 'hero-video-mobile', class: 'hero-embed-body w-embed w-iframe' });
    heroVideoMobile.setAttribute('data-jw-media', hero.video.jwMedia);
    heroVideoMobile.setAttribute('data-jw-title', hero.video.title);
    heroMobile.appendChild(heroVideoMobile);

    var scrollContainerMobile = el('div', { class: 'scroll-container-mobile' });
    var scrollMobile = el('div', { class: 'scroll' });
    scrollMobile.appendChild(el('div', { class: 'scroll-text', text: hero.scrollLabel }));
    scrollMobile.appendChild(el('div', { class: 'lottie-open' }));
    scrollContainerMobile.appendChild(scrollMobile);
    heroMobile.appendChild(scrollContainerMobile);
    headContent.appendChild(heroMobile);

    headContentContainer.appendChild(headContent);
    header.appendChild(headContentContainer);

    /* hero-video background */
    var heroVideo = el('div', { class: 'hero-video' });
    heroVideo.appendChild(el('div', { class: 'overlay' }));
    heroVideo.appendChild(el('div', { class: 'background-image' }));
    var bgVideoWrap = el('div', {
      'data-poster-url': resolveImage(hero.backgroundVideo.poster),
      'data-video-urls': hero.backgroundVideo.mp4,
      'data-autoplay': 'true', 'data-loop': 'true', 'data-wf-ignore': 'true',
      class: 'background-video w-background-video w-background-video-atom'
    });
    var video = el('video', {
      autoplay: '', loop: '', muted: '', playsinline: '',
      'data-wf-ignore': 'true', 'data-object-fit': 'cover'
    });
    video.style.backgroundImage = 'url("' + resolveImage(hero.backgroundVideo.poster) + '")';
    var source = el('source', { src: hero.backgroundVideo.mp4, 'data-wf-ignore': 'true' });
    video.appendChild(source);
    bgVideoWrap.appendChild(video);
    heroVideo.appendChild(bgVideoWrap);
    header.appendChild(heroVideo);

    main.appendChild(header);

    /* hero-container (desktop video) */
    var heroContainer = el('div', { class: 'hero-container' });
    var heroVideoDesktop = el('div', { id: 'hero-video', class: 'hero-embed-body w-embed w-iframe' });
    heroVideoDesktop.setAttribute('data-jw-media', hero.video.jwMedia);
    heroVideoDesktop.setAttribute('data-jw-title', hero.video.title);
    heroContainer.appendChild(heroVideoDesktop);
    main.appendChild(heroContainer);

    /* inner-container wraps the remaining sections */
    var innerContainer = el('div', { class: 'w-layout-blockcontainer inner-container w-container' });

    frag.appendChild(main);
    // Store inner container on the fragment for later section appends
    frag._innerContainer = innerContainer;
    main.appendChild(innerContainer);

    return frag;
  }

  /* -- Thought Leadership ---------------------------------------------------- */

  function renderThoughtLeadership(data) {
    var tl = data.thoughtLeadership;
    var container = el('header', { id: tl.id, class: 'tl-container' });

    /* Mobile articles */
    var articlesMobile = el('div', { class: 'tl-articles-mobile' });
    tl.features.forEach(function (feature, idx) {
      var articleMobile = el('div', { class: 'tl-article-' + (idx === 0 ? '3' : idx === 1 ? '2' : '1') + '-mobile' });
      if (idx === 2) articleMobile.id = 'thought-leadership-mobile';
      articleMobile.appendChild(el('h3', { class: 'tl-headline', html: sanitizeRichText(feature.title) }));

      if (feature.video && feature.video.jwMedia) {
        var videoDiv = el('div', { class: 'thought-leadership-video w-embed w-iframe' });
        videoDiv.setAttribute('data-jw-media', feature.video.jwMedia);
        videoDiv.setAttribute('data-jw-title', feature.video.title);
        articleMobile.appendChild(videoDiv);
      }

      var videoText = el('div', { class: 'tl-video-text' });
      feature.body.forEach(function (para) {
        videoText.appendChild(el('p', { class: 'tl-intro', html: sanitizeRichText(para) }));
      });
      articleMobile.appendChild(videoText);

      /* Quote */
      if (feature.quote) {
        var quoteWrap = el('div', { class: 'quote-wrap-mobile' });
        var callOut = el('div', { class: 'call-out-container-mobile' });
        var quoteOuter = el('div', { class: 'quote-outer-container-mobile' });
        var quoteCenter = el('div', { class: 'quote-center-container' });
        var quoteContainer = el('div', { class: 'quote-container' });
        quoteContainer.appendChild(el('img', {
          src: resolveImage('./images/quote_white.svg'), loading: 'lazy',
          alt: 'Quotation Mark', class: 'quote'
        }));
        quoteContainer.appendChild(el('p', { class: 'paragraph-light', html: sanitizeRichText(feature.quote.text) }));
        quoteCenter.appendChild(quoteContainer);
        quoteOuter.appendChild(quoteCenter);
        callOut.appendChild(quoteOuter);

        var headshotContainer = el('div', { class: 'headshot-container-mobile' });
        var headshotDiv = el('div', { class: feature.id === 'liquidity-ecosystem' ? 'emily-spurling-headshot' : 'aaron-jung-headshot' });
        if (feature.quote.headshot) {
          headshotDiv.style.backgroundImage = 'url("' + resolveContentImage(feature.quote.headshot) + '")';
        }
        headshotContainer.appendChild(headshotDiv);
        var nameContainer = el('div', { class: 'name-container' });
        nameContainer.appendChild(el('div', { class: 'name', text: feature.quote.name }));
        nameContainer.appendChild(el('div', { class: 'title', text: feature.quote.role }));
        headshotContainer.appendChild(nameContainer);
        callOut.appendChild(headshotContainer);
        quoteWrap.appendChild(callOut);
        articleMobile.appendChild(quoteWrap);
      }

      articlesMobile.appendChild(articleMobile);
    });
    container.appendChild(articlesMobile);

    /* Module container */
    var moduleContainer = el('div', { class: 'tl-module-container' });

    /* Headline */
    var headlineContainer = el('div', { class: 'headline-container-2' });
    headlineContainer.appendChild(el('div', { class: 'headline-2', html: sanitizeRichText(tl.headline) }));
    headlineContainer.appendChild(el('div', { class: 'text-block-15', text: tl.clickLabel }));
    moduleContainer.appendChild(headlineContainer);

    /* Portraits container with section content and cards */
    var portraitsContainer = el('div', { class: 'portraits-container' });
    var section2 = el('div', { class: 'section-2' });

    /* section-content (expandable articles) */
    var sectionContent = el('div', { class: 'section-content' });

    tl.features.forEach(function (feature, idx) {
      var articleClasses = ['first-article', 'second-article', 'third-article', 'fourth-article'];
      var article = el('section', { class: articleClasses[idx] });

      /* Close button */
      var closeBtn = el('a', { href: '#', class: 'button-close w-inline-block' });
      closeBtn.appendChild(el(idx === 3 ? 'div' : 'div', { text: '✕' }));
      article.appendChild(closeBtn);

      /* container-article */
      var containerArticle = el('div', { class: 'container-article' + (idx >= 1 ? ' green' : '') });
      var innerClasses = ['inner-container-2', 'inner-container-2 lilah', 'inner-container-2 steve', 'inner-container-2 lilah'];
      var innerContainer2 = el('div', { class: innerClasses[idx] });

      /* header-row */
      var headerRow = el('div', { class: 'header-row' });
      var heading2 = el('h1', { class: 'heading-2' });
      heading2.innerHTML = '<strong class="headline-1">' + sanitizeRichText(feature.title) + '<br></strong>';
      headerRow.appendChild(heading2);

      /* survivor info */
      if (feature.survivor) {
        var innerHeaderCol = el('div', { class: 'inner-header-col' });
        if (idx === 2) {
          var nestedCol = el('div', { class: 'inner-header-col' });
          nestedCol.appendChild(el('div', { class: 'survivor-1', html: esc(feature.survivor.name) + '<br>' }));
          nestedCol.appendChild(el('div', { class: 'survivor-1 career' + (feature.survivor.noVideo ? ' no-video' : ''), html: esc(feature.survivor.role) + '<br>' }));
          innerHeaderCol.appendChild(nestedCol);
        } else {
          innerHeaderCol.appendChild(el('div', { class: 'survivor-1', html: esc(feature.survivor.name) + '<br>' }));
          innerHeaderCol.appendChild(el('div', { class: 'survivor-1 career' + (feature.survivor.noVideo ? ' no-video' : ''), html: esc(feature.survivor.role) + '<br>' }));
        }
        headerRow.appendChild(innerHeaderCol);
      }
      innerContainer2.appendChild(headerRow);

      /* video container */
      var videoContainer = el('div', { class: 'video-container' });
      if (feature.video && feature.video.jwMedia) {
        var videoScript = el('div', { class: 'video-script w-embed w-iframe' });
        videoScript.setAttribute('data-jw-media', feature.video.jwMedia);
        videoScript.setAttribute('data-jw-title', feature.video.title);
        videoContainer.appendChild(videoScript);
      } else {
        var htmlEmbed = el('div', { class: 'html-embed w-embed' });
        videoContainer.appendChild(htmlEmbed);
      }
      innerContainer2.appendChild(videoContainer);

      /* body text */
      feature.body.forEach(function (para, pIdx) {
        if (pIdx === 0) {
          innerContainer2.appendChild(el('p', { class: 'first-line', html: sanitizeRichText(para) }));
        } else {
          // Check if it's a quote (starts with " or &ldquo;)
          var isQuote = /^["\u201c]/.test(para.trim());
          innerContainer2.appendChild(el('p', { class: isQuote ? 'quote-2' : '', html: sanitizeRichText(para) }));
        }
      });

      /* divider after body */
      innerContainer2.appendChild(el('div', { class: 'divider-div' }));

      /* quote (for features 0 and 1) */
      if (feature.quote && idx < 2) {
        var quoteWrap = el('div', { class: 'quote-wrap' });
        var callOutContainer = el('div', { class: 'call-out-container' });
        var headshotContainer = el('div', { class: 'headshot-container' });
        var headshotClass = feature.id === 'liquidity-ecosystem' ? 'emily-spurling-headshot' : 'aaron-jung-headshot';
        var headshotDiv = el('div', { class: headshotClass });
        if (feature.quote.headshot) {
          headshotDiv.style.backgroundImage = 'url("' + resolveContentImage(feature.quote.headshot) + '")';
        }
        headshotContainer.appendChild(headshotDiv);
        var nameContainer = el('div', { class: 'name-container' });
        nameContainer.appendChild(el('div', { class: 'name', text: feature.quote.name }));
        nameContainer.appendChild(el('div', { class: 'title', text: feature.quote.role }));
        headshotContainer.appendChild(nameContainer);
        callOutContainer.appendChild(headshotContainer);

        var quoteOuterContainer = el('div', { class: 'quote-outer-container' });
        var quoteCenterContainer = el('div', { class: 'quote-center-container' });
        var quoteContainer = el('div', { class: 'quote-container' });
        quoteContainer.appendChild(el('img', { src: resolveImage('./images/quote_white.svg'), loading: 'lazy', alt: 'Quotation Mark', class: 'quote' }));
        quoteContainer.appendChild(el('p', { class: 'paragraph-light', html: sanitizeRichText(feature.quote.text) }));
        quoteCenterContainer.appendChild(quoteContainer);
        quoteOuterContainer.appendChild(quoteCenterContainer);
        callOutContainer.appendChild(quoteOuterContainer);
        quoteWrap.appendChild(callOutContainer);
        innerContainer2.appendChild(quoteWrap);
      }

      containerArticle.appendChild(innerContainer2);
      article.appendChild(containerArticle);
      sectionContent.appendChild(article);
    });

    section2.appendChild(sectionContent);

    /* Cards (card-1 through card-4) */
    tl.features.forEach(function (feature, idx) {
      var cardNum = idx + 1;
      var card = el('div', { class: 'card-' + cardNum });

      /* image-overlay */
      card.appendChild(el('div', { class: 'image-overlay' }));

      /* card-inner with details */
      var cardInner = el('div', { class: 'card-inner' });
      var cardDetails = el('div', { class: 'card-details-wrapper' });

      if (feature.card && feature.card.highlight) {
        var titleWrapper = el('div', { class: 'title-wrapper' });
        titleWrapper.appendChild(el('div', { class: 'highlights', text: feature.card.highlight }));
        cardDetails.appendChild(titleWrapper);
      }

      var mainHeading = el('h1', { class: 'main-heading' });
      mainHeading.innerHTML = '<strong class="bold-text-' + (cardNum === 1 ? '8' : cardNum === 2 ? '5' : '7') + '">' + sanitizeRichText(feature.title) + (cardNum <= 2 ? '<br>' : cardNum === 4 ? '<br>' : '') + '</strong>';
      cardDetails.appendChild(mainHeading);

      cardInner.appendChild(cardDetails);
      card.appendChild(cardInner);

      /* image-wrapper */
      var imageWrapper = el('div', { class: 'image-wrapper' });
      if (feature.card && feature.card.loopVideo) {
        var codeEmbed = el('div', { class: 'card-' + cardNum + '-code w-embed' });
        codeEmbed.innerHTML = '<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;"><source src="' + feature.card.loopVideo + '" type="video/mp4"></video>';
        imageWrapper.appendChild(codeEmbed);
      }
      /* image div (CSS background) */
      var imageClass = 'image-' + (cardNum === 1 ? '1' : cardNum === 2 ? '5' : cardNum === 3 ? '6' : '4');
      imageWrapper.appendChild(el('div', { class: imageClass }));
      card.appendChild(imageWrapper);

      section2.appendChild(card);
    });

    portraitsContainer.appendChild(section2);
    moduleContainer.appendChild(portraitsContainer);

    /* background image */
    moduleContainer.appendChild(el('div', { class: 'background-image-2' }));

    container.appendChild(moduleContainer);
    return container;
  }
  /* -- Client Spotlights ----------------------------------------------------- */

  function renderClientSpotlights(data) {
    var cs = data.clientSpotlights;
    var section = el('section', { id: cs.id, class: 'client-spotlights-archive w-node-_8c1c790f-dbef-a50f-894e-46b14469928a-51b7b3c5' });

    /* Headline */
    var headline = el('h3', { class: 'cs-headline' });
    headline.innerHTML = sanitizeRichText(cs.headline);
    section.appendChild(headline);

    /* Video group playlist container */
    var playlistWrap = el('div', { class: 'video-group-playlist w-embed w-iframe w-script' });

    /* Desktop/tablet view: main video + carousel playlist */
    var desktopView = el('div', { class: 'desktop-tablet-view' });

    var mainVideoWrapper = el('div', { class: 'main-video-wrapper', id: 'main-video-container' });
    var mainVideoPlayer = el('div', { class: 'bp-main-video', 'data-jw-media': cs.videos[0].jwMedia, 'data-jw-title': cs.videos[0].title });
    mainVideoPlayer.setAttribute('data-anchor', cs.videos[0].anchor || '');
    mainVideoWrapper.appendChild(mainVideoPlayer);

    var videoTitle = el('h3', { id: 'video-title', text: cs.videos[0].title });
    mainVideoWrapper.appendChild(videoTitle);
    var videoDesc = el('p', { id: 'video-description', text: cs.videos[0].description });
    mainVideoWrapper.appendChild(videoDesc);

    desktopView.appendChild(mainVideoWrapper);

    /* Playlist carousel */
    var carousel = el('div', { class: 'playlist-carousel' });
    var carouselWrapper = el('div', { class: 'carousel-wrapper' });
    var playlistContainer = el('div', { class: 'playlist-container', id: 'playlist-container' });

    cs.videos.forEach(function (video, idx) {
      var item = el('div', {
        class: 'playlist-item' + (idx === 0 ? ' active' : ''),
        'data-jw-media': video.jwMedia,
        'data-jw-title': video.title,
        'data-anchor': video.anchor || '',
        'data-description': video.description || '',
        'data-index': idx
      });

      var thumbWrap = el('div', { class: 'playlist-thumbnail' });
      thumbWrap.setAttribute('data-jw-media', video.jwMedia);
      item.appendChild(thumbWrap);

      var labelWrap = el('div', { class: 'playlist-label' });
      labelWrap.appendChild(el('div', { class: 'playlist-title', text: video.title }));
      if (idx === 0) labelWrap.appendChild(el('div', { class: 'now-playing-badge', text: cs.nowPlayingLabel || 'Now playing' }));
      item.appendChild(labelWrap);

      playlistContainer.appendChild(item);
    });

    carouselWrapper.appendChild(playlistContainer);
    carousel.appendChild(carouselWrapper);

    var indicators = el('div', { class: 'carousel-indicators', id: 'carousel-indicators' });
    carousel.appendChild(indicators);

    desktopView.appendChild(carousel);
    playlistWrap.appendChild(desktopView);

    /* Mobile video stack */
    var mobileStack = el('div', { class: 'mobile-video-stack', id: 'mobile-video-stack' });

    cs.videos.forEach(function (video, idx) {
      var mobileItem = el('div', {
        class: 'mobile-video-item' + (idx >= (cs.mobileInitialCount || 4) ? ' bp-hidden' : ''),
        'data-jw-media': video.jwMedia,
        'data-jw-title': video.title,
        'data-anchor': video.anchor || ''
      });
      var mobilePlayer = el('div', { class: 'mobile-video-player' });
      mobilePlayer.setAttribute('data-jw-media', video.jwMedia);
      mobilePlayer.setAttribute('data-jw-title', video.title);
      mobileItem.appendChild(mobilePlayer);

      var mobileDetails = el('div', { class: 'mobile-video-details' });
      mobileDetails.appendChild(el('p', { class: 'cs-video-title', text: video.title }));
      var textIntro = el('div', { class: 'text-intro' });
      textIntro.appendChild(el('p', { html: sanitizeRichText(video.description) }));
      mobileDetails.appendChild(textIntro);
      mobileItem.appendChild(mobileDetails);

      mobileStack.appendChild(mobileItem);
    });

    playlistWrap.appendChild(mobileStack);

    /* See More / See Less toggle */
    if (cs.videos.length > (cs.mobileInitialCount || 4)) {
      var seeMore = el('div', { class: 'see-more-container', id: 'see-more-container' });
      seeMore.appendChild(el('div', { class: 'see-more-arrow' }));
      seeMore.appendChild(el('div', { class: 'see-more-text', text: cs.seeMoreLabel || 'See More' }));
      seeMore.setAttribute('data-see-more', cs.seeMoreLabel || 'See More');
      seeMore.setAttribute('data-see-less', cs.seeLessLabel || 'See Less');
      playlistWrap.appendChild(seeMore);
    }

    section.appendChild(playlistWrap);

    /* Desktop grid (cs-container) — the 2x2 grid of videos */
    cs.videos.forEach(function (video, idx) {
      var gridNum = idx < 2 ? 2 : 1;
      var space = el('div', { id: 'space', class: 'w-layout-grid cs-container' + (gridNum === 2 ? '-2' : '') });
      var csVideo = el('div', { class: 'cs-video' });
      var embedClass = 'client-video-embed-' + ((idx % 4) + 1);
      var embed = el('div', { class: embedClass + ' w-embed w-iframe' });
      embed.setAttribute('data-jw-media', video.jwMedia);
      embed.setAttribute('data-jw-title', video.title);
      var videoContainer = el('div', { class: 'video-container' });
      videoContainer.setAttribute('data-jw-media', video.jwMedia);
      videoContainer.setAttribute('data-jw-title', video.title);
      embed.appendChild(videoContainer);
      csVideo.appendChild(embed);

      var details = el('div', { class: 'client-video-details' });
      details.appendChild(el('p', { class: 'cs-video-title', text: video.title }));
      var textIntro = el('div', { class: 'text-intro' });
      textIntro.appendChild(el('p', { html: sanitizeRichText(video.description) }));
      details.appendChild(textIntro);
      csVideo.appendChild(details);

      space.appendChild(csVideo);
      section.appendChild(space);
    });

    return section;
  }

  /* -- Solutions ------------------------------------------------------------- */

  function renderSolutions(data) {
    var sol = data.solutions;
    var section = el('section', { id: sol.id, class: 'solutions w-node-ceee8c4e-c36e-6fe4-1191-601eef8c5121-51b7b3c5' });

    /* Headline */
    var headlineDiv = el('div', { class: 'solutions-headline' });
    headlineDiv.appendChild(el('h3', { class: 'solutions-headline', text: sol.headline }));
    headlineDiv.appendChild(el('p', { class: 'paragraph', html: sanitizeRichText(sol.intro) }));
    section.appendChild(headlineDiv);

    /* Solutions scroll indicator */
    var scrollDiv = el('div', { class: 'solutions-scroll' });
    scrollDiv.appendChild(el('div', { class: 'text-block-12', text: sol.swipeLabel }));
    section.appendChild(scrollDiv);

    /* Solutions module */
    var module = el('div', { class: 'solutions-module' });

    /* Mobile grid */
    var mobile = el('div', { class: 'solutions-mobile' });
    var gridMobile = el('div', { class: 'solutions-grid-mobile' });

    sol.buildings.forEach(function (building, bIdx) {
      var bNum = bIdx + 1;
      /* Mobile building container */
      var bMobile = el('div', { class: 'solutions-b' + bNum + '-mobile' });
      var solutionsBody = el('div', { class: 'solutions-body' });
      solutionsBody.appendChild(el('div', { class: 'text-intro' }));
      bMobile.appendChild(solutionsBody);

      /* Active building image */
      var bActive = el('div', { class: 'b' + bNum + '-active' });
      var buildingActive = el('div', { class: 'building-' + bNum + '-active' });
      buildingActive.appendChild(el('div', { class: 'solutions-category', text: building.label }));
      bActive.appendChild(buildingActive);

      /* Rest building */
      var bRest = el('div', { class: 'b' + bNum + '-rest' });
      var buildingRest = el('div', { class: 'building-' + bNum + '-rest' });
      buildingRest.appendChild(el('div', { class: 'solutions-category', text: building.label }));
      bRest.appendChild(buildingRest);

      bMobile.appendChild(bActive);
      bMobile.appendChild(bRest);
      gridMobile.appendChild(bMobile);
    });

    mobile.appendChild(gridMobile);
    module.appendChild(mobile);

    /* Desktop buildings */
    sol.buildings.forEach(function (building, bIdx) {
      var bNum = bIdx + 1;
      var bContainer = el('div', { class: 'b' + bNum + '-container' });

      /* Active state */
      var bActive = el('div', { class: 'b' + bNum + '-active' });
      var buildingActive = el('div', { class: 'building-' + bNum + '-active' });
      buildingActive.appendChild(el('div', { class: 'solutions-category', text: building.label }));
      bActive.appendChild(buildingActive);

      /* Rest state */
      var bRest = el('div', { class: 'b' + bNum + '-rest' });
      var buildingRest = el('div', { class: 'building-' + bNum + '-rest' });
      buildingRest.appendChild(el('div', { class: 'solutions-category', text: building.label }));

      /* Solutions body with intro */
      var solutionsBody = el('div', { class: 'solutions-body' });
      var textIntro = el('div', { class: 'text-intro' });
      textIntro.appendChild(el('p', { html: sanitizeRichText(building.intro) }));
      solutionsBody.appendChild(textIntro);

      /* Embed (building 1) */
      if (building.embed) {
        var embedDiv = el('div', { class: 'b' + bNum + '-code-embed w-embed w-iframe' });
        embedDiv.innerHTML = '<iframe src="' + building.embed.url + '" width="100%" height="' + building.embed.height + '" frameborder="0" scrolling="auto" title="' + esc(building.embed.title) + '" allowfullscreen></iframe>';
        solutionsBody.appendChild(embedDiv);
      }

      /* Cards container */
      if (building.cards && building.cards.length > 0) {
        var containerClass = '';
        if (building.id === 'income-generation') containerClass = 'income-gen-container';
        else if (building.id === 'megatrends') containerClass = 'mega-trends-container';
        else if (building.id === 'digital-assets') containerClass = 'digital-assets-container';
        else if (building.id === 'advisor-solutions') containerClass = 'private-markets-container';

        var cardsContainer = el('div', { class: containerClass });

        building.cards.forEach(function (card, cIdx) {
          var sNum = cIdx + 1;
          /* Rest state */
          var sRest = el('div', { class: 'b' + bNum + '-s' + sNum + '-rest' });
          var blockSpacer = el('div', { class: 'block-spacer' });
          var infoCard = el('div', { class: 'info-card' });
          infoCard.appendChild(el('div', { class: 'arrow-overlay' }));
          infoCard.appendChild(el('div', { class: 'hover-text-block', text: card.cta || 'Learn More' }));
          blockSpacer.appendChild(infoCard);
          sRest.appendChild(blockSpacer);

          /* Active state */
          var sActive = el('a', { href: card.url, target: '_blank', class: 'b' + bNum + '-s' + (sNum === 1 ? '' : '-') + sNum + '-active w-inline-block' });
          var blockSpacer2 = el('div', { class: 'block-spacer' });
          var infoCard2 = el('div', { class: 'info-card' });
          var infoCardDetails = el('div', { class: 'info-card-details' });
          infoCardDetails.appendChild(el('div', { class: 'arrow-overlay-hover' }));
          infoCardDetails.appendChild(el('div', { class: 'hover-text-block', text: card.cta || 'Learn More' }));
          infoCard2.appendChild(infoCardDetails);
          blockSpacer2.appendChild(infoCard2);
          sActive.appendChild(blockSpacer2);

          var sWrapper = el('div', { class: 'b' + bNum + '-s' + sNum });
          sWrapper.appendChild(sRest);
          sWrapper.appendChild(sActive);
          cardsContainer.appendChild(sWrapper);
        });

        solutionsBody.appendChild(cardsContainer);
      }

      /* Advisor solutions bullets */
      if (building.id === 'advisor-solutions' && building.bullets) {
        var advisorContainer = el('div', { class: 'advisor-solutions-container' });
        var bulletIntro = el('div', { class: 'text-intro' });
        bulletIntro.appendChild(el('p', { text: building.bulletsIntro || '' }));
        advisorContainer.appendChild(bulletIntro);
        building.bullets.forEach(function (bullet) {
          var bulletBox = el('div', { class: 'bullet-box' });
          bulletBox.appendChild(el('div', { class: 'bullet' }));
          bulletBox.appendChild(el('div', { class: 'inner-text', text: bullet }));
          advisorContainer.appendChild(bulletBox);
        });
        solutionsBody.appendChild(advisorContainer);
      }

      /* Body link */
      if (building.bodyLink) {
        var bodyLink = el('a', { href: building.bodyLink.url, target: '_blank', class: 'solutions-body-link w-inline-block' });
        var bodyLinkDiv = el('div', { class: 'body-link' });
        bodyLinkDiv.appendChild(el('div', { class: 'click-body', html: sanitizeRichText(building.bodyLink.text) }));
        bodyLink.appendChild(bodyLinkDiv);
        solutionsBody.appendChild(bodyLink);
      }

      /* Ancillary links */
      if (building.links && building.links.length > 0) {
        var linksContainer = el('div', { class: 'ancillary-link-container' });
        building.links.forEach(function (link) {
          var linkEl = el('a', { href: link.url, target: '_blank', class: 'ancillary-link w-inline-block', 'data-track': '' });
          var linkText = el('div', { class: 'link-text' });
          linkText.appendChild(el('span', { html: esc(link.eyebrow) }));
          linkText.appendChild(el('div', { class: 'right-click' }));
          linkEl.appendChild(linkText);
          linkEl.appendChild(el('div', { class: 'right-click-spacer' }));
          linksContainer.appendChild(linkEl);
        });
        solutionsBody.appendChild(linksContainer);
        /* Desktop links container */
        var linksDesktop = el('div', { class: 'ancillary-link-container' });
        building.links.forEach(function (link) {
          var linkEl = el('a', { href: link.url, target: '_blank', class: 'ancillary-link w-inline-block', 'data-track': '' });
          var linkText = el('div', { class: 'link-text' });
          linkText.appendChild(el('span', { html: esc(link.eyebrow) }));
          linkText.appendChild(el('div', { class: 'right-click' }));
          linkEl.appendChild(linkText);
          linkEl.appendChild(el('div', { class: 'right-click-spacer' }));
          linksDesktop.appendChild(linkEl);
        });
        solutionsBody.appendChild(el('div', { class: 'right-click-desktop' }));
      }

      buildingRest.appendChild(solutionsBody);
      bContainer.appendChild(bActive);
      bContainer.appendChild(bRest);
      module.appendChild(bContainer);
    });

    section.appendChild(module);

    /* Cityscape */
    if (data.cityscape) {
      section.appendChild(el('div', { class: 'cityscape' }));
    }

    return section;
  }

  /* -- Footer ---------------------------------------------------------------- */

  function renderFooter(data) {
    var footer = data.footer;
    var footerEl = el('footer', { id: 'footer', class: 'footer-wrapper w-node-_2767a12c-8d36-ac23-aca5-03e8b217acba-51b7b3c5' });
    var container = el('section', { class: 'footer-container' });

    var columnContainer = el('div', { class: 'column-container' });
    var columns = el('div', { class: 'columns' });

    footer.columns.forEach(function (col) {
      var linkColumn = el('div', { class: 'link-column' });
      col.forEach(function (link) {
        var isPrivacy = link.label === 'Privacy Policy' || link.label === 'Cookies' || link.label === 'Legal' || link.label === 'Cookie Settings';
        linkColumn.appendChild(el('a', {
          href: link.url, target: '_blank',
          class: 'footer-link' + (isPrivacy ? ' privacy-legal' : ''),
          text: link.label
        }));
      });
      columns.appendChild(linkColumn);
    });

    columnContainer.appendChild(columns);
    container.appendChild(columnContainer);

    /* Social icons (mobile) */
    var socialMobile = el('div', { class: 'social-icons-container' });
    var socialMobileInner = el('div', { class: 'social-icons-mobile' });
    footer.social.forEach(function (s) {
      var a = el('a', { id: s.label, href: s.url, target: '_blank', class: s.id + ' w-inline-block' });
      a.appendChild(el('img', { loading: 'lazy', src: resolveImage(s.icon), alt: s.label + ' logo', class: s.id }));
      socialMobileInner.appendChild(a);
    });
    socialMobile.appendChild(socialMobileInner);

    /* Nasdaq logo full */
    var logoFull = el('div', { class: 'nasdaq-logo-container-full' });
    var logoLink = el('a', { href: footer.logo.url, target: '_blank', class: 'nasdaq-logo-footer w-inline-block' });
    logoLink.appendChild(el('img', { loading: 'lazy', src: resolveImage(footer.logo.src), alt: footer.logo.alt, class: 'nasdaq-logo' }));
    logoFull.appendChild(logoLink);
    socialMobile.appendChild(logoFull);

    container.appendChild(socialMobile);

    /* Logo + copyright container */
    var logoCopyrightContainer = el('div', { class: 'logo-copyright-container' });
    var nasdaqLogoContainer = el('div', { class: 'nasdaq-logo-container' });
    nasdaqLogoContainer.appendChild(el('img', { loading: 'lazy', src: resolveImage(footer.logo.src), alt: footer.logo.alt, class: 'nasdaq-logo' }));
    logoCopyrightContainer.appendChild(nasdaqLogoContainer);

    var socialCopyrightContainer = el('div', { class: 'social-copyright-container' });
    var socialIcons = el('div', { class: 'social-icons' });
    footer.social.forEach(function (s) {
      var a = el('a', { href: s.url, target: '_blank', class: s.id + ' w-inline-block' });
      a.appendChild(el('img', { id: s.id, loading: 'lazy', src: resolveImage(s.icon), alt: '', class: s.id }));
      socialIcons.appendChild(a);
    });
    socialCopyrightContainer.appendChild(socialIcons);

    /* Copyright */
    var copyrightText = (footer.copyright || '').replace('{year}', String(new Date().getFullYear()));
    var copyrightDiv = el('div', { class: 'copyright-inline-2 w-embed' });
    copyrightDiv.innerHTML = esc(copyrightText);
    socialCopyrightContainer.appendChild(copyrightDiv);

    logoCopyrightContainer.appendChild(socialCopyrightContainer);
    container.appendChild(logoCopyrightContainer);

    footerEl.appendChild(container);
    return footerEl;
  }

  /* ========================================================================== *
   * VIDEO INITIALISATION
   * ========================================================================== */

  var activePlayer = null;

  function initVideo(container, videoData) {
    var mediaId = container.getAttribute('data-jw-media');
    var title = container.getAttribute('data-jw-title') || '';
    if (!mediaId || !window.jwplayer) return;

    var playerId = 'bp-player-' + mediaId + '-' + Math.random().toString(36).slice(2, 8);
    container.id = playerId;

    var player = jwplayer(playerId);
    player.setup({
      file: 'https://cdn.jwplayer.com/manifests/' + mediaId + '.m3u8',
      mediaid: mediaId,
      title: title,
      autostart: false,
      controls: true,
      stretching: 'uniform'
    });

    return player;
  }

  function mountPlayer(container) {
    if (activePlayer) {
      try { activePlayer.stop(); activePlayer.remove(); } catch (e) {}
      activePlayer = null;
    }

    var mediaId = container.getAttribute('data-jw-media');
    var title = container.getAttribute('data-jw-title') || '';
    if (!mediaId || !window.jwplayer) return;

    var playerId = 'bp-player-' + mediaId + '-' + Date.now();
    container.id = playerId;
    container.innerHTML = '';

    var player = jwplayer(playerId);
    player.setup({
      file: 'https://cdn.jwplayer.com/manifests/' + mediaId + '.m3u8',
      mediaid: mediaId,
      title: title,
      autostart: true,
      controls: true,
      stretching: 'uniform'
    });

    activePlayer = player;
    return player;
  }

  function initAllVideos() {
    /* Hero videos — mount on click */
    var heroVideos = document.querySelectorAll('[data-jw-media]');
    heroVideos.forEach(function (container) {
      if (container.classList.contains('bp-video-init')) return;
      container.classList.add('bp-video-init');

      /* Show a poster/play button overlay */
      var overlay = el('div', { class: 'bp-video-poster-overlay' });
      overlay.innerHTML = '<div class="bp-play-btn"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>';
      container.style.position = 'relative';
      container.appendChild(overlay);

      function activate(e) {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.display = 'none';
        mountPlayer(container);
      }

      overlay.addEventListener('click', activate);
      overlay.setAttribute('tabindex', '0');
      overlay.setAttribute('role', 'button');
      overlay.setAttribute('aria-label', container.getAttribute('data-jw-title') || 'Play video');
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') activate(e);
      });
    });
  }

  /* ========================================================================== *
   * CLIENT SPOTLIGHTS — playlist interaction
   * ========================================================================== */

  function initClientSpotlights(cs) {
    var items = document.querySelectorAll('.playlist-item');
    var mainPlayer = document.querySelector('.bp-main-video');
    var titleEl = document.getElementById('video-title');
    var descEl = document.getElementById('video-description');

    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var mediaId = item.getAttribute('data-jw-media');
        var title = item.getAttribute('data-jw-title');
        var desc = item.getAttribute('data-description');

        /* Update active state */
        items.forEach(function (i) { i.classList.remove('active'); i.querySelectorAll('.now-playing-badge').forEach(function (b) { b.remove(); }); });
        item.classList.add('active');
        var badge = el('div', { class: 'now-playing-badge', text: cs.nowPlayingLabel || 'Now playing' });
        var labelWrap = item.querySelector('.playlist-label');
        if (labelWrap) labelWrap.appendChild(badge);

        /* Update title and description */
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;

        /* Mount player in main video container */
        if (mainPlayer) {
          mainPlayer.setAttribute('data-jw-media', mediaId);
          mainPlayer.setAttribute('data-jw-title', title);
          mountPlayer(mainPlayer);
        }
      });
    });
  }

  /* ========================================================================== *
   * MOBILE NAV
   * ========================================================================== */

  function initMobileNav() {
    var button = document.getElementById('mobile-nav-button');
    var menu = document.querySelector('.mobile-nav-menu');
    if (!button || !menu) return;

    button.addEventListener('click', function () {
      menu.classList.toggle('bp-nav-open');
      button.classList.toggle('bp-nav-open');
    });

    /* Close on link click */
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('bp-nav-open');
        button.classList.remove('bp-nav-open');
      });
    });
  }

  /* ========================================================================== *
   * ANCHORS — deep linking
   * ========================================================================== */

  function initAnchors() {
    /* Measure nav height for scroll-padding */
    function updateNavHeight() {
      var nav = document.querySelector('.nasdaq-subnav');
      var h = nav ? nav.offsetHeight : 0;
      document.documentElement.style.setProperty('--bp-nav-h', h + 'px');
      document.documentElement.style.scrollPaddingTop = h + 'px';
    }
    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);

    /* Handle hash links */
    var hash = location.hash;
    if (hash) {
      var target = document.querySelector(hash);
      if (target) {
        setTimeout(function () {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 100);
      }
    }

    /* Handle anchor-based video selection */
    if (hash) {
      var anchor = hash.replace('#', '');
      /* Client spotlights */
      var csItem = document.querySelector('.playlist-item[data-anchor="' + anchor + '"]');
      if (csItem) csItem.click();
      /* Thought leadership */
      var tlCard = document.querySelector('[data-anchor="' + anchor + '"]');
      if (tlCard && tlCard.classList.contains('card-1') || tlCard && tlCard.classList.contains('card-2') || tlCard && tlCard.classList.contains('card-3') || tlCard && tlCard.classList.contains('card-4')) {
        tlCard.click();
      }
    }
  }

  /* ========================================================================== *
   * SEE MORE / SEE LESS
   * ========================================================================== */

  function initSeeMore(cs) {
    var container = document.getElementById('see-more-container');
    if (!container) return;
    var hiddenItems = document.querySelectorAll('.mobile-video-item.bp-hidden');
    var textEl = container.querySelector('.see-more-text');
    var expanded = false;

    container.addEventListener('click', function () {
      expanded = !expanded;
      hiddenItems.forEach(function (item) {
        item.classList.toggle('bp-hidden', !expanded);
      });
      if (textEl) textEl.textContent = expanded ? (cs.seeLessLabel || 'See Less') : (cs.seeMoreLabel || 'See More');
    });
  }

  /* ========================================================================== *
   * LANGUAGE SWITCHER
   * ========================================================================== */

  function initLanguageSwitcher(languages, currentLang) {
    /* If there's a language dropdown in the nav, wire it up */
    var dropdown = document.querySelector('.who-we-serve');
    if (!dropdown || languages.length <= 1) return;

    var label = dropdown.querySelector('div');
    if (!label) return;

    var menu = el('div', { class: 'bp-lang-menu bp-hidden' });
    languages.forEach(function (lang) {
      var link = el('a', {
        href: '?lang=' + lang.code,
        class: 'bp-lang-link' + (lang.code === currentLang ? ' active' : ''),
        text: lang.name || lang.code
      });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        saveLanguage(lang.code);
        var search = '?lang=' + lang.code;
        location.href = search + (location.hash || '');
      });
      menu.appendChild(link);
    });

    dropdown.style.position = 'relative';
    dropdown.appendChild(menu);

    label.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('bp-hidden');
    });

    document.addEventListener('click', function () {
      menu.classList.add('bp-hidden');
    });
  }

  /* ========================================================================== *
   * ANIMATE.JS LOADER
   * ========================================================================== */

  function loadAnimate() {
    var script = el('script', { src: 'js/animate.js?v=' + BUILD_VERSION });
    document.body.appendChild(script);
  }

  /* ========================================================================== *
   * MAIN ENTRY POINT
   * ========================================================================== */

  function showError(container, msg) {
    container.innerHTML = '<div style="padding:2rem;text-align:center;color:#666;">' + esc(msg) + '</div>';
  }

  function render(data, langCode) {
    var siteContainer = document.querySelector('.site-container');
    if (!siteContainer) return;

    /* Clear container */
    siteContainer.innerHTML = '';

    /* Set body language class */
    document.body.className = 'body lang-' + langCode;
    document.documentElement.lang = langCode;

    /* Update meta tags */
    if (data.meta) {
      if (data.meta.title) document.title = data.meta.title;
      if (data.meta.description) {
        var desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute('content', data.meta.description);
      }
      if (data.meta.ogTitle) {
        var og = document.querySelector('meta[property="og:title"]');
        if (og) og.setAttribute('content', data.meta.ogTitle);
      }
    }

    /* Render nav first */
    siteContainer.appendChild(renderNav(data));

    /* Render hero (creates main + inner-container) */
    var heroFrag = renderHero(data);
    siteContainer.appendChild(heroFrag);
    var innerContainer = heroFrag._innerContainer;

    /* Render sections in sectionOrder */
    var sectionRenderers = {
      thoughtLeadership: renderThoughtLeadership,
      clientSpotlights: renderClientSpotlights,
      solutions: renderSolutions
    };

    data.sectionOrder.forEach(function (key) {
      if (key === 'hero') return; /* already rendered */
      if (key === 'cityscape') return; /* rendered as part of solutions */
      var renderer = sectionRenderers[key];
      if (renderer && data[key]) {
        innerContainer.appendChild(renderer(data));
      }
    });

    /* Render footer last */
    siteContainer.appendChild(renderFooter(data));

    /* Mark as ready */
    document.body.classList.add('bp-ready');

    /* Log build stamp */
    if (window.console) {
      console.log(SITE + '_BUILD', window[SITE + '_BUILD']);
    }
  }

  function init(data, langCode, languages) {
    /* Render the page */
    render(data, langCode);

    /* Initialise interactive features */
    initAllVideos();
    initClientSpotlights(data.clientSpotlights);
    initSeeMore(data.clientSpotlights);
    initMobileNav();
    initAnchors();
    initLanguageSwitcher(languages || [], langCode);

    /* Load animation library */
    loadAnimate();
  }

  /* -- Bootstrap ------------------------------------------------------------- */

  function boot() {
    var contentURL = resolveContentURL();
    deriveAssetBase(contentURL);

    var container = document.querySelector('.site-container');
    if (!container) return;

    /* Load content.json and languages.json in parallel */
    var contentPromise = fetchJSON(contentURL).catch(function () { return null; });
    var languagesURL = contentURL.replace(/content\.json$/, '') + 'languages.json';
    var languagesPromise = fetchJSON(languagesURL).catch(function () { return null; });

    Promise.all([contentPromise, languagesPromise])
      .then(function (results) {
        var content = results[0];
        var languages = results[1];

        if (!content) {
          /* Try cache */
          var cached = getCachedJSON();
          if (cached) {
            content = cached;
          } else {
            showError(container, (content && content.ui && content.ui.loadError) || 'This page could not load its content.');
            return;
          }
        }

        /* Cache good JSON */
        cacheJSON(content);

        /* Build languages list */
        var langList = languages ? languages.languages : [{ code: 'en', label: 'EN', name: 'EN | English', content: 'content.json' }];
        var defaultLang = languages ? languages.default : 'en';

        /* Resolve language */
        var langCode = resolveLanguage(langList, defaultLang);
        saveLanguage(langCode);

        /* If not default language, load translation file */
        if (langCode !== defaultLang) {
          var langEntry = langList.find(function (l) { return l.code === langCode; });
          if (langEntry && langEntry.content) {
            var translationURL = contentURL.replace(/content\.json$/, '') + langEntry.content;
            return fetchJSON(translationURL).then(function (translation) {
              init(translation, langCode, langList);
            }).catch(function () {
              /* Fall back to default content */
              init(content, langCode, langList);
            });
          }
        }

        /* Render with default content */
        init(content, langCode, langList);
      })
      .catch(function (err) {
        console.error('Blueprint render error:', err);
        showError(container, 'This page could not load its content.');
      });
  }

  /* Start when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
