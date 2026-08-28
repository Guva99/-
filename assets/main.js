/* =========================================================
   Auros — landing interactions
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Sticky header state ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Active nav link on scroll ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-nav a'));
  var sections = navLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  revealItems.forEach(function (el) {
    el.style.setProperty('--reveal-delay', el.dataset.delay || 0);
  });

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Animated statistics ---------- */
  function formatValue(value, decimals, prefix, suffix) {
    return prefix + value.toFixed(decimals) + suffix;
  }

  function runCounter(el) {
    var target = parseFloat(el.dataset.countTo);
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';

    if (isNaN(target)) return;
    if (reduceMotion) {
      el.textContent = formatValue(target, decimals, prefix, suffix);
      return;
    }

    var duration = 1600;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatValue(target * eased, decimals, prefix, suffix);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count-to]'));
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      var counterObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { counterObserver.observe(el); });
    }
  }

  /* ---------- CTA form (no backend — client-side feedback only) ---------- */
  var form = document.querySelector('.cta-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var note = form.querySelector('.form-note');
      var value = (input.value || '').trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      note.textContent = valid
        ? 'Заявка принята — свяжемся в течение рабочего дня'
        : 'Укажите корректный рабочий адрес';
      note.style.color = valid ? 'var(--color-liquid-mist)' : 'var(--color-lavender-phosphor)';
      if (valid) form.reset();
    });
  }

  /* =========================================================
     Particle sphere — bioluminescent data orb
     ========================================================= */
  var canvas = document.getElementById('orb');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var POINTS = window.innerWidth < 760 ? 900 : 1700;
  var points = [];
  var width = 0;
  var height = 0;
  var radius = 0;
  var pointer = { x: 0, y: 0 };
  var pointerTarget = { x: 0, y: 0 };

  // Fibonacci sphere distribution
  (function buildPoints() {
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < POINTS; i++) {
      var y = 1 - (i / (POINTS - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = golden * i;
      points.push({
        x: Math.cos(theta) * r,
        y: y,
        z: Math.sin(theta) * r,
        // deterministic per-point variation
        seed: (i % 17) / 17
      });
    }
  })();

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    radius = Math.min(width, height) * (width < 760 ? 0.42 : 0.34);
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    pointer.x += (pointerTarget.x - pointer.x) * 0.05;
    pointer.y += (pointerTarget.y - pointer.y) * 0.05;

    var ry = time * 0.00013 + pointer.x * 0.5;
    var rx = -0.35 + Math.sin(time * 0.00009) * 0.12 + pointer.y * 0.3;

    var cosY = Math.cos(ry), sinY = Math.sin(ry);
    var cosX = Math.cos(rx), sinX = Math.sin(rx);
    var cx = width / 2;
    var cy = height / 2;
    var perspective = radius * 3.2;

    for (var i = 0; i < points.length; i++) {
      var p = points[i];

      // rotate Y
      var x1 = p.x * cosY - p.z * sinY;
      var z1 = p.x * sinY + p.z * cosY;
      // rotate X
      var y2 = p.y * cosX - z1 * sinX;
      var z2 = p.y * sinX + z1 * cosX;

      var scale = perspective / (perspective + z2 * radius);
      var sx = cx + x1 * radius * scale;
      var sy = cy + y2 * radius * scale;

      // depth 0 (far) .. 1 (near)
      var depth = (z2 + 1) / 2;
      var alpha = 0.08 + depth * 0.52;
      var size = (0.5 + depth * 1.5) * scale;

      // edge points (low |z|, far from centre in 2D) pick up the pink accent
      var radial = Math.sqrt(x1 * x1 + y2 * y2);
      var color;
      if (radial > 0.86 && p.seed > 0.72) {
        color = '253, 233, 255';          // lavender phosphor
        alpha = Math.min(1, alpha + 0.12);
      } else if (p.seed > 0.55) {
        color = '203, 255, 252';          // aurora / pale aqua
      } else {
        color = '0, 176, 168';            // bioluminescent teal
      }

      ctx.fillStyle = 'rgba(' + color + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.2, size), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var rafId = null;
  function loop(time) {
    draw(time);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  resize();
  window.addEventListener('resize', function () {
    resize();
    if (reduceMotion) draw(0);
  });

  if (reduceMotion) {
    draw(0);
  } else {
    window.addEventListener('mousemove', function (e) {
      pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    // Pause the orb once the hero has scrolled away
    if ('IntersectionObserver' in window) {
      var heroObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start(); else stop();
        });
      }, { threshold: 0 });
      heroObserver.observe(canvas);
    } else {
      start();
    }
    start();
  }
})();
