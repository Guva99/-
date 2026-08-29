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

  // На белом почти не работают светлые токены, поэтому поле ведут
  // оранжевые акценты и средние серые
  var PALETTE = [
    ['#FD622C', 26], ['#FC5922', 16], ['#C24A22', 12], ['#FFDBCE', 10],
    ['#BFBFBF', 14], ['#7B7B7B', 12], ['#4B4B4B', 10],
    // цвета иконок: вес 0 — в общее поле не подмешиваются
    ['#8052FF', 0], ['#22A06B', 0], ['#E5484D', 0], ['#3B82F6', 0], ['#FF5FA2', 0]
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

  var COUNT = window.innerWidth < 760 ? 2000 : 5200;
  var rand = rng(1337);
  var particles = [];
  for (var i = 0; i < COUNT; i++) {
    var r = [rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    particles.push({
      r: r,
      // единый калибр: размер не меняется от сцены к сцене
      size: 1.2 + Math.pow(r[2], 2.2) * 3.4,
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
      c.lineWidth = 4.5;
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
      // надпись UP внутри колбы — контуром, залитые буквы сливаются в пятно
      // предповорот на +30° гасит наклон самой фигуры, надпись стоит прямо
      c.save();
      c.translate(110, 90);
      c.rotate(30 * Math.PI / 180);
      c.font = '700 44px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 3;
      c.strokeText('UP', 0, 0);
      c.restore();
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

  // Кусок пазла: квадрат со скруглением, к нему прибавляются выступы
  // и вычитаются впадины — так форма читается без ручного построения кривых.
  /* --- иконки сервисов: каждая своим цветом --- */
  // Рисуются штрихом в буфере 220x220; на экране занимают ~120px.
  function iconStroke(paint) {
    return rasterise(function (c) {
      c.lineWidth = 6;
      paint(c);
    });
  }

  var ICONS = [
    { hex: '#8052FF', px: -0.62, py: -0.33, s: 0.12, pool: iconStroke(function (c) {
      // ИИ — четырёхлучевая искра и малая рядом
      c.beginPath();
      c.moveTo(104, 32);
      c.quadraticCurveTo(114, 96, 176, 106);
      c.quadraticCurveTo(114, 116, 104, 180);
      c.quadraticCurveTo(94, 116, 32, 106);
      c.quadraticCurveTo(94, 96, 104, 32);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(178, 128);
      c.quadraticCurveTo(182, 150, 204, 154);
      c.quadraticCurveTo(182, 158, 178, 180);
      c.quadraticCurveTo(174, 158, 152, 154);
      c.quadraticCurveTo(174, 150, 178, 128);
      c.closePath();
      c.stroke();
    }) },
    { hex: '#FD622C', px: -0.62, py: 0.0, s: 0.12, pool: iconStroke(function (c) {
      // чат — облако реплики с хвостом
      c.beginPath();
      if (c.roundRect) c.roundRect(36, 52, 148, 96, 20); else c.rect(36, 52, 148, 96);
      c.stroke();
      c.beginPath();
      c.moveTo(80, 148); c.lineTo(64, 186); c.lineTo(114, 148);
      c.stroke();
    }) },
    { hex: '#22A06B', px: -0.62, py: 0.33, s: 0.12, pool: iconStroke(function (c) {
      // доставка — объёмная коробка
      c.beginPath();
      c.moveTo(110, 34); c.lineTo(176, 68); c.lineTo(176, 140);
      c.lineTo(110, 174); c.lineTo(44, 140); c.lineTo(44, 68);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.moveTo(44, 68); c.lineTo(110, 102);
      c.moveTo(176, 68); c.lineTo(110, 102);
      c.moveTo(110, 102); c.lineTo(110, 174);
      c.stroke();
    }) },
    { hex: '#E5484D', px: 0.62, py: -0.33, s: 0.12, pool: iconStroke(function (c) {
      // конструктор сайта — окно браузера с блоком
      c.beginPath();
      if (c.roundRect) c.roundRect(30, 48, 160, 112, 10); else c.rect(30, 48, 160, 112);
      c.stroke();
      c.beginPath();
      c.moveTo(30, 80); c.lineTo(190, 80);
      c.stroke();
      c.beginPath();
      if (c.roundRect) c.roundRect(48, 96, 52, 48, 6); else c.rect(48, 96, 52, 48);
      c.stroke();
      c.beginPath();
      c.moveTo(116, 108); c.lineTo(174, 108);
      c.moveTo(116, 132); c.lineTo(158, 132);
      c.stroke();
    }) },
    { hex: '#3B82F6', px: 0.62, py: 0.0, s: 0.12, pool: iconStroke(function (c) {
      // CRM — контакт: голова и плечи
      c.beginPath(); c.arc(110, 76, 30, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(54, 170);
      c.bezierCurveTo(54, 122, 166, 122, 166, 170);
      c.stroke();
    }) },
    { hex: '#FF5FA2', px: 0.62, py: 0.33, s: 0.12, pool: iconStroke(function (c) {
      // таймер — циферблат со стрелками и кнопкой
      c.beginPath(); c.arc(110, 124, 56, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(110, 124); c.lineTo(110, 88);
      c.moveTo(110, 124); c.lineTo(138, 134);
      c.stroke();
      c.beginPath();
      c.moveTo(92, 44); c.lineTo(128, 44);
      c.moveTo(110, 44); c.lineTo(110, 62);
      c.stroke();
    }) }
  ];
  ICONS.forEach(function (ic) { ic.color = COLORS.indexOf(ic.hex); });

  // центры сгустков для рыхлых формаций
  var CLUSTERS = [];
  (function () {
    var cr = rng(4242);
    for (var i = 0; i < 26; i++) CLUSTERS.push([-1.15 + Math.pow(cr(), 0.6) * 2.4, (cr() * 2 - 1) * 1.05]);
  })();

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
    // распыление плотное слева и плавно тающее вправо;
    // поверх него шесть цветных иконок сервисов
    cubes: function (p, i) {
      if (p.r[6] < 0.72) {
        // степенное распределение: слева плотно, вправо плавный хвост
        var x = -1.02 + Math.pow(p.r[0], 3.4) * 2.15;
        return [x, (p.r[1] * 2 - 1) * 0.62];
      }
      var k = Math.min(ICONS.length - 1, (((p.r[6] - 0.72) / 0.28) * ICONS.length) | 0);
      var ic = ICONS[k];
      var n = ic.pool.length / 2;
      var j = (i * 7919) % n;
      // третьим элементом едет индекс цвета иконки;
      // деление на 0.92 гасит вертикальное сжатие сцены
      return [
        ic.pool[j * 2] * ic.s + ic.px,
        ic.pool[j * 2 + 1] * ic.s / 0.92 + ic.py,
        ic.color
      ];
    },

    // плотные абстрактные волны по низу экрана
    waves: function (p) {
      var x = -0.98 + p.r[0] * 1.96;
      // сумма гармоник — узор не повторяется по ширине экрана
      function crest(k) {
        return 0.15 + k * 0.075
          + 0.125 * Math.sin(x * 2.7 + k * 0.8 + 0.4)
          + 0.065 * Math.sin(x * 5.5 + k * 1.7 + 1.7)
          + 0.032 * Math.sin(x * 10.5 + k * 2.3 + 2.9)
          + 0.016 * Math.sin(x * 19.0 + 1.1);
      }
      if (p.r[6] < 0.1) {
        // редкая взвесь над гребнем — след от осыпания
        return [x, crest(0) - Math.pow(p.r[1], 2.4) * 0.4];
      }
      if (p.r[6] < 0.8) {
        var top = crest(0);
        // низ упирается в край экрана: ниже частицы просто отсекались бы
        return [x, top + Math.pow(p.r[1], 1.9) * (0.6 - top)];
      }
      var band = 1 + ((p.r[7] * 4) | 0);
      return [x, crest(band) + (p.r[1] - 0.5) * 0.022];
    },
    sparse: function (p) {
      return [(p.r[0] * 2 - 1) * 1.55, (p.r[1] * 2 - 1) * 1.4];
    },
    bubble: shapeFormation(SHAPES.bubble, 0.62),
    envelope: shapeFormation(SHAPES.envelope, 0.62)
  };

  // насколько сцена выкручивает непрозрачность — на белом шар иначе тонет
  var FORM_BOOST = { planet: 1.6, waves: 1.3, cubes: 1.9 };
  // множитель дрейфа: 1 — обычное дыхание поля, меньше — резче контуры
  var FORM_CALM = { cubes: 0.3, planet: 0.6 };

  /* --- планета: шар с материками ---
         Контуры материков задаются полигонами в градусах долготы и широты,
         растеризуются в равнопромежуточную маску, после чего точки сферы
         проверяются по ней. Поворот зафиксирован так, чтобы к зрителю были
         повёрнуты Европа, Россия и Индия. --- */
  var LANDS = [
    // Африка
    [[-17,14],[-17,21],[-13,28],[-10,31],[-6,36],[1,37],[10,37],[20,33],[25,32],[32,31],
     [35,24],[38,18],[43,12],[48,12],[51,11],[45,2],[41,-2],[40,-11],[35,-20],[33,-26],
     [28,-31],[25,-34],[19,-35],[15,-27],[12,-18],[11,-8],[9,-1],[9,4],[5,5],[-2,5],
     [-8,4],[-13,9]],
    // Евразия
    [[-9,43],[-2,43],[-2,48],[1,50],[4,52],[7,54],[10,57],[12,55],[19,54],[21,56],
     [24,57],[28,59],[30,60],[29,65],[31,70],[41,68],[55,68],[60,70],[70,73],[80,73],
     [90,76],[105,77],[115,74],[130,73],[140,72],[150,70],[160,70],[170,68],[179,66],
     [178,64],[170,60],[163,58],[160,53],[156,51],[148,46],[143,44],[140,45],[136,48],
     [133,44],[130,43],[129,40],[126,39],[122,40],[122,37],[119,35],[121,32],[122,30],
     [118,24],[110,21],[108,15],[106,10],[105,9],[103,4],[100,7],[98,10],[98,14],
     [94,16],[92,21],[89,22],[87,20],[82,17],[80,13],[78,6],[75,12],[72,18],[70,22],
     [67,24],[64,25],[61,25],[58,25],[57,22],[55,17],[52,13],[45,13],[43,17],[39,21],
     [36,28],[34,31],[36,36],[30,37],[27,37],[23,38],[23,40],[19,40],[16,41],[13,45],
     [12,44],[8,44],[4,43],[3,42],[0,39],[-1,37],[-5,36],[-6,37],[-9,38]],
    // Скандинавия
    [[5,58],[8,58],[11,59],[13,58],[18,60],[21,63],[24,66],[28,70],[31,70],[29,66],
     [25,63],[22,60],[19,58],[15,56],[11,55],[8,57]],
    // Британские острова
    [[-5,50],[-6,54],[-3,58],[0,58],[1,53],[-2,51]],
    // Гренландия
    [[-45,60],[-52,64],[-55,70],[-45,78],[-30,82],[-20,78],[-22,70],[-32,64]],
    // Северная Америка
    [[-125,49],[-130,55],[-140,60],[-155,60],[-165,65],[-160,70],[-140,70],[-125,70],
     [-110,68],[-95,68],[-80,65],[-65,60],[-60,50],[-70,45],[-75,40],[-80,32],[-82,28],
     [-90,29],[-97,26],[-98,20],[-95,17],[-88,15],[-84,10],[-78,8],[-83,15],[-90,20],
     [-105,22],[-110,30],[-117,32],[-122,37],[-124,42]],
    // Южная Америка
    [[-78,8],[-75,0],[-70,-5],[-72,-15],[-70,-20],[-71,-30],[-73,-45],[-75,-52],
     [-68,-55],[-65,-45],[-62,-40],[-57,-35],[-53,-33],[-48,-25],[-40,-20],[-35,-8],
     [-45,-2],[-50,0],[-60,5],[-70,10]],
    // Австралия
    [[114,-22],[113,-26],[115,-34],[122,-34],[129,-32],[137,-35],[140,-38],[146,-39],
     [150,-37],[153,-28],[146,-19],[142,-11],[136,-12],[130,-11],[125,-14],[122,-18]],
    // Мадагаскар, Шри-Ланка, Япония, Индонезия
    [[44,-16],[50,-15],[50,-24],[45,-25],[43,-21]],
    [[80,9],[82,8],[82,6],[80,6]],
    [[130,32],[135,34],[140,37],[142,43],[145,44],[141,40],[137,35],[132,32]],
    [[95,5],[105,0],[115,-3],[120,-8],[130,-6],[140,-5],[140,-8],[128,-9],[115,-9],
     [105,-7],[98,1]]
  ];

  var landMask = (function () {
    var W = 720, H = 360;
    var off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    var mctx = off.getContext('2d');
    mctx.fillStyle = '#000';
    LANDS.forEach(function (poly) {
      mctx.beginPath();
      poly.forEach(function (pt, k) {
        var x = (pt[0] + 180) / 360 * W;
        var y = (90 - pt[1]) / 180 * H;
        if (k === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
      });
      mctx.closePath();
      mctx.fill();
    });
    var data = mctx.getImageData(0, 0, W, H).data;
    return function (lat, lon) {
      var x = Math.floor((lon + 180) / 360 * W);
      var y = Math.floor((90 - lat) / 180 * H);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return data[(y * W + x) * 4 + 3] > 128;
    };
  })();

  var PLANET = (function () {
    var RADIUS = 0.62;
    var TILT = 0.48;                // смотрим сверху, ближе к северному полюсу
    var SPIN = 45 * Math.PI / 180;  // к зрителю повёрнута долгота 45° в.д.
    var SAMPLES = 90000;
    var golden = Math.PI * (3 - Math.sqrt(5));

    var ca = Math.cos(SPIN), sa = Math.sin(SPIN);
    var ct = Math.cos(TILT), st = Math.sin(TILT);
    var land = [];

    for (var i = 0; i < SAMPLES; i++) {
      var y = 1 - (i / (SAMPLES - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = golden * i;
      var x = Math.cos(th) * r;
      var z = Math.sin(th) * r;

      var lat = Math.asin(y) * 180 / Math.PI;
      var lon = Math.atan2(z, x) * 180 / Math.PI;
      if (!landMask(lat, lon)) continue;

      var z1 = x * sa + z * ca;
      var z2 = y * st + z1 * ct;
      if (z2 < -0.2) continue;   // с запасом на подкрутку при скролле

      land.push(x, y, z);
    }

    return { land: land, radius: RADIUS, tilt: TILT, spin: SPIN };
  })();

  /* Планета — динамическая сцена: 15% частиц держат лимб, остальные лежат
     на суше и подкручиваются вместе со скроллом. Ортографическая проекция,
     без неё силуэт перестаёт быть ровной окружностью. */
  function buildPlanetStage() {
    var ringCount = Math.round(COUNT * 0.15);
    var n = PLANET.land.length / 3;
    var ct = Math.cos(PLANET.tilt), st = Math.sin(PLANET.tilt);
    var ca = Math.cos(PLANET.spin), sa = Math.sin(PLANET.spin);
    var entries = [];
    var i;

    for (i = 0; i < COUNT; i++) {
      if (i < ringCount) {
        var a = (i / ringCount) * Math.PI * 2;
        entries.push({
          ring: true, ang: a,
          bx: Math.cos(a) * PLANET.radius,
          by: Math.sin(a) * PLANET.radius
        });
      } else {
        var j = ((i - ringCount) * 7919) % n;
        var x = PLANET.land[j * 3], y = PLANET.land[j * 3 + 1], z = PLANET.land[j * 3 + 2];
        var x1 = x * ca - z * sa;
        var z1 = x * sa + z * ca;
        var y2 = y * ct - z1 * st;
        entries.push({
          ring: false, x: x, y: y, z: z,
          bx: -x1 * PLANET.radius, by: -y2 * PLANET.radius
        });
      }
    }

    // порядок по углу — как у статичных фигур, чтобы перетекание было связным
    var sx = 0, sy = 0;
    entries.forEach(function (e) { sx += e.bx; sy += e.by; });
    var cx = sx / COUNT, cy = sy / COUNT;
    entries.forEach(function (e) { e.key = Math.atan2(e.by - cy, e.bx - cx); });
    entries.sort(function (a, b) { return a.key - b.key; });

    var p3 = new Float32Array(COUNT * 3);
    var isRing = new Uint8Array(COUNT);
    var ringAng = new Float32Array(COUNT);
    for (i = 0; i < COUNT; i++) {
      if (entries[i].ring) {
        isRing[i] = 1;
        ringAng[i] = entries[i].ang;
      } else {
        p3[i * 3] = entries[i].x;
        p3[i * 3 + 1] = entries[i].y;
        p3[i * 3 + 2] = entries[i].z;
      }
    }

    var pts = new Float32Array(COUNT * 2);
    var vis = new Float32Array(COUNT);

    function update(k) {
      var spin = PLANET.spin + k * 0.75;  // шар доворачивается вместе со скроллом
      var sc = Math.cos(spin), ss = Math.sin(spin);
      var tc = Math.cos(PLANET.tilt), ts = Math.sin(PLANET.tilt);

      for (var i = 0; i < COUNT; i++) {
        if (isRing[i]) {
          pts[i * 2] = Math.cos(ringAng[i]) * PLANET.radius;
          pts[i * 2 + 1] = Math.sin(ringAng[i]) * PLANET.radius;
          vis[i] = 1;
          continue;
        }
        var x = p3[i * 3], y = p3[i * 3 + 1], z = p3[i * 3 + 2];
        var x1 = x * sc - z * ss;
        var z1 = x * ss + z * sc;
        var y2 = y * tc - z1 * ts;
        var z2 = y * ts + z1 * tc;

        pts[i * 2] = -x1 * PLANET.radius;
        pts[i * 2 + 1] = -y2 * PLANET.radius;

        // точки, ушедшие за край, гаснут
        var f = Math.max(0, Math.min(1, (z2 + 0.02) / 0.22));
        vis[i] = f * f * (3 - 2 * f);
      }
    }

    update(0);
    return { pts: pts, vis: vis, update: update };
  }

  /* --- сцены: каждая секция — одна фигура ---
         Цели считаются один раз и сортируются по углу вокруг центроида,
         поэтому частица держит своё угловое место во всех фигурах и
         переход читается как перетекание, а не как пересборка с нуля. --- */
  function buildTargets(fn, rotate) {
    var pts = [];
    var sumX = 0, sumY = 0;
    var i;
    var hasColors = false;
    for (i = 0; i < COUNT; i++) {
      var t = fn(particles[i], i);
      // третий элемент цели — необязательный индекс цвета
      pts.push({ x: t[0], y: t[1], col: t.length > 2 ? t[2] : -1 });
      if (t.length > 2) hasColors = true;
      sumX += t[0];
      sumY += t[1];
    }
    var cx = sumX / COUNT, cy = sumY / COUNT;

    // поворот вокруг центроида фигуры
    if (rotate) {
      var cos = Math.cos(rotate), sin = Math.sin(rotate);
      for (i = 0; i < COUNT; i++) {
        var rx = pts[i].x - cx, ry = pts[i].y - cy;
        pts[i].x = cx + rx * cos - ry * sin;
        pts[i].y = cy + rx * sin + ry * cos;
      }
    }

    for (i = 0; i < COUNT; i++) {
      var dx = pts[i].x - cx, dy = pts[i].y - cy;
      pts[i].ang = Math.atan2(dy, dx);
      pts[i].rad = Math.sqrt(dx * dx + dy * dy);
    }
    pts.sort(function (a, b) { return a.ang - b.ang || a.rad - b.rad; });

    var arr = new Float32Array(COUNT * 2);
    var cols = hasColors ? new Int16Array(COUNT) : null;
    for (i = 0; i < COUNT; i++) {
      arr[i * 2] = pts[i].x;
      arr[i * 2 + 1] = pts[i].y;
      if (cols) cols[i] = pts[i].col;
    }
    return { pts: arr, colors: cols };
  }

  var STAGES = Array.prototype.slice.call(document.querySelectorAll('[data-formation]'))
    .map(function (el) {
      var name = el.dataset.formation;
      var scale = parseFloat(el.dataset.scale) || 1;
      var stage = {
        el: el,
        slot: el.querySelector('.figure-slot'),
        boost: FORM_BOOST[name] || 1,
        calm: FORM_CALM[name] || 1,
        // на сцене с этим флагом калибр разбавлен крупными треугольниками
        mixed: el.dataset.size === 'mixed',
        scale: scale
      };
      stage.fall = el.dataset.enter === 'fall';
      stage.tornado = el.dataset.enter === 'tornado';
      if (name === 'planet') {
        var planet = buildPlanetStage();
        stage.pts = planet.pts;
        stage.vis = planet.vis;
        stage.update = planet.update;
      } else {
        var built = buildTargets(
          FORMATIONS[name] || FORMATIONS.scatter,
          (parseFloat(el.dataset.rotate) || 0) * Math.PI / 180
        );
        stage.pts = built.pts;
        stage.colorMap = built.colors;
      }
      return stage;
    });
  if (!STAGES.length) return;

  /* --- геометрия --- */
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

  // фигура живёт в своём слоте; экран без слота занимает весь вьюпорт
  function geometry(stage) {
    if (stage.slot) {
      var r = stage.slot.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var u = Math.min(r.width, r.height) * 0.5 / 0.7 * stage.scale;
      // страховка от выхода за экран по вертикали: фигура занимает ~0.6 радиуса
      u = Math.min(u, (height * 0.5 - 16) / 0.6);
      return { cx: cx, cy: cy, u: u, ys: 1 };
    }
    return { cx: width / 2, cy: height / 2, u: unit, ys: 0.92 };
  }

  // между какими двумя экранами мы сейчас и насколько глубоко
  function pair() {
    var centre = height / 2;
    var k = 0;
    for (var i = 0; i < STAGES.length; i++) {
      var r = STAGES[i].el.getBoundingClientRect();
      if (r.top + r.height / 2 - centre <= 0) k = i;
    }
    var a = STAGES[k];
    var b = STAGES[Math.min(k + 1, STAGES.length - 1)];
    var t = 0;
    if (b !== a) {
      var ra = a.el.getBoundingClientRect();
      var rb = b.el.getBoundingClientRect();
      var ca = ra.top + ra.height / 2 - centre;
      var cb = rb.top + rb.height / 2 - centre;
      if (cb !== ca) t = Math.max(0, Math.min(1, -ca / (cb - ca)));
    }
    return { a: a, b: b, t: t };
  }

  // насколько центр сцены ушёл от центра экрана, в долях высоты вьюпорта
  function stageShift(stage) {
    var r = stage.el.getBoundingClientRect();
    return (height / 2 - (r.top + r.height / 2)) / height;
  }

  // фигура держится, пока экран близко к центру, и перетекает в средней трети пути
  function ease(t) {
    var e = Math.max(0, Math.min(1, (t - 0.18) / 0.64));
    return e * e * (3 - 2 * e);
  }

  /* --- отрисовка --- */
  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    pointer.x += (pointerTarget.x - pointer.x) * 0.04;
    pointer.y += (pointerTarget.y - pointer.y) * 0.04;

    var t = time * 0.001;
    var span = pair();
    var e = ease(span.t);
    var ga = geometry(span.a);
    var gb = geometry(span.b);
    var boost = span.a.boost + (span.b.boost - span.a.boost) * e;
    var calm = span.a.calm + (span.b.calm - span.a.calm) * e;
    var mixA = span.a.mixed ? 1 : 0;
    var mixB = span.b.mixed ? 1 : 0;
    var mix = mixA + (mixB - mixA) * e;
    var pa = span.a.pts;
    var pb = span.b.pts;
    var va = span.a.vis;
    var vb = span.b.vis;
    var falling = span.b.fall && span.b !== span.a;
    var swirling = span.b.tornado && span.b !== span.a;
    var cmap = (e < 0.5 ? span.a.colorMap : span.b.colorMap);
    var i;

    // живые сцены (планета) доворачиваются вместе со скроллом
    if (span.a.update) span.a.update(stageShift(span.a));
    if (span.b.update && span.b !== span.a) span.b.update(stageShift(span.b));


    for (i = 0; i < buckets.length; i++) buckets[i].length = 0;

    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      var depth = 0.35 + p.z * 0.65;
      var driftX = Math.sin(t * p.speed + p.phase) * 0.0075 * calm;
      var driftY = Math.cos(t * p.speed * 0.85 + p.phase) * 0.0075 * calm;

      var ax = ga.cx + (pa[i * 2] + driftX) * ga.u;
      var ay = ga.cy + (pa[i * 2 + 1] + driftY) * ga.u * ga.ys;
      var bx = gb.cx + (pb[i * 2] + driftX) * gb.u;
      var by = gb.cy + (pb[i * 2 + 1] + driftY) * gb.u * gb.ys;

      // при входе в «волны» частицы осыпаются: у каждой своя задержка,
      // по вертикали движение с ускорением, как при падении
      var ex = e, ey = e, spread = 0, swirlX = 0, swirlY = 0, shrink = 1;
      if (swirling) {
        var sDelay = p.r[6] * 0.4;
        var sLocal = Math.max(0, Math.min(1, (e - sDelay) / (1 - sDelay)));
        ex = ey = sLocal;
        var wave = Math.sin(Math.PI * sLocal);          // 0 → 1 → 0
        var ang = p.r[4] * Math.PI * 2 + sLocal * 7;    // закрутка
        var rad = wave * (0.12 + p.r[5] * 0.55);
        swirlX = Math.cos(ang) * rad;
        swirlY = Math.sin(ang) * rad * 0.55 - wave * 0.16;
        shrink = 1 - wave * 0.6;                        // распыляется в мелкую пыль
      }
      if (falling) {
        var delay = p.r[6] * 0.45;
        var local = Math.max(0, Math.min(1, (e - delay) / (1 - delay)));
        ex = local;
        ey = local * local;                       // вниз с ускорением
        spread = Math.sin(Math.PI * local) * 0.13; // в середине пути распыляется
      }

      var px = ax + (bx - ax) * ex + pointer.x * depth * 26;
      var py = ay + (by - ay) * ey + pointer.y * depth * 26;
      if (spread > 0) {
        px += (p.r[4] - 0.5) * spread * ga.u;
        py += (p.r[5] - 0.5) * spread * ga.u * 0.7;
      }
      if (swirling) {
        px += swirlX * ga.u;
        py += swirlY * ga.u;
      }

      var size = p.size * (0.7 + depth * 0.45);
      // редкие крупные фигуры — только там, где сцена этого просит
      if (mix > 0) size *= 1 + mix * Math.pow(p.r[7], 4) * 6;
      size *= shrink;
      if (px < -size * 2 || px > width + size * 2 || py < -size * 2 || py > height + size * 2) continue;

      // самые крупные держим чуть бледнее — они читаются как ближние
      var big = Math.min(1, (p.size - 1.2) / 3.4);
      var twinkle = 0.66 + 0.34 * Math.sin(t * 1.15 + p.phase * 2);
      var alpha = (1 - big * 0.62) * (0.55 + depth * 0.45) * twinkle;

      // у живых сцен своя видимость — точки, ушедшие за край шара, гаснут
      if (va || vb) {
        var v1 = va ? va[i] : 1;
        var v2 = vb ? vb[i] : 1;
        alpha *= v1 + (v2 - v1) * e;
      }
      alpha = Math.min(1, alpha * boost);

      var aStep = Math.min(ALPHA_STEPS - 1, Math.max(0, Math.round(alpha * ALPHA_STEPS) - 1));
      var lwStep = size > 3.9 ? 2 : (size > 2.6 ? 1 : 0);
      var colorIdx = p.color;
      if (cmap && cmap[i] >= 0) colorIdx = cmap[i];

      var bucket = (colorIdx * ALPHA_STEPS + aStep) * LINE_WIDTHS.length + lwStep;

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

  if (reduceMotion) {
    // без анимации перерисовываем только при прокрутке
    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; draw(0); });
    }, { passive: true });
    return;
  }

  window.addEventListener('mousemove', function (e) {
    pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  start();
})();
