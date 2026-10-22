// Arranges project cards into masonry columns.
// Desktop (3 columns) follows the exact column placement from the Figma design (data-col).
// Narrower screens fill the shortest column first, keeping reading order.
(function () {
  var work = document.querySelector('.work');
  if (!work) return;
  var items = Array.prototype.slice.call(work.querySelectorAll('.item'));

  items.forEach(function (item, i) {
    item.style.setProperty('--i', i);
    var img = item.querySelector('img');
    if (img) {
      var w = +img.getAttribute('width'), h = +img.getAttribute('height');
      if (w && h) img.style.aspectRatio = w + ' / ' + h;
    }
  });

  function columnCount() {
    return getComputedStyle(work).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  }

  function ratio(item) {
    var img = item.querySelector('img');
    return img ? (+img.getAttribute('height') / +img.getAttribute('width')) || 1 : 1;
  }

  var current = 0;
  function layout() {
    var n = columnCount();
    if (n === current) return;
    current = n;

    var cols = [], heights = [];
    for (var c = 0; c < n; c++) {
      var col = document.createElement('div');
      col.className = 'work__col';
      cols.push(col);
      heights.push(0);
    }

    // Desktop: keep the order of items inside each Figma column
    var ordered = n === 3
      ? [1, 2, 3].reduce(function (acc, c) {
          return acc.concat(items.filter(function (it) { return it.dataset.col === String(c); }));
        }, [])
      : items;

    ordered.forEach(function (item) {
      var target;
      if (n === 3) {
        target = (+item.dataset.col || 1) - 1;
      } else {
        target = heights.indexOf(Math.min.apply(null, heights));
      }
      cols[target].appendChild(item);
      heights[target] += ratio(item) + 0.2; // + caption allowance
    });

    work.querySelectorAll('.work__col').forEach(function (c) { c.remove(); });
    cols.forEach(function (c) { work.appendChild(c); });
    work.classList.add('is-ready');
  }

  layout();
  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(layout, 100);
  });
})();

