/* Nongki — global theme JS.
   Small per-section "islands". Each island activates when its markup is
   on the page. No external libs: the mockup's GSAP/Locomotive/Matter
   effects are replaced with CSS animations + tiny scroll handlers. */

(function () {
  'use strict';

  /* ---- Fixed nav ↔ sliding page coordination ------------------------------
     The nav is position:fixed, but an open drawer transforms [data-main],
     which turns fixed into wrapper-relative. nav-follow pins the nav at the
     scroll offset captured on open so it rides the slide, and lets the
     close transition finish before going back to fixed. */
  var navFollowT = null;
  function navFollowOn() {
    clearTimeout(navFollowT);
    // while the body is locked (phone drawers) scrollY reads 0 — keep the
    // offset captured at lock time instead of recapturing
    if (!scrollLocked) document.body.style.setProperty('--nav-scroll-top', window.scrollY + 'px');
    document.body.classList.add('nav-follow');
  }
  function navFollowOff() {
    clearTimeout(navFollowT);
    navFollowT = setTimeout(function () { document.body.classList.remove('nav-follow'); }, 720);
  }

  /* ---- Phone scroll lock ---------------------------------------------------
     ≤767 the menu overlays the page instead of sliding it, so the body
     is pinned (position:fixed at the captured offset) while one is open:
     the page can't scroll behind the sheet, and embedded iframes (Shop
     login) see a zero window scroll offset, which keeps iOS tap mapping
     exact. Desktop keeps the underlay slide and never locks. */
  var isPhone = function () { return window.matchMedia('(max-width: 767px)').matches; };
  var lockY = 0, scrollLocked = false;
  function lockScroll() {
    if (scrollLocked || !isPhone()) return;
    scrollLocked = true;
    lockY = window.scrollY;
    document.body.style.top = -lockY + 'px';
    document.body.classList.add('scroll-locked');
  }
  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, lockY);
    if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(lockY, { immediate: true });
  }

  /* Nav tuck: inside the page's first section (hero/header) the nav is
     always shown; past it, scrolling down fades the nav out and any
     scroll up brings it back. Drawers force it visible. */
  function initNavTuck() {
    if (document.body.dataset.navTuckBound) return;
    document.body.dataset.navTuckBound = '1';
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var lastY = window.scrollY, ticking = false, heroB = 0;
    function measureHero() {
      // capped at one viewport: some templates are a single giant section,
      // which would otherwise keep the nav pinned for the whole page
      var main = document.getElementById('MainContent');
      var first = main && main.firstElementChild;
      var b = first ? first.offsetTop + first.offsetHeight : 600;
      heroB = Math.min(b, window.innerHeight);
    }
    // measured on load and resize, not on every scroll frame
    measureHero();
    window.addEventListener('resize', measureHero);
    window.addEventListener('load', measureHero);
    function update() {
      ticking = false;
      var y = window.scrollY;
      var open = document.body.dataset.menuStatus === 'open' ||
        document.body.classList.contains('nav-follow');
      if (open || y <= 0 || y < heroB) { nav.classList.remove('is-tucked'); lastY = y; return; }
      // 6px dead zone so tiny jitter (iOS momentum wobble) can't flicker it
      if (y > lastY + 6) nav.classList.add('is-tucked');
      else if (y < lastY - 6) nav.classList.remove('is-tucked');
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* Opt-in one-line page-header titles: nowrap + shrink the script font
     until the line fits its box (waits for the webfont so measurements
     use real metrics; re-fits on resize). */
  function initOneLineTitles(root) {
    var els = (root.querySelectorAll ? root : document).querySelectorAll('.page-header__title--one-line');
    if (!els.length) return;
    function fit(el) {
      el.style.fontSize = '';
      var box = el.parentElement.clientWidth;
      var size = parseFloat(getComputedStyle(el).fontSize);
      for (var i = 0; i < 14 && el.scrollWidth > box; i++) {
        size *= 0.94;
        el.style.fontSize = size + 'px';
      }
    }
    function all() { els.forEach(fit); }
    all();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
    if (!document.body.dataset.oneLineBound) {
      document.body.dataset.oneLineBound = '1';
      window.addEventListener('resize', all);
    }
  }

  /* ---- Underlay menu ---------------------------------------------------- */
  function initMenu(root) {
    // Underlay pattern: the drawers must sit OUTSIDE the transformed
    // [data-main] wrapper (they render inside sections, so relocate them).
    document.querySelectorAll('[data-main] .underlay-nav__menu, [data-main] .underlay-nav__overlay')
      .forEach(function (el) { document.body.appendChild(el); });
    var menuEl = document.querySelector('.underlay-nav__menu');
    var lastTrigger = null;

    function syncToggles(open) {
      document.querySelectorAll('[data-menu-toggle]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
      });
    }

    function openMenu(trigger) {
      lastTrigger = trigger || document.querySelector('[data-menu-toggle]');
      navFollowOn();
      lockScroll();
      document.body.dataset.menuStatus = 'open';
      var mainEl = document.querySelector('[data-main]');
      if (mainEl) mainEl.inert = true;
      if (menuEl) menuEl.setAttribute('aria-hidden', 'false');
      syncToggles(true);
      if (menuEl) {
        var firstTarget = isPhone()
          ? (menuEl.querySelector('[data-menu-close]') || menuEl.querySelector('a, button'))
          : (menuEl.querySelector('.underlay-nav__link-large, a, button'));
        if (firstTarget && typeof firstTarget.focus === 'function') {
          setTimeout(function () { firstTarget.focus(); }, 60);
        }
      }
    }

    function closeMenu(restoreFocus) {
      if (document.body.dataset.menuStatus !== 'open') return;
      navFollowOff();
      unlockScroll();
      document.body.dataset.menuStatus = 'closed';
      var mainEl = document.querySelector('[data-main]');
      if (mainEl) mainEl.inert = false;
      if (menuEl) menuEl.setAttribute('aria-hidden', 'true');
      syncToggles(false);
      if (restoreFocus && lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
      lastTrigger = null;
    }

    root.querySelectorAll('[data-menu-toggle]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (document.body.dataset.menuStatus === 'open') closeMenu(false);
        else openMenu(btn);
      });
    });
    root.querySelectorAll('[data-menu-close]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      el.addEventListener('click', function () {
        var href = el.getAttribute && el.getAttribute('href');
        var isInPageHash = href && href.charAt(0) === '#';
        closeMenu(!isInPageHash);
      });
    });

    if (!document.body.dataset.menuKeysBound) {
      document.body.dataset.menuKeysBound = '1';
      document.addEventListener('keydown', function (e) {
        if (document.body.dataset.menuStatus !== 'open') return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMenu(true);
          return;
        }
        if (e.key === 'Tab' && menuEl) {
          var focusables = Array.prototype.slice.call(
            menuEl.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
          ).filter(function (node) { return node.offsetParent !== null || getComputedStyle(node).position === 'fixed'; });
          if (!focusables.length) return;
          var first = focusables[0];
          var last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }
  }

  /* ---- Reviews marquee ------------------------------------------------------
     Duplicated track driven by rAF in pixels with modulo wrapping — the
     CSS keyframe version translated a ~6000px composited layer by
     percentages, which iOS Safari intermittently renders blank. Constant
     px/s speed (slower on phones), hover pause, reduced-motion static. */
  function isHiddenTree(el) {
    return !!(el && el.closest && el.closest('[hidden]'));
  }

  function initMarquee(root) {
    root.querySelectorAll('[data-marquee]').forEach(function (track) {
      if (isHiddenTree(track)) return;
      if (track.dataset.bound) return; track.dataset.bound = '1';
      track.innerHTML += track.innerHTML;
      var wrap = track.parentElement;
      // loop period = one full copy INCLUDING the gap that follows it —
      // scrollWidth/2 is a card-gap short and causes a visible tick on wrap
      function period() {
        var kids = track.children;
        var mid = kids.length / 2;
        return kids.length > 1 ? kids[mid].offsetLeft - kids[0].offsetLeft : 0;
      }
      // reduced motion: no auto-scroll (phones get a native swipe row in CSS)
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var x = 0, last = null, paused = false, dragX = null, resumeT = 0;
      function wrapX(p) { if (p > 0) { while (x <= -p) x += p; while (x > 0) x -= p; } }
      if (wrap) {
        wrap.addEventListener('mouseenter', function () { paused = true; });
        wrap.addEventListener('mouseleave', function () { paused = false; });
        // touch: a sideways drag moves the row with the finger (vertical
        // swipes still scroll the page, touch-action:pan-y); autoplay resumes
        // a beat after release
        wrap.addEventListener('touchstart', function (e) { dragX = e.touches[0].clientX; paused = true; clearTimeout(resumeT); }, { passive: true });
        wrap.addEventListener('touchmove', function (e) {
          if (dragX == null) return;
          var cx = e.touches[0].clientX; x += cx - dragX; dragX = cx;
          wrapX(period());
          track.style.transform = 'translate3d(' + x + 'px,0,0)';
        }, { passive: true });
        var release = function () { dragX = null; clearTimeout(resumeT); resumeT = setTimeout(function () { paused = false; last = null; }, 1200); };
        wrap.addEventListener('touchend', release);
        wrap.addEventListener('touchcancel', release);
      }
      function step(ts) {
        if (last == null) last = ts;
        var dt = (ts - last) / 1000; last = ts;
        var p = period();
        // skip runaway frames (tab was in the background)
        if (!paused && p > 0 && dt < 0.5) {
          x -= 42 * dt;
          wrapX(p);
          track.style.transform = 'translate3d(' + x + 'px,0,0)';
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ---- UFO featured-roast carousel ---------------------------------------- */
  function initUfo(root) {
    root.querySelectorAll('[data-ufo]').forEach(function (sec) {
      if (sec.dataset.bound) return; sec.dataset.bound = '1';
      var jsonEl = sec.querySelector('[data-ufo-json]');
      if (!jsonEl) return;
      var slides = JSON.parse(jsonEl.textContent);
      var idx = 0, n = slides.length;
      if (!n) return;
      var bags = sec.querySelectorAll('[data-ufo-bag]');
      function apply() {
        bags.forEach(function (bag, i) {
          var d = i - idx;
          if (d > n / 2) d -= n; if (d < -n / 2) d += n;
          var abs = Math.abs(d);
          bag.dataset.slot = Math.max(-2, Math.min(2, d));
          bag.style.zIndex = 10 - abs;
          // only the centre bag navigates, so only it advertises "Lihat Kafe"
          if (d === 0) {
            bag.setAttribute('data-pop', 'Lihat Kafe');
            bag.setAttribute('data-pop-bg', '#f0ede8');
            bag.setAttribute('data-pop-fg', '#1a1a1a');
          } else {
            bag.removeAttribute('data-pop');
          }
        });
        sec.querySelectorAll('[data-ufo-detail]').forEach(function (detail, i) {
          detail.hidden = i !== idx;
          if (i === idx) {
            detail.style.animation = 'none'; void detail.offsetWidth;
            detail.style.animation = 'ac-fade-in .6s ease';
          }
        });
        var s = slides[idx];
        var beam = sec.querySelector('[data-ufo-beam]');
        if (beam) beam.style.background = s.color;
        sec.querySelectorAll('[data-ufo-particles] circle').forEach(function (c) { c.setAttribute('fill', s.color); });
      }
      sec.addEventListener('click', function (e) {
        if (e.target.closest('[data-ufo-prev]')) { idx = (idx - 1 + n) % n; apply(); return; }
        if (e.target.closest('[data-ufo-next]')) { idx = (idx + 1) % n; apply(); return; }
        var bag = e.target.closest('[data-ufo-bag]');
        if (bag) {
          var i = Array.prototype.indexOf.call(bags, bag);
          if (i === idx) { if (!bag.hasAttribute('data-select-city') && slides[i].url && slides[i].url.charAt(0) === '#') { var target = document.querySelector(slides[i].url); if (target) target.scrollIntoView({ behavior: 'smooth' }); } }
          else { e.stopPropagation(); idx = i; apply(); }
        }
      });
      apply();
      sec.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var bag = e.target.closest('[data-ufo-bag]');
        if (bag) { e.preventDefault(); bag.click(); }
      });
      // centre-bag float: a JS sine riding inside the slot transform (via
      // --ufo-float), like the mockup — a CSS keyframe would stomp the
      // slot transition and make rotations snap.
      if (!isHiddenTree(sec) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var floatStart = performance.now();
        (function floatTick(t) {
          if (!document.body.contains(sec)) return;
          sec.style.setProperty('--ufo-float', (Math.sin(((t || floatStart) - floatStart) / 1400) * 7).toFixed(2) + 'px');
          requestAnimationFrame(floatTick);
        })(floatStart);
      }
    });
  }

  /* ---- Sticky steps (What Fuels You) -------------------------------------- */
  function initStickySteps(root) {
    root.querySelectorAll('[data-sticky-steps]').forEach(function (wrap) {
      if (wrap.dataset.bound) return; wrap.dataset.bound = '1';
      var items = wrap.querySelectorAll('[data-sticky-steps-item]');
      if (!('IntersectionObserver' in window) || !items.length) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            items.forEach(function (it) {
              // FOLLOWING = the active item comes after `it`, so `it` was
              // already scrolled past ('before'); upcoming items are 'after'
              // and stay hidden until they take over.
              var pos = it.compareDocumentPosition(en.target);
              it.dataset.stickyStepsItemStatus =
                it === en.target ? 'active' : (pos & Node.DOCUMENT_POSITION_FOLLOWING ? 'before' : 'after');
            });
          }
        });
      }, { rootMargin: '-45% 0px -45% 0px' });
      items.forEach(function (it) { io.observe(it); });

      // desktop auto scroll-snapping intentionally disabled so deliberate scrolling is never hijacked

      // phones + tablets: the cards stack (sticky, CSS). As the incoming card slides
      // over, the outgoing one fades with how much it covers
      var mq = window.matchMedia('(max-width: 1023px)');
      var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // touch screens: the cards stack without the fade (iOS Safari painted the
      // fading pinned cards cut off); they only need --h for the stick line and
      // one shared height, so a shorter card fully covers the one beneath it
      if (window.matchMedia('(hover: none)').matches) {
        var even = function () {
          items.forEach(function (it) { it.style.minHeight = ''; });
          if (!mq.matches) return;
          var tall = 0;
          items.forEach(function (it) { tall = Math.max(tall, it.offsetHeight); });
          items.forEach(function (it) { it.style.minHeight = tall + 'px'; it.style.setProperty('--h', tall + 'px'); });
        };
        // iOS fires resize as its toolbar shows and hides: only a width change re-measures
        var evenT = 0, evenW = window.innerWidth;
        window.addEventListener('resize', function () {
          if (window.innerWidth === evenW) return;
          evenW = window.innerWidth; clearTimeout(evenT); evenT = setTimeout(even, 150);
        });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(even);
        window.addEventListener('load', even);
        even();
        return;
      }
      if (still || items.length < 2) return;
      // Smooth on phones: the sticky offset and card heights are measured once
      // (and on resize), each frame reads every card's position first and only
      // then writes opacity (compositor-only), skipping cards whose progress
      // hasn't changed, so scrolling never forces a layout per card. Opacity
      // only, never scale: resizing a pinned card per frame juddered on iOS.
      var raf = 0, tops = [], hs = [], last = [];
      function measure() {
        // heights first (as --h, which the stick line reads), then the lines
        items.forEach(function (it, i) { hs[i] = it.offsetHeight || 1; it.style.setProperty('--h', hs[i] + 'px'); });
        items.forEach(function (it, i) {
          tops[i] = parseFloat(getComputedStyle(it).top) || 0;
        });
      }
      function reset() {
        items.forEach(function (it, i) { it.style.opacity = ''; last[i] = 0; });
      }
      function paint() {
        raf = 0;
        if (!mq.matches) return;
        var ys = [];
        for (var k = 1; k < items.length; k++) ys[k] = items[k].getBoundingClientRect().top;
        for (var i = 0; i < items.length - 1; i++) {
          var p = Math.max(0, Math.min(1, (tops[i] + hs[i] - ys[i + 1]) / hs[i]));
          p = Math.round(p * 500) / 500;
          if (p === last[i]) continue;
          last[i] = p;
          // fully gone by 70% of the cover, so nothing of it shows behind the incoming card
          items[i].style.opacity = p ? String(Math.max(0, 1 - p / 0.7)) : '';
        }
      }
      function queue() { if (!raf) raf = requestAnimationFrame(paint); }
      // iOS fires resize whenever its toolbar shows or hides mid-scroll: re-measure
      // and repaint in place. Clearing the fades first flashed the covered cards
      // back to full strength for a frame.
      function refit() {
        if (!mq.matches) { reset(); return; }
        measure();
        for (var j = 0; j < last.length; j++) last[j] = -1;
        queue();
      }
      window.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', refit);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
      refit();
    });
  }

  /* ---- Horizontal timeline (scroll-driven, vanilla) ------------------------
     Distances are measured once (and again on resize or when the page above
     changes height); scrolling then only moves the track and backdrop by
     transform. Browsers with scroll timelines run the movement in CSS (the
     timeline section's styles read --tl-x / --tl-bx), off the main thread;
     the rest get the same movement from a scroll listener. Measuring on every
     scroll frame, and resizing the backdrop on each, made it judder on iOS. */
  function initTimeline(root) {
    root.querySelectorAll('[data-timeline]').forEach(function (sec) {
      if (isHiddenTree(sec)) return;
      if (sec.dataset.bound) return; sec.dataset.bound = '1';
      var track = sec.querySelector('[data-timeline-track]');
      var bg = sec.querySelector('[data-timeline-bg]');
      var pin = sec.querySelector('[data-timeline-pin]');
      if (!track) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      // touch screens swipe the cards natively (timeline section styles)
      if (window.matchMedia('(hover: none)').matches) return;
      var cssDriven = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
      var top = 0, scrollable = 1, x = 0, bx = 0, phone = false, ticking = false, mt = 0;
      function measure() {
        mt = 0;
        var pinH = pin ? pin.offsetHeight : window.innerHeight;
        scrollable = Math.max(1, sec.offsetHeight - pinH);
        top = sec.getBoundingClientRect().top + window.scrollY;
        phone = window.innerWidth < 768;
        // travel to the last card's right edge plus the track's end padding,
        // measured directly: Safari leaves a flex row's end padding out of
        // scrollWidth, which parked the last card flush against the edge
        var last = track.lastElementChild;
        var padR = parseFloat(getComputedStyle(track).paddingRight) || 0;
        var end = last ? last.offsetLeft + last.offsetWidth + padR : track.scrollWidth;
        x = Math.max(0, end - window.innerWidth);
        if (bg) {
          var bgW = bg.offsetHeight * (3168 / 1344);
          bg.style.width = bgW + 'px';
          bx = Math.max(0, bgW - window.innerWidth);
        }
        sec.style.setProperty('--tl-x', x + 'px');
        sec.style.setProperty('--tl-bx', bx + 'px');
        paint();
      }
      function paint() {
        ticking = false;
        if (cssDriven) return;
        var p = Math.min(1, Math.max(0, (window.scrollY - top) / scrollable));
        // phones: the cards finish their run at 88% of the scroll, so the
        // last one holds in place for a beat before the page moves on
        if (phone) p = Math.min(1, p / 0.88);
        track.style.transform = 'translate3d(' + (-p * x) + 'px,0,0)';
        if (bg) bg.style.transform = 'translate3d(' + (-p * bx) + 'px,0,0)';
      }
      function queueMeasure() { if (!mt) mt = requestAnimationFrame(measure); }
      if (!cssDriven) window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(paint); }
      }, { passive: true });
      window.addEventListener('resize', queueMeasure);
      window.addEventListener('load', queueMeasure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);
      // anything above growing (images, fonts, reveals) moves the section's start
      if (window.ResizeObserver) new ResizeObserver(queueMeasure).observe(document.body);
      measure();
    });
  }

  /* ---- Smooth scroll-to buttons ---------------------------------------------- */
  function initScrollTo(root) {
    root.querySelectorAll('[data-scroll-to]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var el = document.querySelector(btn.dataset.scrollTo);
        if (!el) return;
        if (window.__lenis) window.__lenis.scrollTo(el);
        else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---- Smooth scrolling (Lenis) --------------------------------------------
     The mockup runs Locomotive Scroll v5 — a thin wrapper around Lenis with
     its default options — so the theme ships Lenis itself (assets/lenis.min.js,
     loaded before theme.js in theme.liquid) and initializes it the same way.
     Lenis eases the native scroll position, so position:sticky (the timeline,
     the pillars) and the browser-owned scrollbar keep working, and touch
     input stays native. Containers marked data-lenis-prevent (menu,
     modals) scroll natively; it stands down under prefers-reduced-motion. */
  var smoothStarted = false;
  function initSmoothScroll() {
    if (smoothStarted) return; smoothStarted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // touch screens scroll natively: Lenis never eases touch, and running it
    // there only added a second scroll loop beside iOS Safari's own momentum
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var tries = 0;
    (function boot() {
      if (!window.Lenis) {
        if (tries++ < 50) setTimeout(boot, 100);
        return;
      }
      /* lerp 0.07 glides longer than the Lenis/Locomotive default (0.1) —
         requested floatier feel beyond mockup parity */
      window.__lenis = new window.Lenis({ autoRaf: true, anchors: true, lerp: 0.07 });
    })();
  }

  /* ---- Stop-motion bean fields (ports the mockup's BeanField) --------------
     Beans pop in/out on steps() timing and re-roll their position every
     cycle, keeping a clear gap (28px; 16px on fast fields) between the
     whole bean and every rect measured from [data-bean-avoid] content, and
     off any bean currently visible — so they never sit on copy, bags or
     controls.
     The server-rendered CSS scatter stays as the no-JS fallback. */
  function initBeanFields(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-bean-field]').forEach(function (field) {
      if (isHiddenTree(field)) return;
      if (field.dataset.bound) return; field.dataset.bound = '1';
      var host = field.parentElement;
      var beans = Array.prototype.slice.call(field.querySelectorAll('img'));
      if (!beans.length) return;
      field.classList.add('bean-field--js');

      var fast = field.dataset.tempo === 'fast';
      var ON = fast ? [650, 1300] : [1800, 3000];
      var OFF = fast ? [220, 520] : [360, 720];
      // clear gap (px) kept between a bean's edge and any avoided content
      var GAP = fast ? 16 : 28;
      var sideBias = field.dataset.sideBias === 'edges' ? 0.45 : 0;

      var avoid = [];
      var dims = { w: 1, h: 1 };
      function measure() {
        var wr = field.getBoundingClientRect();
        if (!wr.width || !wr.height) return;
        dims = { w: wr.width, h: wr.height };
        avoid = [];
        // rects in px from the field's corner; a wrapper with no box of its
        // own (display:contents, as the PDP columns are on tablet) is
        // measured through its children so its content is still avoided
        function add(el) {
          var r = el.getBoundingClientRect();
          if (!r.width || !r.height) {
            if (getComputedStyle(el).display === 'contents') Array.prototype.forEach.call(el.children, add);
            return;
          }
          avoid.push({ x0: r.left - wr.left, y0: r.top - wr.top, x1: r.right - wr.left, y1: r.bottom - wr.top });
        }
        host.querySelectorAll('[data-bean-avoid]').forEach(add);
        // the fixed nav's buttons and seal float over the top of the page
        document.querySelectorAll('.site-nav a, .site-nav button').forEach(add);
      }
      measure();
      setTimeout(measure, 300); setTimeout(measure, 900);   // fonts/images settle
      window.addEventListener('resize', measure);

      var rnd = function (a, b) { return a + Math.random() * (b - a); };
      var scale = isPhone() ? 0.72 : 1;
      var lastY = window.scrollY;               // phones draw beans at 72% (CSS)
      // off screen the field rests (no pops, no measuring); measuring waits until
      // scrolling stops, since reading positions mid-scroll stalled iOS Safari
      var visible = true, scrolledAt = 0;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { rootMargin: '120px 0px' }).observe(field);
      }
      window.addEventListener('scroll', function () { scrolledAt = Date.now(); }, { passive: true });
      var slots = beans.map(function () { return { left: 50, top: 50, size: 40, on: false }; });

      function claim(i) {
        var size = rnd(34, 62);                       // mockup re-rolls 34-62px per pop
        if (window.scrollY !== lastY && Date.now() - scrolledAt > 180) { lastY = window.scrollY; measure(); }  // nav is fixed: re-measure after scrolling
        for (var tries = 0; tries < 80; tries++) {
          var left = (sideBias > 0 && Math.random() < sideBias)
            ? (Math.random() < 0.5 ? rnd(2, 24) : rnd(76, 98))
            : rnd(3, 97);
          var top = rnd(4, 95);
          var ok = true;
          // the whole bean (its drawn size, shadow included) must stay GAP px
          // clear of every avoided rect, not just its centre point
          var x = left / 100 * dims.w, y = top / 100 * dims.h;
          // beans are a touch taller than wide and spin up to ±50°: allow for
          // the rotated box, not just the width
          var half = size * scale * 0.8 + 5;
          for (var a = 0; a < avoid.length; a++) {
            var r = avoid[a];
            if (x + half > r.x0 - GAP && x - half < r.x1 + GAP && y + half > r.y0 - GAP && y - half < r.y1 + GAP) { ok = false; break; }
          }
          if (ok) {
            for (var j = 0; j < slots.length; j++) {
              if (j === i || !slots[j].on) continue;
              var sx = slots[j].left / 100 * dims.w, sy = slots[j].top / 100 * dims.h;
              if (Math.abs(x - sx) < (size + slots[j].size) / 2 * scale * 0.9 &&
                Math.abs(y - sy) < (size + slots[j].size) / 2 * scale * 0.9) { ok = false; break; }
            }
          }
          if (ok) return { left: left, top: top, size: size };
        }
        return null;                                  // no clear spot — sit this cycle out
      }

      beans.forEach(function (bean, i) {
        function appear() {
          if (!document.body.contains(field)) return;  // section re-rendered in editor
          if (!visible) { setTimeout(appear, 600); return; }
          var spot = claim(i);
          if (spot) {
            slots[i] = { left: spot.left, top: spot.top, size: spot.size, on: true };
            bean.style.left = spot.left + '%';
            bean.style.top = spot.top + '%';
            bean.style.setProperty('--br', Math.round(rnd(-50, 50)) + 'deg');
            bean.style.setProperty('--bw', Math.round(spot.size) + 'px');
            bean.classList.add('is-on');
          }
          setTimeout(disappear, rnd(ON[0], ON[1]));
        }
        function disappear() {
          slots[i].on = false;
          bean.classList.remove('is-on');
          setTimeout(appear, rnd(OFF[0], OFF[1]));
        }
        setTimeout(appear, i * 200 + rnd(0, 300));
      });
    });
  }


  /* ---- Masked split-text heading reveal ------------------------------------
     Vanilla port of the mockup's GSAP SplitText: words are wrapped in
     overflow-hidden masks and slide up with a small stagger the first time
     the heading scrolls into view. Nested elements (script spans) reveal as
     a single unit; <br> is preserved. */
  /* Arrival after an in-site link: the page may load under a cover,
     so entrances wait for it to start lifting (ac:uncover) instead of
     finishing out of sight. */
  function whenUncovered(fn) {
    var pt = document.querySelector('[data-pt]');
    if (!pt || !pt.classList.contains('is-cover')) { fn(); return; }
    var ran = false;
    var go = function () { if (!ran) { ran = true; fn(); } };
    window.addEventListener('ac:uncover', go, { once: true });
    setTimeout(go, 2600);   // the cover always lifts by then
  }

  function initSplitReveal(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els = root.querySelectorAll ? root.querySelectorAll('[data-split]') : [];
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('sr-off'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -20% 0px' });
    els.forEach(function (el) {
      if (el.dataset.srBound) return; el.dataset.srBound = '1';
      var idx = 0;
      function wrap(node) {
        var mask = document.createElement('span');
        mask.className = 'sr-mask';
        var word = document.createElement('span');
        word.className = 'sr-word';
        word.style.setProperty('--sr-d', (idx * 0.06).toFixed(2) + 's');
        idx++;
        mask.appendChild(word);
        node.parentNode.insertBefore(mask, node);
        word.appendChild(node);
        return mask;
      }
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          var parts = node.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var mask = document.createElement('span');
            mask.className = 'sr-mask';
            var word = document.createElement('span');
            word.className = 'sr-word';
            word.style.setProperty('--sr-d', (idx * 0.06).toFixed(2) + 's');
            idx++;
            word.textContent = p;
            mask.appendChild(word);
            frag.appendChild(mask);
          });
          node.parentNode.replaceChild(frag, node);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          wrap(node);
        }
      });
      el.classList.add('is-split');
    });
    // headings already on screen play right away (a hero title low in the
    // first screen would otherwise sit hidden below the trigger line); the
    // rest reveal as they scroll up into the top 80% of the viewport
    whenUncovered(function () {
      els.forEach(function (el) {
        if (!el.classList.contains('is-split') || el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in'); else io.observe(el);
      });
    });
  }


  /* ---- Manifesto: kata-kata menyala mengikuti scroll ------------------ */
  /* ---- Kicker chips: orange brush stroke draws in on scroll ---------------- */
  function initLblDraw(root) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      [].forEach.call(root.querySelectorAll('.lbl'), function (el) { el.classList.add('is-drawn'); });
      return;
    }
    if (!('IntersectionObserver' in window)) {
      [].forEach.call(root.querySelectorAll('.lbl'), function (el) { el.classList.add('is-drawn'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-drawn'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    [].forEach.call(root.querySelectorAll('.lbl'), function (el) {
      if (el.dataset.lblBound) return;
      el.dataset.lblBound = '1';
      io.observe(el);
    });
  }

  function initMani(root) {
    if (!root.querySelector) return;
    if (window.matchMedia('(max-width: 767px)').matches) return; // ditangani home-m.js
    var mani = root.querySelector('.mani[data-mani="desktop"]');
    if (!mani) return;
    var words = [].slice.call(mani.querySelectorAll('.w'));
    if (!words.length) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      words.forEach(function (w) {
        w.style.opacity = 1;
        if (w.closest && w.closest('.mk')) w.classList.add('is-ink');
      });
      [].forEach.call(mani.querySelectorAll('.mk'), function (m) { m.classList.add('is-on'); });
      return;
    }
    var maniText = mani.querySelector('.mani__text');
    var marks = [].slice.call(mani.querySelectorAll('.mk')).map(function (el) {
      var ws = el.querySelectorAll('.w');
      return { el: el, first: words.indexOf(ws[0]), last: words.indexOf(ws[ws.length - 1]) };
    });
    function measureMarks() {
      if (!maniText) return;
      var base = maniText.getBoundingClientRect();
      [].slice.call(maniText.querySelectorAll('.mk__cov')).forEach(function (c) { c.remove(); });
      marks.forEach(function (m) {
        var acc = 0;
        m.covers = [].slice.call(m.el.getClientRects()).map(function (r) {
          var el = document.createElement('i'); el.className = 'mk__cov'; maniText.appendChild(el);
          var c = { el: el, x: r.left - base.left - 3, y: r.top - base.top - 3, w: r.width + 6, h: r.height + 6, before: acc };
          acc += c.w; el.style.top = c.y + 'px'; el.style.left = c.x + 'px'; el.style.width = c.w + 'px'; el.style.height = c.h + 'px';
          return c;
        });
        m.total = acc; m.shown = -1;
      });
    }
    function scrubMark(m, f) {
      if (!m.covers || Math.abs(f - m.shown) < 0.001) return;
      m.shown = f;
      var L = f * m.total;
      m.covers.forEach(function (c) {
        var rev = Math.max(0, Math.min(c.w, L - c.before));
        c.el.style.left = (c.x + rev) + 'px';
        c.el.style.width = Math.max(0, c.w - rev) + 'px';
      });
    }
    var frame = function () {
      var r = mani.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var start = vh * 0.8;
      var end = Math.min(vh * 0.08, Math.max(-80, vh - (r.height || 320) - 24));
      var span = Math.max(220, start - end);
      var p = Math.max(0, Math.min(1, (start - r.top) / span));
      var lit = p * words.length;
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        w.style.opacity = (0.22 + 0.78 * Math.max(0, Math.min(1, lit - i))).toFixed(3);
        if (w.closest && w.closest('.mk')) w.classList.toggle('is-ink', lit > i + 0.15);
        if (w.classList.contains('w--x')) w.style.setProperty('--xp', Math.max(0, Math.min(1, (lit - i - 0.15) / 0.85)).toFixed(3));
      }
      marks.forEach(function (m) {
        m.el.classList.toggle('is-on', lit >= m.last + 1);
        scrubMark(m, Math.max(0, Math.min(1, (lit - m.first) / Math.max(1, m.last + 1 - m.first))));
      });
    };
    var kick = function () { requestAnimationFrame(frame); };
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', function () { measureMarks(); kick(); });
    measureMarks(); frame();
    window.addEventListener('load', function () { measureMarks(); kick(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureMarks(); kick(); });
    setTimeout(function () { measureMarks(); kick(); }, 600);
  }

  /* ---- phone hero: "lazy susan" of best-selling roasts --------------------- */
  /* After Osmo's Depth Tiles loop: each bag's offset from the current position
     is clamped to [-2, 2] and mapped onto half an orbit (angle = rel/2 * PI),
     so the front bag is full size, one bag sits on each side, and the rest
     wait hidden behind the front one. Steps use the same "depth" ease
     (cubic-bezier .6,0,0,1) for 1.5s, then rest 3s. Each swipe moves one
     roast, tap a side bag to bring it forward, tap the front bag to open it. Touch
     pauses autoplay; off-screen, hidden tabs and reduced motion stop it. */
  function initHeroSusan(scope) {
    (scope || document).querySelectorAll('[data-hero-susan]').forEach(function (root) {
      if (root.__susan) return;
      root.__susan = true;
      var stage = root.querySelector('[data-susan-stage]');
      var items = [].slice.call(root.querySelectorAll('[data-susan-item]'));
      var n = items.length;
      if (!stage || !n) return;
      var cap = root.querySelector('[data-susan-cap]');
      var elRank = root.querySelector('[data-susan-rank]');
      var elName = root.querySelector('[data-susan-name]');
      var elMeta = root.querySelector('[data-susan-meta]');
      var elTrend = root.querySelector('[data-susan-trend]');
      var elPrice = root.querySelector('[data-susan-price]');
      var elLink = root.querySelector('[data-susan-link]');
      var X_MULT = 0.65, BACK = parseFloat(root.dataset.susanBack) || 0.5, ROT_Y = 5, MOVE = 1500, REST = parseInt(root.dataset.susanRest, 10) || 3000;
      // side spread comes from CSS (--susan-x): .65 on phones, wider on tablets
      // optional --susan-drop (px) sinks the front bag a touch, easing in as it turns forward
      var DROP = 0;
      function readSpread() {
        var cs = getComputedStyle(root);
        var v = parseFloat(cs.getPropertyValue('--susan-x')); X_MULT = isFinite(v) && v > 0 ? v : 0.65;
        var d = parseFloat(cs.getPropertyValue('--susan-drop')); DROP = isFinite(d) ? d : 0;
      }
      var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var pos = 0, front = -1, raf = 0, loop = 0, hold = 0, drag = null, dragged = false, onScreen = true, bw = 0;

      function bezier(x1, y1, x2, y2) {
        function bx(t) { return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; }
        function by(t) { return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; }
        return function (x) {
          var lo = 0, hi = 1, t = x;
          for (var i = 0; i < 22; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
          return by(t);
        };
      }
      var depthEase = bezier(0.6, 0, 0, 1);

      function caption(k) {
        var it = items[k];
        if (elRank) { elRank.textContent = '#' + (k + 1); elRank.setAttribute('aria-label', 'Kota urutan ' + (k + 1)); }
        if (elName) elName.textContent = it.dataset.name || '';
        if (elMeta) elMeta.textContent = it.dataset.meta || '';
        if (elTrend) { elTrend.hidden = !it.dataset.trend; elTrend.textContent = it.dataset.trend ? '▲ ' + it.dataset.trend + ' · ' : ''; }
        if (elPrice) elPrice.textContent = it.dataset.price || '';
        if (elLink) { elLink.href = it.getAttribute('href'); if (it.dataset.selectCity) elLink.dataset.selectCity = it.dataset.selectCity; else delete elLink.dataset.selectCity; }
        root.dispatchEvent(new CustomEvent('susan:front', { bubbles: true, detail: { index: k } }));
      }
      function render() {
        if (!bw) { bw = items[0].offsetWidth || 128; readSpread(); }
        var rx = bw * X_MULT;
        var f = ((Math.round(pos) % n) + n) % n;
        var depths = [];
        items.forEach(function (el, k) {
          var rel = k - pos;
          rel = ((rel + n / 2) % n + n) % n - n / 2;
          rel = Math.max(-2, Math.min(2, rel));
          var angle = rel / 2 * Math.PI;
          var depth = (Math.cos(angle) + 1) / 2;
          var x = rel <= -2 || rel >= 2 ? 0 : Math.sin(angle) * rx;
          var s = BACK + (1 - BACK) * depth;
          // short rings (e.g. 3 bundles) fade out before the wrap point so the back
          // item never jumps across in view
          var op = Math.max(0, Math.min(1, (Math.min(2, n / 2) - Math.abs(rel)) * 2));
          el.style.transform = 'translateX(calc(-50% + ' + x.toFixed(2) + 'px))' + (DROP ? ' translateY(' + (DROP * Math.max(0, 2 * depth - 1)).toFixed(2) + 'px)' : '') + ' perspective(1200px) rotateY(' + (Math.sin(angle) * -ROT_Y).toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
          el.style.opacity = op.toFixed(3);
          depths[k] = depth;
          el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
          el.setAttribute('aria-hidden', k === f ? 'false' : 'true');
          el.tabIndex = k === f ? 0 : -1;
        });
        // stacking order by depth, written only when it changes: rewriting every
        // bag's z-index on every frame made Safari rebuild the layers above them
        // (the arrows strobed)
        items.map(function (el, k) { return k; })
          .sort(function (a, b) { return depths[a] - depths[b]; })
          .forEach(function (k, rank) {
            var z = String(rank + 1);
            if (items[k].style.zIndex !== z) items[k].style.zIndex = z;
          });
        if (f !== front) { front = f; caption(f); }
        if (cap) {
          var c = Math.max(0, 1 - Math.abs(pos - Math.round(pos)) * 3);
          cap.style.opacity = c.toFixed(3);
          cap.style.transform = c < 1 ? 'translateY(' + ((1 - c) * 6).toFixed(1) + 'px)' : '';
        }
      }
      function spinTo(target, dur, ease, done) {
        cancelAnimationFrame(raf);
        var from = pos;
        if (rm || from === target) { pos = target; render(); if (done) done(); return; }
        var t0 = performance.now();
        (function tick(now) {
          var t = Math.min(1, (now - t0) / dur);
          pos = from + (target - from) * ease(t);
          render();
          if (t < 1) raf = requestAnimationFrame(tick);
          else if (done) done();
        })(t0);
      }
      function step() {
        clearTimeout(loop);
        if (rm || drag || !onScreen || document.hidden || Date.now() < hold || !root.offsetWidth) {
          loop = setTimeout(step, 500);
          return;
        }
        spinTo(Math.round(pos) + 1, MOVE, depthEase, function () { loop = setTimeout(step, REST); });
      }
      function userSpin(target) {
        hold = Date.now() + 2500;
        clearTimeout(loop);
        spinTo(target, 900, depthEase, function () { loop = setTimeout(step, 2500); });
      }
      function goTo(k) {
        var base = Math.round(pos);
        var d = (((k - base) % n) + n) % n;
        if (d > n / 2) d -= n;
        if (d) userSpin(base + d);
      }

      items.forEach(function (el, k) {
        el.addEventListener('click', function (e) {
          if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; return; }
          if (k !== front) { e.preventDefault(); e.stopPropagation(); goTo(k); }
        });
      });
      if (elLink) elLink.addEventListener('click', function (e) {
        if (typeof bagTransition === 'function') bagTransition(e, items[front]);
      });
      var prev = root.querySelector('[data-susan-prev]'), next = root.querySelector('[data-susan-next]');
      if (prev) prev.addEventListener('click', function () { userSpin(Math.round(pos) - 1); });
      if (next) next.addEventListener('click', function () { userSpin(Math.round(pos) + 1); });
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); userSpin(Math.round(pos) - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); userSpin(Math.round(pos) + 1); }
      });

      stage.addEventListener('pointerdown', function (e) {
        if (e.target.closest('[data-susan-prev],[data-susan-next]')) return;
        clearTimeout(loop);
        dragged = false;
        drag = { x: e.clientX, pos: pos, lx: e.clientX, lt: performance.now(), v: 0 };
        hold = Date.now() + 2500;
      });
      stage.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        if (Math.abs(dx) > 6) dragged = true;
        var now = performance.now();
        if (now > drag.lt) { drag.v = (e.clientX - drag.lx) / (now - drag.lt); drag.lx = e.clientX; drag.lt = now; }
        // the swipe is a gesture, not a drag: the ring holds still and the
        // release plays the same eased turn as the arrows
        drag.dx = dx;
      });
      function release(e) {
        if (!drag) return;
        var g = drag;
        drag = null;
        hold = Date.now() + 2500;
        // past 30px (or a quick flick) turns exactly one roast; a vertical
        // scroll takes the pointer (pointercancel) and turns nothing
        var dx = g.dx || 0, dir = 0;
        if (dragged && e.type !== 'pointercancel' && (Math.abs(dx) > 30 || Math.abs(g.v) > 0.35)) dir = (dx || -g.v) < 0 ? 1 : -1;
        if (dir) userSpin(Math.round(pos) + dir);
        else loop = setTimeout(step, 2500);
        if (e.type !== 'pointerup') dragged = false;
      }
      stage.addEventListener('pointerup', release);
      stage.addEventListener('pointercancel', release);
      stage.addEventListener('pointerleave', release);

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(stage);
      }
      window.addEventListener('resize', function () { bw = 0; render(); });
      render();
      loop = setTimeout(step, REST);
    });
  }

  /* ---- falling bean physics (Matter.js, mockup parity) --------------------- */
  /* Beans drop in staggered, bounce off each other and settle into a pile at
     the host's bottom edge — the mockup's initFallingStickers. Deferred until
     the host scrolls into view; skipped under prefers-reduced-motion. The
     sections that use it include matter.min.js themselves (defer), so wait
     for window.Matter before starting. */
  function startBeanPhysics(host) {
    if (host.__matterInit) return;
    if (!window.Matter) {
      host.__matterWait = (host.__matterWait || 0) + 1;
      if (host.__matterWait < 50) setTimeout(function () { startBeanPhysics(host); }, 200);
      return;
    }
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    var srcs = [];
    try { srcs = JSON.parse(host.dataset.beanImgs || '[]'); } catch (e) { }
    if (!srcs.length) return;
    host.__matterInit = true;
    var total = parseInt(host.dataset.beanTotal || '95', 10);
    var size = parseInt(host.dataset.beanSize || '64', 10);
    if (W < 768) { total = Math.min(total, 40); size = Math.min(size, 42); }
    Promise.all(srcs.map(function (src) {
      return new Promise(function (res) {
        var i = new Image();
        i.onload = function () { res({ src: src, w: i.naturalWidth || 256, h: i.naturalHeight || 256 }); };
        i.onerror = function () { res({ src: src, w: 256, h: 256 }); };
        i.src = src;
      });
    })).then(function (sizes) {
      var M = window.Matter;
      var engine = M.Engine.create();
      engine.world.gravity.y = 1.3;
      var render = M.Render.create({
        element: host, engine: engine,
        options: {
          background: 'transparent', wireframes: false, width: W, height: H,
          pixelRatio: Math.min(2, window.devicePixelRatio || 1)
        }
      });
      function rnd(min, max) { return Math.random() * (max - min) + min; }
      var ti = 0;
      function drop() {
        var s = sizes[ti % sizes.length]; ti++;
        var jitter = rnd(0.85, 1.15);
        var scale = (size * jitter) / Math.max(s.w, s.h);
        var w = s.w * scale, h = s.h * scale;
        M.Composite.add(engine.world, M.Bodies.rectangle(rnd(w / 2 + 8, W - w / 2 - 8), -h, w, h, {
          chamfer: { radius: Math.min(w, h) / 2.2 },
          restitution: 0.55, friction: 0.15, density: 0.0014,
          angle: rnd(-Math.PI, Math.PI),
          render: { sprite: { texture: s.src, xScale: scale, yScale: scale } }
        }));
      }
      var wall = 300;
      M.Composite.add(engine.world, [
        M.Bodies.rectangle(W / 2, H + wall / 2, W + wall * 2, wall, { isStatic: true, render: { visible: false } }),
        M.Bodies.rectangle(-wall / 2, H / 2, wall, H * 4, { isStatic: true, render: { visible: false } }),
        M.Bodies.rectangle(W + wall / 2, H / 2, wall, H * 4, { isStatic: true, render: { visible: false } })
      ]);
      M.Render.run(render);
      var runner = M.Runner.create();
      M.Runner.run(runner, engine);
      var dropped = 0;
      var timer = setInterval(function () {
        drop(); dropped++;
        if (dropped >= total) clearInterval(timer);
      }, 70);
      /* mouse/touch drag — grab and toss individual beans (mockup parity).
         Wheel and free touch scrolling pass through; touch only engages the
         constraint once it has actually picked up a bean. */
      var mouse = M.Mouse.create(render.canvas);
      var mc = M.MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
      M.Composite.add(engine.world, mc);
      mouse.element.removeEventListener('wheel', mouse.mousewheel);
      mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
      mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
      mouse.element.removeEventListener('touchstart', mouse.mousedown);
      mouse.element.removeEventListener('touchmove', mouse.mousemove);
      mouse.element.removeEventListener('touchend', mouse.mouseup);
      mouse.element.addEventListener('touchstart', mouse.mousedown, { passive: true });
      mouse.element.addEventListener('touchmove', function (e) { if (mc.body) mouse.mousemove(e); });
      mouse.element.addEventListener('touchend', function (e) { if (mc.body) mouse.mouseup(e); });
      M.Events.on(mc, 'startdrag', function () { render.canvas.style.cursor = 'grabbing'; });
      M.Events.on(mc, 'enddrag', function () { render.canvas.style.cursor = 'grab'; });
      /* cursor plow — moving the mouse through the pile shoves beans aside
         and along the cursor's path, no click needed. Listens on the whole
         section so it works over the copy too; a still cursor does nothing. */
      var sec = host.closest('section') || host.parentElement;
      var ptr = { x: 0, y: 0, vx: 0, vy: 0, on: false };
      function onPtrMove(e) {
        if (e.pointerType === 'touch') return;
        var r = host.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (ptr.on) { ptr.vx += x - ptr.x; ptr.vy += y - ptr.y; }
        ptr.x = x; ptr.y = y; ptr.on = true;
      }
      function onPtrLeave() { ptr.on = false; ptr.vx = ptr.vy = 0; }
      sec.addEventListener('pointermove', onPtrMove, { passive: true });
      sec.addEventListener('pointerleave', onPtrLeave);
      var reach = size * 1.6;
      M.Events.on(engine, 'beforeUpdate', function () {
        var sp = Math.hypot(ptr.vx, ptr.vy);
        if (!ptr.on || sp < 0.5 || mc.body) { ptr.vx *= 0.5; ptr.vy *= 0.5; return; }
        var push = Math.min(sp, 48);
        var ux = ptr.vx / sp, uy = ptr.vy / sp;
        M.Composite.allBodies(engine.world).forEach(function (b) {
          if (b.isStatic) return;
          var dx = b.position.x - ptr.x, dy = b.position.y - ptr.y;
          var d = Math.hypot(dx, dy);
          if (d > reach) return;
          var f = 1 - d / reach;
          var ax = d ? dx / d : 0, ay = d ? dy / d : -1;
          var vx = b.velocity.x + (ax * 0.55 + ux * 0.45) * push * 0.22 * f;
          var vy = b.velocity.y + (ay * 0.55 + uy * 0.45) * push * 0.22 * f - 1.2 * f;
          var cap = 18, v = Math.hypot(vx, vy);
          if (v > cap) { vx *= cap / v; vy *= cap / v; }
          M.Body.setVelocity(b, { x: vx, y: vy });
          M.Body.setAngularVelocity(b, b.angularVelocity + (ux * ay - uy * ax) * 0.04 * f);
        });
        ptr.vx *= 0.5; ptr.vy *= 0.5;
      });
      // pause the engine and the canvas redraws while the section is off
      // screen, so the physics never costs frames elsewhere on the page
      if ('IntersectionObserver' in window) {
        var running = true;
        host.__matterVis = new IntersectionObserver(function (es) {
          var vis = es[es.length - 1].isIntersecting;
          if (vis && !running) { M.Render.run(render); M.Runner.run(runner, engine); running = true; }
          else if (!vis && running) { M.Render.stop(render); M.Runner.stop(runner); running = false; }
        }, { rootMargin: '100px 0px' });
        host.__matterVis.observe(host);
      }
      host.__matterCleanup = function () {
        if (host.__matterVis) { host.__matterVis.disconnect(); host.__matterVis = null; }
        sec.removeEventListener('pointermove', onPtrMove);
        sec.removeEventListener('pointerleave', onPtrLeave);
        clearInterval(timer);
        M.Render.stop(render); M.Runner.stop(runner); M.Engine.clear(engine);
        if (render.canvas && render.canvas.parentNode) render.canvas.parentNode.removeChild(render.canvas);
        render.canvas = null; render.context = null; render.textures = {};
        host.__matterInit = false;
      };
    });
  }

  function initBeanPhysics(scope) {
    var hosts = (scope || document).querySelectorAll('[data-bean-physics]');
    if (!hosts.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    hosts.forEach(function (host) {
      if (host.__beansBound) return;
      host.__beansBound = true;
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          io.disconnect();
          startBeanPhysics(host);
        }
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
      io.observe(host);
    });
  }
  /* ---- init --------------------------------------------------------------- */
  /* ---- Bean-field sweep travel ----------------------------------------------
     The 45°-rotated beam's horizontal footprint scales with the section's
     HEIGHT, so the keyframe endpoints must be measured per section — CSS
     can't derive a height-proportional horizontal distance. Feeds
     --sweep-start/--sweep-end (px) to the bean-sweep keyframes. */
  function initSweeps(root) {
    root.querySelectorAll('.bean-field__sweep').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      function size() {
        var parent = el.offsetParent || el.parentElement;
        if (!parent) return;
        var w = parent.offsetWidth, h = parent.offsetHeight;
        // half the rotated strip's horizontal extent: (2.2h + 64px) * sin45 / 2
        var reach = 0.354 * (2.2 * h + 64) + 96;
        el.style.setProperty('--sweep-start', Math.round(w + reach) + 'px');
        el.style.setProperty('--sweep-end', Math.round(-64 - reach) + 'px');
      }
      size();
      window.addEventListener('resize', size);
    });
  }

  /* ---- Edge fades on carousels / horizontal sliders ------------------------
     Scrollable rows fade a side only while content continues past it;
     rows that slide by transform (UFO) fade both. */
  // (the story timeline and the reviews marquee run edge to edge, no fade)
  var EDGE_ROWS = '.scroll-row, .pdp__reviews-grid, .related__grid, .cbundles__grid, .ufo__bags';
  var EDGE_ALWAYS = '.ufo__bags';
  function initEdgeFades(root) {
    root.querySelectorAll(EDGE_ROWS).forEach(function (el) {
      if (el.dataset.edgeFade) return; el.dataset.edgeFade = '1';
      el.classList.add('edge-fade');
      var raf = null;
      function update() {
        raf = null;
        var max = el.scrollWidth - el.clientWidth;
        var scrolls = max > 2 && getComputedStyle(el).overflowX !== 'hidden';
        if (scrolls) {
          el.classList.toggle('is-fade-l', el.scrollLeft > 2);
          el.classList.toggle('is-fade-r', el.scrollLeft < max - 2);
        } else {
          var both = el.matches(EDGE_ALWAYS);
          el.classList.toggle('is-fade-l', both);
          el.classList.toggle('is-fade-r', both);
        }
      }
      function queue() { if (!raf) raf = requestAnimationFrame(update); }
      el.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue);
      if (window.ResizeObserver) new ResizeObserver(queue).observe(el);
      update();
    });
  }

  function initAll(scope) {
    var root = scope || document;
    initMenu(root); initNavTuck(); initOneLineTitles(root); initMarquee(root); initUfo(root);
    initStickySteps(root); initTimeline(root); initScrollTo(root); initBeanFields(root);
    initSplitReveal(root); initMani(root); initLblDraw(root); initHeroSusan(root); initBeanPhysics(root); initSweeps(root); initEdgeFades(root);
  }

  /* ---- Press physics (every button, one feel) ------------------------------
     Pointer or Enter/Space down: the control dips (quick ease-out); release:
     it springs back past 1 and settles. The dip is about 5px across the
     larger side, never more than 6%, so a small icon and a full-width
     button feel equally deep. Runs on the `scale` property through the Web
     Animations API, so it layers over each control's own transform,
     transitions and hover states without touching them. */
  function initPress() {
    if (window.__acPress || !Element.prototype.animate) return; window.__acPress = 1;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var SEL = 'button, [role="button"], input[type="submit"], input[type="button"], select, .button-039, .icon-btn, .arrow-btn, .hm-arrow, .underlay-nav__link-large';
    var held = null;
    function target(el) {
      el = el && el.closest ? el.closest(SEL) : null;
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-no-press')) return null;
      return el;
    }
    function now(n) { var v = parseFloat(getComputedStyle(n).scale); return isFinite(v) ? v : 1; }
    // the hand-drawn pill scales its art + label, not the button: scaling the
    // drop-shadow-filtered button would blur its text
    function parts(el) {
      return el.classList.contains('button-039') ? el.querySelectorAll(':scope > .button-039__bg, :scope > .button-039__inner') : [el];
    }
    function down(el) {
      var r = el.getBoundingClientRect();
      var d = Math.max(0.94, 1 - 5 / Math.max(r.width, r.height, 1));
      Array.prototype.forEach.call(parts(el), function (n) {
        var from = now(n);
        // resting scale (a hover may set one) to settle back to on release
        if (!n.__pressDn && !(n.__pressUp && n.__pressUp.playState === 'running')) n.__pressBase = from;
        if (n.__pressUp) n.__pressUp.cancel();
        if (n.__pressDn) n.__pressDn.cancel();
        n.__pressDn = n.animate([{ scale: from }, { scale: (n.__pressBase || 1) * d }], { duration: 110, easing: 'cubic-bezier(.3,0,.5,1)', fill: 'forwards' });
      });
      held = el;
    }
    function up() {
      var el = held; held = null;
      if (!el) return;
      Array.prototype.forEach.call(parts(el), function (n) {
        if (!n.__pressDn) return;
        var from = now(n), dn = n.__pressDn, base = n.__pressBase || 1;
        n.__pressUp = n.animate([
          { scale: from },
          { scale: base * 1.025, offset: 0.45 },
          { scale: base * 0.995, offset: 0.75 },
          { scale: base }
        ], { duration: 380, easing: 'ease-out' });
        n.__pressUp.onfinish = function () { if (n.__pressDn === dn) { dn.cancel(); n.__pressDn = null; } };
      });
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var el = target(e.target); if (el) down(el);
    }, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', up);
    document.addEventListener('keydown', function (e) {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      var el = target(e.target); if (el && el === document.activeElement) down(el);
    }, true);
    document.addEventListener('keyup', function (e) {
      if (e.key === 'Enter' || e.key === ' ') up();
    }, true);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAll(document);
    initSmoothScroll();
    initPress();
  });
})();
