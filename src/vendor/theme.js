/* Apocalypse Coffee — global theme JS.
   Small per-section "islands" that re-initialise on shopify:section:load
   so everything keeps working inside the theme editor. No external libs:
   the mockup's GSAP/Locomotive/Matter effects are replaced with CSS
   animations + tiny scroll handlers (per the readiness review). */

(function () {
  'use strict';

  var money = function (cents) {
    var f = (window.AC && window.AC.moneyFormat) || '${{amount}}';
    var amount = (cents / 100).toFixed(2);
    return f.replace(/\{\{\s*amount[^}]*\}\}/, amount);
  };

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
     ≤767 the menu/cart overlay the page instead of sliding it, so the body
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
                 document.body.dataset.cartStatus === 'open' ||
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
    document.querySelectorAll('[data-main] .underlay-nav__menu, [data-main] .underlay-nav__overlay, [data-main] .cart-drawer, [data-main] .cart-drawer__overlay')
      .forEach(function (el) { document.body.appendChild(el); });
    root.querySelectorAll('[data-menu-toggle]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var open = document.body.dataset.menuStatus === 'open';
        if (open) { navFollowOff(); unlockScroll(); } else { navFollowOn(); lockScroll(); }
        document.body.dataset.menuStatus = open ? 'closed' : 'open';
        btn.setAttribute('aria-expanded', String(!open));
        btn.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      });
    });
    root.querySelectorAll('[data-menu-close]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      el.addEventListener('click', function () {
        navFollowOff();
        // only unlock if the cart isn't also open (cart pill while menu open)
        if (document.body.dataset.cartStatus !== 'open') unlockScroll();
        document.body.dataset.menuStatus = 'closed';
      });
    });
  }

  /* ---- Cart drawer (AJAX Cart API) --------------------------------------- */
  var openToken = 0;
  function openCart() {
    navFollowOn();
    lockScroll();
    document.body.dataset.menuStatus = 'closed';
    if (window.__cartAuthCheck) window.__cartAuthCheck();
    if (!isPhone()) { document.body.dataset.cartStatus = 'open'; return; }
    // phones: the scroll lock re-lays out the whole page; flip the sheet open
    // two frames later so that work is done and its slide-up plays in full
    // instead of being swallowed (which read as a hard cut to the cart)
    var token = ++openToken;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (token === openToken) document.body.dataset.cartStatus = 'open'; });
    });
  }
  function closeCart() {
    openToken++;
    navFollowOff();
    unlockScroll();
    document.body.dataset.cartStatus = 'closed';
    var slider = document.querySelector('.cart-drawer__slider');
    if (slider) {
      setTimeout(function () { slider.dataset.cartView = 'cart'; }, 350);
    }
  }

  /* Cart line editors need sibling-variant + selling-plan data; a tiny
     "cart-data" section carries it and is re-fetched via the Section
     Rendering API after every mutation so new products are covered. */
  var cartData = { products: {} };
  function readCartData(scope) {
    var el = (scope || document).querySelector('[data-cart-data]');
    if (!el) return;
    try { cartData = JSON.parse(el.textContent); } catch (e) { /* keep previous */ }
  }
  function refreshCartData() {
    return fetch('/?sections=cart-data', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var html = json['cart-data'];
        if (!html) return;
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        readCartData(tmp);
      }).catch(function () {});
  }

  var FREQ_ICON_SUB = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>';
  var FREQ_ICON_BOX = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // "6oz" -> "6 oz" for display; raw option values stay untouched for matching
  function sizeLabel(s) {
    return String(s == null ? '' : s).replace(/(\d)\s*(oz)\b/gi, '$1 $2');
  }

  // ReCharge plan names ("2 week subscription with 5% discount") display as
  // "Every 2 weeks"; names without a week count keep their own wording
  function planLabel(name) {
    var n = String(name == null ? '' : name);
    var m = n.match(/(\d+)\s*week/i);
    if (m) return +m[1] === 1 ? 'Every week' : 'Every ' + m[1] + ' weeks';
    return n.replace(/Delivery every |Deliver every /, '');
  }

  // frequency pill text: the full label, plus a short one phones show instead
  // ("Every 2 wks"); CSS picks which (.freq-l / .freq-s)
  function freqPillLabel(name) {
    var full = planLabel(name);
    var short = full.replace(/ weeks$/, ' wks');
    return '<span class="freq-l">' + full + '</span><span class="freq-s">' + short + '</span>';
  }

  // compact chip text for the in-cart frequency chips ("4 wks"); matching
  // still goes through planLabel's full wording
  function chipLabel(name) {
    var m = String(name == null ? '' : name).match(/(\d+)\s*week/i);
    if (m) return +m[1] === 1 ? '1 wk' : m[1] + ' wks';
    return planLabel(name);
  }

  var lastCart = null;
  var freqsEnterVariant = null; // line whose frequency chips should slide in once
  var undoState = null;         // { index, title, add, timer } for Remove -> Undo
  // replay a one-shot motion class (removing it and forcing a reflow restarts it)
  function replayMotion(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function renderCart(cart) {
    lastCart = cart;
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = cart.item_count;
      el.classList.toggle('is-empty', cart.item_count === 0);
    });
    document.querySelectorAll('[data-cart-title-count]').forEach(function (el) {
      el.textContent = cart.item_count > 0 ? '(' + cart.item_count + ')' : '';
    });
    var bodies = document.querySelectorAll('[data-cart-items]');
    if (!bodies.length) return;
    var linesHTML;
    if (!cart.items.length) {
      // the drawer snippet ships the empty state (grind loop + shop CTA) in a
      // <template> because asset URLs aren't reachable from JS
      var emptyTpl = document.querySelector('template[data-cart-empty-tpl]');
      linesHTML = emptyTpl ? emptyTpl.innerHTML : '<div class="cart-drawer__empty">Your cart is empty.</div>';
    } else {
      linesHTML = cart.items.map(function (it, i) {
        var pd = cartData.products && cartData.products[it.product_id];
        var bundleName = it.properties && it.properties._bundle;
        var curOpts = it.options_with_values || [];
        var curSize = pd && it.variant_options ? it.variant_options[pd.sizePos] : null;
        var curGrind = pd && pd.grindPos > -1 && it.variant_options ? it.variant_options[pd.grindPos] : (it.properties && it.properties.Grind) || null;

        // inline controls: size segmented buttons + grind select (mockup)
        var controls = '';
        if (pd && pd.sizes && pd.sizes.length > 1) {
          controls += '<div class="cart-item__size" role="group" aria-label="Size" style="--n:' + pd.sizes.length + ';--i:' + pd.sizes.indexOf(curSize) + '">' +
            '<span class="cart-item__size-ink" aria-hidden="true"></span>' +
            pd.sizes.map(function (s) {
              return '<button type="button" data-cart-size="' + esc(s) + '"' + (s === curSize ? ' class="is-active"' : '') + ' aria-pressed="' + (s === curSize) + '">' + esc(sizeLabel(s)).toUpperCase() + '</button>';
            }).join('') + '</div>';
        }
        var grindChoices = pd && pd.grinds && pd.grinds.length ? pd.grinds
          : ((it.properties && Object.prototype.hasOwnProperty.call(it.properties, 'Grind')) ? ['Whole Bean', 'Coarse', 'Medium', 'Fine'] : null);
        if (grindChoices) {
          controls += '<div class="cart-item__grind"><select data-cart-grind aria-label="Grind">' +
            grindChoices.map(function (g) {
              return '<option value="' + esc(g) + '"' + (g === curGrind ? ' selected' : '') + '>' + esc(g) + '</option>';
            }).join('') + '</select><div class="caret">▾</div></div>';
        }
        if (controls) {
          controls = '<div class="cart-item__controls">' + controls + '</div>';
        }

        var props = [];
        if (!controls && it.variant_title && it.variant_title !== 'Default Title') props.push(esc(sizeLabel(it.variant_title)));
        if (it.properties) {
          Object.keys(it.properties).forEach(function (k) {
            if (k.charAt(0) !== '_' && it.properties[k] && !(grindChoices && k === 'Grind')) props.push(esc(it.properties[k]));
          });
        }

        // subscription toggle + frequency chips (mockup in-cart upsell)
        var subBlock = '';
        var plans = pd && pd.plans && pd.plans.length ? pd.plans : null;
        var alloc = it.selling_plan_allocation;
        if (plans || alloc) {
          var on = !!alloc;
          var isB = !!bundleName;
          var planName = alloc ? planLabel(alloc.selling_plan.name) : '';
          var label;
          if (isB) label = on ? 'Bundle Subscription · ' + planName : 'Bundle · Subscribe &amp; Save';
          else label = on ? 'Subscription · ' + planName : 'Subscribe &amp; Save';
          subBlock = '<button type="button" class="cart-item__subtoggle' + (on ? ' is-on' : '') + (isB && !on ? ' is-bundle' : '') + '" data-cart-sub aria-expanded="' + on + '">' +
            '<span class="cart-item__subtoggle-label">' + (isB && !on ? FREQ_ICON_BOX : FREQ_ICON_SUB) + '<span>' + label + '</span></span>' +
            '<span class="cart-item__switch" aria-hidden="true"><i></i></span></button>';
          if (on && plans) {
            subBlock += '<div class="cart-item__freqs' + (freqsEnterVariant === it.variant_id ? ' is-entering' : '') + '">' + plans.map(function (pl) {
              var active = alloc && String(alloc.selling_plan.id) === String(pl.id);
              return '<button type="button" data-cart-freq="' + pl.id + '"' + (active ? ' class="is-active"' : '') +
                ' aria-pressed="' + !!active + '" aria-label="' + esc(planLabel(pl.name)) + '">' +
                esc(chipLabel(pl.name)) + '</button>';
            }).join('') + '</div>';
          }
        }
        // bundle identity + the all-bags rule live in one compact caption
        // under the name (the mockup's condensed bundle line)
        var bundleNote = bundleName
          ? '<div class="cart-item__bundlenote">' + esc(bundleName) + ' · edits apply to all bags</div>'
          : '';

        return (
          '<div class="cart-item" data-line="' + (i + 1) + '" data-product-id="' + it.product_id + '">' +
            '<div class="cart-item__top">' +
              '<a class="cart-item__img" href="' + it.url + '">' +
                (it.image ? '<img src="' + it.image.replace(/(\.[a-z]+)(\?|$)/, '_200x$1$2') + '" alt="">' : '') +
              '</a>' +
              '<div class="cart-item__body">' +
                '<div class="cart-item__head">' +
                  '<a class="cart-item__name" href="' + it.url + '">' + esc(it.product_title) + '</a>' +
                  '<button type="button" class="cart-item__remove" data-qty-set="0" aria-label="Remove ' + esc(it.product_title) + '">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>' +
                  '</button>' +
                '</div>' +
                bundleNote +
                (props.length ? '<div class="cart-item__meta">' + props.join(' · ') + '</div>' : '') +
                controls +
              '</div>' +
            '</div>' +
            '<div class="cart-item__bar">' +
              '<div class="cart-item__qty">' +
                '<button type="button" data-qty-change="-1" aria-label="Decrease quantity">−</button>' +
                '<span>' + it.quantity + '</span>' +
                '<button type="button" data-qty-change="1" aria-label="Increase quantity">+</button>' +
              '</div>' +
              '<div class="cart-item__price">' + money(it.final_line_price) + '</div>' +
            '</div>' + subBlock +
          '</div>'
        );
      }).join('');
    }
    bodies.forEach(function (body) {
      body.innerHTML = linesHTML;
      if (undoState) {
        var row = document.createElement('div');
        row.className = 'cart-undo';
        row.setAttribute('data-cart-undo-row', '');
        row.innerHTML = '<span class="cart-undo__text">' + esc(undoState.title) + ' removed</span>' +
          '<button type="button" class="sq-btn sq-btn--soft cart-undo__btn" data-cart-undo>Undo</button>';
        var at = body.querySelectorAll('.cart-item')[undoState.index];
        if (at) body.insertBefore(row, at); else body.appendChild(row);
      }
    });
    freqsEnterVariant = null;
    // footer: pre-discount subtotal + savings rows + checkout amount (mockup)
    var subSave = 0, bundleSave = 0, subCount = 0, subGroups = {};
    cart.items.forEach(function (it) {
      var save = (it.original_line_price || 0) - (it.final_line_price || 0);
      if (save <= 0) return;
      if (it.selling_plan_allocation) {
        subSave += save;
        // a subscribed bundle's 10% is one saving off its total, so its
        // bags count as one item here, not three
        var gk = bundleKeyOf(it);
        if (!gk) subCount++;
        else if (!subGroups[gk]) { subGroups[gk] = 1; subCount++; }
      }
      else if (it.properties && it.properties._bundle) bundleSave += save;
      else subSave += save;
    });
    document.querySelectorAll('[data-cart-total]').forEach(function (totalEl) {
      totalEl.textContent = money(cart.original_total_price != null ? cart.original_total_price : cart.total_price);
    });
    var ss = document.querySelector('[data-cart-sub-savings]');
    if (ss) {
      ss.hidden = subSave <= 0;
      var ssl = ss.querySelector('[data-cart-sub-savings-label]');
      if (ssl) ssl.textContent = 'Subscription savings' + (subCount > 1 ? ' (' + subCount + ' items)' : '');
      var ssa = ss.querySelector('[data-cart-sub-savings-amt]');
      if (ssa) ssa.textContent = '−' + money(subSave);
    }
    var bs = document.querySelector('[data-cart-bundle-savings]');
    if (bs) {
      bs.hidden = bundleSave <= 0;
      var bsa = bs.querySelector('[data-cart-bundle-savings-amt]');
      if (bsa) bsa.textContent = '−' + money(bundleSave);
    }
    var co = document.querySelector('[data-cart-checkout-total]');
    if (co) co.textContent = money(cart.total_price);
    var foot = document.querySelector('[data-cart-foot]');
    if (foot) foot.hidden = !cart.items.length;
    var clr = document.querySelector('[data-cart-clear]');
    if (clr) clr.hidden = !cart.items.length;
  }

  /* Cart writes run one at a time so rapid taps can't race each other;
     body.cart-pending dims prices and holds checkout until the server
     confirms (the tapped control has already updated optimistically). */
  var cartQueue = Promise.resolve(), cartPending = 0;
  function enqueueCart(task) {
    cartPending++;
    document.body.classList.add('cart-pending');
    var done = function () {
      if (--cartPending <= 0) { cartPending = 0; document.body.classList.remove('cart-pending'); }
    };
    cartQueue = cartQueue.then(task).then(done, function () { done(); return fetchCart(); })
      .catch(function () {}); // a failed redraw must never stall later taps
    return cartQueue;
  }

  function fetchCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (c) { renderCart(c); return c; });
  }

  // line: a 1-based line number, or a line item key (stable across the
  // reordering a swap causes, so queued taps can't hit the wrong line)
  function changeLine(line, qty) {
    var body = typeof line === 'string' ? { id: line, quantity: qty } : { line: line, quantity: qty };
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('cart change ' + r.status);
      return r.json();
    }).then(renderCart);
  }
  function lineKeyAt(idx) {
    var it = lastCart && lastCart.items[idx - 1];
    return it ? it.key : idx;
  }

  /* Custom-bundle lines change as one unit: a grind, size, or subscription
     edit on any bag applies to every line in the same bundle group, so a
     bundle can never end up with mismatched bags or a single subscribed
     roast. Groups key on the hidden _bundle_key property the builder adds
     (falling back to the _bundle name for lines added before it existed). */
  function bundleKeyOf(it) {
    var p = it && it.properties;
    return p && p._bundle ? (p._bundle_key || p._bundle) : null;
  }
  function bundleLinesOf(cart, it) {
    var k = bundleKeyOf(it);
    if (!k) return [it];
    return cart.items.filter(function (x) { return bundleKeyOf(x) === k; });
  }

  // swap lines to different variants / selling plans / properties in one
  // pass, keeping qty: zero them together, then re-add together
  function swapLines(swaps) {
    var updates = {};
    swaps.forEach(function (s) { updates[s.item.key] = 0; });
    return fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ updates: updates })
    }).then(function () {
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: swaps.map(function (s) {
          var add = { id: s.variantId || s.item.variant_id, quantity: s.item.quantity, properties: s.properties || s.item.properties || {} };
          if (s.planId) add.selling_plan = s.planId;
          return add;
        }) })
      });
    }).then(fetchCart);
  }
  function swapLine(item, newVariantId, newPlanId) {
    return swapLines([{ item: item, variantId: newVariantId, planId: newPlanId }]);
  }
  function keptPlanOf(it) {
    return it.selling_plan_allocation ? it.selling_plan_allocation.selling_plan.id : null;
  }

  function lineItemFromCart(cart, lineIdx) { return cart.items[lineIdx - 1]; }

  function initCart(root) {
    readCartData(document);
    root.querySelectorAll('[data-cart-toggle]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) { e.preventDefault(); openCart(); fetchCart(); });
    });
    root.querySelectorAll('[data-cart-close]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      el.addEventListener('click', closeCart);
    });
    /* ≤767 bottom sheet: drag the grab handle (or either pane head) down to
       dismiss. The sheet follows the finger; releasing past 110px, or a
       quick flick, closes it — otherwise it springs back. */
    (function () {
      var drawer = document.querySelector('.cart-drawer');
      if (!drawer || drawer.dataset.dragBound) return;
      drawer.dataset.dragBound = '1';
      var startY = 0, dy = 0, dragging = false, t0 = 0;
      function onStart(e) {
        if (!isPhone() || document.body.dataset.cartStatus !== 'open') return;
        dragging = true; dy = 0; t0 = Date.now();
        startY = e.touches[0].clientY;
        drawer.style.transition = 'none';
      }
      function onMove(e) {
        if (!dragging) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        drawer.style.transform = 'translateY(' + dy + 'px)';
      }
      function onEnd() {
        if (!dragging) return;
        dragging = false;
        drawer.style.transition = '';
        drawer.style.transform = '';
        var flick = dy > 40 && (Date.now() - t0) < 260;
        if (dy > 110 || flick) closeCart();
      }
      drawer.querySelectorAll('.cart-drawer__grab, .cart-drawer__head').forEach(function (el) {
        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: true });
        el.addEventListener('touchend', onEnd);
        el.addEventListener('touchcancel', onEnd);
      });
    })();
    /* in-cart auth pane: slide between the cart and Account views (mockup) */
    var slider = document.querySelector('.cart-drawer__slider');
    if (slider && !slider.dataset.authBound) {
      slider.dataset.authBound = '1';

      /* Sign in with Shop completes in a popup without a page load, so the
         pane can't rely on server-rendered customer state. Probe the
         classic-account session by following /account to wherever it lands:
         guests end up on the login page, signed-in customers stay on the
         account page (redirects for locale prefixes or URL normalization
         don't fool it). On sign-in, flip the pane to the success state and
         drop the guest note in place. */
      var authDone = slider.querySelector('[data-cart-auth-done]');
      var authPoll = null;
      function markSignedIn() {
        stopAuthWatch();
        slider.querySelectorAll('[data-cart-auth-form]').forEach(function (f) { f.hidden = true; });
        slider.querySelectorAll('.cart-auth__divider, .cart-auth__shop').forEach(function (el) { el.hidden = true; });
        if (authDone) authDone.hidden = false;
        document.querySelectorAll('.cart-drawer__guest').forEach(function (el) { el.hidden = true; });
      }
      function checkSignedIn() {
        if (!authDone || !authDone.hidden) return;
        var accountUrl = authDone.dataset.accountUrl || '/account';
        fetch(accountUrl, { redirect: 'follow', credentials: 'same-origin', headers: { Accept: 'text/html' } })
          .then(function (r) {
            if (r.ok && r.url.indexOf('/login') === -1 && r.url.indexOf('/account') !== -1) markSignedIn();
          })
          .catch(function () {});
      }
      function startAuthWatch() {
        if (!authDone || !authDone.hidden || authPoll) return;
        checkSignedIn();
        authPoll = setInterval(function () {
          if (document.body.dataset.cartStatus !== 'open' || slider.dataset.cartView !== 'auth') { stopAuthWatch(); return; }
          checkSignedIn();
        }, 2500);
      }
      function stopAuthWatch() {
        if (authPoll) { clearInterval(authPoll); authPoll = null; }
      }
      /* the popup (or in-page Shop modal) closing hands focus/visibility
         back to the page — check right away; also re-check whenever the
         drawer opens, in case the session appeared without a page load */
      window.addEventListener('focus', function () {
        if (slider.dataset.cartView === 'auth') checkSignedIn();
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && slider.dataset.cartView === 'auth') checkSignedIn();
      });
      window.__cartAuthCheck = checkSignedIn;

      document.addEventListener('click', function (e) {
        var open = e.target.closest('[data-cart-auth-open]');
        if (open) { e.preventDefault(); slider.dataset.cartView = 'auth'; startAuthWatch(); return; }
        if (e.target.closest('[data-cart-auth-back]')) { slider.dataset.cartView = 'cart'; stopAuthWatch(); return; }
        if (e.target.closest('[data-cart-close]')) { stopAuthWatch(); return; }
        var show = e.target.closest('[data-cart-auth-show]');
        if (show) {
          slider.querySelectorAll('[data-cart-auth-form]').forEach(function (f) {
            f.hidden = f.dataset.cartAuthForm !== show.dataset.cartAuthShow;
          });
        }
      });
    }
    var clearBtn = document.querySelector('[data-cart-clear]');
    if (clearBtn && !clearBtn.dataset.bound) {
      clearBtn.dataset.bound = '1';
      /* Clear Cart: the lines slide off one after another while the
         checkout card drops away, then the empty state rises in. The clear
         request runs alongside the animation; the redraw waits for both. */
      clearBtn.addEventListener('click', function () {
        var drawer = clearBtn.closest('.cart-drawer');
        if (!drawer || drawer.classList.contains('is-clearing')) return;
        var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var lines = drawer.querySelectorAll('.cart-item, .cart-undo');
        lines.forEach(function (el, i) { el.style.setProperty('--clear-i', Math.min(i, 6)); });
        drawer.classList.add('is-clearing');
        var outMs = still ? 200 : Math.max(560, 420 + Math.min(lines.length - 1, 6) * 70);
        var wait = new Promise(function (res) { setTimeout(res, outMs); });
        enqueueCart(function () {
          var req = fetch('/cart/clear.js', { method: 'POST', headers: { Accept: 'application/json' } })
            .then(function (r) { return r.json(); });
          return Promise.all([req, wait]).then(function (r) {
            renderCart(r[0]);
            drawer.classList.remove('is-clearing');
            if (still) return;
            drawer.classList.add('is-cleared');
            setTimeout(function () { drawer.classList.remove('is-cleared'); }, 900);
          }, function (err) { drawer.classList.remove('is-clearing'); throw err; });
        });
      });
    }
    root.querySelectorAll('[data-cart-items]').forEach(function (items) {
      if (items.dataset.bound) return;
      items.dataset.bound = '1';
      function withLine(target, fn) {
        var lineEl = target.closest('.cart-item');
        if (!lineEl) return;
        var idx = parseInt(lineEl.dataset.line, 10);
        lineEl.classList.add('is-pending');
        var key = lineKeyAt(idx);
        var run = function (cart) {
          var it = null;
          cart.items.forEach(function (x) { if (x.key === key) it = x; });
          var res = fn(it || lineItemFromCart(cart, idx), idx, lineEl, cart);
          // nothing to send: drop the optimistic state back to the truth
          if (!res) renderCart(cart);
          return res;
        };
        // the drawer was drawn from lastCart, so its line numbers match it
        enqueueCart(function () {
          return lastCart ? run(lastCart)
            : fetch('/cart.js', { headers: { Accept: 'application/json' } })
                .then(function (r) { return r.json(); }).then(run);
        });
      }
      // optimistic quantity: show the new count and line price now, send one
      // request once the taps settle
      var qtyTimers = {}, qtyWant = {};
      function stepQty(line, idx, delta) {
        var span = line.querySelector('.cart-item__qty span');
        var cur = qtyWant[idx] != null ? qtyWant[idx] : parseInt(span.textContent, 10);
        var next = Math.max(0, cur + delta);
        if (next === 0) { removeLine(line, idx); return; }
        qtyWant[idx] = next;
        span.textContent = next;
        var it = lastCart && lastCart.items[idx - 1];
        var priceEl = line.querySelector('.cart-item__price');
        if (it && priceEl && it.quantity) priceEl.textContent = money(Math.round(it.final_line_price / it.quantity) * next);
        var roll = delta > 0 ? 'is-roll-up' : 'is-roll-down';
        [span, priceEl].forEach(function (el) {
          if (!el) return;
          el.classList.remove('is-roll-up', 'is-roll-down');
          replayMotion(el, roll);
        });
        line.classList.add('is-pending');
        clearTimeout(qtyTimers[idx]);
        var key = lineKeyAt(idx);
        qtyTimers[idx] = setTimeout(function () {
          var want = qtyWant[idx];
          delete qtyWant[idx];
          enqueueCart(function () { return changeLine(key, want); });
        }, 320);
      }
      function removeLine(line, idx) {
        clearTimeout(qtyTimers[idx]);
        delete qtyWant[idx];
        var gone = lastCart && lastCart.items[idx - 1];
        if (undoState) clearTimeout(undoState.timer);
        undoState = gone ? {
          index: idx - 1,
          title: gone.product_title,
          add: { id: gone.variant_id, quantity: gone.quantity, properties: gone.properties || {},
                 selling_plan: gone.selling_plan_allocation ? gone.selling_plan_allocation.selling_plan.id : undefined },
          timer: setTimeout(dismissUndo, 5000)
        } : null;
        line.classList.add('is-removing');
        var key = lineKeyAt(idx);
        enqueueCart(function () { return changeLine(key, 0); });
      }
      function dismissUndo() {
        if (undoState) clearTimeout(undoState.timer);
        undoState = null;
        document.querySelectorAll('[data-cart-undo-row]').forEach(function (r) {
          r.classList.add('is-leaving');
          setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 300);
        });
      }
      items.addEventListener('click', function (e) {
        if (e.target.closest('[data-cart-undo]')) {
          var u = undoState;
          dismissUndo();
          if (u) enqueueCart(function () {
            return fetch('/cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ items: [u.add] })
            }).then(fetchCart);
          });
          return;
        }
        var line = e.target.closest('.cart-item');
        if (!line) return;
        var idx = parseInt(line.dataset.line, 10);
        var stepBtn = e.target.closest('[data-qty-change]');
        var setBtn = e.target.closest('[data-qty-set]');
        var sizeBtn = e.target.closest('[data-cart-size]');
        var subBtn = e.target.closest('[data-cart-sub]');
        var freqBtn = e.target.closest('[data-cart-freq]');
        if (stepBtn) {
          stepQty(line, idx, parseInt(stepBtn.dataset.qtyChange, 10));
        } else if (setBtn) {
          var setTo = parseInt(setBtn.dataset.qtySet, 10);
          if (setTo === 0) removeLine(line, idx);
          else { var setKey = lineKeyAt(idx); enqueueCart(function () { return changeLine(setKey, setTo); }); }
        } else if (sizeBtn && !sizeBtn.classList.contains('is-active')) {
          var sizeBtns = Array.prototype.slice.call(sizeBtn.parentNode.querySelectorAll('[data-cart-size]'));
          sizeBtns.forEach(function (b) { b.classList.toggle('is-active', b === sizeBtn); b.setAttribute('aria-pressed', String(b === sizeBtn)); });
          sizeBtn.parentNode.style.setProperty('--i', sizeBtns.indexOf(sizeBtn));
          replayMotion(line.querySelector('.cart-item__img'), 'is-sway');
          withLine(sizeBtn, function (it, _i, _el, cart) {
            if (!it) return;
            var want = sizeBtn.dataset.cartSize;
            var swaps = [];
            bundleLinesOf(cart, it).forEach(function (ln) {
              var pd = cartData.products && cartData.products[ln.product_id];
              if (!pd) return;
              var target = null, fallback = null;
              (pd.variants || []).forEach(function (v) {
                if (v.opts[pd.sizePos] !== want) return;
                var same = v.opts.every(function (o, k) { return k === pd.sizePos || o === (ln.variant_options || [])[k]; });
                if (same && !target && v.available) target = v;
                if (same && !fallback) fallback = v;
                if (!fallback && v.available) fallback = v;
              });
              var v = target || fallback;
              if (v) swaps.push({ item: ln, variantId: v.id, planId: keptPlanOf(ln) });
            });
            if (swaps.length) return swapLines(swaps);
          });
        } else if (subBtn) {
          subBtn.classList.toggle('is-on');
          subBtn.setAttribute('aria-expanded', String(subBtn.classList.contains('is-on')));
          replayMotion(subBtn.querySelector('.cart-item__switch'), 'is-hop');
          // switching off: fold the frequency chips away before the redraw drops them
          var freqRow = subBtn.nextElementSibling;
          if (!subBtn.classList.contains('is-on') && freqRow && freqRow.classList.contains('cart-item__freqs')) {
            freqRow.classList.remove('is-entering');
            freqRow.classList.add('is-leaving');
          }
          var subIt = lastCart && lastCart.items[idx - 1];
          freqsEnterVariant = subBtn.classList.contains('is-on') && subIt ? subIt.variant_id : null;
          withLine(subBtn, function (it, _i, _el, cart) {
            if (!it) return;
            var turnOn = !it.selling_plan_allocation;
            var swaps = [];
            bundleLinesOf(cart, it).forEach(function (ln) {
              var pd = cartData.products && cartData.products[ln.product_id];
              if (turnOn) {
                // keep an already-subscribed bag's plan; give the rest their
                // own product's first plan
                var planId = keptPlanOf(ln) || (pd && pd.plans && pd.plans.length ? pd.plans[0].id : null);
                if (planId) swaps.push({ item: ln, planId: planId });
              } else if (ln.selling_plan_allocation) {
                swaps.push({ item: ln, planId: null });
              }
            });
            if (swaps.length) return swapLines(swaps);
          });
        } else if (freqBtn && !freqBtn.classList.contains('is-active')) {
          freqBtn.parentNode.querySelectorAll('[data-cart-freq]').forEach(function (b) {
            b.classList.toggle('is-active', b === freqBtn);
            b.setAttribute('aria-pressed', String(b === freqBtn));
          });
          withLine(freqBtn, function (it, _i, _el, cart) {
            if (!it) return;
            var pid = parseInt(freqBtn.dataset.cartFreq, 10);
            // other bags in the bundle are different products with their own
            // plan ids — match the chosen frequency by label, then by index
            var itPd = cartData.products && cartData.products[it.product_id];
            var wantLabel = null, wantIdx = -1;
            ((itPd && itPd.plans) || []).forEach(function (pl, i) {
              if (String(pl.id) === String(pid)) { wantLabel = planLabel(pl.name); wantIdx = i; }
            });
            var swaps = [];
            bundleLinesOf(cart, it).forEach(function (ln) {
              if (ln === it) { swaps.push({ item: ln, planId: pid }); return; }
              if (!ln.selling_plan_allocation) return;
              var plans = ((cartData.products || {})[ln.product_id] || {}).plans || [];
              var match = null;
              plans.forEach(function (pl) { if (!match && wantLabel && planLabel(pl.name) === wantLabel) match = pl; });
              if (!match && wantIdx > -1) match = plans[wantIdx];
              if (match) swaps.push({ item: ln, planId: match.id });
            });
            if (swaps.length) return swapLines(swaps);
          });
        }
      });
      items.addEventListener('change', function (e) {
        var sel = e.target.closest('[data-cart-grind]');
        if (!sel) return;
        replayMotion(sel.closest('.cart-item') && sel.closest('.cart-item').querySelector('.cart-item__img'), 'is-sway');
        withLine(sel, function (it, _i, _el, cart) {
          if (!it) return;
          var want = sel.value;
          var swaps = [];
          bundleLinesOf(cart, it).forEach(function (ln) {
            var pd = cartData.products && cartData.products[ln.product_id];
            if (pd && pd.grindPos > -1) {
              var target = null;
              (pd.variants || []).forEach(function (v) {
                if (v.opts[pd.grindPos] !== want) return;
                var same = v.opts.every(function (o, k) { return k === pd.grindPos || o === (ln.variant_options || [])[k]; });
                if (same && (!target || (v.available && !target.available))) target = v;
              });
              if (target) swaps.push({ item: ln, variantId: target.id, planId: keptPlanOf(ln) });
            } else if (ln === it || (ln.properties && Object.prototype.hasOwnProperty.call(ln.properties, 'Grind'))) {
              // grind is a line-item property: carry it on the re-added line
              var props = {};
              Object.keys(ln.properties || {}).forEach(function (k) { props[k] = ln.properties[k]; });
              props.Grind = want;
              swaps.push({ item: ln, properties: props, planId: keptPlanOf(ln) });
            }
          });
          if (swaps.length) return swapLines(swaps);
        });
      });
    });
    if (!document.body.dataset.escBound) {
      document.body.dataset.escBound = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeCart(); document.body.dataset.menuStatus = 'closed'; }
      });
    }
  }

  /* ---- Add-to-cart forms (product page, cards, hero bundle) ------------- */
  // the add button plays its check first; the cart opens once it's done
  var CHECK_MS = 750;
  function addItems(items, btn, qty) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: items })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json();
    }).then(function () {
      if (btn) flashAdded(btn, qty);
      // render right away, then re-render once cart-data has the new
      // product — its size/grind/plan controls need that payload, and
      // racing it left first-added lines without controls. Both renders
      // land before the drawer opens (while the check plays), so no heavy
      // re-render runs during its slide; a slow store never holds it past 1.6s
      var t0 = Date.now();
      fetchCart();
      var rendered = refreshCartData().then(fetchCart);
      var cap = new Promise(function (res) { setTimeout(res, 1600); });
      return Promise.race([rendered, cap]).then(function () {
        setTimeout(openCart, Math.max(0, (btn ? CHECK_MS : 0) - (Date.now() - t0)));
        return rendered;
      });
    });
  }

  function flashAdded(btn, qty) {
    var label = btn.querySelector('.button-039__text');
    var prevPill = btn.style.getPropertyValue('--button-039-color-background');
    var prevHTML = null;
    btn.classList.add('is-added');
    if (label) {
      var prev = label.textContent;
      label.textContent = qty > 1 ? '✓ Added (' + qty + ')!' : '✓ Added!';
      btn.style.setProperty('--button-039-color-background', '#30a050');
    } else if (!btn.classList.contains('button-039')) {
      // icon button: swap the plus for a check that draws itself in; the
      // card's wide button keeps its label, reading "Added"
      prevHTML = btn.innerHTML;
      var wide = btn.querySelector('.roast-card__add-label');
      btn.innerHTML = '<svg class="icon-btn__check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + (wide ? '#1a1a1a' : '#f0ede8') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" pathLength="1"/></svg>' + (wide ? '<span class="roast-card__add-label">Added</span>' : '');
    }
    setTimeout(function () {
      btn.classList.remove('is-added');
      if (label) {
        label.textContent = prev;
        if (prevPill) btn.style.setProperty('--button-039-color-background', prevPill);
        else btn.style.removeProperty('--button-039-color-background');
      } else if (prevHTML !== null) {
        btn.innerHTML = prevHTML;
      }
    }, 2000);
  }

  function initAddForms(root) {
    root.querySelectorAll('form[data-ajax-add]').forEach(function (form) {
      if (form.dataset.bound) return; form.dataset.bound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var item = { id: parseInt(fd.get('id'), 10), quantity: parseInt(fd.get('quantity') || '1', 10), properties: {} };
        var plan = fd.get('selling_plan');
        if (plan) item.selling_plan = parseInt(plan, 10);
        fd.forEach(function (v, k) {
          var m = k.match(/^properties\[(.+)\]$/);
          if (m && v) item.properties[m[1]] = v;
        });
        // the button actually pressed (the PDP has a desktop and a phone/tablet
        // Add to Cart; only one is visible), else the first visible submit
        var sub = e.submitter || [].filter.call(form.querySelectorAll('[type="submit"]'), function (b) { return b.offsetParent; })[0] || form.querySelector('[type="submit"]');
        addItems([item], sub, item.quantity).catch(function (err) { alert((err && err.description) || 'Could not add to cart.'); });
      });
    });
    // one-click add (cards) & multi-add (hero "Buy Bundle")
    root.querySelectorAll('[data-add-variants]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var ids = (btn.dataset.addVariants || '').split(',').filter(Boolean);
        if (!ids.length) return;
        var bundleName = btn.dataset.addBundleName;
        addItems(ids.map(function (entry) {
          var parts = entry.split(':');
          var item = { id: parseInt(parts[0], 10), quantity: parseInt(parts[1] || '1', 10) };
          if (bundleName) item.properties = { _bundle: bundleName };
          return item;
        }), btn)
          .catch(function (err) { alert((err && err.description) || 'Could not add to cart.'); });
      });
    });
  }

  /* ---- Product cards: size pick updates price + variant ------------------ */
  function initCards(root) {
    root.querySelectorAll('[data-roast-card]').forEach(function (card) {
      if (card.dataset.bound) return; card.dataset.bound = '1';
      var dataEl = card.querySelector('[data-variants-json]');
      var variants = dataEl ? JSON.parse(dataEl.textContent) : [];
      card.addEventListener('click', function (e) {
        var sizeBtn = e.target.closest('[data-size-option]');
        if (!sizeBtn) return;
        card.querySelectorAll('[data-size-option]').forEach(function (b) { b.classList.remove('is-active'); });
        sizeBtn.classList.add('is-active');
        var v = variants.filter(function (x) { return String(x.id) === sizeBtn.dataset.variantId; })[0];
        if (!v) return;
        var qty = parseInt(card.dataset.bundleQty || '1', 10);
        var pct = parseFloat(card.dataset.bundleDiscountPct || '0');
        var priceEl = card.querySelector('[data-card-price]');
        if (priceEl) priceEl.textContent = money(Math.round(v.price * qty * (1 - pct / 100)));
        var cmpEl = card.querySelector('[data-card-compare]');
        if (cmpEl) cmpEl.textContent = money(Math.round((v.compare && v.compare > v.price ? v.compare : v.price) * qty));
        var addBtn = card.querySelector('[data-add-variants]');
        if (addBtn) addBtn.dataset.addVariants = v.id + (qty > 1 ? ':' + qty : '');
      });
    });
  }

  /* ---- Cursor-follow "roast pop" pill ------------------------------------
     One document-level tracker instead of per-element handlers (product
     cards are excluded; the tractor beam keeps its pill): the pill
     follows the cursor, the innermost [data-pop] under it wins (so a size
     button overrides its card, and leaving the button falls back to the
     card's roast pop instead of killing the pill). */
  var popEl = null, popSource = null, popsStarted = false;
  function initPops() {
    if (popsStarted) return; popsStarted = true;
    if (window.matchMedia('(pointer:coarse)').matches) return;
    document.addEventListener('mousemove', function (e) {
      var el = e.target.closest ? e.target.closest('[data-pop]') : null;
      // product cards (roast, 3-pack and bundle cards) skip the pill; the
      // tractor-beam bags and the other pop sources keep it
      if (el && el.closest('.roast-card')) el = null;
      if (el) {
        if (!popEl) {
          popEl = document.createElement('div');
          popEl.className = 'roast-pop-wrap';
          popEl.innerHTML = '<div class="roast-pop"></div>';
          document.body.appendChild(popEl);
        }
        if (el !== popSource) {
          popSource = el;
          if (el.dataset.popName) {
            // 3-line roast info card (hero bags): pill svg stroked in the
            // roast colour, LEVEL · price / name / flavour notes
            var lc = el.dataset.popLc || '#e06d2d';
            var clip = document.querySelector('#shop-pill-clip path');
            var d = clip ? clip.getAttribute('d') : '';
            popEl.innerHTML = '<div class="roast-pop-card">' +
              '<svg class="roast-pop-card__bg" viewBox="0 0 226 82" fill="none" preserveAspectRatio="none" style="filter:drop-shadow(6px 6px 0 #1a1a1a)"><path d="' + d + '" fill="#f0ede8" stroke="' + lc + '" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>' +
              '<div class="roast-pop-card__in">' +
                '<div class="roast-pop-card__meta" style="color:' + lc + '"></div>' +
                '<div class="roast-pop-card__name"></div>' +
                '<div class="roast-pop-card__notes"></div>' +
              '</div></div>';
            popEl.querySelector('.roast-pop-card__meta').textContent = el.dataset.pop || '';
            popEl.querySelector('.roast-pop-card__name').textContent = el.dataset.popName;
            popEl.querySelector('.roast-pop-card__notes').textContent = el.dataset.popNotes || '';
            popEl.style.setProperty('--pop-sh', 'transparent');
          } else {
            popEl.innerHTML = '<div class="roast-pop"></div>';
            var pill = popEl.firstChild;
            pill.textContent = el.dataset.pop;
            var bg = el.dataset.popBg || '#f0ede8';
            pill.style.background = bg;
            pill.style.color = el.dataset.popFg || '#1a1a1a';
            popEl.style.setProperty('--pop-sh', (bg === '#1a1a1a' || bg === '#090705') ? '#f0ede8' : '#1a1a1a');
          }
        }
        popEl.style.display = 'block';
        // card mode flips to the left of the cursor near the right edge
        if (popSource.dataset.popName && e.clientX + 24 + 384 > window.innerWidth) {
          popEl.style.left = Math.max(8, e.clientX - 384) + 'px';
        } else {
          popEl.style.left = e.clientX + 'px';
        }
        popEl.style.top = e.clientY + 'px';
      } else if (popEl && popEl.style.display !== 'none') {
        popEl.style.display = 'none';
        popSource = null;
      }
    }, { passive: true });
  }

  /* ---- Horizontal scroll rows -------------------------------------------- */
  // one card + gap, measured on the first visible card (the roast filter
  // hides cards with display:none, which measure 0 wide)
  function rowStride(row) {
    var gap = parseFloat(getComputedStyle(row).columnGap) || 14;
    for (var i = 0; i < row.children.length; i++) {
      var w = row.children[i].offsetWidth;
      if (w) return w + gap;
    }
    return row.clientWidth;
  }

  /* Desktop carousels scroll like the PDP reviews row: snap card by card
     (CSS, >=1024) and a mouse can drag them like a touch swipe, settling
     on the nearest card when released. A drag never fires the card link. */
  var DRAG_ROWS = '.scroll-row, .related__grid';
  function initDragRows(root) {
    var desk = window.matchMedia('(min-width: 1024px)');
    root.querySelectorAll(DRAG_ROWS).forEach(function (row) {
      if (row.dataset.drag) return; row.dataset.drag = '1';
      row.setAttribute('data-lenis-prevent-horizontal', '');
      var drag = null, swallow = false;
      row.addEventListener('dragstart', function (e) { if (desk.matches) e.preventDefault(); });
      row.addEventListener('pointerdown', function (e) {
        if (!desk.matches || e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target.closest('button, input, select, label')) return;
        drag = { x: e.clientX, left: row.scrollLeft, moved: false };
      });
      window.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < 4) return;
        if (!drag.moved) { drag.moved = true; row.classList.add('is-dragging'); }
        row.scrollLeft = drag.left - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!drag) return;
        var moved = drag.moved; drag = null;
        if (!moved) return;
        swallow = true; setTimeout(function () { swallow = false; }, 0);
        row.classList.remove('is-dragging');
        var stride = rowStride(row);
        var max = row.scrollWidth - row.clientWidth;
        row.scrollTo({ left: Math.min(max, Math.round(row.scrollLeft / stride) * stride), behavior: 'smooth' });
      });
      row.addEventListener('click', function (e) {
        if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; }
      }, true);
    });
  }

  function initScrollRows(root) {
    root.querySelectorAll('[data-scroll-prev],[data-scroll-next]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var row = document.getElementById(btn.dataset.scrollPrev || btn.dataset.scrollNext);
        if (!row || !row.children.length) return;
        // step exactly one card and land on a card boundary, so arrow clicks
        // agree with the mobile scroll-snap points instead of fighting them
        var stride = rowStride(row);
        var dir = btn.dataset.scrollPrev ? -1 : 1;
        var target = Math.round((row.scrollLeft + dir * stride) / stride) * stride;
        row.scrollTo({ left: target, behavior: 'smooth' });
      });
    });
  }

  /* iOS Safari intermittently abandons a mandatory snap mid-gesture and
     lets the row rest between cards. Belt-and-braces: once scrolling
     settles (and no finger is down), nudge the row to the nearest card
     boundary. On the boundary already → no-op. */
  function initSnapGuard(root) {
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    root.querySelectorAll('.scroll-row').forEach(function (row) {
      if (row.dataset.snapGuard) return; row.dataset.snapGuard = '1';
      var t = null, touching = false;
      function nudge() {
        if (touching || !row.children.length) return;
        var stride = rowStride(row);
        if (!stride) return;
        var max = row.scrollWidth - row.clientWidth;
        var target = Math.min(max, Math.max(0, Math.round(row.scrollLeft / stride) * stride));
        if (Math.abs(row.scrollLeft - target) > 2) row.scrollTo({ left: target, behavior: 'smooth' });
      }
      function arm() { clearTimeout(t); t = setTimeout(nudge, 180); }
      row.addEventListener('scroll', arm, { passive: true });
      row.addEventListener('touchstart', function () { touching = true; clearTimeout(t); }, { passive: true });
      row.addEventListener('touchend', function () { touching = false; arm(); }, { passive: true });
      row.addEventListener('touchcancel', function () { touching = false; arm(); }, { passive: true });
    });
  }

  /* ---- Reviews marquee ------------------------------------------------------
     Duplicated track driven by rAF in pixels with modulo wrapping — the
     CSS keyframe version translated a ~6000px composited layer by
     percentages, which iOS Safari intermittently renders blank. Constant
     px/s speed (slower on phones), hover pause, reduced-motion static. */
  function initMarquee(root) {
    root.querySelectorAll('[data-marquee]').forEach(function (track) {
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
          // only the centre bag navigates, so only it advertises "Learn More"
          if (d === 0) {
            bag.setAttribute('data-pop', 'Learn More');
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
          if (i === idx) { window.location.href = slides[i].url; }
          else { idx = i; apply(); }
        }
      });
      apply();
      // centre-bag float: a JS sine riding inside the slot transform (via
      // --ufo-float), like the mockup — a CSS keyframe would stomp the
      // slot transition and make rotations snap.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

      // desktop: snap scroll. Once scrolling settles inside the steps, the
      // nearest step's copy glides to the middle of the screen, so one step
      // holds the stage at a time. Done in JS rather than CSS scroll-snap,
      // which would fight Lenis's eased scroll; it uses Lenis when running.
      // Near the section's ends it only snaps when close, so scrolling into or
      // out of the section never gets pulled back.
      var dq = window.matchMedia('(min-width: 1024px)');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var texts = Array.prototype.map.call(items, function (it) { return it.querySelector('.sticky-steps__text') || it; });
        var snapT = 0, snapping = false;
        var snap = function () {
          if (!dq.matches || snapping) return;
          var vh = window.innerHeight, best = -1, bd = Infinity;
          texts.forEach(function (t, i) {
            var r = t.getBoundingClientRect(), d = r.top + r.height / 2 - vh / 2;
            if (Math.abs(d) < Math.abs(bd)) { bd = d; best = i; }
          });
          if (best < 0 || Math.abs(bd) < 4 || Math.abs(bd) > vh * 0.5) return;
          if (best === 0 && bd > vh * 0.25) return;
          if (best === texts.length - 1 && bd < -vh * 0.25) return;
          var y = window.scrollY + bd;
          snapping = true;
          var done = function () { snapping = false; };
          if (window.__lenis && window.__lenis.scrollTo) window.__lenis.scrollTo(y, { duration: 0.7, onComplete: done });
          else { window.scrollTo({ top: y, behavior: 'smooth' }); setTimeout(done, 800); }
        };
        window.addEventListener('scroll', function () {
          if (snapping) return;
          clearTimeout(snapT); snapT = setTimeout(snap, 160);
        }, { passive: true });
      }

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

  /* ---- Quiz popup ---------------------------------------------------------- */
  function initQuiz(root) {
    root.querySelectorAll('[data-quiz]').forEach(function (quiz) {
      if (quiz.dataset.bound) return; quiz.dataset.bound = '1';
      document.querySelectorAll('[data-quiz-open]').forEach(function (b) {
        if (b.dataset.bound) return; b.dataset.bound = '1';
        b.addEventListener('click', function () {
          quiz.hidden = false;
          quiz.querySelectorAll('[data-quiz-result]').forEach(function (r) { r.hidden = true; });
          var q = quiz.querySelector('[data-quiz-question]');
          if (q) q.hidden = false;
        });
      });
      quiz.addEventListener('click', function (e) {
        if (e.target.closest('[data-quiz-close]') || e.target === quiz) { quiz.hidden = true; return; }
        var opt = e.target.closest('[data-quiz-answer]');
        if (opt) {
          var q = quiz.querySelector('[data-quiz-question]');
          if (q) q.hidden = true;
          var res = quiz.querySelector('[data-quiz-result="' + opt.dataset.quizAnswer + '"]') ||
                    quiz.querySelector('[data-quiz-result]');
          if (res) res.hidden = false;
        }
        if (e.target.closest('[data-quiz-retake]')) {
          quiz.querySelectorAll('[data-quiz-result]').forEach(function (r) { r.hidden = true; });
          var qq = quiz.querySelector('[data-quiz-question]');
          if (qq) qq.hidden = false;
        }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') quiz.hidden = true; });
    });
  }

  /* ---- Product page island -------------------------------------------------- */
  function initProduct(root) {
    root.querySelectorAll('[data-product-island]').forEach(function (el) {
      if (el.dataset.bound) return; el.dataset.bound = '1';
      var variants = JSON.parse(el.querySelector('[data-variants-json]').textContent);
      var form = el.querySelector('form[data-ajax-add]');
      if (!form) return;
      var sizePos = parseInt(el.dataset.sizePos || '0', 10);
      var grindPos = parseInt(el.dataset.grindPos || '-1', 10);
      var state = { qty: 1 };

      function currentVariant() {
        var id = form.querySelector('input[name="id"]').value;
        return variants.filter(function (v) { return String(v.id) === String(id); })[0];
      }
      function activeValue(sel) {
        var b = el.querySelector(sel + '.is-active');
        return b ? (b.dataset.sizeValue || b.dataset.grindValue) : null;
      }
      // pick the variant matching the selected size (+ grind when it's a real
      // option), preferring available combos
      function resolveVariant() {
        var size = activeValue('[data-size-value]');
        var grind = grindPos > -1 ? activeValue('[data-grind-value]') : null;
        var match = null, fallback = null;
        variants.forEach(function (v) {
          if (!v.opts) return;
          if (size && v.opts[sizePos] !== size) return;
          if (grind && v.opts[grindPos] !== grind) return;
          if (!fallback) fallback = v;
          if (v.available && !match) match = v;
        });
        var v = match || fallback;
        if (v) form.querySelector('input[name="id"]').value = v.id;
        // reflect availability on grind buttons for the current size
        if (grindPos > -1 && size) {
          el.querySelectorAll('[data-grind-value]').forEach(function (b) {
            var any = variants.some(function (vv) {
              return vv.opts && vv.opts[sizePos] === size && vv.opts[grindPos] === b.dataset.grindValue && vv.available;
            });
            b.classList.toggle('is-unavailable', !any);
          });
        }
        return v;
      }
      function refresh() {
        var v = currentVariant();
        if (!v) return;
        var isBundle = el.hasAttribute('data-bundle-pdp');
        var onePct = parseFloat(el.dataset.onePct || '10');
        var subPctD = parseFloat(el.dataset.subPct || '15');
        var subEl = el.querySelector('[data-sub-toggle]');
        var subOn = subEl && subEl.classList.contains('is-on');
        var active = el.querySelector('[data-freq-option].is-active');
        var pct = subOn ? parseFloat((active && active.dataset.discountPct) || '10') : 0;
        var unit = Math.round(v.price * (1 - pct / 100));
        var total = unit * state.qty;
        var elTotal = el.querySelector('[data-price-total]');
        if (elTotal) elTotal.textContent = money(total);
        var each = el.querySelector('[data-price-each]');
        if (each) {
          each.hidden = state.qty <= 1;
          each.textContent = money(unit) + ' × ' + state.qty;
        }
        var was = el.querySelector('[data-price-compare]');
        if (was) {
          var cmp = (v.compare && v.compare > v.price) ? v.compare : v.price;
          // bundles always show the crossed-out full price at qty 1;
          // plain roasts only once Subscribe & Save discounts the price
          var showCmp = state.qty <= 1 && (isBundle ? cmp > unit : subOn);
          was.hidden = !showCmp;
          was.textContent = money(cmp);
        }
        var off = el.querySelector('[data-price-off]');
        if (off) {
          if (isBundle) {
            off.hidden = false;
            off.textContent = (subOn ? subPctD : onePct) + '% off';
            off.style.color = subOn ? '#1f7a42' : '#e06d2d';
          } else {
            off.hidden = !subOn;
            off.style.color = '';
          }
        }
        var save = el.querySelector('[data-bundle-save]');
        if (save) save.textContent = (subOn ? subPctD : onePct) + '% Off';
        var bnote = el.querySelector('[data-bundle-note]');
        if (bnote) bnote.hidden = subOn;
        // mockup swaps the toggle copy between states
        var sl = el.querySelector('[data-sub-label]');
        if (sl && sl.dataset.on) sl.textContent = subOn ? sl.dataset.on : (sl.dataset.off || sl.textContent);
        var sh = el.querySelector('[data-sub-hint]');
        if (sh && sh.dataset.on) sh.textContent = subOn ? sh.dataset.on : (sh.dataset.off || sh.textContent);
        var qv = el.querySelector('[data-qty-value]');
        if (qv) qv.textContent = state.qty;
        var qi = form.querySelector('input[name="quantity"]');
        if (qi) qi.value = state.qty;
      }

      el.addEventListener('click', function (e) {
        var size = e.target.closest('[data-size-option], [data-size-value]');
        if (size) {
          el.querySelectorAll('[data-size-option], [data-size-value]').forEach(function (b) { b.classList.remove('is-active'); });
          size.classList.add('is-active');
          if (size.dataset.variantId) form.querySelector('input[name="id"]').value = size.dataset.variantId;
          else resolveVariant();
          refresh(); return;
        }
        var grindVal = e.target.closest('[data-grind-value]');
        if (grindVal) {
          el.querySelectorAll('[data-grind-value]').forEach(function (b) {
            b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false');
          });
          grindVal.classList.add('is-active'); grindVal.setAttribute('aria-pressed', 'true');
          var gimg = grindVal.querySelector('img');
          if (gimg) { gimg.classList.remove('grind-wiggle'); void gimg.offsetWidth; gimg.classList.add('grind-wiggle'); }
          resolveVariant();
          refresh(); return;
        }
        var grind = e.target.closest('[data-grind-option]');
        if (grind) {
          el.querySelectorAll('[data-grind-option]').forEach(function (b) {
            b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false');
          });
          grind.classList.add('is-active'); grind.setAttribute('aria-pressed', 'true');
          var img = grind.querySelector('img');
          if (img) { img.classList.remove('grind-wiggle'); void img.offsetWidth; img.classList.add('grind-wiggle'); }
          var input = form.querySelector('input[data-grind-input]');
          if (input) input.value = grind.dataset.grindOption;
          return;
        }
        var qtyBtn = e.target.closest('[data-qty-step]');
        if (qtyBtn) {
          var qBefore = state.qty;
          state.qty = Math.max(1, state.qty + parseInt(qtyBtn.dataset.qtyStep, 10));
          refresh();
          // same roll as the cart line: count and total slide in from the step direction
          if (state.qty !== qBefore) {
            var roll = state.qty > qBefore ? 'is-roll-up' : 'is-roll-down';
            [el.querySelector('[data-qty-value]'), el.querySelector('[data-price-total]')].forEach(function (x) {
              if (!x) return;
              x.classList.remove('is-roll-up', 'is-roll-down');
              replayMotion(x, roll);
            });
          }
          return;
        }
        var freq = e.target.closest('[data-freq-option]');
        if (freq) {
          el.querySelectorAll('[data-freq-option]').forEach(function (b) { b.classList.remove('is-active'); });
          freq.classList.add('is-active');
          var pi = form.querySelector('input[name="selling_plan"]');
          if (pi) pi.value = freq.dataset.planId;
          refresh(); return;
        }
        var subT = e.target.closest('[data-sub-toggle]');
        if (subT) {
          subT.classList.toggle('is-on');
          var on = subT.classList.contains('is-on');
          var planInput = form.querySelector('input[name="selling_plan"]');
          var freqs = el.querySelector('[data-freq-list]');
          if (freqs) freqs.hidden = !on;
          if (planInput) {
            var act = el.querySelector('[data-freq-option].is-active');
            planInput.value = on && act ? act.dataset.planId : '';
          }
          refresh(); return;
        }
      });
      refresh();
    });
    // video lightbox
    root.querySelectorAll('[data-video-open]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var box = document.querySelector('[data-video-lightbox]');
        if (!box) return;
        box.hidden = false;
        var frame = box.querySelector('iframe');
        // always (re)assign: after close blanks the src, the src PROPERTY
        // reads back as the page URL, so a !frame.src guard never refires
        if (frame) frame.src = frame.dataset.src;
      });
    });
    root.querySelectorAll('[data-video-lightbox]').forEach(function (box) {
      if (box.dataset.bound) return; box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.closest('[data-video-close]')) {
          box.hidden = true;
          var frame = box.querySelector('iframe');
          if (frame) frame.src = '';
        }
      });
    });
    // about pop-up: the product description behind the info button
    root.querySelectorAll('[data-info-open]').forEach(function (btn) {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var box = document.querySelector('[data-info-modal]');
        if (!box) return;
        var close = function () {
          box.hidden = true;
          document.documentElement.style.overflow = '';
          document.removeEventListener('keydown', onKey);
          btn.focus({ preventScroll: true });
        };
        var onKey = function (e) { if (e.key === 'Escape') close(); };
        box._close = close;
        box.hidden = false;
        document.documentElement.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
        var x = box.querySelector('[data-info-close]');
        if (x) x.focus({ preventScroll: true });
      });
    });
    root.querySelectorAll('[data-info-modal]').forEach(function (box) {
      if (box.dataset.bound) return; box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        if ((e.target === box || e.target.closest('[data-info-close]')) && box._close) box._close();
      });
    });
  }

  /* ---- Contact page tabs ----------------------------------------------------- */
  function initTabs(root) {
    root.querySelectorAll('[data-tabs]').forEach(function (wrap) {
      if (wrap.dataset.bound) return; wrap.dataset.bound = '1';
      wrap.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-tab]');
        if (!btn) return;
        wrap.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        wrap.querySelectorAll('[data-tab-panel]').forEach(function (p) {
          var hide = p.dataset.tabPanel !== btn.dataset.tab;
          p.hidden = hide;
          p.querySelectorAll('input, textarea, select').forEach(function (f) { f.disabled = hide; });
        });
      });
      // disable fields inside initially-hidden panels too
      wrap.querySelectorAll('[data-tab-panel][hidden] input, [data-tab-panel][hidden] textarea, [data-tab-panel][hidden] select')
        .forEach(function (f) { f.disabled = true; });
    });
  }

  /* ---- All Roasts row: client-side roast-type filter ---------------------- */
  function initRoastFilter(root) {
    root.querySelectorAll('[data-roast-filter-group]').forEach(function (group) {
      if (group.dataset.bound) return; group.dataset.bound = '1';
      var row = document.getElementById(group.dataset.roastFilterGroup);
      if (!row) return;
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-roast-filter]');
        if (!btn) return;
        group.querySelectorAll('[data-roast-filter]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        var want = btn.dataset.roastFilter;
        row.querySelectorAll('[data-rt]').forEach(function (item) {
          // data-rt holds the level key plus "decaf" when it applies
          var keys = (item.dataset.rt || '').split(' ');
          item.style.display = (want === 'all' || keys.indexOf(want) > -1) ? '' : 'none';
        });
        row.scrollTo({ left: 0 });
      });
    });
  }

  /* ---- Build Your Bundle (4-step cream configurator) ----------------------- */
  function initBundleBuilder(root) {
    root.querySelectorAll('[data-bundle-builder]').forEach(function (bb) {
      if (bb.dataset.bound) return; bb.dataset.bound = '1';
      var products = JSON.parse(bb.querySelector('[data-bundle-json]').textContent);
      var byId = {};
      products.forEach(function (pp) { byId[pp.id] = pp; });
      var onePct = parseFloat(bb.dataset.onePct || '10');
      var subPct = parseFloat(bb.dataset.subPct || '15');
      var max = parseInt(bb.dataset.max || '3', 10);
      var state = { step: 1, size: null, grind: null, sel: [], sub: false, plan: {} };

      function variantFor(pp, size, grind) {
        var bySize = pp.variants.filter(function (v) { return !size || v.size === size; });
        if (!bySize.length) bySize = pp.variants;
        if (pp.hasGrind && grind) {
          var exact = bySize.filter(function (v) { return v.grind === grind && v.available; })[0] ||
                      bySize.filter(function (v) { return v.grind === grind; })[0];
          if (exact) return exact;
        }
        return bySize.filter(function (v) { return v.available; })[0] || bySize[0];
      }
      function fullTotal() {
        return state.sel.reduce(function (s, id) {
          return s + variantFor(byId[id], state.size, state.grind).price;
        }, 0);
      }
      // seed the size cards' "3 bags from" totals
      bb.querySelectorAll('[data-bb-size-total]').forEach(function (el) {
        var size = el.dataset.bbSizeTotal;
        var sample = products[0];
        if (!sample) return;
        var v = variantFor(sample, size);
        el.textContent = money(Math.round(v.price * max * (1 - onePct / 100)));
      });

      function render() {
        bb.querySelectorAll('[data-bb-step]').forEach(function (el) {
          el.hidden = parseInt(el.dataset.bbStep, 10) !== state.step;
        });
        bb.querySelectorAll('[data-bb-progress]').forEach(function (el) {
          el.classList.toggle('is-active', parseInt(el.dataset.bbProgress, 10) === state.step);
        });
        var gl = bb.querySelector('[data-bb-grind-label]');
        if (gl) gl.textContent = state.grind || '';
        // returning to step 2 shows the chosen grind as the pressed card
        bb.querySelectorAll('[data-bb-grind]').forEach(function (b) {
          b.classList.toggle('is-selected', b.dataset.bbGrind === state.grind);
        });
        bb.querySelectorAll('[data-bb-size]').forEach(function (b) {
          b.classList.toggle('is-selected', b.dataset.bbSize === state.size);
        });
        // slots
        bb.querySelectorAll('[data-bb-slot]').forEach(function (slot, i) {
          var id = state.sel[i];
          slot.classList.toggle('is-filled', !!id);
          slot.querySelector('[data-bb-slot-name]').textContent = id ? byId[id].title : 'Bag ' + (i + 1);
          var x = slot.querySelector('[data-bb-slot-remove]');
          if (x) x.hidden = !id;
        });
        // picks
        bb.querySelectorAll('[data-bb-pick]').forEach(function (card) {
          var sel = state.sel.indexOf(card.dataset.bbPick) !== -1;
          card.classList.toggle('is-selected', sel);
          card.classList.toggle('is-maxed', state.sel.length >= max && !sel);
        });
        var goBtn = bb.querySelector('[data-bb-configure]');
        var waitB = bb.querySelector('[data-bb-wait]');
        if (goBtn) goBtn.hidden = state.sel.length !== max;
        if (waitB) {
          waitB.hidden = state.sel.length === 0 || state.sel.length === max;
          waitB.textContent = 'Select ' + (max - state.sel.length) + ' more to continue';
        }
        // review cards
        var wrap = bb.querySelector('[data-bb-config]');
        if (wrap && state.step === 4) {
          wrap.innerHTML = state.sel.map(function (id, i) {
            var pp = byId[id];
            var v = variantFor(pp, state.size, state.grind);
            return '<div class="bb-config">' +
              '<div class="bb-config__head"><span class="bb-config__dot" style="background:' + (pp.color || '#e06d2d') + '"></span>' +
              '<span class="bb-config__name">' + pp.title + '</span><span class="bb-config__n">Bag ' + (i + 1) + '</span></div>' +
              '<div class="bb-config__meta"><span class="badge" style="--badge-c:#3a352d">Size: ' + (v.size || v.title || '') + '</span>' +
              (state.grind ? '<span class="badge" style="--badge-c:#3a352d">Grind: ' + state.grind + '</span>' : '') + '</div>' +
              '<div class="bb-config__price">' + money(v.price) + '</div>' +
            '</div>';
          }).join('');
        }
        // subscribe + totals
        var subEl = bb.querySelector('[data-bb-sub]');
        if (subEl) subEl.classList.toggle('is-on', state.sub);
        var subL = bb.querySelector('[data-bb-sub-label]');
        if (subL) subL.textContent = state.sub ? 'Subscribed, saving ' + subPct + '%' : 'Subscribe & save ' + subPct + '%';
        var freqs = bb.querySelector('[data-bb-freqs]');
        if (freqs) {
          freqs.hidden = !state.sub;
          if (state.sub && !freqs.childElementCount) {
            var plans = (byId[state.sel[0]] || products[0] || {}).plans || [];
            freqs.innerHTML = plans.map(function (pl, i) {
              return '<button type="button" class="sub-toggle__freq' + (i === 0 ? ' is-active' : '') + '" data-bb-freq="' + i + '">' +
                freqPillLabel(pl.name) + '</button>';
            }).join('');
          }
        }
        var pct = state.sub ? subPct : onePct;
        var full = fullTotal();
        var totalEl = bb.querySelector('[data-bb-total]');
        if (totalEl) totalEl.textContent = money(Math.round(full * (1 - pct / 100)));
        var fullEl = bb.querySelector('[data-bb-full]');
        if (fullEl) { fullEl.textContent = full ? money(full) : ''; fullEl.hidden = !pct; }
        var offEl = bb.querySelector('[data-bb-off]');
        if (offEl) { offEl.hidden = !pct; offEl.textContent = pct + '% off'; offEl.classList.toggle('is-sub', state.sub); }
        var addBtn = bb.querySelector('[data-bb-add] .button-039__text');
        if (addBtn) addBtn.textContent = state.sub ? 'Subscribe to Bundle' : 'Add Bundle to Cart';
      }

      bb.addEventListener('click', function (e) {
        var sizeBtn = e.target.closest('[data-bb-size]');
        if (sizeBtn) { state.size = sizeBtn.dataset.bbSize; state.step = 2; render(); return; }
        var grindBtn = e.target.closest('[data-bb-grind]');
        if (grindBtn) { state.grind = grindBtn.dataset.bbGrind; state.step = 3; render(); return; }
        var pick = e.target.closest('[data-bb-pick]');
        if (pick && state.step === 3) {
          var id = pick.dataset.bbPick;
          var at = state.sel.indexOf(id);
          if (at !== -1) state.sel.splice(at, 1);
          else if (state.sel.length < max) state.sel.push(id);
          render(); return;
        }
        var slotX = e.target.closest('[data-bb-slot-remove]');
        if (slotX) {
          state.sel.splice(parseInt(slotX.closest('[data-bb-slot]').dataset.bbSlot, 10), 1);
          render(); return;
        }
        var back = e.target.closest('[data-bb-back]');
        if (back) { state.step = parseInt(back.dataset.bbBack, 10); render(); return; }
        if (e.target.closest('[data-bb-configure]')) { state.step = 4; render(); return; }
        var freq = e.target.closest('[data-bb-freq]');
        if (freq) {
          bb.querySelectorAll('[data-bb-freq]').forEach(function (b) { b.classList.toggle('is-active', b === freq); });
          return;
        }
        if (e.target.closest('[data-bb-sub]') && !e.target.closest('[data-bb-freq]')) {
          state.sub = !state.sub; render(); return;
        }
        var addBtn = e.target.closest('[data-bb-add]');
        if (addBtn) {
          var planIdx = 0;
          var active = bb.querySelector('[data-bb-freq].is-active');
          if (active) planIdx = parseInt(active.dataset.bbFreq, 10);
          // hidden group key ties the three lines together in the cart so
          // grind/size/subscription edits cascade across this bundle only
          var bkey = 'cb-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
          var items = state.sel.map(function (id) {
            var pp = byId[id];
            var v = variantFor(pp, state.size, state.grind);
            var item = { id: v.id, quantity: 1, properties: { _bundle: 'Custom Bundle', _bundle_key: bkey } };
            if (!pp.hasGrind) item.properties.Grind = state.grind || 'Whole Bean';
            if (state.sub && pp.plans && pp.plans[planIdx]) item.selling_plan = pp.plans[planIdx].id;
            return item;
          });
          if (!items.length) return;
          addItems(items, addBtn).then(function () {
            state.sel = []; state.step = 1; state.sub = false;
            render();
          }).catch(function (err) { alert((err && err.description) || 'Could not add to cart.'); });
        }
      });
      render();
    });
  }

  /* ---- 3-bag bundle hero ----------------------------------------------------- */
  function initBundleHero(root) {
    root.querySelectorAll('[data-bundle-hero]').forEach(function (bh) {
      if (bh.dataset.bound) return; bh.dataset.bound = '1';
      var data = JSON.parse(bh.querySelector('[data-bh-json]').textContent);
      if (!data.bundles.length) return;
      var state = { bundle: data.bundles[0], sub: true, planIdx: 0 };
      // bundle stage: one trio at a time, autoplaying; the active trio picks
      // the bundle and its bags enter one by one (CSS .is-entering)
      (function () {
        var slides = [].slice.call(bh.querySelectorAll('[data-bh-slide]'));
        var n = slides.length;
        if (n < 2) return;
        var cap = bh.querySelector('[data-bh-cap]'), elName = bh.querySelector('[data-bh-name]'), elMeta = bh.querySelector('[data-bh-meta]'), elNum = bh.querySelector('[data-bh-num]');
        var cur = 0, timer = 0, hold = 0, onScreen = true, REST = 4200;
        var leaveT = 0, capT = 0;
        function show(i, back) {
          i = ((i % n) + n) % n;
          if (i === cur) return;
          // the outgoing trio turns out (left, or right when going back) while
          // the new one rotates in bag by bag
          slides.forEach(function (x) { x.classList.remove('is-leaving'); });
          var old = slides[cur];
          old.classList.remove('is-on', 'is-entering');
          old.classList.toggle('is-back', !!back);
          old.setAttribute('aria-hidden', 'true');
          replayMotion(old, 'is-leaving');
          clearTimeout(leaveT);
          leaveT = setTimeout(function () { old.classList.remove('is-leaving'); }, 1600);
          cur = i;
          var s = slides[i];
          s.setAttribute('aria-hidden', 'false');
          s.classList.toggle('is-back', !!back);
          s.classList.add('is-on');
          replayMotion(s, 'is-entering');
          // the caption dips out and swaps at the crossover, as the trios cross
          if (cap) replayMotion(cap, 'is-roll-up');
          clearTimeout(capT);
          capT = setTimeout(function () {
            if (elName) elName.textContent = s.dataset.name || '';
            if (elNum) { elNum.textContent = String(i + 1); elNum.setAttribute('aria-label', 'Bundle ' + (i + 1) + ' of ' + n); }
            if (elMeta) elMeta.textContent = s.dataset.meta || '';
          }, cap ? 560 : 0);
          var b = data.bundles[i];
          if (b) { state.bundle = b; render(); }
        }
        function tick() {
          clearTimeout(timer);
          if (!onScreen || document.hidden || Date.now() < hold) { timer = setTimeout(tick, 600); return; }
          show(cur + 1);
          timer = setTimeout(tick, REST);
        }
        function user(i) { hold = Date.now() + 4000; show(i, i < cur); clearTimeout(timer); timer = setTimeout(tick, REST); }
        var prev = bh.querySelector('[data-bh-prev]'), next = bh.querySelector('[data-bh-next]');
        if (prev) prev.addEventListener('click', function () { user(cur - 1); });
        if (next) next.addEventListener('click', function () { user(cur + 1); });
        var ring = bh.querySelector('[data-bh-ring]'), sx = null;
        if (ring) {
          ring.addEventListener('pointerdown', function (e) { if (e.target.closest('[data-bh-prev],[data-bh-next]')) return; sx = e.clientX; hold = Date.now() + 4000; });
          // a swipe changes bundle; a tap (no real drag) opens the shown bundle's page
          ring.addEventListener('pointerup', function (e) {
            if (sx == null) return; var dx = e.clientX - sx; sx = null;
            if (Math.abs(dx) > 30) { user(cur + (dx < 0 ? 1 : -1)); return; }
            if (Math.abs(dx) < 8 && !e.target.closest('[data-bh-prev],[data-bh-next]')) {
              var b = data.bundles[cur];
              if (b && b.url) window.location.href = b.url;
            }
          });
          ring.addEventListener('pointercancel', function () { sx = null; });
          ring.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { var kb = data.bundles[cur]; if (kb && kb.url) window.location.href = kb.url; return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); user(cur - 1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); user(cur + 1); }
          });
          if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }).observe(ring);
        }
        timer = setTimeout(tick, REST);
      })();

      // Prices are REAL: a bundle backed by a bundle product sells at that
      // product's price (one-time) and its selling-plan price (subscribed);
      // %-off labels are computed against what the bags cost separately.
      function itemsSum() { return state.bundle.items.reduce(function (s, it) { return s + it.price; }, 0); }
      function full() { return state.bundle.full || itemsSum(); }
      function bundlePlans() { return (state.bundle.items[0] || {}).plans || []; }
      function planPct() {
        var pl = bundlePlans()[state.planIdx];
        return pl && pl.pct ? pl.pct : 0;
      }
      // Labels use the design's tiers (one-time 10%, subscribe 15% — both
      // framed against what the bags cost separately); AMOUNTS are real:
      // the bundle product's price one-time, its selling-plan price when
      // subscribed (promised tier until the plans exist in ReCharge).
      function onePrice() { return state.bundle.real ? itemsSum() : Math.round(full() * (1 - data.onePct / 100)); }
      function subPrice() {
        if (state.bundle.real && bundlePlans().length) return Math.round(itemsSum() * (1 - planPct() / 100));
        return Math.round(full() * (1 - data.subPct / 100));
      }

      function render() {
        var plans = bundlePlans();
        var canSub = plans.length > 0;
        if (state.planIdx >= plans.length) state.planIdx = 0;
        bh.querySelectorAll('[data-bh-stage]').forEach(function (el) { el.hidden = el.dataset.bhStage !== state.bundle.id; });
        bh.querySelectorAll('[data-bh-contents]').forEach(function (el) { el.hidden = el.dataset.bhContents !== state.bundle.id; });
        bh.querySelectorAll('[data-bh-pick]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.bhPick === state.bundle.id); });
        var oneEl = bh.querySelector('[data-bh-plan-price="one"]');
        if (oneEl) oneEl.textContent = money(onePrice());
        var oneOff = bh.querySelector('[data-bh-plan-off="one"]');
        if (oneOff) oneOff.textContent = data.onePct + '%';
        var subEl = bh.querySelector('[data-bh-plan-price="sub"]');
        if (subEl) subEl.textContent = money(subPrice());
        var subOff = bh.querySelector('[data-bh-plan-off="sub"]');
        if (subOff) subOff.textContent = data.subPct + '%';
        bh.querySelectorAll('[data-bh-plan]').forEach(function (b) {
          var on = (b.dataset.bhPlan === 'sub') === state.sub;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        var freqs = bh.querySelector('[data-bh-freqs]');
        if (freqs) {
          freqs.hidden = !state.sub || !canSub;
          freqs.innerHTML = plans.map(function (pl, i) {
            return '<button type="button" class="sub-toggle__freq' + (i === state.planIdx ? ' is-active' : '') + '" data-bh-freq="' + i + '">' +
              freqPillLabel(pl.name) + '</button>';
          }).join('');
        }
        var price = state.sub ? subPrice() : onePrice();
        // the buy column's price row and the phone box's condensed price
        bh.querySelectorAll('[data-bh-price]').forEach(function (el) { el.textContent = money(price); });
        bh.querySelectorAll('[data-bh-full]').forEach(function (el) { el.textContent = money(full()); el.hidden = price >= full(); });
        bh.querySelectorAll('[data-bh-off]').forEach(function (el) {
          el.hidden = false;
          el.textContent = (state.sub ? data.subPct : data.onePct) + '% off';
          el.style.color = '#e06d2d';
        });
        var addLabel = bh.querySelector('[data-bh-add] .button-039__text');
        var short = state.bundle.name.replace(' Bundle', '');
        var subbing = state.sub && canSub;
        if (addLabel) addLabel.textContent = subbing ? 'Subscribe to ' + short : 'Add ' + short;
        // round corner button: its label follows the plan + bundle (no hover pop)
        var addBtn = bh.querySelector('[data-bh-add]');
        if (addBtn && !addLabel) {
          addBtn.setAttribute('aria-label', (subbing ? 'Subscribe to ' : 'Add ') + state.bundle.name + (subbing ? '' : ' to cart'));
          var addText = addBtn.querySelector('[data-bh-add-label]');
          if (addText) addText.textContent = subbing ? 'Subscribe' : 'Add to cart';
        }
        var info = bh.querySelector('[data-bh-info]');
        if (info) {
          if (state.bundle.url) info.href = state.bundle.url;
          info.setAttribute('aria-label', state.bundle.name + ' details');
        }
        var fine = bh.querySelector('[data-bh-fine]');
        if (fine) {
          if (state.sub && canSub) fine.innerHTML = 'Stacking a subscription is the cheapest way to buy · <span class="bhero__fine-hl">pause or cancel anytime.</span>';
          else if (state.sub) fine.textContent = 'Subscription pricing is being activated. Adding puts the one-time bundle in your cart for now.';
          else fine.textContent = 'Switch to a subscription anytime for ' + data.subPct + '% off, the cheapest way to buy.';
        }
      }

      // the Subscribe & Save card is a div (it holds the frequency pills), so it
      // answers Enter and Space itself
      bh.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var plan = e.target.closest('[data-bh-plan]');
        if (!plan || plan.tagName === 'BUTTON' || e.target !== plan) return;
        e.preventDefault(); plan.click();
      });
      bh.addEventListener('click', function (e) {
        var pick = e.target.closest('[data-bh-pick]');
        if (pick) {
          state.bundle = data.bundles.filter(function (b) { return b.id === pick.dataset.bhPick; })[0] || state.bundle;
          render(); return;
        }
        // frequency pills sit inside the Subscribe & Save card, so check them first
        var freq = e.target.closest('[data-bh-freq]');
        if (freq) { state.sub = true; state.planIdx = parseInt(freq.dataset.bhFreq, 10); render(); return; }
        var plan = e.target.closest('[data-bh-plan]');
        if (plan) { state.sub = plan.dataset.bhPlan === 'sub'; render(); return; }
        var add = e.target.closest('[data-bh-add]');
        if (add) {
          var items = state.bundle.items.map(function (it) {
            var item = { id: it.variant, quantity: 1, properties: { _bundle: state.bundle.name } };
            if (!state.bundle.real) item.properties.Grind = 'Whole Bean';
            if (state.sub && it.plans && it.plans[state.planIdx]) item.selling_plan = it.plans[state.planIdx].id;
            return item;
          });
          addItems(items, add)
            .catch(function (err) { alert((err && err.description) || 'Could not add to cart.'); });
        }
      });
      render();
    });
  }

  /* ---- Big Bang Bundle: 6 oz / 12 oz pick swaps the variant on the add button */
  function initBigBang(root) {
    root.querySelectorAll('[data-bigbang]').forEach(function (bb) {
      if (bb.dataset.bound) return; bb.dataset.bound = '1';
      var add = bb.querySelector('[data-bb-add]');
      bb.addEventListener('click', function (e) {
        var size = e.target.closest('[data-bb-size]');
        if (!size) return;
        bb.querySelectorAll('[data-bb-size]').forEach(function (b) {
          var on = b === size;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (add) add.dataset.addVariants = size.dataset.variant;
      });
    });
  }

  /* ---- First-visit popup ---------------------------------------------------- */
  function initFvp(root) {
    var fvp = root.querySelector ? root.querySelector('[data-fvp]') : null;
    if (!fvp || fvp.dataset.bound) return; fvp.dataset.bound = '1';
    var KEY = 'apoc-welcome-pop';
    var state; try { state = sessionStorage.getItem(KEY); } catch (e) { state = 'blocked'; }
    var chip = document.querySelector('[data-fvp-reopen]');
    function show() { fvp.hidden = false; if (chip) chip.hidden = true; }
    function hide(done) {
      fvp.hidden = true;
      try { sessionStorage.setItem(KEY, done ? 'done' : '1'); } catch (e) {}
      if (chip && !done) chip.hidden = false;
    }
    var posted = fvp.querySelector('[data-fvp-step="3"]');
    if (posted) {
      show(); try { sessionStorage.setItem(KEY, 'done'); } catch (e) {}
      // personalise the confirmation from what was typed before the reload
      try {
        var meta = JSON.parse(sessionStorage.getItem(KEY + '-meta') || '{}');
        var nameEl = posted.querySelector('[data-fvp-done-name]');
        if (nameEl && meta.name) nameEl.textContent = ', ' + meta.name.split(' ')[0];
        var blendEl = posted.querySelector('[data-fvp-done-blend]');
        if (blendEl && meta.blend && meta.blend.toLowerCase().indexOf('mind') === -1) {
          blendEl.textContent = '. Keep an eye out for our favorite ' + meta.blend.toLowerCase() + ' roasts, too';
        }
      } catch (e) {}
    }
    else if (!state) setTimeout(show, parseInt(fvp.dataset.delay || '5000', 10));
    else if (state === '1' && chip) chip.hidden = false;

    fvp.addEventListener('click', function (e) {
      if (e.target === fvp || e.target.closest('[data-fvp-close]')) { hide(!!posted); return; }
      var blend = e.target.closest('[data-fvp-blend]');
      if (blend) {
        var tags = fvp.querySelector('[data-fvp-tags]');
        if (tags) tags.value = 'newsletter,first-visit-popup,blend-' + blend.dataset.fvpBlend.toLowerCase().replace(/[^a-z]+/g, '-');
        try {
          var m = JSON.parse(sessionStorage.getItem(KEY + '-meta') || '{}');
          m.blend = blend.dataset.fvpBlend;
          sessionStorage.setItem(KEY + '-meta', JSON.stringify(m));
        } catch (e2) {}
        fvp.querySelector('[data-fvp-step="1"]').hidden = true;
        fvp.querySelector('[data-fvp-step="2"]').hidden = false;
      }
    });
    var fvpForm = fvp.querySelector('form');
    if (fvpForm) fvpForm.addEventListener('submit', function () {
      try {
        var m = JSON.parse(sessionStorage.getItem(KEY + '-meta') || '{}');
        var n = fvp.querySelector('[data-fvp-name]');
        if (n && n.value) m.name = n.value;
        sessionStorage.setItem(KEY + '-meta', JSON.stringify(m));
      } catch (e2) {}
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fvp.hidden) hide(!!posted); });
    document.addEventListener('click', function (e) { if (e.target.closest('[data-fvp-open]')) show(); });
    // phones: the edge tab sits centred on the hero's orange panel as the page
    // first shows it (the visible part of the panel, measured from the top of
    // the page), slides away while scrolling down and back on scroll up
    if (chip) {
      var placeTab = function () {
        var panel = document.querySelector('.hero-m__panel');
        if (!panel || !panel.offsetHeight) { chip.style.removeProperty('--fvp-y'); return; }
        var r = panel.getBoundingClientRect(), top = r.top + window.scrollY, vh = window.innerHeight;
        var a = Math.max(top, 0), b = Math.min(top + r.height, vh);
        if (b - a < 120) { chip.style.removeProperty('--fvp-y'); return; }
        chip.style.setProperty('--fvp-y', Math.round((a + b) / 2) + 'px');
      };
      placeTab();
      window.addEventListener('load', placeTab);
      window.addEventListener('resize', placeTab);
      var lastY = window.scrollY;
      window.addEventListener('scroll', function () {
        var y = window.scrollY, dy = y - lastY;
        if (Math.abs(dy) < 8) return;
        chip.classList.toggle('is-away', dy > 0 && y > 40);
        lastY = y;
      }, { passive: true });
    }
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
     input stays native. Containers marked data-lenis-prevent (cart drawer,
     menu, modals) scroll natively; it stands down in the theme editor and
     under prefers-reduced-motion. */
  var smoothStarted = false;
  function initSmoothScroll() {
    if (smoothStarted) return; smoothStarted = true;
    if (!(window.AC && window.AC.smoothScroll)) return;
    if (window.Shopify && window.Shopify.designMode) return;
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
  /* Arrival after an in-site link: the page loads under the orange cover,
     so entrances wait for it to start lifting (initPageTransition fires
     ac:uncover) instead of finishing out of sight. */
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

  /* ---- PDP reviews: arrows pagination + write-a-review form ----------------
     Mirrors the mockup: reviews page 3-at-a-time via the arrow buttons; the
     Write a Review form star-picker + submit prepends a local card and shows
     a thank-you banner (persistence comes later via a review app). */
  // rounded review star, same as snippets/review-star.liquid
  var REVIEW_STAR = '<svg class="review-star" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.62 5.31 5.86.85-4.24 4.13 1 5.84L12 16.58l-5.24 2.75 1-5.84-4.24-4.13 5.86-.85z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  function initReviews(root) {
    root.querySelectorAll('[data-reviews]').forEach(function (rv) {
      if (rv.dataset.bound) return; rv.dataset.bound = '1';
      var grid = rv.querySelector('[data-rev-grid]');
      var cards = grid ? Array.prototype.slice.call(grid.children) : [];
      // every review sits in a swipe carousel (scroll-snap row, CSS); the
      // arrows step one card and a mouse can drag it like a touch swipe
      function paint() { cards.forEach(function (c) { c.hidden = false; }); }
      function refreshCards() { cards = Array.prototype.slice.call(grid.children); paint(); }
      paint();
      function slide(dir) {
        var first = cards[0];
        var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        var step = first ? first.getBoundingClientRect().width + gap : grid.clientWidth;
        grid.scrollBy({ left: dir * step, behavior: 'smooth' });
      }
      if (grid) {
        var drag = null;
        grid.addEventListener('pointerdown', function (e) {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          drag = { x: e.clientX, left: grid.scrollLeft, moved: false };
        });
        window.addEventListener('pointermove', function (e) {
          if (!drag) return;
          var dx = e.clientX - drag.x;
          if (!drag.moved && Math.abs(dx) < 4) return;
          if (!drag.moved) { drag.moved = true; grid.classList.add('is-dragging'); }
          grid.scrollLeft = drag.left - dx;
        });
        window.addEventListener('pointerup', function () {
          if (!drag) return;
          var moved = drag.moved; drag = null;
          if (!moved) return;
          grid.classList.remove('is-dragging');
          // snap to the nearest card once released
          var first = cards[0];
          var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
          var step = first ? first.getBoundingClientRect().width + gap : grid.clientWidth;
          grid.scrollTo({ left: Math.round(grid.scrollLeft / step) * step, behavior: 'smooth' });
        });
      }
      var rating = 5;
      rv.addEventListener('click', function (e) {
        if (e.target.closest('[data-rev-prev]')) { slide(-1); return; }
        if (e.target.closest('[data-rev-next]')) { slide(1); return; }
        var star = e.target.closest('[data-rv-star]');
        if (star) {
          rating = parseInt(star.dataset.rvStar, 10);
          rv.querySelectorAll('[data-rv-star]').forEach(function (s) {
            s.classList.toggle('is-on', parseInt(s.dataset.rvStar, 10) <= rating);
          });
          return;
        }
        if (e.target.closest('[data-rev-write]')) { openRevForm(); return; }
        // Cancel, the x, or a click on the dimmed backdrop closes the pop-up
        if (e.target.closest('[data-rev-cancel]') || e.target.matches('[data-rev-form]')) { closeRevForm(); return; }
      });
      /* the review form is a pop-up: the page behind stops scrolling while
         it's open, focus moves into it, and Esc closes it */
      function openRevForm() {
        var f = rv.querySelector('[data-rev-form]');
        if (!f || !f.hidden) return;
        f.hidden = false;
        if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
        document.documentElement.style.overflow = 'hidden';
        var first = f.querySelector('[data-rv-star], input, textarea');
        if (first) first.focus({ preventScroll: true });
      }
      function closeRevForm() {
        var f = rv.querySelector('[data-rev-form]');
        if (!f || f.hidden) return;
        f.hidden = true;
        document.documentElement.style.overflow = '';
        if (window.__lenis && window.__lenis.start) window.__lenis.start();
        // back to whichever write button is showing (icon on desktop, full on phones)
        var wb = [].filter.call(rv.querySelectorAll('[data-rev-write]'), function (b) { return b.offsetParent; })[0];
        if (wb) wb.focus({ preventScroll: true });
      }
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRevForm(); });
      var form = rv.querySelector('[data-rev-form] form') || rv.querySelector('form[data-rev-form]');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var name = (form.querySelector('[name="rv-name"]') || {}).value || '';
          var email = (form.querySelector('[name="rv-email"]') || {}).value || '';
          var title = (form.querySelector('[name="rv-title"]') || {}).value || '';
          var body = (form.querySelector('[name="rv-body"]') || {}).value || '';
          if (!name.trim() || !body.trim()) return;
          /* Real store: post the review to Judge.me (same account that
             collects reviews on the live site); it appears after approval. */
          if (rv.dataset.jmProduct) {
            var btn = form.querySelector('[type="submit"]');
            if (btn) btn.disabled = true;
            fetch('https://judge.me/api/v1/reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shop_domain: rv.dataset.jmShop,
                platform: 'shopify',
                id: parseInt(rv.dataset.jmProduct, 10),
                name: name.trim(),
                email: email.trim(),
                rating: rating,
                title: title.trim(),
                body: body.trim()
              })
            }).then(function (r) {
              if (!r.ok) throw new Error('status ' + r.status);
              form.reset();
              rating = 5;
              rv.querySelectorAll('[data-rv-star]').forEach(function (s) { s.classList.add('is-on'); });
              closeRevForm();
              var done = rv.querySelector('[data-rev-done]');
              if (done) { done.hidden = false; setTimeout(function () { done.hidden = true; }, 6000); }
            }).catch(function () {
              alert('Could not submit your review right now. Please try again in a moment.');
            }).then(function () {
              if (btn) btn.disabled = false;
            });
            return;
          }
          if (grid) {
            var card = document.createElement('div');
            card.className = grid.firstElementChild ? grid.firstElementChild.className : 'pdp-review';
            var stars = '';
            for (var i = 1; i <= 5; i++) stars += '<span' + (i > rating ? ' style="opacity:.22"' : '') + '>' + REVIEW_STAR + '</span>';
            card.innerHTML =
              '<div class="review-card__stars" style="color:#e06d2d">' + stars + '</div>' +
              (title.trim() ? '<div class="review-card__title"></div>' : '') +
              '<p class="review-card__body"></p>' +
              '<div class="review-card__author"></div>';
            if (title.trim()) card.querySelector('.review-card__title').textContent = '\u201C' + title.trim() + '\u201D';
            card.querySelector('.review-card__body').textContent = body.trim();
            card.querySelector('.review-card__author').textContent = name.trim();
            grid.insertBefore(card, grid.firstChild);
            refreshCards();
            page = 0; paint();
          }
          form.reset();
          rating = 5;
          rv.querySelectorAll('[data-rv-star]').forEach(function (s) { s.classList.add('is-on'); });
          closeRevForm();
          var done = rv.querySelector('[data-rev-done]');
          if (done) { done.hidden = false; setTimeout(function () { done.hidden = true; }, 4500); }
        });
      }
    });
  }

  /* ---- hero: rotating bundle trios ---------------------------------------- */
  /* Crossfades the hero stage through its bundle trios (Best Sellers / Dark /
     Light). Pauses while hovered so pops and the Buy Bundle chip stay put;
     skipped entirely under prefers-reduced-motion. */
  function initHeroTrios(scope) {
    (scope || document).querySelectorAll('[data-hero-trios]').forEach(function (stage) {
      if (stage.__heroTrios) return;
      stage.__heroTrios = true;
      var trios = stage.querySelectorAll('[data-hero-trio]');
      if (trios.length < 2) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var i = 0, timer = null;
      function show(n) {
        trios[i].classList.remove('is-active');
        i = (n + trios.length) % trios.length;
        trios[i].classList.add('is-active');
      }
      function arm() {
        if (timer) clearInterval(timer);
        timer = setInterval(function () { show(i + 1); }, 5200);
      }
      stage.addEventListener('mouseenter', function () { if (timer) { clearInterval(timer); timer = null; } });
      stage.addEventListener('mouseleave', arm);
      arm();
    });
  }

  /* ---- product image → product page view transition ------------------------ */
  /* Cross-document view transitions (base.css @view-transition) run only when
     a product image is clicked, and on Back from that product page to where
     it was clicked; every other navigation skips them in pageswap. The clicked image carries the roast-bag name and the product
     page's bag picks it up ([data-vt-bag]), so the image scales into place
     while the page fades in. Trimmed bag cuts (bagtrim-*, the hero turntable)
     get a fixed square "ghost" framed like the product page's square render
     (bag 225x443 inside 560) so both snapshots line up; square renders (cards,
     carousels) are named directly. */
  var bagVT = null;
  var BACK_KEY = 'ac-vt-back';
  function bagVTCleanup() {
    if (!bagVT) return;
    clearTimeout(bagVT.t);
    if (bagVT.img) bagVT.img.style.viewTransitionName = '';
    if (bagVT.ghost && bagVT.ghost.parentNode) bagVT.ghost.parentNode.removeChild(bagVT.ghost);
    if (bagVT.el) bagVT.el.style.visibility = '';
    if (bagVT.others) bagVT.others.forEach(function (x) { x.style.viewTransitionName = ''; });
    bagVT = null;
  }
  // name the image (or a framed ghost of a trimmed cut) as roast-bag
  function bagName(el, img, back) {
    bagVTCleanup();
    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    // only one element may carry the name: on a product page its own bag
    // ([data-vt-bag]) has it too, which aborts the transition (prev/next
    // tabs, related cards), so the others step aside until cleanup
    var others = [].filter.call(document.querySelectorAll('[data-vt-bag]'), function (x) { return x !== img; });
    others.forEach(function (x) { x.style.viewTransitionName = 'none'; });
    if ((img.currentSrc || img.src).indexOf('bagtrim-') === -1) {
      img.style.viewTransitionName = 'roast-bag';
      bagVT = { img: img, back: back, others: others, t: setTimeout(bagVTCleanup, 8000) };
      return true;
    }
    var S = r.height * 540 / 443;
    var left = r.left + r.width * 146 / 293 - S * 280.5 / 560;
    var top = r.top + r.height * 550 / 560 - S * 504 / 560;
    var ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = 'position:fixed;z-index:9000;pointer-events:none;view-transition-name:roast-bag;left:' + left + 'px;top:' + top + 'px;width:' + S + 'px;height:' + S + 'px';
    var c = img.cloneNode(false);
    c.removeAttribute('loading');
    c.style.cssText = 'position:absolute;max-width:none;left:' + (r.left - left) + 'px;top:' + (r.top - top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    ghost.appendChild(c);
    document.body.appendChild(ghost);
    el.style.visibility = 'hidden';
    // a navigation that never happens must not leave the ghost behind
    bagVT = { ghost: ghost, el: el, back: back, others: others, t: setTimeout(bagVTCleanup, 8000) };
    return true;
  }
  function readBack() { try { return JSON.parse(sessionStorage.getItem(BACK_KEY) || 'null'); } catch (e) { return null; } }
  function linksFor(href) {
    return [].filter.call(document.querySelectorAll('a[href*="/products/"]'), function (x) { return x.getAttribute('href') === href; });
  }
  function bagTransition(e, el, img) {
    if (!el || !window.CSSViewTransitionRule || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    img = img || el.querySelector('img');
    if (!img || !bagName(el, img, false)) return;
    // remember where the image came from, so Back can shrink the bag home
    try {
      var href = el.getAttribute('href');
      sessionStorage.setItem(BACK_KEY, JSON.stringify({
        from: location.href, href: href, idx: linksFor(href).indexOf(el),
        img: [].indexOf.call(el.querySelectorAll('img'), img)
      }));
    } catch (err) {}
  }
  // any click on a product image that links to a product page (window, so
  // carousels that cancel the click for their own use have already run)
  window.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="/products/"]');
    if (!a) return;
    // PDP prev/next tabs: the whole tab hands its thumbnail to the next page
    if (a.hasAttribute('data-pdp-nav')) {
      var th = a.querySelector('.pdp-nav__thumb');
      if (th) bagTransition(e, a, th);
      return;
    }
    var imgs = a.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        bagTransition(e, a, imgs[i]);
        return;
      }
    }
  });
  // Leaving a page: keep the transition for a product-image click, or for
  // Back from a product page to the page its image was clicked on (the bag
  // shrinks home); skip it for everything else.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || (bagVT && !bagVT.back)) return;
    var rec = readBack(), act = e.activation;
    if (rec && act && act.navigationType === 'traverse' && act.entry && act.entry.url === rec.from &&
        document.querySelector('[data-vt-bag]')) return;
    e.viewTransition.skipTransition();
  });
  // Arriving back on that page: name the same image so the bag lands on it.
  // Runs on Back restores from the back/forward cache; a cold reload of the
  // page just crossfades.
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var rec = readBack();
    if (!rec || rec.from !== location.href) return;
    if (window.navigation && navigation.activation && navigation.activation.navigationType !== 'traverse') return;
    try { sessionStorage.removeItem(BACK_KEY); } catch (err) {}
    var a = linksFor(rec.href)[rec.idx];
    var img = a && a.querySelectorAll('img')[rec.img || 0];
    if (!img || parseFloat(getComputedStyle(a).opacity) < 0.5) return;
    if (bagName(a, img, true)) e.viewTransition.finished.then(bagVTCleanup, bagVTCleanup);
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted && !(bagVT && bagVT.back)) bagVTCleanup(); });

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
        if (elRank) { elRank.textContent = '#' + (k + 1); elRank.setAttribute('aria-label', 'Number ' + (k + 1) + ' best seller'); }
        if (elName) elName.textContent = it.dataset.name || '';
        if (elMeta) elMeta.textContent = it.dataset.meta || '';
        if (elTrend) { elTrend.hidden = !it.dataset.trend; elTrend.textContent = it.dataset.trend ? '▲ ' + it.dataset.trend + ' · ' : ''; }
        if (elPrice) elPrice.textContent = it.dataset.price || '';
        if (elLink) elLink.href = it.getAttribute('href');
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
          if (dragged) { e.preventDefault(); dragged = false; return; }
          if (k !== front) { e.preventDefault(); goTo(k); }
        });
      });
      if (elLink) elLink.addEventListener('click', function (e) { bagTransition(e, items[front]); });
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
      sec.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = host.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (ptr.on) { ptr.vx += x - ptr.x; ptr.vy += y - ptr.y; }
        ptr.x = x; ptr.y = y; ptr.on = true;
      }, { passive: true });
      sec.addEventListener('pointerleave', function () { ptr.on = false; ptr.vx = ptr.vy = 0; });
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
  document.addEventListener('shopify:section:unload', function (e) {
    e.target.querySelectorAll('[data-bean-physics]').forEach(function (h) {
      if (h.__matterCleanup) h.__matterCleanup();
    });
  });

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

  /* ---- Page transition: torn orange sweep ----------------------------------
     Any in-site link (nav, buttons, menu, footer…) except a product card —
     those keep the bag view transition — stretches the orange panel across
     like an accordion, springs the link's title in over a field of popping
     beans, then navigates. The next page opens under the panel (layout's
     inline script, before first paint) and it snaps shut to the right. */
  function initPageTransition() {
    var pt = document.querySelector('[data-pt]');
    if (!pt || pt.dataset.bound) return; pt.dataset.bound = '1';
    var titleEl = pt.querySelector('[data-pt-title]');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // arrival: hold a beat for the page to settle, then sweep off to the right
    if (pt.classList.contains('is-cover')) {
      var done = false;
      var leave = function () {
        if (done) return; done = true;
        setTimeout(function () {
          pt.className = 'pt is-out';
          // the panel starts sweeping off ~.18s in: entrances begin as it lifts
          setTimeout(function () { window.dispatchEvent(new Event('ac:uncover')); }, 240);
          setTimeout(function () { pt.className = 'pt'; }, 1080);
        }, 160);
      };
      if (document.readyState === 'complete') leave(); else window.addEventListener('load', leave, { once: true });
      setTimeout(leave, 1200);   // slow images never hold the page hostage
    }
    // back/forward cache restores the page as it was left: drop the cover
    window.addEventListener('pageshow', function (e) { if (e.persisted) pt.className = 'pt'; });
    if (reduce) return;
    // each word sits in its own mask and rises into view (staggered)
    function setTitle(t) {
      titleEl.innerHTML = '';
      t.split(' ').forEach(function (w, i) {
        var m = document.createElement('span'); m.className = 'pt__w'; m.style.setProperty('--i', i);
        var inner = document.createElement('span'); inner.textContent = w;
        m.appendChild(inner); titleEl.appendChild(m); titleEl.appendChild(document.createTextNode(' '));
      });
    }
    var SKIP = '[data-roast-card], .roast-card, .bundle-card, .acc-card, .cbundle, .pdp-nav, [data-no-pt]';
    function titleFor(a, url) {
      // a menu link's label only (not its 01/02 index); stray digit runs go too
      var lab = a.querySelector('.underlay-nav__link-label');
      var t = (a.getAttribute('data-pt-title') || (lab && lab.textContent) || a.getAttribute('aria-label') || a.textContent || '')
        .replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 32) {
        var seg = url.pathname.split('/').filter(Boolean).pop();
        t = seg ? seg.replace(/[-_]+/g, ' ') : 'Home';
      }
      return t;
    }
    window.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target && a.target !== '_self' || a.hasAttribute('download') || a.closest(SKIP)) return;
      if (bagVT && !bagVT.back) return;                 // a product image is morphing instead
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;   // same page / #anchor
      e.preventDefault();
      var title = titleFor(a, url);
      setTitle(title);
      // the bean field re-measures (on resize) so beans keep off the new title
      window.dispatchEvent(new Event('resize'));
      try { sessionStorage.setItem('ac-pt', JSON.stringify({ title: title, t: Date.now() })); } catch (err) {}
      pt.className = 'pt is-in';
      // navigate once the accordion has stretched and the title has landed
      setTimeout(function () { location.href = url.href; }, 1150);
    });
  }

  /* ---- PDP prev/next roast tabs: centred on the image card ---------------- */
  function initPdpNav(root) {
    root.querySelectorAll('.pdp__hero').forEach(function (hero) {
      if (hero.dataset.navBound || !hero.querySelector('[data-pdp-nav]')) return;
      hero.dataset.navBound = '1';
      var card = hero.querySelector('.pdp__bag');
      if (!card) return;
      function place() {
        var h = hero.getBoundingClientRect(), c = card.getBoundingClientRect();
        if (c.height) hero.style.setProperty('--nav-y', Math.round(c.top - h.top + c.height / 2) + 'px');
      }
      place();
      window.addEventListener('resize', place);
      if (window.ResizeObserver) new ResizeObserver(place).observe(card);
    });
  }

  function initAll(scope) {
    var root = scope || document;
    initMenu(root); initNavTuck(); initOneLineTitles(root); initCart(root); initAddForms(root); initCards(root);
    initPops(); initScrollRows(root); initDragRows(root); initSnapGuard(root); initMarquee(root); initUfo(root);
    initStickySteps(root); initTimeline(root); initQuiz(root); initProduct(root);
    initTabs(root); initRoastFilter(root); initBundleBuilder(root); initBundleHero(root); initBigBang(root); initFvp(root); initScrollTo(root); initBeanFields(root);
    initSplitReveal(root); initReviews(root); initPdpNav(root); initHeroTrios(root); initHeroSusan(root); initBeanPhysics(root); initSweeps(root); initEdgeFades(root);
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
    var SEL = 'button, [role="button"], input[type="submit"], input[type="button"], select, .button-039, .icon-btn, .arrow-btn, .hm-arrow, .fvp-badge, .underlay-nav__link-large';
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

  /* ---- Empty-cart grind loop ----------------------------------------------
     Steps the four grind icons above the empty-cart CTA, one visible at a
     time. Queries live so it survives renderCart() re-rendering the drawer;
     when no empty state is on the page the tick is a no-op. */
  function initGrindCycle() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setInterval(function () {
      document.querySelectorAll('[data-grind-cycle]').forEach(function (box) {
        var imgs = box.querySelectorAll('img');
        if (imgs.length < 2) return;
        var cur = 0;
        imgs.forEach(function (img, i) { if (img.classList.contains('is-active')) cur = i; });
        imgs[cur].classList.remove('is-active');
        imgs[(cur + 1) % imgs.length].classList.add('is-active');
      });
    }, 850);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAll(document);
    fetchCart();
    initSmoothScroll();
    initPress();
    initPageTransition();
    initGrindCycle();
  });
  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });

  window.AC = window.AC || {};
  window.AC.openCartDrawer = openCart;
  window.AC.closeCartDrawer = closeCart;
  window.AC.refreshCart = fetchCart;
})();