// Lightbox: click a project to open it large over a darkened page.
// The image grows out of its card, and clicking anywhere (or Esc) sends it back.
// ← / → step through projects while open.
(function () {
  var DURATION = 450;
  var EASE = 'cubic-bezier(.2, .7, .2, 1)';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;

  var lb = document.createElement('div');
  lb.className = 'lb';
  lb.hidden = true;
  lb.tabIndex = -1;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Project image. Click or press Escape to close.');
  lb.innerHTML = '<div class="lb__backdrop"></div><img class="lb__img" alt="">';
  document.body.appendChild(lb);
  var backdrop = lb.querySelector('.lb__backdrop');
  var big = lb.querySelector('.lb__img');

  var current = null;   // the .item__open link that is open
  var closing = false;
  var closeTimer;

  function links() { return Array.prototype.slice.call(document.querySelectorAll('.item__open')); }
  function thumbOf(link) { return link.querySelector('img'); }

  function ratioOf(img) {
    return { w: +img.getAttribute('width') || img.naturalWidth || 4, h: +img.getAttribute('height') || img.naturalHeight || 3 };
  }

  // Where the big image sits: as large as fits, with a small margin, centred
  function targetRect(img) {
    var pad = window.innerWidth < 760 ? 12 : 32;
    var r = ratioOf(img);
    var s = Math.min((window.innerWidth - pad * 2) / r.w, (window.innerHeight - pad * 2) / r.h);
    var w = r.w * s, h = r.h * s;
    return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2, width: w, height: h };
  }

  function place(t) {
    big.style.left = t.left + 'px';
    big.style.top = t.top + 'px';
    big.style.width = t.width + 'px';
    big.style.height = t.height + 'px';
  }

  // Transform that makes the big image sit exactly over the card
  function flipFrom(card, t) {
    return 'translate(' + (card.left - t.left) + 'px,' + (card.top - t.top) + 'px) ' +
           'scale(' + (card.width / t.width) + ',' + (card.height / t.height) + ')';
  }

  function setTransition(on) {
    var ms = reduceMotion.matches ? 150 : DURATION;
    big.style.transition = on && !reduceMotion.matches ? 'transform ' + ms + 'ms ' + EASE + ', opacity 150ms ease' : on ? 'opacity 150ms ease' : 'none';
    backdrop.style.transition = on ? 'opacity ' + ms + 'ms ease' : 'none';
    return ms;
  }

  function loadFull(link) {
    var thumb = thumbOf(link);
    var full = thumb.getAttribute('data-full');
    big.src = thumb.currentSrc || thumb.src; // already loaded — shows instantly
    big.alt = thumb.alt;
    if (full && full !== thumb.getAttribute('src')) {
      var hi = new Image();
      hi.src = full;
      (hi.decode ? hi.decode() : Promise.resolve()).then(function () {
        if (current === link) big.src = full;
      }).catch(function () {});
    }
  }

  function lockScroll(on) {
    if (on) {
      var gap = window.innerWidth - root.clientWidth;
      if (gap > 0) root.style.paddingRight = gap + 'px';
      root.classList.add('lb-open');
    } else {
      root.classList.remove('lb-open');
      root.style.paddingRight = '';
    }
  }

  function open(link) {
    clearTimeout(closeTimer);
    if (current) thumbOf(current).style.visibility = '';
    closing = false;
    current = link;
    var thumb = thumbOf(link);
    var card = thumb.getBoundingClientRect();
    var t = targetRect(thumb);

    loadFull(link);
    setTransition(false);
    place(t);
    big.style.opacity = reduceMotion.matches ? '0' : '1';
    big.style.transform = reduceMotion.matches ? 'none' : flipFrom(card, t);
    backdrop.style.opacity = '0';
    lb.hidden = false;
    lockScroll(true);
    thumb.style.visibility = 'hidden';

    void big.offsetWidth; // commit the start position before animating
    setTransition(true);
    big.style.transform = 'none';
    big.style.opacity = '1';
    backdrop.style.opacity = '1';
    lb.focus({ preventScroll: true });
  }

  function close() {
    if (!current || closing) return;
    closing = true;
    var link = current;
    var thumb = thumbOf(link);
    var card = thumb.getBoundingClientRect();
    var t = big.getBoundingClientRect();
    var ms = setTransition(true);
    if (reduceMotion.matches) {
      big.style.opacity = '0';
    } else {
      // Card may be off-screen after ←/→; fade instead of flying away
      var visible = card.bottom > 0 && card.top < window.innerHeight;
      if (visible) big.style.transform = flipFrom(card, { left: t.left, top: t.top, width: t.width, height: t.height });
      else big.style.opacity = '0';
    }
    backdrop.style.opacity = '0';
    closeTimer = setTimeout(function () {
      lb.hidden = true;
      thumb.style.visibility = '';
      big.removeAttribute('src');
      lockScroll(false);
      current = null;
      closing = false;
      link.focus({ preventScroll: true });
    }, ms);
  }

  function step(dir) {
    if (!current || closing) return;
    var all = links();
    var next = all[(all.indexOf(current) + dir + all.length) % all.length];
    thumbOf(current).style.visibility = '';
    big.style.transition = 'opacity 120ms ease';
    big.style.opacity = '0';
    setTimeout(function () {
      current = next;
      var thumb = thumbOf(next);
      thumb.style.visibility = 'hidden';
      setTransition(false);
      big.style.transform = 'none';
      place(targetRect(thumb));
      loadFull(next);
      void big.offsetWidth;
      big.style.transition = 'opacity 180ms ease';
      big.style.opacity = '1';
    }, 120);
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.item__open');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(link);
  });

  lb.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') { e.preventDefault(); } // keep focus inside while open
  });

  window.addEventListener('resize', function () {
    if (!current || closing) return;
    setTransition(false);
    place(targetRect(thumbOf(current)));
  });
})();
