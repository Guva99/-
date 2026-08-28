/* =========================================================
   Созвездие — одно фоновое поле на всю страницу,
   перестраивается при скролле
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('scene');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  // На светлом фоне поле ведут серые токены, оранжевый — редкая пунктуация
  var PALETTE = [
    ['#E8E8E8', 32], ['#BFBFBF', 22], ['#FFDBCE', 14],
    ['#FD622C', 12], ['#FC5922', 8], ['#C24A22', 6], ['#7B7B7B', 6]
  ];
  var COLORS = PALETTE.map(function (p) { return p[0]; });
  var PICK = [];
  PALETTE.forEach(function (p, i) { for (var k = 0; k < p[1]; k++) PICK.push(i); });

  var ALPHA_STEPS = 4;
  var LINE_WIDTHS = [1, 1.6, 2.4];

  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  var COUNT = window.innerWidth < 760 ? 1100 : 2800;
  var rand = rng(1337);
  var particles = [];
  for (var i = 0; i < COUNT; i++) {
    var r = [rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    particles.push({
      r: r,
      x: (r[0] * 2 - 1) * 1.4,
      y: (r[1] * 2 - 1) * 1.4,
      tx: 0, ty: 0,
      // мелкая «пыль» и редкие крупные ближние фигуры
      size: 1.5 + Math.pow(r[2], 5.6) * 70,
      z: r[3],
      color: PICK[(r[4] * PICK.length) | 0],
      rot: r[5] * Math.PI * 2,
      spin: (r[5] - 0.5) * 0.35,
      phase: r[0] * Math.PI * 2,
      speed: 0.2 + r[1] * 0.5
    });
  }

  /* --- силуэт мозга: бугристый контур, межполушарная щель,
         борозда мозжечка и извилины; кромка держится плотной --- */
  function sampleBrain(br) {
    var x = br() * 2.2 - 1.1;
    var y = br() * 2 - 1;
    var ex = x, ey = y / 0.86;
    var th = Math.atan2(ey, ex);
    var rr = Math.sqrt(ex * ex + ey * ey);
    var R = 0.9 + 0.07 * Math.sin(3 * th + 0.6) + 0.05 * Math.sin(5 * th + 2.1) + 0.035 * Math.sin(8 * th + 0.3);
    var d = R - rr;
    if (d <= 0) return null;

    var fx = x + 0.05 * Math.sin(y * 2.4);
    if (y < 0.3 && Math.abs(fx) < 0.072) return null;

    var groove = (x * 0.55 + y * 0.83) - 0.52;
    if (Math.abs(groove) < 0.045 && x > -0.15) return null;

    if (d < 0.14) return [x, y];
    var band = Math.sin(8.5 * x + 3.1 * Math.sin(2.9 * y) + 1.4 * y);
    if (Math.abs(band) < 0.33) return null;
    return [x, y];
  }

  var brainPoints = [];
  (function () {
    var br = rng(90210);
    var guard = COUNT * 600;
    while (brainPoints.length < COUNT * 2 && guard-- > 0) {
      var pt = sampleBrain(br);
      if (pt) { brainPoints.push(pt[0], pt[1]); }
    }
  })();

  /* --- фигуры: рисуем в офскрин-канвас и берём непрозрачные пиксели
         как цели для частиц; штрих даёт контурный рисунок --- */
  var SHAPE_SIZE = 220;

  function rasterise(paint) {
    var off = document.createElement('canvas');
    off.width = SHAPE_SIZE;
    off.height = SHAPE_SIZE;
    var octx = off.getContext('2d');
    octx.strokeStyle = '#000';
    octx.fillStyle = '#000';
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    paint(octx, SHAPE_SIZE);

    var data = octx.getImageData(0, 0, SHAPE_SIZE, SHAPE_SIZE).data;
    var pool = [];
    for (var y = 0; y < SHAPE_SIZE; y++) {
      for (var x = 0; x < SHAPE_SIZE; x++) {
        if (data[(y * SHAPE_SIZE + x) * 4 + 3] > 128) {
          pool.push((x / SHAPE_SIZE) * 2 - 1, (y / SHAPE_SIZE) * 2 - 1);
        }
      }
    }
    return pool;
  }

  var SHAPES = {
    // лампочка — инсайт
    bulb: rasterise(function (c) {
      c.lineWidth = 6;
      c.beginPath(); c.arc(110, 88, 46, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(88, 130); c.lineTo(88, 150);
      c.moveTo(132, 130); c.lineTo(132, 150);
      c.stroke();
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(86, 156); c.lineTo(134, 156);
      c.moveTo(90, 168); c.lineTo(130, 168);
      c.moveTo(98, 180); c.lineTo(122, 180);
      c.stroke();
      // нить накаливания
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(94, 96); c.lineTo(104, 78); c.lineTo(114, 96); c.lineTo(124, 78);
      c.stroke();
      // лучи
      c.lineWidth = 5;
      for (var i = 0; i < 8; i++) {
        var a = (Math.PI * 2 / 8) * i - Math.PI / 2;
        if (a > 0.6 && a < 2.5) continue;
        c.beginPath();
        c.moveTo(110 + Math.cos(a) * 62, 88 + Math.sin(a) * 62);
        c.lineTo(110 + Math.cos(a) * 78, 88 + Math.sin(a) * 78);
        c.stroke();
      }
    }),

    // столбцы и растущая стрелка — результаты
    chart: rasterise(function (c) {
      c.lineWidth = 6;
      var base = 190;
      var bars = [[46, 38], [96, 62], [146, 86]];
      bars.forEach(function (b) {
        c.fillRect(b[0], base - b[1], 34, b[1]);
      });
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(50, 88); c.lineTo(104, 58); c.lineTo(158, 28);
      c.stroke();
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(126, 26); c.lineTo(164, 24); c.lineTo(160, 62);
      c.stroke();
    }),

    // облако реплики — отзыв
    bubble: rasterise(function (c) {
      c.lineWidth = 6;
      var x = 28, y = 44, w = 164, h = 104, r = 28;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(66, 148); c.lineTo(62, 186); c.lineTo(102, 148);
      c.stroke();
      // кавычки внутри
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(80, 82); c.lineTo(70, 104); c.moveTo(100, 82); c.lineTo(90, 104);
      c.moveTo(126, 82); c.lineTo(116, 104); c.moveTo(146, 82); c.lineTo(136, 104);
      c.stroke();
    }),

    // конверт — заявка
    envelope: rasterise(function (c) {
      c.lineWidth = 6;
      c.strokeRect(28, 62, 164, 108);
      c.beginPath();
      c.moveTo(28, 62); c.lineTo(110, 128); c.lineTo(192, 62);
      c.stroke();
      c.beginPath();
      c.moveTo(28, 170); c.lineTo(84, 118);
      c.moveTo(192, 170); c.lineTo(136, 118);
      c.stroke();
    })
  };

  function shapeFormation(pool, scale, offsetY) {
    var pairs = pool.length / 2;
    return function (p, i) {
      var j = (i * 7919) % pairs;
      return [
        pool[j * 2] * scale + (p.r[0] - 0.5) * 0.02,
        pool[j * 2 + 1] * scale + (p.r[1] - 0.5) * 0.02 + (offsetY || 0)
      ];
    };
  }

  // центры сгустков для рыхлых формаций
  var CLUSTERS = [];
  (function () {
    var cr = rng(4242);
    for (var i = 0; i < 26; i++) CLUSTERS.push([-1.15 + Math.pow(cr(), 0.6) * 2.4, (cr() * 2 - 1) * 1.05]);
  })();

  /* --- формации: положение частицы в нормализованном пространстве --- */
  var FORMATIONS = {
    scatter: function (p) {
      if (p.r[6] < 0.62) {
        var c = CLUSTERS[(p.r[7] * CLUSTERS.length) | 0];
        var a = p.r[0] * Math.PI * 2;
        var rr = Math.pow(p.r[1], 0.7) * 0.42;
        return [c[0] + Math.cos(a) * rr * 1.2, c[1] + Math.sin(a) * rr];
      }
      return [-1.3 + Math.pow(p.r[0], 0.58) * 2.7, (p.r[1] * 2 - 1) * 1.2];
    },
    bulb: shapeFormation(SHAPES.bulb, 0.66),
    brain: function (p, i) {
      var j = (i % (brainPoints.length / 2)) | 0;
      return [brainPoints[j * 2] * 0.62, brainPoints[j * 2 + 1] * 0.62];
    },
    chart: shapeFormation(SHAPES.chart, 0.66),
    sparse: function (p) {
      return [(p.r[0] * 2 - 1) * 1.55, (p.r[1] * 2 - 1) * 1.4];
    },
    bubble: shapeFormation(SHAPES.bubble, 0.62),
    envelope: shapeFormation(SHAPES.envelope, 0.62)
  };

  var FORM_SIZE = { brain: 0.2, bulb: 0.2, chart: 0.2, bubble: 0.2, envelope: 0.2 };
  var sizeScale = 1;
  var sizeTarget = 1;

  function applyFormation(name) {
    var fn = FORMATIONS[name] || FORMATIONS.sparse;
    sizeTarget = FORM_SIZE[name] || 1;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var t = fn(p, i);
      p.tx = t[0];
      p.ty = t[1];
    }
  }
  applyFormation('scatter');
  if (reduceMotion) {
    particles.forEach(function (p) { p.x = p.tx; p.y = p.ty; });
    sizeScale = sizeTarget;
  }

  /* --- секция → формация: по близости к центру вьюпорта,
         чтобы прыжок скролла всегда попадал в нужную --- */
  var zones = Array.prototype.slice.call(document.querySelectorAll('[data-formation]'));
  var current = 'scatter';
  var anchor = null;   // .figure-slot активной секции — фигура собирается в нём

  function pickFormation() {
    var centre = window.innerHeight / 2;
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < zones.length; i++) {
      var rect = zones[i].getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      var distance = Math.abs((rect.top + rect.bottom) / 2 - centre);
      if (distance < bestDistance) { bestDistance = distance; best = zones[i]; }
    }
    if (!best) return;
    var name = best.dataset.formation;
    if (name && name !== current) {
      current = name;
      anchor = best.querySelector('.figure-slot');
      applyFormation(name);
    }
  }

  pickFormation();
  window.addEventListener('scroll', pickFormation, { passive: true });
  window.addEventListener('resize', pickFormation);

  /* --- отрисовка --- */
  var width = 0, height = 0, unit = 0;
  var pointer = { x: 0, y: 0 };
  var pointerTarget = { x: 0, y: 0 };
  var buckets = [];
  for (var b = 0; b < COLORS.length * ALPHA_STEPS * LINE_WIDTHS.length; b++) buckets.push([]);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.max(width, height) * 0.56;
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    pointer.x += (pointerTarget.x - pointer.x) * 0.04;
    pointer.y += (pointerTarget.y - pointer.y) * 0.04;

    var t = time * 0.001;
    var cx = width / 2;
    var cy = height / 2;
    var u = unit;
    var yScale = 0.92;
    var i;

    if (anchor) {
      var slot = anchor.getBoundingClientRect();
      cx = slot.left + slot.width / 2;
      cy = slot.top + slot.height / 2;
      u = Math.min(slot.width, slot.height) * 0.5 / 0.7;
      yScale = 1;
    }

    sizeScale += (sizeTarget - sizeScale) * 0.05;

    for (i = 0; i < buckets.length; i++) buckets[i].length = 0;

    for (i = 0; i < particles.length; i++) {
      var p = particles[i];

      if (!reduceMotion) {
        var ease = 0.035 + p.r[3] * 0.045;
        p.x += (p.tx - p.x) * ease;
        p.y += (p.ty - p.y) * ease;
      }

      var depth = 0.35 + p.z * 0.65;
      var driftX = Math.sin(t * p.speed + p.phase) * 0.0075;
      var driftY = Math.cos(t * p.speed * 0.85 + p.phase) * 0.0075;

      var px = cx + (p.x + driftX) * u + pointer.x * depth * 26;
      var py = cy + (p.y + driftY) * u * yScale + pointer.y * depth * 26;

      var size = p.size * (0.55 + depth * 0.7) * sizeScale;
      if (px < -size * 2 || px > width + size * 2 || py < -size * 2 || py > height + size * 2) continue;

      // крупные фигуры читаются как ближние и расфокусированные — держим их бледными
      var big = Math.min(1, p.size / 34);
      var twinkle = 0.66 + 0.34 * Math.sin(t * 1.15 + p.phase * 2);
      var alpha = (1 - big * 0.62) * (0.55 + depth * 0.45) * twinkle;

      var aStep = Math.min(ALPHA_STEPS - 1, Math.max(0, Math.round(alpha * ALPHA_STEPS) - 1));
      var lwStep = size > 26 ? 2 : (size > 11 ? 1 : 0);
      var bucket = (p.color * ALPHA_STEPS + aStep) * LINE_WIDTHS.length + lwStep;

      buckets[bucket].push(px, py, size * 0.5, p.rot + t * p.spin);
    }

    ctx.lineJoin = 'miter';
    for (i = 0; i < buckets.length; i++) {
      var items = buckets[i];
      if (!items.length) continue;
      ctx.beginPath();
      for (var j = 0; j < items.length; j += 4) {
        var x = items[j], y = items[j + 1], s = items[j + 2], a = items[j + 3];
        ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a + 2.0944) * s, y + Math.sin(a + 2.0944) * s);
        ctx.lineTo(x + Math.cos(a + 4.1888) * s, y + Math.sin(a + 4.1888) * s);
        ctx.closePath();
      }
      ctx.lineWidth = LINE_WIDTHS[i % LINE_WIDTHS.length];
      ctx.globalAlpha = ((((i / LINE_WIDTHS.length) | 0) % ALPHA_STEPS) + 1) / ALPHA_STEPS;
      ctx.strokeStyle = COLORS[(i / (ALPHA_STEPS * LINE_WIDTHS.length)) | 0];
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  var rafId = null;
  function loop(time) { draw(time); rafId = window.requestAnimationFrame(loop); }
  function start() { if (rafId === null && !reduceMotion) rafId = window.requestAnimationFrame(loop); }
  function stop() { if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null; } }

  resize();
  draw(0);
  window.addEventListener('resize', function () { resize(); draw(performance.now()); });

  if (reduceMotion) return;

  window.addEventListener('mousemove', function (e) {
    pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  start();
})();
