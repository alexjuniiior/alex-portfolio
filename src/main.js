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
