/* Phone homepage (sections/home-mobile.liquid): the redesign's hero turntable, bean pops, manifesto
   read-in and fitted "Our Story" word. Built from the Home2 prototype (scratchpad home2/mkmobile.py). */
(function () {
  class HomeM {
    renderVals() {
      return { rootRef: (el) => { this._root = el; } };
    }

    componentDidMount() {
      const root = this._root;
      if (!root) return;
      this._rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // On the canvas the board is drawn at its full height, so nothing scrolls: show every
      // scroll animation in its finished state. In Play (full window) the page scrolls for real.
      this._frame = false;
      root.classList.toggle('is-frame', this._frame);
      this._timers = [];
      this.initIntro(root);
      // the menu drawer
      const menu = root.querySelector('[data-menu]'), menuBtn = root.querySelector('[data-menu-open]');
      if (menu && menuBtn) {
        const setMenu = (on) => { menu.classList.toggle('is-open', on); menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
        menuBtn.addEventListener('click', () => setMenu(true));
        menu.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', () => setMenu(false)));
      }
      this.initRing(root);
      this.initBeans(root);
      this.initScroll(root);
      // eyebrow marker streaks draw in as they enter the viewport (all at once on the canvas frame)
      const lbls = [].slice.call(root.querySelectorAll('.lbl'));
      if (this._frame || this._rm || !('IntersectionObserver' in window)) lbls.forEach((l) => l.classList.add('is-drawn'));
      else { this._lblIo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); this._lblIo.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' }); lbls.forEach((l) => this._lblIo.observe(l)); }
    }

    componentWillUnmount() {
      (this._timers || []).forEach(clearTimeout);
      cancelAnimationFrame(this._raf); cancelAnimationFrame(this._introRaf);
      (this._rings || []).forEach((R) => { cancelAnimationFrame(R.raf); clearTimeout(R.loop); });
      if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this._onTuck) window.removeEventListener('scroll', this._onTuck);
      if (this._closeMenu) this._closeMenu();
      if (this._fallIo) this._fallIo.disconnect();
      if (this._fallStop) this._fallStop();
    }

    // ---------------------------------------------------------------- the live theme's nav (assets/theme.js)
    // underlay menu: opening sets body[data-menu-status=open], which slides [data-main] aside on desktop and drops
    // the menu over the page on phones; the fixed nav rides along (nav-follow) and tucks away on scroll past the hero
    initThemeNav(root) {
      const body = document.body, nav = root.querySelector('.site-nav');
      let followT = null, lockY = 0, locked = false;
      const phone = () => window.matchMedia('(max-width: 767px)').matches;
      const followOn = () => { clearTimeout(followT); if (!locked) body.style.setProperty('--nav-scroll-top', window.scrollY + 'px'); body.classList.add('nav-follow'); };
      const followOff = () => { clearTimeout(followT); followT = setTimeout(() => body.classList.remove('nav-follow'), 720); };
      const lock = () => { if (locked || !phone()) return; locked = true; lockY = window.scrollY; body.style.top = -lockY + 'px'; body.classList.add('scroll-locked'); };
      const unlock = () => { if (!locked) return; locked = false; body.classList.remove('scroll-locked'); body.style.top = ''; window.scrollTo(0, lockY); };
      const toggles = [].slice.call(root.querySelectorAll('[data-menu-toggle]'));
      const setOpen = (open) => {
        if (open) { followOn(); lock(); } else { followOff(); unlock(); }
        body.dataset.menuStatus = open ? 'open' : 'closed';
        toggles.forEach((b) => { b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu'); });
      };
      toggles.forEach((b) => b.addEventListener('click', () => setOpen(body.dataset.menuStatus !== 'open')));
      root.querySelectorAll('[data-menu-close]').forEach((el) => el.addEventListener('click', () => setOpen(false)));
      this._closeMenu = () => setOpen(false);
      if (!nav || this._frame) return;
      let lastY = window.scrollY, ticking = false;
      const heroBottom = () => { const first = root.querySelector('.hero2, .herom'); const h = first && first.offsetHeight ? first : root.querySelector('.herom'); return Math.min(h ? h.offsetTop + h.offsetHeight : 600, window.innerHeight); };
      const update = () => {
        ticking = false;
        const y = window.scrollY, open = body.dataset.menuStatus === 'open' || body.classList.contains('nav-follow');
        if (open || y <= 0 || y < heroBottom()) { nav.classList.remove('is-tucked'); lastY = y; return; }
        if (y > lastY + 6) nav.classList.add('is-tucked'); else if (y < lastY - 6) nav.classList.remove('is-tucked');
        lastY = y;
      };
      this._onTuck = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
      window.addEventListener('scroll', this._onTuck, { passive: true });
    }

    later(fn, ms) { const t = setTimeout(fn, ms); this._timers.push(t); return t; }

    bezier(x1, y1, x2, y2) {
      const bx = (t) => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
      const by = (t) => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
      return (x) => { let lo = 0, hi = 1, t = x; for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; } return by(t); };
    }

    // ---------------------------------------------------------------- 1. intro
    // (removed: the hero now loads without an opening statement)
    initIntro() { }

    // ---------------------------------------------------------------- 2. hero ring
    // the theme's lazy-susan laws (initHeroSusan): same depth ease, 1.5s turn, 3s rest, 0.9s user turn,
    // one-roast swipe gesture; widened to show five roasts, the front one largest
    initRing(root) {
      this._ringRenders = [];
      root.querySelectorAll('[data-ring]').forEach((sec) => this.ringOne(root, sec));
      this._ringRender = () => this._ringRenders.forEach((f) => f());
    }

    ringOne(root, sec) {
      const R = { raf: 0, loop: 0 }; (this._rings = this._rings || []).push(R);
      const susan = sec.getAttribute('data-ring') === 'susan';
      const stage = sec.querySelector('[data-ring-stage]');
      const items = [].slice.call(sec.querySelectorAll('[data-ring-item]'));
      const n = items.length;
      const cap = sec.querySelector('[data-ring-cap]');
      const q = (s) => sec.querySelector(s);
      const capRank = q('[data-cap-rank]'), capName = q('[data-cap-name]'), capMeta = q('[data-cap-meta]'), capTrend = q('[data-cap-trend]'), capPrice = q('[data-cap-price]');
      const ease = this.bezier(0.6, 0, 0, 1);
      const MOVE = 1500, REST = 3000, rm = this._rm;
      let pos = 0, front = -1, hold = 0, drag = null, dragged = false;
      // the live hero's caption (initHeroSusan caption()): rank, name, "Trending" when tagged, level · notes, price
      const caption = (k) => {
        const d = items[k].dataset;
        if (capRank) { capRank.textContent = '#' + (k + 1); capRank.setAttribute('aria-label', 'Nomor ' + (k + 1) + ' terlaris'); }
        if (capName) capName.textContent = d.name;
        if (capMeta) capMeta.textContent = d.meta;
        if (capTrend) { capTrend.hidden = !d.trend; capTrend.textContent = d.trend ? '\u25B2 ' + d.trend + ' \u00B7 ' : ''; }
        if (capPrice) capPrice.textContent = d.price;
        if (d.color) (sec.closest('section') || sec).style.setProperty('--bean-sh', d.color);
        // the caption's price link follows the roast in front
        sec.querySelectorAll('.hero2__from').forEach((a) => { a.href = items[k].href; });
      };
      const render = () => {
        const W = sec.clientWidth;
        const R = W < 768 ? W * 0.44 : Math.min(W * 0.4, 640);
        const f = ((Math.round(pos) % n) + n) % n;
        items.forEach((el, k) => {
          let rel = k - pos;
          rel = ((rel + n / 2) % n + n) % n - n / 2;
          if (susan) {
            // initHeroSusan: rel clamped to +/-2, x = sin(angle) * bag width * .65, scale .5..1, slight drop as it turns forward
            const rc = Math.max(-2, Math.min(2, rel)), angle = rc / 2 * Math.PI, depth = (Math.cos(angle) + 1) / 2;
            const bw = items[0].offsetWidth || 128, x = rc <= -2 || rc >= 2 ? 0 : Math.sin(angle) * bw * 0.65;
            const sc = 0.5 + 0.5 * depth, op = Math.max(0, Math.min(1, (Math.min(2, n / 2) - Math.abs(rc)) * 2));
            el.style.transform = 'translateX(calc(-50% + ' + x.toFixed(2) + 'px)) translateY(' + ((sec.classList.contains('hero2__ring') ? 5 : 2) * Math.max(0, 2 * depth - 1)).toFixed(2) + 'px) perspective(1200px) rotateY(' + (Math.sin(angle) * -5).toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
            el.style.opacity = op.toFixed(3); el._zd = depth; el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
            return;
          }
          const r = Math.abs(rel), t = Math.min(r, 2.4) / 2.4, sx = Math.sin(t * Math.PI / 2);
          const x = Math.sign(rel) * R * sx;
          const s = 1 - 0.55 * Math.pow(sx, 1.3);
          const op = Math.max(0, Math.min(1, (2.6 - r) / 0.5));
          const blur = Math.max(0, r - 0.6) * (W < 768 ? 0.6 : 1);
          el.style.transform = 'translateX(calc(-50% + ' + x.toFixed(2) + 'px)) perspective(1200px) rotateY(' + (Math.sign(rel) * sx * -6).toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
          el.style.opacity = op.toFixed(3);
          el.style.filter = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
          el._zd = -r;
          el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
        });
        items.map((el, k) => k).sort((a, b) => items[a]._zd - items[b]._zd).forEach((k, rank) => { const z = String(rank + 1); if (items[k].style.zIndex !== z) items[k].style.zIndex = z; });
        if (f !== front) { front = f; caption(f); }
        if (cap) { const c = Math.max(0, 1 - Math.abs(pos - Math.round(pos)) * 3); cap.style.opacity = c.toFixed(3); cap.style.transform = c < 1 ? 'translateY(' + ((1 - c) * 6).toFixed(1) + 'px)' : ''; }
      };
      const spinTo = (target, dur, done) => {
        cancelAnimationFrame(R.raf);
        const from = pos;
        if (rm || from === target) { pos = target; render(); if (done) done(); return; }
        const t0 = performance.now();
        const tick = (now) => { const t = Math.min(1, (now - t0) / dur); pos = from + (target - from) * ease(t); render(); if (t < 1) R.raf = requestAnimationFrame(tick); else if (done) done(); };
        R.raf = requestAnimationFrame(tick);
      };
      const step = () => {
        clearTimeout(R.loop);
        if (rm || drag || document.hidden || Date.now() < hold) { R.loop = setTimeout(step, 500); return; }
        spinTo(Math.round(pos) + 1, MOVE, () => { R.loop = setTimeout(step, REST); });
      };
      const userSpin = (target) => { hold = Date.now() + 2500; clearTimeout(R.loop); spinTo(target, 900, () => { R.loop = setTimeout(step, 2500); }); };
      const goTo = (k) => { const base = Math.round(pos); let d = (((k - base) % n) + n) % n; if (d > n / 2) d -= n; if (d) userSpin(base + d); };
      // a side bag turns the ring; the front bag opens its product page
      items.forEach((el, k) => el.addEventListener('click', (e) => { e.preventDefault(); if (dragged) { dragged = false; return; } if (k !== front) goTo(k); else location.href = el.href; }));
      q('[data-ring-prev]').addEventListener('click', () => userSpin(Math.round(pos) - 1));
      q('[data-ring-next]').addEventListener('click', () => userSpin(Math.round(pos) + 1));
      stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.edge-arrow')) return;
        clearTimeout(R.loop); dragged = false;
        drag = { x: e.clientX, lx: e.clientX, lt: performance.now(), v: 0, dx: 0 }; hold = Date.now() + 2500;
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) dragged = true;
        const now = performance.now(); if (now > drag.lt) { drag.v = (e.clientX - drag.lx) / (now - drag.lt); drag.lx = e.clientX; drag.lt = now; }
        drag.dx = dx;
      });
      const release = (e) => {
        if (!drag) return;
        const g = drag; drag = null; hold = Date.now() + 2500;
        let dir = 0;
        if (dragged && e.type !== 'pointercancel' && (Math.abs(g.dx) > 30 || Math.abs(g.v) > 0.35)) dir = (g.dx || -g.v) < 0 ? 1 : -1;
        if (dir) userSpin(Math.round(pos) + dir); else R.loop = setTimeout(step, 2500);
      };
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => stage.addEventListener(t, release));
      this._ringRenders.push(render);
      render();
      // the first turn waits for the intro to clear
      R.loop = setTimeout(step, root.querySelector('.is-intro') ? (this._introEnd || 3500) + 300 : REST);
    }

    // ---------------------------------------------------------------- hero beans
    // initBeanFields from theme.js: each bean pops on for 1.8-3s and off for 0.36-0.72s at a fresh
    // spot, re-rolled 34-62px and up to +/-50deg, kept 28px clear of the copy, the front roasts and the nav
    initBeans(root) {
      const field = root.querySelector('[data-beans]');
      if (!field || this._rm) return;
      const host = field.parentElement, beans = [].slice.call(field.querySelectorAll('img'));
      const ON = [1800, 3000], OFF = [360, 720], GAP = 28;
      const rnd = (a, b) => a + Math.random() * (b - a);
      const slots = beans.map(() => ({ left: 50, top: 50, size: 40, on: false }));
      let avoid = [], dims = { w: 1, h: 1 };
      const measure = () => {
        const wr = field.getBoundingClientRect(); dims = { w: wr.width || 1, h: wr.height || 1 };
        avoid = [];
        const add = (el) => { const r = el.getBoundingClientRect(); if (r.width && r.height) avoid.push({ x0: r.left - wr.left, y0: r.top - wr.top, x1: r.right - wr.left, y1: r.bottom - wr.top }); };
        host.querySelectorAll('[data-bean-avoid], .ring-arrow').forEach(add);
        host.querySelectorAll('[data-ring-item]').forEach((el) => { if (parseFloat(el.style.opacity || '1') > 0.3) add(el); });
        root.querySelectorAll('.site-nav__inner > *').forEach(add);
      };
      const claim = (i) => {
        measure();
        const scale = dims.w < 768 ? 0.72 : 1, size = rnd(34, 62);
        for (let tries = 0; tries < 80; tries++) {
          const left = rnd(3, 97), top = rnd(4, 95);
          const x = left / 100 * dims.w, y = top / 100 * dims.h, half = size * scale * 0.8 + 5;
          let ok = !avoid.some((r) => x + half > r.x0 - GAP && x - half < r.x1 + GAP && y + half > r.y0 - GAP && y - half < r.y1 + GAP);
          if (ok) ok = !slots.some((sl, j) => j !== i && sl.on && Math.abs(x - sl.left / 100 * dims.w) < (size + sl.size) / 2 * scale * 0.9 && Math.abs(y - sl.top / 100 * dims.h) < (size + sl.size) / 2 * scale * 0.9);
          if (ok) return { left, top, size };
        }
        return null;
      };
      beans.forEach((bean, i) => {
        const appear = () => {
          const spot = claim(i);
          if (spot) {
            slots[i] = { left: spot.left, top: spot.top, size: spot.size, on: true };
            bean.style.left = spot.left + '%'; bean.style.top = spot.top + '%';
            bean.style.setProperty('--br', Math.round(rnd(-50, 50)) + 'deg');
            bean.style.setProperty('--bw', Math.round(spot.size) + 'px');
            bean.classList.add('is-on');
          }
          this.later(disappear, rnd(ON[0], ON[1]));
        };
        const disappear = () => { slots[i].on = false; bean.classList.remove('is-on'); this.later(appear, rnd(OFF[0], OFF[1])); };
        this.later(appear, i * 200 + rnd(0, 300));
      });
    }

    // ---------------------------------------------------------------- falling beans (theme startBeanPhysics, Matter.js)
    // beans tumble in when the section arrives and settle in a pile; grab and toss one, or move the cursor through the pile to plow it
    watchFall(root) {
      const host = root.querySelector('[data-fall]');
      if (!host || this._rm || !('IntersectionObserver' in window)) return;
      this._fallIo = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { this._fallIo.disconnect(); this.startFall(host, 0); }
      }, { threshold: 0.35 });
      this._fallIo.observe(host);
    }
    startFall(host, tries) {
      const M = window.Matter;
      if (this._fallOn) return;
      if (!M) { if (tries < 50) this.later(() => this.startFall(host, tries + 1), 200); return; }
      const W = host.clientWidth, H = host.clientHeight;
      if (!W || !H) return;
      this._fallOn = true;
      const srcs = (host.getAttribute('data-fall') || '').split(' ').filter(Boolean);
      const imgs = srcs.map((src) => { const im = new Image(); im.src = src; return im; });
      const phone = W < 768, total = phone ? 34 : 70, len = phone ? 40 : 58;
      const engine = M.Engine.create();
      engine.world.gravity.y = 1.2;
      const render = M.Render.create({ element: host, engine, options: { background: 'transparent', wireframes: false, width: W, height: H, pixelRatio: Math.min(2, window.devicePixelRatio || 1) } });
      const rnd = (a, b) => Math.random() * (b - a) + a;
      let bi = 0;
      const drop = () => {
        const im = imgs[bi % imgs.length]; bi++;
        const nw = im.naturalWidth || 100, nh = im.naturalHeight || 140;
        const h = len * rnd(0.8, 1.2), w = h * nw / nh;       // a bean is taller than it is wide
        M.Composite.add(engine.world, M.Bodies.rectangle(rnd(w + 8, W - w - 8), -h, w * 0.86, h * 0.9, {
          chamfer: { radius: w * 0.4 }, restitution: 0.3, friction: 0.35, density: 0.0014, angle: rnd(-Math.PI, Math.PI),
          render: { sprite: { texture: im.src, xScale: w / nw, yScale: h / nh } }
        }));
      };
      const wall = 300;
      M.Composite.add(engine.world, [
        M.Bodies.rectangle(W / 2, H + wall / 2, W + wall * 2, wall, { isStatic: true, render: { visible: false } }),
        M.Bodies.rectangle(-wall / 2, H / 2, wall, H * 4, { isStatic: true, render: { visible: false } }),
        M.Bodies.rectangle(W + wall / 2, H / 2, wall, H * 4, { isStatic: true, render: { visible: false } })
      ]);
      M.Render.run(render);
      const runner = M.Runner.create(); M.Runner.run(runner, engine);
      let dropped = 0;
      const timer = setInterval(() => { drop(); if (++dropped >= total) clearInterval(timer); }, 60);
      const mouse = M.Mouse.create(render.canvas);
      const mc = M.MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
      M.Composite.add(engine.world, mc);
      mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
      mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
      mouse.element.removeEventListener('touchstart', mouse.mousedown);
      mouse.element.removeEventListener('touchmove', mouse.mousemove);
      mouse.element.removeEventListener('touchend', mouse.mouseup);
      mouse.element.addEventListener('touchstart', mouse.mousedown, { passive: true });
      mouse.element.addEventListener('touchmove', (e) => { if (mc.body) mouse.mousemove(e); });
      mouse.element.addEventListener('touchend', (e) => { if (mc.body) mouse.mouseup(e); });
      M.Events.on(mc, 'startdrag', () => { render.canvas.style.cursor = 'grabbing'; });
      M.Events.on(mc, 'enddrag', () => { render.canvas.style.cursor = 'grab'; });
      // cursor plow: moving through the pile shoves beans along the cursor's path
      const sec = host.parentElement;
      const ptr = { x: 0, y: 0, vx: 0, vy: 0, on: false };
      const onMove = (e) => {
        if (e.pointerType === 'touch') return;
        const b = host.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
        if (ptr.on) { ptr.vx += x - ptr.x; ptr.vy += y - ptr.y; }
        ptr.x = x; ptr.y = y; ptr.on = true;
      };
      const onLeave = () => { ptr.on = false; ptr.vx = ptr.vy = 0; };
      sec.addEventListener('pointermove', onMove, { passive: true });
      sec.addEventListener('pointerleave', onLeave);
      const reach = len * 1.7;
      M.Events.on(engine, 'beforeUpdate', () => {
        const sp = Math.hypot(ptr.vx, ptr.vy);
        if (!ptr.on || sp < 0.5 || mc.body) { ptr.vx *= 0.5; ptr.vy *= 0.5; return; }
        const push = Math.min(sp, 48), ux = ptr.vx / sp, uy = ptr.vy / sp;
        M.Composite.allBodies(engine.world).forEach((b) => {
          if (b.isStatic) return;
          const dx = b.position.x - ptr.x, dy = b.position.y - ptr.y, d = Math.hypot(dx, dy);
          if (d > reach) return;
          const f = 1 - d / reach, ax = d ? dx / d : 0, ay = d ? dy / d : -1;
          let vx = b.velocity.x + (ax * 0.55 + ux * 0.45) * push * 0.22 * f;
          let vy = b.velocity.y + (ay * 0.55 + uy * 0.45) * push * 0.22 * f - 1.2 * f;
          const v = Math.hypot(vx, vy); if (v > 18) { vx *= 18 / v; vy *= 18 / v; }
          M.Body.setVelocity(b, { x: vx, y: vy });
          M.Body.setAngularVelocity(b, b.angularVelocity + (ux * ay - uy * ax) * 0.04 * f);
        });
        ptr.vx *= 0.5; ptr.vy *= 0.5;
      });
      let running = true;
      const vis = new IntersectionObserver((es) => {
        const on = es[es.length - 1].isIntersecting;
        if (on && !running) { M.Render.run(render); M.Runner.run(runner, engine); running = true; }
        else if (!on && running) { M.Render.stop(render); M.Runner.stop(runner); running = false; }
      }, { rootMargin: '100px 0px' });
      vis.observe(host);
      this._fallStop = () => {
        vis.disconnect(); clearInterval(timer);
        sec.removeEventListener('pointermove', onMove); sec.removeEventListener('pointerleave', onLeave);
        M.Render.stop(render); M.Runner.stop(runner); M.Engine.clear(engine);
        if (render.canvas && render.canvas.parentNode) render.canvas.parentNode.removeChild(render.canvas);
      };
    }

    // ---------------------------------------------------------------- scroll: pins, reveal, tilt
    initScroll(root) {
      const pins = [].slice.call(root.querySelectorAll('[data-hscroll-pinned]')).map((sec) => ({
        sec, track: sec.querySelector('[data-hs-track]'), bar: sec.querySelector('[data-hs-bar]'), pin: sec.querySelector('.hs__pin'), pinH: 0, pinTop: 0,
        items: [].slice.call(sec.querySelectorAll('[data-tilt-item]')).map((el) => ({ el, rot: 0 })), dist: 0
      }));
      const mani = root.querySelector('[data-reveal]') || document.querySelector('.mani[data-mani="mobile"]');
      const words = mani ? [].slice.call(mani.querySelectorAll('.w')) : [];
      const marks = mani ? [].slice.call(mani.querySelectorAll('.mk')).map((el) => { const ws = el.querySelectorAll('.w'); return { el, first: words.indexOf(ws[0]), last: words.indexOf(ws[ws.length - 1]) }; }) : [];
      const fits = [].slice.call(root.querySelectorAll('[data-fit]'));
      const vh = () => window.innerHeight;
      // marker streaks are scrubbed by scroll: a dark cover sits over each wrapped line of a marked phrase (above the
      // streak, under the words) and slides off line by line as the phrase is read, so the streak is never stretched
      const maniText = mani && mani.querySelector('.mani__text');
      const measureMarks = () => {
        if (!maniText) return;
        const base = maniText.getBoundingClientRect();
        marks.forEach((m) => {
          (m.covers || []).forEach((c) => c.el.remove());
          let acc = 0;
          m.covers = [].slice.call(m.el.getClientRects()).map((r) => {
            const el = document.createElement('i'); el.className = 'mk__cov'; maniText.appendChild(el);
            const c = { el, x: r.left - base.left - 3, y: r.top - base.top - 3, w: r.width + 6, h: r.height + 6, before: acc };
            acc += c.w; el.style.top = c.y + 'px'; el.style.height = c.h + 'px';
            return c;
          });
          m.total = acc; m.shown = -1;
        });
      };
      const scrubMark = (m, f) => {
        if (!m.covers || Math.abs(f - m.shown) < 0.001) return;
        m.shown = f;
        const L = f * m.total;
        m.covers.forEach((c) => { const rev = Math.max(0, Math.min(c.w, L - c.before)); c.el.style.left = (c.x + rev) + 'px'; c.el.style.width = Math.max(0, c.w - rev) + 'px'; });
      };
      const layout = () => {
        if (this._ringRender) this._ringRender();
        // the giant "Our Story" spans the full width
        // (capped at 360px so the story section can keep a fixed height on wide screens)
        fits.forEach((el) => {
          el.style.fontSize = '100px'; const w = el.scrollWidth || 1;
          // data-fit="1.04": scale to 104% of the width so the letters just bleed off both edges (no height cap)
          const k = parseFloat(el.getAttribute('data-fit')) || 0.97, cap = el.getAttribute('data-fit') ? 1e9 : 360;
          const target = el.parentNode.clientWidth * k;
          let fs = Math.min(cap, 100 * target / w);
          // type doesn't scale perfectly linearly (hinting, glyph advances), so correct against the real width twice
          for (let n = 0; n < 2 && fs < cap; n++) { el.style.fontSize = fs.toFixed(2) + 'px'; const real = el.scrollWidth || 1; if (Math.abs(real - target) < 2) break; fs = Math.min(cap, fs * target / real); }
          el.style.fontSize = fs.toFixed(2) + 'px';
        });
        measureMarks();
        if (this._frame) return;
        pins.forEach((P) => {
          P.dist = Math.max(0, P.track.scrollWidth - P.sec.clientWidth);
          // a pin can be a full screen (story) or just its content's height, held centred (what sets us apart)
          P.pinH = P.pin.offsetHeight;
          // bands pin to the top of the screen; on tall screens the section's own colour shows below the band
          P.pinTop = 0;
          P.pin.style.top = P.pinTop + 'px';
          P.sec.style.height = (P.dist + P.pinH + vh() * 0.15) + 'px';
        });
      };
      let lastY = window.scrollY, vel = 0;
      const frame = () => {
        const H = vh(), y = window.scrollY;
        vel += ((y - lastY) - vel) * 0.18; lastY = y;
        if (this._frame) {
          words.forEach((w) => {
            w.style.opacity = 1;
            if (w.closest('.mk')) w.classList.add('is-ink');
            if (w.classList.contains('w--s') || w.classList.contains('w--x')) w.classList.add('is-scr');
          });
          if (!this._frameMarked) { this._frameMarked = true; measureMarks(); }
          marks.forEach((m) => { m.el.classList.add('is-on'); scrubMark(m, 1); });
          words.forEach((w) => w.style.setProperty('--xp', '1'));
          pins.forEach((P) => { if (P.bar) P.bar.style.width = '100%'; });
          return;
        }
        if (mani && words.length) {
          const r = mani.getBoundingClientRect();
          const start = H * 0.8;
          const end = Math.min(H * 0.08, Math.max(-80, H - (r.height || 320) - 24));
          const span = Math.max(200, start - end);
          const p = Math.max(0, Math.min(1, (start - r.top) / span));
          const lit = p * words.length;
          let reflow = false;
          words.forEach((w, i) => {
            w.style.opacity = (0.22 + 0.78 * Math.max(0, Math.min(1, lit - i))).toFixed(3);
            if (w.closest('.mk')) w.classList.toggle('is-ink', lit > i + 0.15);
            // key words switch to the script face, and ego / jargon / cover-up get struck through, once they're read
            // the strike line draws through the word as it's read
            if (w.classList.contains('w--x')) w.style.setProperty('--xp', Math.max(0, Math.min(1, (lit - i - 0.15) / 0.85)).toFixed(3));
          });
          // a word switching face changes the line breaks, so the covers are re-measured
          if (reflow) measureMarks();
          marks.forEach((m) => {
            m.el.classList.toggle('is-on', lit >= m.last + 1);
            scrubMark(m, Math.max(0, Math.min(1, (lit - m.first) / Math.max(1, m.last + 1 - m.first))));
          });
        }
        pins.forEach((P) => {
          const r = P.sec.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, (P.pinTop - r.top) / Math.max(1, r.height - P.pinH)));
          P.track.style.transform = 'translate3d(' + (-p * P.dist).toFixed(1) + 'px,0,0)';
          if (P.bar) P.bar.style.width = (p * 100).toFixed(1) + '%';
          const W = P.sec.clientWidth;
          P.items.forEach((it) => {
            const b = it.el.getBoundingClientRect();
            const d = (b.left + b.width / 2 - W * 0.5) / W;           // -0.5 .. 1+ as it travels in from the right
            const target = Math.max(-1.5, Math.min(6, d * 5)) + Math.max(-3, Math.min(3, vel * 0.08));
            it.rot += (target - it.rot) * 0.12;
            const lift = Math.max(0, Math.min(1, d - 0.35)) * 60;      // cards rise into the row as they arrive
            it.el.style.transform = 'translateY(' + lift.toFixed(1) + 'px) rotate(' + it.rot.toFixed(2) + 'deg)';
          });
        });
      };
      layout();
      const kick = () => { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; frame(); }); };
      const relayout = () => { layout(); kick(); };
      // iOS fires resize as its toolbar shows and hides: only a width change re-lays out
      let lw = window.innerWidth;
      this._onResize = () => { if (window.innerWidth === lw) { kick(); return; } lw = window.innerWidth; relayout(); };
      window.addEventListener('resize', this._onResize);
      window.addEventListener('scroll', kick, { passive: true });
      window.addEventListener('load', relayout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
      this.later(relayout, 600);
      kick();
    }
  }

  var mobileMq = window.matchMedia('(max-width: 767px)');
  function boot() {
    if (!mobileMq.matches) return;
    document.querySelectorAll('[data-home-m]').forEach(function (root) {
      if (root.dataset.bound) return; root.dataset.bound = '1';
      var c = new HomeM(); c._root = root; c.componentDidMount();
    });
  }
  if (mobileMq.addEventListener) mobileMq.addEventListener('change', boot);
  else if (mobileMq.addListener) mobileMq.addListener(boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
