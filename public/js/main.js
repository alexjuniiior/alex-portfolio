/* =========================================================
   Motion — portfolio v2
   Timings and curves follow bymonolog.com:
   lines slide up from behind a mask (150% → 0) with a
   long, soft "ease-transition" curve and a tight stagger.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready() { root.classList.remove('is-loading'); }

  // If the libraries failed to load, just show the page
  if (!window.gsap || !window.SplitText || !window.CustomEase) { ready(); return; }

  gsap.registerPlugin(SplitText, CustomEase, window.ScrollTrigger);

  // Shared motion tokens (same as bymonolog.com)
  CustomEase.create('ease-transition', '0.22, 1, 0.36, 1');
  CustomEase.create('ease-secondary', '0.31, 0.75, 0.22, 1');
  var DUR = { fast: 0.3, normal: 0.65, slow: 0.95, slower: 1.25 };
  var LINE_STAGGER = 0.075;

  /* ---------- Smooth scrolling ---------- */
  var lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ duration: 0.5, smoothWheel: true }); // same as bymonolog.com
    if (window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  window.lenis = lenis;

  /* ---------- Hero intro ---------- */
  /* ---------- Hero video: plays only while the hero is on screen ---------- */
  function heroVideo() {
    var video = document.querySelector('.hero__video');
    if (!video) return;
    if (reduceMotion) {            // still frame (the poster) instead of motion
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }
    function play() { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    play();
    if (window.ScrollTrigger) ScrollTrigger.create({
      trigger: '.hero',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: function (self) { self.isActive ? play() : video.pause(); }
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && ScrollTrigger.isInViewport && ScrollTrigger.isInViewport('.hero')) play();
    });
  }

  function heroIntro() {
    var title = document.querySelector('.hero__title');
    var strike = document.querySelector('.hero__strike');
    var navItems = document.querySelectorAll('[data-reveal="nav"]');
    var button = document.querySelector('[data-reveal="button"]');
    var heroBg = document.querySelector('[data-reveal="hero-bg"]');

    if (reduceMotion) { ready(); return; }

    // Split the headline into lines, each inside its own clipping mask
    var split = title ? SplitText.create(title, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line'
    }) : null;

    // Starting positions: everything sits just below its mask
    if (split) gsap.set(split.lines, { yPercent: 150 });
    gsap.set(navItems, { yPercent: 100 });
    if (button) gsap.set(button, { yPercent: 150 });
    if (heroBg) gsap.set(heroBg, { autoAlpha: 0, scale: 1.08 });
    if (strike) gsap.set(strike, { '--strike': '0%', color: getComputedStyle(root).getPropertyValue('--fg').trim() });

    ready();

    var tl = gsap.timeline({
      defaults: { ease: 'ease-transition' },
      onComplete: function () {
        // Hand transforms back to CSS so hover effects work
        gsap.set([navItems, button, heroBg], { clearProps: 'transform' });
      }
    });

    // Background photo: fades up from black and settles
    if (heroBg) tl.to(heroBg, { autoAlpha: 1, scale: 1, duration: 2.2, ease: 'ease-transition' }, 0);

    // Headline: line by line
    if (split) {
      tl.to(split.lines, { yPercent: 0, duration: DUR.slow, stagger: LINE_STAGGER }, 0);
    }

    // Header: logo, then About
    tl.to(navItems, { yPercent: 0, duration: DUR.slow, stagger: 0.0525, rotate: 0.001 }, 0.3);

    // Button
    if (button) tl.to(button, { yPercent: 0, duration: DUR.slow }, 0.55);

    // "handed off." gets crossed out, then dims
    if (strike) {
      tl.to(strike, { '--strike': '100%', duration: DUR.normal, ease: 'power2.inOut' }, 1.15)
        .to(strike, { color: getComputedStyle(root).getPropertyValue('--muted').trim(), duration: DUR.normal, ease: 'ease-secondary' }, '-=0.35');
    }
  }

  /* ---------- Text that lights up as you scroll ----------
     Every letter starts grey and turns cream, letter by letter and
     line by line, tied to the scroll position (like bymonolog.com). */
  function highlightOnScroll() {
    if (!window.ScrollTrigger) return;
    var css = getComputedStyle(root);
    var dim = css.getPropertyValue('--text-dim').trim();
    var lit = css.getPropertyValue('--fg').trim();

    document.querySelectorAll('[data-highlight]').forEach(function (block) {
      SplitText.create(block.querySelectorAll('p'), {
        type: 'lines, words, chars',
        autoSplit: true, // re-split when the layout changes width
        onSplit: function (self) {
          // All letters end up cream, whatever their starting color in the design
          gsap.set(self.chars, { color: lit });
          var tl = gsap.timeline({
            scrollTrigger: {
              trigger: block,
              start: 'top 85%',     // begins as the text enters the screen
              end: 'clamp(bottom 45%)', // fully lit just below the middle (or by the page end)
              scrub: true
            }
          });
          self.lines.forEach(function (line, i) {
            var chars = self.chars.filter(function (c) { return line.contains(c); });
            // Lines light up one after another, each slightly overlapping the last
            tl.from(chars, { color: dim, stagger: 0.1, ease: 'none', duration: 1 }, i === 0 ? 0 : '-=0.8');
          });
          return tl;
        }
      });

      // Once fully lit, the text slowly fades away as the next section takes over
      gsap.fromTo(block, { opacity: 1 }, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: block,
          start: 'clamp(bottom 45%)', // right where the lighting-up finishes
          end: 'bottom top',          // gone as it leaves the top of the screen
          scrub: true
        }
      });
    });
  }

  /* ---------- Client logos: endless right → left drift ---------- */
  var LOGO_SPEED = 32; // pixels per second — slow

  function logoMarquee() {
    document.querySelectorAll('.logos').forEach(function (box) {
      var track = box.querySelector('.logos__track');
      var set = track && track.querySelector('.logos__set');
      if (!set) return;
      if (reduceMotion) return; // keep the row still

      var tween = null;
      function build() {
        // Enough copies to cover the box twice, so the loop never shows a gap
        track.querySelectorAll('.logos__set[aria-hidden]').forEach(function (n) { n.remove(); });
        var setW = set.getBoundingClientRect().width;
        var copies = Math.max(1, Math.ceil((box.clientWidth * 2) / setW));
        for (var i = 0; i < copies; i++) {
          var clone = set.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
          track.appendChild(clone);
        }
        if (tween) tween.kill();
        gsap.set(track, { x: 0 });
        // Move by exactly one set width, then jump back: seamless
        tween = gsap.to(track, { x: -setW, duration: setW / LOGO_SPEED, ease: 'none', repeat: -1 });
      }
      build();

      // Only run while visible
      if (window.ScrollTrigger) {
        ScrollTrigger.create({
          trigger: box,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: function (st) { if (tween) st.isActive ? tween.play() : tween.pause(); }
        });
      }

      var lastW = box.clientWidth;
      window.addEventListener('resize', function () {
        if (box.clientWidth !== lastW) { lastW = box.clientWidth; build(); }
      });
    });
  }

  /* ---------- Showcase: the screen grows from the centre to 80% of the
     screen while you scroll, switching screens on the way ---------- */
  var SHOWCASE_START_W = 344; // px, from Figma

  function showcaseOnScroll() {
    if (!window.ScrollTrigger) return;
    document.querySelectorAll('.showcase').forEach(function (section) {
      var stage = section.querySelector('.showcase__stage');
      var frame = section.querySelector('[data-showcase]');
      var screens = frame ? Array.prototype.slice.call(frame.querySelectorAll('.showcase__screen')) : [];
      if (!frame || !screens.length) return;

      function startScale() {
        var endW = frame.offsetWidth || 1;
        // Figma size on desktop; on narrow screens start at about half the end size
        return Math.min(SHOWCASE_START_W, endW * 0.55) / endW;
      }
      function show(i) {
        screens.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      }

      var phoneMQ = window.matchMedia('(max-width: 760px)');
      var PIN_LENGTH = '160%';  // how long the screen stays fixed in the middle
      var GROW = 0.85;          // share of the scroll spent growing; the rest holds at full size

      // 1. Keep the screen fixed in the middle once the section reaches the top
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=' + PIN_LENGTH,
        pin: stage
      });

      // 2. Start growing as soon as the section comes into view, so the screen
      //    is already growing while it rises to the middle
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'top -' + PIN_LENGTH,   // finishes together with the pin
          scrub: 0.6,                  // a little smoothing behind the scroll
          invalidateOnRefresh: true,
          onUpdate: function (st) {
            // The first screen stays while it rises to the middle; the rest switch
            // at even steps while it keeps growing; the last one stays
            // On phones the section is pulled up under the logos, so wait until
            // the screen is fully centred (pin start = 1 / 2.6 of the scroll)
            var SWITCH_FROM = phoneMQ.matches ? 0.385 : 0.3;
            var p = gsap.utils.clamp(0, 1, (st.progress - SWITCH_FROM) / (GROW - SWITCH_FROM));
            show(p <= 0 ? 0 : Math.min(screens.length - 1, 1 + Math.floor(p * (screens.length - 1))));
          }
        }
      });
      tl.fromTo(frame,
        { scale: startScale },
        { scale: 1, duration: GROW, ease: 'power1.inOut', force3D: false }, 0)
        .to({}, { duration: 1 - GROW }); // hold
    });
  }

  /* ---------- Floating CTA ----------
     The "Schedule an intro call" button scrolls away with the hero like
     normal. Once it has left the top of the screen, a copy slowly rises
     from below into a fixed spot at the bottom centre, and stays there.
     Scrolling back up sends it down again. */
  function floatingCta() {
    if (!window.ScrollTrigger) return;
    var source = document.querySelector('[data-cta-source]');
    var button = source && source.querySelector('.button');
    if (!button) return;

    var float = document.createElement('div');
    float.className = 'cta-float';
    var copy = button.cloneNode(true);
    copy.removeAttribute('data-reveal');
    copy.removeAttribute('style');
    float.appendChild(copy);
    document.body.appendChild(float);

    // Hidden position: just below the bottom edge of the screen
    function hiddenY() {
      var pad = parseFloat(getComputedStyle(root).getPropertyValue('--pad')) || 32;
      return float.offsetHeight + pad + 8;
    }
    gsap.set(float, { xPercent: -50, y: hiddenY, autoAlpha: 0 });

    function show() {
      gsap.to(float, {
        y: 0, autoAlpha: 1,
        duration: reduceMotion ? 0 : DUR.slower, // slow rise
        ease: 'ease-transition', overwrite: true
      });
      copy.removeAttribute('tabindex');
    }
    function hide() {
      gsap.to(float, {
        y: hiddenY, autoAlpha: 0,
        duration: reduceMotion ? 0 : DUR.normal,
        ease: 'power2.in', overwrite: true
      });
      copy.setAttribute('tabindex', '-1');
    }
    copy.setAttribute('tabindex', '-1');

    // Visible once the hero button has gone, until the closing section's
    // own button takes over at the end of the page.
    var pastHero = false, atEnd = false, shown = false;
    function update() {
      var want = pastHero && !atEnd;
      if (want === shown) return;
      shown = want;
      want ? show() : hide();
    }
    ScrollTrigger.create({
      trigger: source,
      start: 'bottom top',   // the hero button has fully left the screen
      end: 'max',
      onToggle: function (self) { pastHero = self.isActive; update(); }
    });
    var end = document.querySelector('[data-closing]');
    if (end) ScrollTrigger.create({
      trigger: end,
      start: 'top 65%',      // hand over before the closing heading comes into view
      end: 'max',
      refreshPriority: -1,   // made before the showcase pin; measure after it
      onToggle: function (self) { atEnd = self.isActive; update(); }
    });
  }

  /* ---------- Replayable scroll animations ----------
     Plays when the element scrolls up into view (scrolling down the page).
     Scrolling back up over it leaves it as it is; it only resets once it
     has dropped fully below the screen, so it plays again the next time
     you scroll down to it. */
  function replayOnScroll(el, play, reset) {
    reset();
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      onEnter: play
    });
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',   // fully below the screen
      onLeaveBack: reset
    });
  }

  /* ---------- Text that slides up line by line as it scrolls into view ---------- */
  function revealLinesOnScroll() {
    if (!window.ScrollTrigger || reduceMotion) return;
    document.querySelectorAll('[data-reveal-lines]').forEach(function (el) {
      var split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
      var tween = null;
      replayOnScroll(el,
        function play() {
          if (tween) tween.kill();
          tween = gsap.to(split.lines, { yPercent: 0, duration: DUR.slow, stagger: LINE_STAGGER, ease: 'ease-transition' });
        },
        function reset() {
          if (tween) tween.kill();
          gsap.set(split.lines, { yPercent: 150 });
        });
    });

    // The heading's arrow nudges forward once the heading has landed
    var arrow = document.querySelector('.approach__arrow');
    if (arrow) {
      var arrowTween = null;
      replayOnScroll(arrow.closest('h2') || arrow,
        function play() {
          if (arrowTween) arrowTween.kill();
          arrowTween = gsap.to(arrow, { x: 0, autoAlpha: 1, duration: DUR.slow, delay: 0.45, ease: 'ease-transition' });
        },
        function reset() {
          if (arrowTween) arrowTween.kill();
          gsap.set(arrow, { x: -10, autoAlpha: 0 });
        });
    }
  }

  /* ---------- Who's in the room: tags pop in, the active row follows the scroll ---------- */
  function roomsOnScroll() {
    if (!window.ScrollTrigger) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll('[data-rooms] .room'));
    if (!rows.length) return;

    function setActive(i) {
      rows.forEach(function (r, k) { r.classList.toggle('is-active', k === i); });
    }
    // Row 1 is lit until row 2 reaches the upper part of the screen, and so on.
    // Scrolling back up hands the highlight back.
    rows.forEach(function (row, i) {
      if (i === 0) return;
      ScrollTrigger.create({
        trigger: row,
        start: 'top 65%',
        onEnter: function () { setActive(i); },
        onLeaveBack: function () { setActive(i - 1); }
      });
    });

    if (reduceMotion) return;
    document.querySelectorAll('[data-reveal-items]').forEach(function (list) {
      var items = list.children;
      var tween = null;
      replayOnScroll(list,
        function play() {
          if (tween) tween.kill();
          tween = gsap.to(items, { y: 0, autoAlpha: 1, duration: DUR.normal, stagger: 0.06, delay: 0.15, ease: 'ease-transition' });
        },
        function reset() {
          if (tween) tween.kill();
          gsap.set(items, { y: 14, autoAlpha: 0 });
        });
    });
  }

  /* ---------- Closing section: the room lights up as it scrolls in ---------- */
  function closingOnScroll() {
    if (!window.ScrollTrigger || reduceMotion) return;
    var section = document.querySelector('[data-closing]');
    if (!section) return;
    var bg = section.querySelector('.closing__bg');
    var img = bg.querySelector('img');

    // Photo settles from a slight zoom and the dimmer lifts, tied to scroll
    gsap.fromTo(img, { scale: 1.15, yPercent: -6 }, {
      scale: 1, yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 0.6 }
    });
    gsap.fromTo(bg, { '--dim': 0.75 }, {
      '--dim': 0, ease: 'power1.out',
      scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 10%', scrub: 0.6 }
    });

    // Button slides up out of its mask after the two lines land
    var button = section.querySelector('[data-closing-button]');
    if (button) {
      var tween = null;
      replayOnScroll(button,
        function play() {
          if (tween) tween.kill();
          tween = gsap.to(button, { yPercent: 0, duration: DUR.slow, delay: 0.35, ease: 'ease-transition',
            onComplete: function () { gsap.set(button, { clearProps: 'transform' }); } });
        },
        function reset() {
          if (tween) tween.kill();
          gsap.set(button, { yPercent: 150 });
        });
    }
  }

  /* ---------- Footer: live date, smooth in-page links, reveal ---------- */

  // Today's date where Alex is (Tbilisi), e.g. "Friday, Nov 6, 2026 (GMT +04)"
  var HOME_TZ = 'Asia/Tbilisi';
  function footerDate() {
    var el = document.querySelector('[data-local-date]');
    if (!el || !window.Intl) return;
    function render() {
      var now = new Date();
      var date, offset = '';
      try {
        date = new Intl.DateTimeFormat('en-US', {
          timeZone: HOME_TZ, weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
        }).format(now);
        var name = new Intl.DateTimeFormat('en-US', { timeZone: HOME_TZ, timeZoneName: 'shortOffset' })
          .formatToParts(now).filter(function (p) { return p.type === 'timeZoneName'; })[0];
        var m = name && /GMT([+-])(\d{1,2})(?::(\d\d))?/.exec(name.value);
        if (m) offset = ' (GMT ' + m[1] + ('0' + m[2]).slice(-2) + (m[3] ? ':' + m[3] : '') + ')';
      } catch (e) { return; }
      el.textContent = date + offset;
      var ymd = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TZ }).format(now); // 2026-11-06
      el.setAttribute('datetime', ymd);
    }
    render();
    setInterval(render, 60 * 1000); // rolls over at midnight while the page is open
  }

  // "#home", "#values"… scroll smoothly; links to sections that don't exist yet do nothing
  function inPageLinks() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      e.preventDefault();
      if (!target) return;
      if (lenis) lenis.scrollTo(id === 'home' ? 0 : target, { duration: 1.6, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function footerReveal() {
    if (!window.ScrollTrigger || reduceMotion) return;
    var foot = document.querySelector('[data-foot]');
    if (!foot) return;
    var items = foot.querySelectorAll('[data-foot-item]');
    var line = foot.querySelector('[data-foot-line]');
    var tl = null;
    replayOnScroll(foot,
      function play() {
        if (tl) tl.kill();
        tl = gsap.timeline()
          .to(items, { yPercent: 0, duration: DUR.slow, stagger: 0.05, ease: 'ease-transition' }, 0)
          .to(line, { scaleX: 1, duration: DUR.slower, ease: 'ease-transition' }, 0.15)
          .add(function () { gsap.set(items, { clearProps: 'transform' }); });
      },
      function reset() {
        if (tl) tl.kill();
        gsap.set(items, { yPercent: 110 });
        gsap.set(line, { scaleX: 0 });
      });
  }

  /* ---------- Featured projects: cards reveal; touch screens show the design in view ---------- */
  function projectsOnScroll() {
    if (!window.ScrollTrigger) return;
    var cases = document.querySelectorAll('[data-case]');
    if (!cases.length) return;

    // Without a mouse there is no hover: show the "Main" design while the card
    // is in the middle of the screen instead
    // Phones and tablets (no mouse, or a phone-width window): no hover, so the
    // "Main" design appears on scroll instead, while the card is mid-screen.
    // Re-checked live, so rotating a tablet or resizing a window just works.
    var mouseMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
    var phoneMQ = window.matchMedia('(max-width: 760px)');
    function scrollMode() { return !mouseMQ.matches || phoneMQ.matches; }
    var triggers = [];
    cases.forEach(function (c) {
      triggers.push(ScrollTrigger.create({
        trigger: c.querySelector('[data-case-media]'),
        start: 'center 70%',   // one card at a time: while its centre is mid-screen
        end: 'center 30%',
        onToggle: function (self) { c.classList.toggle('is-hover', self.isActive && scrollMode()); }
      }));
    });
    function sync() {
      triggers.forEach(function (t, i) { cases[i].classList.toggle('is-hover', t.isActive && scrollMode()); });
    }
    [mouseMQ, phoneMQ].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
    });

    if (reduceMotion) return;
    // Card image wipes up from the bottom and settles from a slight zoom
    cases.forEach(function (c) {
      var media = c.querySelector('[data-case-media]');
      var bg = media.querySelector('.case__bg');
      var tl = null;
      replayOnScroll(media,
        function play() {
          if (tl) tl.kill();
          tl = gsap.timeline()
            .to(media, { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR.slower, ease: 'ease-transition' }, 0)
            .to(bg, { scale: 1, duration: 1.6, ease: 'ease-transition',
              onComplete: function () { gsap.set(bg, { clearProps: 'transform' }); } }, 0)
            .add(function () { gsap.set(media, { clearProps: 'clipPath' }); });
        },
        function reset() {
          if (tl) tl.kill();
          gsap.set(media, { clipPath: 'inset(100% 0% 0% 0%)' });
          gsap.set(bg, { scale: 1.15 });
        });
    });
  }

  /* ---------- Numbers that count up when they appear ---------- */
  function countUpOnScroll() {
    if (!window.ScrollTrigger || reduceMotion) return;
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var pre = el.getAttribute('data-prefix') || '';
      var post = el.getAttribute('data-suffix') || '';
      if (!isFinite(end)) return;
      var state = { v: 0 };
      var tween = null;
      function render() { el.textContent = pre + Math.round(state.v) + post; }
      replayOnScroll(el,
        function play() {
          if (tween) tween.kill();
          state.v = 0; render();
          tween = gsap.to(state, { v: end, duration: 1.6, delay: 0.1, ease: 'power3.out', onUpdate: render });
        },
        function reset() {
          if (tween) tween.kill();
          state.v = 0; render();
        });
    });
  }

  /* ---------- Light sections: header and floating button switch to dark ink ---------- */
  function themeSwitch() {
    if (!window.ScrollTrigger) return;
    document.querySelectorAll('[data-theme="light"]').forEach(function (section) {
      // header band (top of the screen)
      ScrollTrigger.create({
        trigger: section,
        start: 'top top+=50',
        end: 'bottom top+=50',
        toggleClass: { targets: root, className: 'on-light' }
      });
      // floating button band (bottom of the screen)
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom-=55',
        end: 'bottom bottom-=55',
        toggleClass: { targets: root, className: 'cta-on-light' }
      });
    });
  }

  // Lines can only be measured once the fonts are in
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(function () {
      footerDate();
      inPageLinks();
      heroVideo();
      heroIntro();
      floatingCta();
      highlightOnScroll();
      logoMarquee();
      if (!reduceMotion) {
        root.classList.add('has-motion');
        showcaseOnScroll();
      }
      // Created after the pinned showcase so their positions include its scroll length
      revealLinesOnScroll();
      countUpOnScroll();
      projectsOnScroll();
      roomsOnScroll();
      closingOnScroll();
      footerReveal();
      themeSwitch();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    })
    .catch(ready);
})();
