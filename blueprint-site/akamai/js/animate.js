(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  (function heroVideo() {
    var video = document.querySelector('.background-video video');
    var fallback = document.querySelector('.background-image');
    if (!video || !fallback) return;

    var failed = false;
    function showFallback() {
      if (failed) return;
      failed = true;
      video.style.display = 'none';
      fallback.style.display = 'flex';
    }

    video.addEventListener('error', showFallback);
    video.addEventListener('suspend', function () {
      setTimeout(function () { if (video.paused) showFallback(); }, 500);
    });

    var p = video.play();
    if (p && p.catch) p.catch(showFallback);

    setTimeout(function () {
      var t0 = video.currentTime;
      setTimeout(function () {
        if (video.paused || video.currentTime === t0) showFallback();
      }, 1000);
    }, 3000);
  })();

  (function motion() {
    if (typeof gsap === 'undefined') return;
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

    if (reduced) return;

    gsap.from('.head-content .category, .head-content .heading', {
      yPercent: 60, opacity: 0, scale: 0.95, duration: 1.6, stagger: 0.15, ease: 'expo.out'
    });
    gsap.from('.head-content .head-paragraph', {
      y: 40, opacity: 0, duration: 1.4, delay: 0.3, ease: 'power2.out'
    });

    if (typeof ScrollTrigger === 'undefined') return;

    function reveal(selector, vars) {
      document.querySelectorAll(selector).forEach(function (el) {
        if (el.closest('.tl-panel')) return;
        gsap.from(el, Object.assign({
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        }, vars));
      });
    }

    reveal('.tl-headline, .cs-headline, .solutions-headline', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out' });
    reveal('.tl-intro, .text-intro', { y: 30, opacity: 0, duration: 1.4, ease: 'power2.out' });
    reveal('.bp-video', { scale: 0.98, opacity: 0, duration: 1.2, ease: 'power2.out' });
    reveal('.quote-wrap, .quote-wrap-mobile', { x: -50, opacity: 0, duration: 1, ease: 'power2.out' });
    reveal('.ancillary-link, .solutions-body-link', { opacity: 0, duration: 0.8, ease: 'power2.out' });

    [['.solutions-grid', '.sol-building'],
     ['.solutions-grid-mobile', '.sol-building-mobile'],
     ['.playlist-carousel', '.playlist-item'],
     ['.client-spotlights-archive', '.cs-video.visible'],
     ['.portraits-container', '.tl-card']
    ].forEach(function (pair) {
      var host = document.querySelector(pair[0]);
      if (!host) return;
      var kids = host.querySelectorAll(pair[1]);
      if (!kids.length) return;
      gsap.from(kids, {
        y: 40, scale: 0.95, opacity: 0, duration: 1, stagger: 0.15, ease: 'back.out(1.2)',
        scrollTrigger: { trigger: host, start: 'top 80%', once: true }
      });
    });
  })();

  (function swiper() {
    if (typeof Swiper === 'undefined') return;
    var isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobileDevice) return;

    var grid = document.querySelector('.solutions-grid-mobile');
    if (!grid || grid.classList.contains('swiper-initialized')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    Array.prototype.slice.call(grid.children).forEach(function (child) {
      var slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.appendChild(child);
      wrapper.appendChild(slide);
    });
    grid.innerHTML = '';
    grid.appendChild(wrapper);
    grid.classList.add('swiper');

    new Swiper('.solutions-grid-mobile', {
      slidesPerView: 1,
      spaceBetween: 32,
      grabCursor: true,
      resistanceRatio: 0.85,
      speed: 400,
      longSwipes: false,
      threshold: 10
    });
    grid.classList.add('swiper-initialized');
  })();
})();
