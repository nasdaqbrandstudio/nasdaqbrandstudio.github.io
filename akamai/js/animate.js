/* =============================================================================
 * Blueprint of Tomorrow — animate.js
 * Replaces Webflow interactions with GSAP + ScrollTrigger.
 * Every animation checks prefers-reduced-motion and has a static fallback.
 * Loaded by render.js after render completes.
 * ============================================================================= */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* If GSAP is not available, nothing to do */
  if (typeof gsap === 'undefined') return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* --------------------------------------------------------------------------
   * Hero — fade in headline, eyebrow, intro, scroll indicator
   * -------------------------------------------------------------------------- */
  function initHero() {
    if (prefersReducedMotion) return;

    var header = document.querySelector('.header');
    if (!header) return;

    var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    var category = header.querySelector('.category');
    var heading = header.querySelector('.heading');
    var intro = header.querySelector('.intro-copy');
    var scroll = header.querySelector('.scroll-container');

    if (category) tl.from(category, { opacity: 0, y: 20, duration: 0.6 }, 0.1);
    if (heading) tl.from(heading, { opacity: 0, y: 30, duration: 0.8 }, 0.2);
    if (intro) tl.from(intro, { opacity: 0, y: 20, duration: 0.6 }, 0.4);
    if (scroll) tl.from(scroll, { opacity: 0, y: 10, duration: 0.5 }, 0.6);
  }

  /* --------------------------------------------------------------------------
   * Thought Leadership — headline reveal, card hover, article expand
   * -------------------------------------------------------------------------- */
  function initThoughtLeadership() {
    var headline = document.querySelector('.headline-container-2');
    if (headline && !prefersReducedMotion) {
      gsap.from(headline, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: headline,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });
    }

    /* Card hover interactions */
    var cards = document.querySelectorAll('.card-1, .card-2, .card-3, .card-4');
    cards.forEach(function (card) {
      var overlay = card.querySelector('.image-overlay');
      var inner = card.querySelector('.card-inner');

      card.addEventListener('mouseenter', function () {
        if (prefersReducedMotion) return;
        if (overlay) gsap.to(overlay, { opacity: 0.8, duration: 0.3 });
        if (inner) gsap.to(inner, { opacity: 1, display: 'flex', duration: 0.3 });
      });

      card.addEventListener('mouseleave', function () {
        if (prefersReducedMotion) return;
        if (overlay) gsap.to(overlay, { opacity: 0, duration: 0.3 });
        if (inner) gsap.to(inner, { opacity: 0, duration: 0.3, display: 'none' });
      });

      /* Click to open article */
      card.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = Array.prototype.indexOf.call(cards, card);
        var articles = document.querySelectorAll('.first-article, .second-article, .third-article, .fourth-article');
        var article = articles[idx];
        if (!article) return;

        /* Close all other articles */
        articles.forEach(function (a) {
          if (a !== article) {
            a.style.display = 'none';
          }
        });

        /* Toggle this article */
        if (article.style.display === 'block') {
          article.style.display = 'none';
        } else {
          article.style.display = 'block';
          if (!prefersReducedMotion) {
            gsap.fromTo(article,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
            );
          }
        }
      });
    });

    /* Close button for articles */
    var closeButtons = document.querySelectorAll('.button-close');
    closeButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var article = btn.closest('.first-article, .second-article, .third-article, .fourth-article');
        if (article) article.style.display = 'none';
      });
    });
  }

  /* --------------------------------------------------------------------------
   * Client Spotlights — headline reveal, playlist scroll
   * -------------------------------------------------------------------------- */
  function initClientSpotlights() {
    var headline = document.querySelector('.cs-headline');
    if (headline && !prefersReducedMotion) {
      gsap.from(headline, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: headline,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
   * Solutions — building animations, card hover
   * -------------------------------------------------------------------------- */
  function initSolutions() {
    var headline = document.querySelector('.solutions-headline');
    if (headline && !prefersReducedMotion) {
      gsap.from(headline, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: headline,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });
    }

    /* Info card hover */
    var infoCards = document.querySelectorAll('.info-card');
    infoCards.forEach(function (card) {
      var parent = card.closest('[class*="b"][class*="-s"]');
      if (!parent) return;
      var rest = parent.querySelector('[class*="-rest"]');
      var active = parent.querySelector('a[class*="-active"]');

      if (rest && active) {
        parent.addEventListener('mouseenter', function () {
          if (prefersReducedMotion) return;
          gsap.to(rest, { opacity: 0, duration: 0.2 });
          gsap.to(active, { opacity: 1, duration: 0.3 });
        });
        parent.addEventListener('mouseleave', function () {
          if (prefersReducedMotion) return;
          gsap.to(rest, { opacity: 1, duration: 0.2 });
          gsap.to(active, { opacity: 0, duration: 0.3 });
        });
      }
    });

    /* Building rest → active on scroll */
    var buildings = document.querySelectorAll('.b1-container, .b2-container, .b3-container, .b4-container, .b5-container');
    buildings.forEach(function (building) {
      if (prefersReducedMotion || typeof ScrollTrigger === 'undefined') return;

      var rest = building.querySelector('[class*="-rest"]');
      if (!rest) return;

      ScrollTrigger.create({
        trigger: building,
        start: 'top 70%',
        end: 'bottom 30%',
        onEnter: function () {
          /* Highlight active building */
          gsap.to(rest, { scale: 0.95, opacity: 0.5, duration: 0.4 });
        },
        onLeave: function () {
          gsap.to(rest, { scale: 1, opacity: 1, duration: 0.4 });
        },
        onEnterBack: function () {
          gsap.to(rest, { scale: 0.95, opacity: 0.5, duration: 0.4 });
        },
        onLeaveBack: function () {
          gsap.to(rest, { scale: 1, opacity: 1, duration: 0.4 });
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
   * Footer — fade in
   * -------------------------------------------------------------------------- */
  function initFooter() {
    var footer = document.querySelector('#footer');
    if (footer && !prefersReducedMotion) {
      gsap.from(footer, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: footer,
          start: 'top 90%',
          toggleActions: 'play none none none'
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
   * Nav — sticky behavior
   * -------------------------------------------------------------------------- */
  function initNav() {
    var subnav = document.querySelector('.nasdaq-subnav');
    if (!subnav) return;

    /* The subnav is sticky; add shadow when scrolled */
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        subnav.classList.add('bp-nav-scrolled');
      } else {
        subnav.classList.remove('bp-nav-scrolled');
      }
    }, { passive: true });
  }

  /* --------------------------------------------------------------------------
   * Lottie scroll arrow — CSS-based fallback for the Lottie animation
   * -------------------------------------------------------------------------- */
  function initScrollArrow() {
    var lotties = document.querySelectorAll('.lottie-open');
    lotties.forEach(function (lottie) {
      /* Replace with a CSS animated arrow */
      lottie.innerHTML = '<svg width="24" height="40" viewBox="0 0 24 40" style="animation: bp-bounce 1.5s ease-in-out infinite;"><path d="M12 0 L12 32 M6 26 L12 38 L18 26" stroke="#0092BC" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    });

    /* Inject the keyframes once */
    if (!document.getElementById('bp-scroll-keyframes')) {
      var style = document.createElement('style');
      style.id = 'bp-scroll-keyframes';
      style.textContent = '@keyframes bp-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }';
      document.head.appendChild(style);
    }
  }

  /* --------------------------------------------------------------------------
   * Initialise everything
   * -------------------------------------------------------------------------- */
  function init() {
    initHero();
    initThoughtLeadership();
    initClientSpotlights();
    initSolutions();
    initFooter();
    initNav();
    initScrollArrow();

    /* Refresh ScrollTrigger after all animations are set up */
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }

  /* Start */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
