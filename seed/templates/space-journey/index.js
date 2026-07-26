/* =========================================================================
   Космическое путешествие — обучающая игра (жи-ши, чу-щу, ча-ща)
   Всё рисуется вручную в 2D-контексте: фон, маршрут, планеты, ракета,
   карточка, кнопки, частицы и финальный экран.

   Контракт: см. ../../CONTRACT.md
   ========================================================================= */

// ===== МОДУЛЬНЫЕ КОНСТАНТЫ И ЧИСТЫЕ ХЕЛПЕРЫ (без состояния) =====
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);

const easeOutCubic  = p => 1 - Math.pow(1 - p, 3);
const easeInOutQuad = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const easeOutBack   = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

const C = {
  space:  '#060b1a',
  text:   '#e8f4ff',
  dim:    'rgba(232,244,255,0.60)',
  cyan:   '#40e0ff',
  cyan2:  '#00b8d4',
  gold:   '#ffd54f',
  pink:   '#ff6ec7',
  green:  '#69ff47',
  red:    '#ff5252',
  cardBg: 'rgba(13,27,62,0.88)'
};

const QUESTIONS = [
  { rule: 'zhishi', blank: 'ж_знь',    answer: 'И', wrong: 'Ы', hint: 'ЖИ пишем с И!' },
  { rule: 'zhishi', blank: 'ш_на',     answer: 'И', wrong: 'Ы', hint: 'ШИ пишем с И!' },
  { rule: 'chuchu', blank: 'ч_до',     answer: 'У', wrong: 'Ю', hint: 'ЧУ пишем с У!' },
  { rule: 'chacha', blank: 'ч_йник',   answer: 'А', wrong: 'Я', hint: 'ЧА пишем с А!' },
  { rule: 'zhishi', blank: 'ж_раф',    answer: 'И', wrong: 'Ы', hint: 'ЖИ пишем с И!' },
  { rule: 'chuchu', blank: 'щ_пальце', answer: 'У', wrong: 'Ю', hint: 'ЩУ пишем с У!' },
  { rule: 'zhishi', blank: 'маш_на',   answer: 'И', wrong: 'Ы', hint: 'ШИ пишем с И!' },
  { rule: 'chuchu', blank: 'ч_лок',    answer: 'У', wrong: 'Ю', hint: 'ЧУ пишем с У!' },
  { rule: 'chacha', blank: 'ч_сы',     answer: 'А', wrong: 'Я', hint: 'ЧА пишем с А!' }
];
const TOTAL = QUESTIONS.length;

const RULES = {
  zhishi: { label: 'ЖИ-ШИ', color: C.gold },
  chuchu: { label: 'ЧУ-ЩУ', color: C.pink },
  chacha: { label: 'ЧА-ЩА', color: C.green }
};

const CHIPS = [
  { label: 'жи-ши → И', color: C.gold },
  { label: 'чу-щу → У', color: C.pink },
  { label: 'ча-ща → А', color: C.green }
];

// Остановки маршрута: p — доля пути от старта, off — боковое смещение (-1..1)
const STOPS = [
  { p: 0.00, off:  0.00, name: 'Земля',      type: 'earth',    color: '#40e0ff' },
  { p: 0.20, off: -0.47, name: 'Астероид',   type: 'asteroid', color: '#ffd54f' },
  { p: 0.39, off:  0.40, name: 'Сатурн',     type: 'saturn',   color: '#ff8f00' },
  { p: 0.59, off: -0.53, name: 'Марс',       type: 'mars',     color: '#ff5252' },
  { p: 0.78, off:  0.47, name: 'Туманность', type: 'nebula',   color: '#ff6ec7' },
  { p: 1.00, off:  0.00, name: 'Звезда',     type: 'star',     color: '#ffd54f' }
];

const ASTEROID_SHAPE = [0.98, 0.80, 1.00, 0.84, 0.93, 0.74, 1.00, 0.86, 0.90];

const MET = {
  titleLine: 30, titleGap: 8, sub: 16, subGap: 18,
  chip: 28, chipGap: 18, prog: 26, progGap: 22,
  cardPadX: 26, cardPadY: 22, badge: 26, badgeGap: 16,
  qLabel: 16, qGap: 12, word: 54, wordGap: 18,
  opt: 58, optGap: 16, fb: 46, fbGap: 14, next: 44
};
const SAMPLES = 24;

function headerHeight(s) {
  return (MET.titleLine * 2 + MET.titleGap + MET.sub + MET.subGap +
          MET.chip + MET.chipGap + MET.prog + MET.progGap) * s;
}
function cardHeight(s) {
  return (MET.cardPadY * 2 + MET.badge + MET.badgeGap + MET.qLabel + MET.qGap +
          MET.word + MET.wordGap + MET.opt + MET.optGap + MET.fb + MET.fbGap + MET.next) * s;
}
function panelHeight(s) { return headerHeight(s) + cardHeight(s); }

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}


// =========================================================================
export function create(canvas, hub) {
// =========================================================================

const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, T = 0, last = 0;

// ===== РАЗМЕР =====
// Хаб владеет CSS-размером канваса, игра — буфером отрисовки.
function resize() {
  const maxDpr = hub && hub.maxDpr ? hub.maxDpr : 2;
  DPR = Math.min(window.devicePixelRatio || 1, maxDpr);
  W = Math.max(1, canvas.clientWidth  || canvas.width  || 1);
  H = Math.max(1, canvas.clientHeight || canvas.height || 1);
  canvas.width  = Math.max(1, Math.round(W * DPR));
  canvas.height = Math.max(1, Math.round(H * DPR));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildLayout();
  buildNebula();
  seedStars();
}

// ===== ХЕЛПЕРЫ РИСОВАНИЯ (нужен ctx) =====
function roundRect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function starPath(R, points, innerRatio) {
  ctx.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const r = (k % 2 === 0) ? R : R * innerRatio;
    const a = -Math.PI / 2 + k * Math.PI / points;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
function applyFont(o) {
  ctx.font = (o.weight || 600) + ' ' + (o.size || 16) + 'px ' + (o.font || FONT);
  if (o.spacing !== undefined && 'letterSpacing' in ctx) ctx.letterSpacing = o.spacing + 'px';
}
function text(str, x, y, o) {
  o = o || {};
  ctx.save();
  applyFont(o);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.glow) { ctx.shadowColor = o.glowColor || o.color || '#fff'; ctx.shadowBlur = o.glow; }
  ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
  ctx.fillStyle = o.color || '#e8f4ff';
  ctx.fillText(str, x, y);
  ctx.restore();
}
function measure(str, o) {
  ctx.save();
  applyFont(o || {});
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
function wrapText(str, maxW, o) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (line && measure(test, o) > maxW) { lines.push(line); line = words[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ===== АНИМАЦИИ И ТАЙМЕРЫ =====
const tweens = [];
function tweenTo(obj, prop, to, dur, ease, onDone) {
  for (let i = tweens.length - 1; i >= 0; i--)
    if (tweens[i].obj === obj && tweens[i].prop === prop) tweens.splice(i, 1);
  tweens.push({ obj, prop, from: obj[prop], to, dur, t: 0, ease: ease || easeOutCubic, onDone });
}
function clearTweens(obj) {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1);
}
function isTweening(obj, prop) {
  for (let i = 0; i < tweens.length; i++) if (tweens[i].obj === obj && tweens[i].prop === prop) return true;
  return false;
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const p = clamp(tw.t / tw.dur, 0, 1);
    tw.obj[tw.prop] = lerp(tw.from, tw.to, tw.ease(p));
    if (p >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
  }
}

const timers = [];
function delay(sec, fn) { timers.push({ t: sec, fn }); }
function updateTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  }
}

// ===== ФОН: ТУМАННОСТЬ =====
let nebulaCanvas = null;
function buildNebula() {
  const c = document.createElement('canvas');
  c.width  = Math.max(2, Math.round(W * 0.5));
  c.height = Math.max(2, Math.round(H * 0.5));
  const g = c.getContext('2d');
  const blobs = [
    { x: 0.20, y: 0.30, rx: 0.62, ry: 0.42, col: '80,0,180',  a: 0.22 },
    { x: 0.82, y: 0.70, rx: 0.55, ry: 0.62, col: '0,80,180',  a: 0.18 },
    { x: 0.60, y: 0.16, rx: 0.46, ry: 0.50, col: '180,0,80',  a: 0.13 },
    { x: 0.08, y: 0.88, rx: 0.52, ry: 0.46, col: '0,160,190', a: 0.11 }
  ];
  const R = Math.max(c.width, c.height);
  for (const b of blobs) {
    g.save();
    g.translate(b.x * c.width, b.y * c.height);
    g.scale(b.rx, b.ry);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
    grd.addColorStop(0, 'rgba(' + b.col + ',' + b.a + ')');
    grd.addColorStop(1, 'rgba(' + b.col + ',0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.restore();
  }
  nebulaCanvas = c;
}

// ===== ФОН: ЗВЁЗДЫ =====
let stars = [];
function seedStars() {
  const n = Math.round(clamp(W * H / 5200, 90, 340));
  stars = [];
  for (let i = 0; i < n; i++) {
    const depth = Math.random();
    const roll = Math.random();
    stars.push({
      x: Math.random() * W, y: Math.random() * H,
      r: lerp(0.35, 1.9, depth * depth),
      drift: lerp(3, 18, depth),
      tw: Math.random() * TAU,
      twSpeed: rand(0.6, 2.2),
      hue: roll < 0.08 ? '160,220,255' : (roll < 0.15 ? '255,225,180' : '255,255,255')
    });
  }
}
function updateStars(dt) {
  for (const s of stars) {
    s.tw += s.twSpeed * dt;
    s.y += s.drift * dt * 0.4;
    if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
  }
}
function drawStars() {
  for (const s of stars) {
    const a = 0.32 + 0.68 * Math.abs(Math.sin(s.tw));
    ctx.fillStyle = 'rgba(' + s.hue + ',' + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
}

// ===== ФОН: ПАДАЮЩИЕ ЗВЁЗДЫ =====
let shooting = [];
let shootTimer = 3;
function updateShooting(dt) {
  shootTimer -= dt;
  if (shootTimer <= 0) {
    shootTimer = rand(4.5, 12);
    const fromLeft = Math.random() < 0.5;
    shooting.push({
      x: fromLeft ? rand(-0.1, 0.45) * W : rand(0.55, 1.1) * W,
      y: rand(-0.05, 0.5) * H,
      vx: (fromLeft ? 1 : -1) * rand(340, 560),
      vy: rand(170, 320),
      life: 0, max: rand(0.7, 1.15)
    });
  }
  for (let i = shooting.length - 1; i >= 0; i--) {
    const s = shooting[i];
    s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.life > s.max) shooting.splice(i, 1);
  }
}
function drawShooting() {
  for (const s of shooting) {
    const a = Math.sin((s.life / s.max) * Math.PI) * 0.9;
    const m = Math.hypot(s.vx, s.vy) || 1;
    const len = 95;
    const ex = s.x - s.vx / m * len, ey = s.y - s.vy / m * len;
    const g = ctx.createLinearGradient(s.x, s.y, ex, ey);
    g.addColorStop(0, 'rgba(205,240,255,' + a + ')');
    g.addColorStop(1, 'rgba(205,240,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
}

// ===== ЧАСТИЦЫ =====
const particles = [];
function spawnParticle(o) {
  particles.push({
    x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0,
    grav: o.grav || 0, drag: o.drag || 0,
    life: 0, max: o.max || 1,
    size: o.size || 3, color: o.color || '255,255,255',
    shape: o.shape || 'dot', rot: o.rot || 0, spin: o.spin || 0,
    front: !!o.front
  });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.grav * dt;
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
    p.rot += p.spin * dt;
    if (p.life >= p.max) particles.splice(i, 1);
  }
}
function drawParticles(front) {
  for (const p of particles) {
    if (p.front !== front) continue;
    const k = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = 'rgba(' + p.color + ',1)';
    if (p.shape === 'star') { starPath(p.size * (0.35 + 0.65 * k), 4, 0.42); ctx.fill(); }
    else if (p.shape === 'rect') { ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64); }
    else { ctx.beginPath(); ctx.arc(0, 0, Math.max(0.4, p.size * k), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, TAU), sp = rand(70, 260);
    spawnParticle({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      grav: 130, drag: 1.1, max: rand(0.6, 1.15),
      size: rand(3, 7) * L.S, color,
      shape: Math.random() < 0.62 ? 'star' : 'dot',
      spin: rand(-7, 7), rot: rand(0, TAU), front: true
    });
  }
}
function confetti() {
  const cols = ['255,213,79', '255,110,199', '105,255,71', '64,224,255', '255,255,255'];
  for (let i = 0; i < 80; i++) {
    spawnParticle({
      x: rand(0, W), y: rand(-H * 0.35, -8),
      vx: rand(-45, 45), vy: rand(70, 210),
      grav: 45, max: rand(2.4, 4.0),
      size: rand(4, 9) * L.S,
      color: cols[(Math.random() * cols.length) | 0],
      shape: Math.random() < 0.5 ? 'rect' : 'star',
      spin: rand(-6, 6), rot: rand(0, TAU), front: true
    });
  }
}

// ===== РАСКЛАДКА =====
const L = { S: 1, s: 1, portrait: false, route: { x: 0, y: 0, w: 1, h: 1 }, panel: { x: 0, y: 0, w: 1, h: 1 }, planetR: 16, contentW: 1, contentX: 0, contentY: 0 };

function buildLayout() {
  const portrait = (W < 880) || (H > W * 1.02);
  L.portrait = portrait;
  L.S = clamp(portrait ? Math.min(W / 540, H / 920) : Math.min(W / 1240, H / 820), 0.45, 1.7);

  if (portrait) {
    const rh = clamp(H * 0.30, 120, 320);
    L.route = { x: 0, y: 0, w: W, h: rh };
    L.panel = { x: 0, y: rh, w: W, h: H - rh };
  } else {
    const rw = clamp(W * 0.36, 230, 580);
    L.route = { x: 0, y: 0, w: rw, h: H };
    L.panel = { x: rw, y: 0, w: W - rw, h: H };
  }
  L.planetR = clamp(Math.min(L.route.w, L.route.h) * 0.085, 10, 26);

  // Подгоняем масштаб панели, чтобы вся вёрстка поместилась по высоте
  let s = L.S;
  for (let i = 0; i < 8; i++) {
    const need = panelHeight(s);
    const avail = L.panel.h - 20 * s;
    if (need > avail && need > 0) s *= Math.max(0.7, avail / need);
    else break;
  }
  L.s = clamp(s, 0.38, 1.7);
  const padX = Math.min(46 * L.s, L.panel.w * 0.07);
  L.contentW = Math.max(120, Math.min(L.panel.w - padX * 2, 560 * L.s));
  L.contentX = L.panel.x + (L.panel.w - L.contentW) / 2;
  L.contentY = L.panel.y + Math.max(10 * L.s, (L.panel.h - panelHeight(L.s)) / 2);

  buildPath();
}

// ===== МАРШРУТ =====
let pathPts = [], pathLen = [], stopU = [];

function stopPos(i) {
  const st = STOPS[i], r = L.route;
  if (L.portrait) {
    const pad = Math.min(56, r.w * 0.10);
    return {
      x: r.x + pad + st.p * (r.w - pad * 2),
      y: r.y + r.h * 0.48 - st.off * (r.h * 0.24)
    };
  }
  // Отступ сверху/снизу должен вмещать подпись под планетой
  const padY = clamp(L.planetR * 2.4, r.h * 0.10, r.h * 0.22);
  return {
    x: r.x + r.w * 0.5 + st.off * (r.w * 0.32),
    y: r.y + r.h - padY - st.p * (r.h - padY * 2)
  };
}

function buildPath() {
  const pts = STOPS.map((_, i) => stopPos(i));
  pathPts = [];
  const knots = [];
  for (let i = 0; i < pts.length - 1; i++) {
    knots.push(pathPts.length);
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < SAMPLES; k++) pathPts.push(catmull(p0, p1, p2, p3, k / SAMPLES));
  }
  knots.push(pathPts.length);
  pathPts.push(pts[pts.length - 1]);

  pathLen = [0];
  for (let i = 1; i < pathPts.length; i++)
    pathLen.push(pathLen[i - 1] + Math.hypot(pathPts[i].x - pathPts[i - 1].x, pathPts[i].y - pathPts[i - 1].y));
  const total = pathLen[pathLen.length - 1] || 1;
  stopU = knots.map(idx => pathLen[idx] / total);
}

function pointAt(u) {
  const total = pathLen[pathLen.length - 1] || 1;
  const target = clamp(u, 0, 1) * total;
  let lo = 0, hi = pathLen.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pathLen[mid] <= target) lo = mid; else hi = mid;
  }
  const seg = (pathLen[hi] - pathLen[lo]) || 1;
  const t = (target - pathLen[lo]) / seg;
  const a = pathPts[lo], b = pathPts[hi];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

function currentStopIndex() {
  let idx = 0;
  for (let i = 0; i < stopU.length; i++) if (rocket.u >= stopU[i] - 0.004) idx = i;
  return idx;
}

function drawRoutePath() {
  ctx.save();
  ctx.setLineDash([6 * L.S, 6 * L.S]);
  ctx.lineWidth = 2 * L.S;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(64,224,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(pathPts[0].x, pathPts[0].y);
  for (let i = 1; i < pathPts.length; i++) ctx.lineTo(pathPts[i].x, pathPts[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawTravelled(u) {
  if (u <= 0.0005) return;
  const total = pathLen[pathLen.length - 1] || 1;
  const target = u * total;
  ctx.save();
  ctx.lineWidth = 3 * L.S;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(64,224,255,0.55)';
  ctx.shadowColor = 'rgba(64,224,255,0.75)';
  ctx.shadowBlur = 10 * L.S;
  ctx.beginPath();
  ctx.moveTo(pathPts[0].x, pathPts[0].y);
  for (let i = 1; i < pathPts.length; i++) {
    if (pathLen[i] <= target) ctx.lineTo(pathPts[i].x, pathPts[i].y);
    else { const p = pointAt(u); ctx.lineTo(p.x, p.y); break; }
  }
  ctx.stroke();
  ctx.restore();
}

// ===== ПЛАНЕТЫ =====
function drawPlanetBody(type, R, t, color) {
  switch (type) {
    case 'earth': {
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#8fe8ff'); g.addColorStop(0.5, '#2a86d8'); g.addColorStop(1, '#0b3a72');
      ctx.fillStyle = g; circle(0, 0, R); ctx.fill();
      ctx.save(); circle(0, 0, R); ctx.clip();
      ctx.fillStyle = 'rgba(74,214,130,0.9)';
      ctx.beginPath(); ctx.ellipse(-R * 0.28, -R * 0.18, R * 0.44, R * 0.26, 0.45, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(R * 0.30, R * 0.30, R * 0.36, R * 0.20, -0.35, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(R * 0.15, -R * 0.55, R * 0.22, R * 0.12, 0.2, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'asteroid': {
      const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#b9bcc9'); g.addColorStop(1, '#5c5f6d');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let k = 0; k < ASTEROID_SHAPE.length; k++) {
        const a = k / ASTEROID_SHAPE.length * TAU;
        const rr = R * ASTEROID_SHAPE[k];
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(40,42,52,0.5)';
      circle(-R * 0.22, R * 0.12, R * 0.20); ctx.fill();
      circle(R * 0.30, -R * 0.22, R * 0.13); ctx.fill();
      break;
    }
    case 'saturn': {
      ctx.save();
      ctx.rotate(-0.36);
      ctx.strokeStyle = 'rgba(255,214,150,0.8)';
      ctx.lineWidth = R * 0.20;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.75, R * 0.52, 0, Math.PI, TAU); ctx.stroke();
      ctx.restore();
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#ffdca0'); g.addColorStop(0.55, '#e2a34c'); g.addColorStop(1, '#8d5a1d');
      ctx.fillStyle = g; circle(0, 0, R); ctx.fill();
      ctx.save(); circle(0, 0, R); ctx.clip();
      ctx.fillStyle = 'rgba(140,84,26,0.35)';
      ctx.fillRect(-R, -R * 0.22, R * 2, R * 0.16);
      ctx.fillRect(-R,  R * 0.24, R * 2, R * 0.12);
      ctx.restore();
      ctx.save();
      ctx.rotate(-0.36);
      ctx.strokeStyle = 'rgba(255,224,170,0.95)';
      ctx.lineWidth = R * 0.20;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.75, R * 0.52, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'mars': {
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#ff9b6e'); g.addColorStop(0.55, '#d3502c'); g.addColorStop(1, '#7a2412');
      ctx.fillStyle = g; circle(0, 0, R); ctx.fill();
      ctx.save(); circle(0, 0, R); ctx.clip();
      ctx.fillStyle = 'rgba(110,32,16,0.45)';
      ctx.beginPath(); ctx.ellipse(R * 0.22, R * 0.10, R * 0.34, R * 0.22, 0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-R * 0.30, R * 0.34, R * 0.24, R * 0.14, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(0, -R * 0.86, R * 0.42, R * 0.20, 0, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'nebula': {
      const cols = [['255,110,199', 0.55], ['140,90,255', 0.45], ['80,190,255', 0.38]];
      for (let k = 0; k < cols.length; k++) {
        const a = t * 0.35 + k * 2.1;
        const ox = Math.cos(a) * R * 0.28, oy = Math.sin(a * 1.3) * R * 0.24;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 1.05);
        g.addColorStop(0, 'rgba(' + cols[k][0] + ',' + cols[k][1] + ')');
        g.addColorStop(1, 'rgba(' + cols[k][0] + ',0)');
        ctx.fillStyle = g;
        circle(ox, oy, R * 1.05); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let k = 0; k < 5; k++) {
        const a = k * 1.7 + t * 0.6;
        circle(Math.cos(a) * R * 0.5, Math.sin(a * 1.4) * R * 0.45, R * 0.07); ctx.fill();
      }
      break;
    }
    case 'star': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.5);
      g.addColorStop(0, 'rgba(255,255,220,0.95)');
      g.addColorStop(0.45, 'rgba(255,213,79,0.55)');
      g.addColorStop(1, 'rgba(255,143,0,0)');
      ctx.fillStyle = g; circle(0, 0, R * 1.5); ctx.fill();
      ctx.save();
      ctx.rotate(Math.sin(t * 0.6) * 0.14);
      ctx.fillStyle = '#fff3b0';
      ctx.shadowColor = 'rgba(255,213,79,0.9)'; ctx.shadowBlur = R * 0.8;
      starPath(R * 1.25, 5, 0.45); ctx.fill();
      ctx.restore();
      break;
    }
    default: {
      ctx.fillStyle = color; circle(0, 0, R); ctx.fill();
    }
  }
}

function drawPlanet(i, t) {
  const st = STOPS[i];
  const pos = stopPos(i);
  const cur = currentStopIndex();
  const reached = i <= cur;
  const isCurrent = i === cur;
  const R = L.planetR;

  let scale = 1, glowA = reached ? 0.45 : 0.14;
  if (isCurrent) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    scale = 1 + 0.10 * pulse;
    glowA = 0.45 + 0.4 * pulse;
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.globalAlpha = reached ? 1 : 0.42;

  const g = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R * 2.5);
  g.addColorStop(0, hexA(st.color, glowA * 0.6));
  g.addColorStop(1, hexA(st.color, 0));
  ctx.fillStyle = g;
  circle(0, 0, R * 2.5); ctx.fill();

  if (isCurrent) {
    ctx.strokeStyle = hexA(st.color, 0.5);
    ctx.lineWidth = 1.5;
    circle(0, 0, R * (1.55 + 0.12 * Math.sin(t * 2.4))); ctx.stroke();
  }

  ctx.save();
  ctx.scale(scale, scale);
  drawPlanetBody(st.type, R, t, st.color);
  ctx.restore();
  ctx.restore();

  const fs = clamp(R * 0.52, 8, 13);
  text(st.name, pos.x, pos.y + R * 1.65 + fs, {
    size: fs, weight: 700, align: 'center', baseline: 'middle',
    color: reached ? st.color : 'rgba(232,244,255,0.35)',
    alpha: reached ? 0.95 : 0.6
  });
}

// ===== РАКЕТА =====
const rocket = { u: 0, thrust: 0.3 };
let thrustAcc = 0;

function drawRocketShape(s, thrust, t) {
  if (thrust > 0.02) {
    const fl = s * (1.05 + 0.42 * Math.sin(t * 28)) * thrust;
    const g = ctx.createLinearGradient(0, s * 0.5, 0, s * 0.5 + fl);
    g.addColorStop(0, 'rgba(255,255,225,0.95)');
    g.addColorStop(0.38, 'rgba(255,185,60,0.85)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, s * 0.5);
    ctx.quadraticCurveTo(0, s * 0.5 + fl * 1.3, s * 0.32, s * 0.5);
    ctx.closePath(); ctx.fill();
  }
  // Крылья
  ctx.fillStyle = '#e0453f';
  ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.05); ctx.lineTo(-s * 1.00, s * 0.72); ctx.lineTo(-s * 0.48, s * 0.58); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo( s * 0.48, s * 0.05); ctx.lineTo( s * 1.00, s * 0.72); ctx.lineTo( s * 0.48, s * 0.58); ctx.closePath(); ctx.fill();
  // Корпус
  const bg = ctx.createLinearGradient(-s * 0.6, 0, s * 0.6, 0);
  bg.addColorStop(0, '#8ba2b9'); bg.addColorStop(0.35, '#ffffff'); bg.addColorStop(1, '#a9bed5');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.5);
  ctx.quadraticCurveTo( s * 0.64, -s * 0.5,  s * 0.5, s * 0.58);
  ctx.lineTo(-s * 0.5, s * 0.58);
  ctx.quadraticCurveTo(-s * 0.64, -s * 0.5, 0, -s * 1.5);
  ctx.closePath(); ctx.fill();
  // Нос
  ctx.fillStyle = '#ff5252';
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.5);
  ctx.quadraticCurveTo( s * 0.5, -s * 0.85,  s * 0.30, -s * 0.52);
  ctx.lineTo(-s * 0.30, -s * 0.52);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.85, 0, -s * 1.5);
  ctx.closePath(); ctx.fill();
  // Иллюминатор
  ctx.fillStyle = '#0d1b3e'; circle(0, -s * 0.10, s * 0.28); ctx.fill();
  ctx.fillStyle = '#40e0ff'; circle(0, -s * 0.10, s * 0.20); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(-s * 0.07, -s * 0.17, s * 0.07); ctx.fill();
}

function updateRocket(dt) {
  const moving = isTweening(rocket, 'u');
  rocket.thrust = lerp(rocket.thrust, moving ? 1 : 0.3, Math.min(1, dt * 8));
  if (!moving) return;
  thrustAcc += dt;
  while (thrustAcc > 0.02) {
    thrustAcc -= 0.02;
    const p = pointAt(rocket.u);
    const back = p.angle + Math.PI;
    const s = L.planetR * 1.15;
    spawnParticle({
      x: p.x + Math.cos(back) * s * 0.6 + rand(-2, 2),
      y: p.y + Math.sin(back) * s * 0.6 + rand(-2, 2),
      vx: Math.cos(back) * rand(20, 65), vy: Math.sin(back) * rand(20, 65),
      max: rand(0.35, 0.7), size: rand(2, 4.5) * L.S,
      color: Math.random() < 0.5 ? '255,190,80' : '255,120,40',
      shape: 'dot', front: false
    });
  }
}

function drawRocket(t) {
  const p = pointAt(rocket.u);
  const s = L.planetR * 1.15;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle + Math.PI / 2 + Math.sin(t * 2.2) * 0.10);
  ctx.shadowColor = 'rgba(64,224,255,0.55)';
  ctx.shadowBlur = 14 * L.S;
  drawRocketShape(s, rocket.thrust, t);
  ctx.restore();
}

function drawRouteScene(t) {
  drawRoutePath();
  drawTravelled(rocket.u);
  for (let i = 0; i < STOPS.length; i++) drawPlanet(i, t);
  drawParticles(false);
  drawRocket(t);

  const fs = clamp(11 * L.S, 8, 13);
  if (L.portrait) {
    text('маршрут полёта', L.route.x + 14 * L.S, L.route.y + 18 * L.S,
      { size: fs, weight: 700, color: 'rgba(64,224,255,0.55)', spacing: 2, baseline: 'middle' });
  } else {
    text('маршрут полёта', L.route.x + L.route.w / 2, L.route.y + 26 * L.S,
      { size: fs, weight: 700, color: 'rgba(64,224,255,0.55)', spacing: 2, align: 'center', baseline: 'middle' });
  }
}

// ===== ИНТЕРАКТИВНЫЕ ЗОНЫ =====
const pointer = { x: -9999, y: -9999, down: false };
let pressedId = null;
let hotspots = [];

function addHotspot(id, x, y, w, h, onClick, disabled) {
  hotspots.push({ id, x, y, w, h, onClick, disabled: !!disabled });
}
function hitHotspot(x, y) {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const s = hotspots[i];
    if (!s.disabled && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
  }
  return null;
}
function pointIn(x, y, w, h) {
  return pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
}
function drawPill(x, y, w, h, label, color, fontSize, spacing) {
  ctx.fillStyle = hexA(color, 0.10);
  roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = hexA(color, 0.55); ctx.lineWidth = 1.4;
  roundRect(x, y, w, h, h / 2); ctx.stroke();
  text(label, x + w / 2, y + h / 2, {
    size: fontSize, weight: 800, color, align: 'center', baseline: 'middle', spacing
  });
}

// ===== СОСТОЯНИЕ ИГРЫ =====
const game = {
  order: [], idx: 0, question: null, options: [],
  selected: -1, answered: false, lastCorrect: false,
  correctCount: 0, answeredCount: 0, finished: false,
  progress: 0, fbAlpha: 0,
  optAnim: [{ pop: 0, shake: 0, shakeT: 0 }, { pop: 0, shake: 0, shakeT: 0 }]
};
const card = { alpha: 1, shift: 0, busy: false };
const win = { alpha: 0, shown: false, rocketY: 0, starPop: [0, 0, 0] };
const lastOptionRect = [null, null];

function startGame() {
  clearTweens(rocket); clearTweens(game); clearTweens(card);
  timers.length = 0;
  particles.length = 0;
  game.order = shuffle(QUESTIONS.slice());
  game.idx = 0;
  game.correctCount = 0;
  game.answeredCount = 0;
  game.finished = false;
  game.progress = 0;
  rocket.u = 0;
  card.alpha = 1; card.shift = 0;
  loadQuestion();
}

function loadQuestion() {
  const q = game.order[game.idx];
  game.question = q;
  game.options = shuffle([q.answer, q.wrong]);
  game.selected = -1;
  game.answered = false;
  game.lastCorrect = false;
  game.fbAlpha = 0;
  for (let i = 0; i < 2; i++) {
    clearTweens(game.optAnim[i]);
    game.optAnim[i].pop = 0; game.optAnim[i].shake = 0; game.optAnim[i].shakeT = 0;
  }
}

function optionState(i) {
  if (!game.answered) return 'idle';
  if (game.options[i] === game.question.answer) return 'correct';
  if (i === game.selected) return 'wrong';
  return 'idle';
}

function chooseOption(i) {
  if (game.answered || card.busy || win.shown) return;
  game.answered = true;
  game.selected = i;
  const ok = game.options[i] === game.question.answer;
  game.lastCorrect = ok;
  if (ok) game.correctCount++;
  game.answeredCount++;

  game.fbAlpha = 0;
  tweenTo(game, 'fbAlpha', 1, 0.3);

  const a = game.optAnim[i];
  if (ok) {
    a.pop = 1; tweenTo(a, 'pop', 0, 0.45);
  } else {
    a.shake = 1; a.shakeT = 0; tweenTo(a, 'shake', 0, 0.5);
    const ci = game.options.indexOf(game.question.answer);
    if (ci >= 0) { game.optAnim[ci].pop = 1; tweenTo(game.optAnim[ci], 'pop', 0, 0.5); }
  }

  tweenTo(game, 'progress', game.answeredCount / TOTAL, 0.6);
  tweenTo(rocket, 'u', game.answeredCount / TOTAL, 1.0, easeInOutQuad);

  if (ok && lastOptionRect[i]) {
    const r = lastOptionRect[i];
    burst(r.x + r.w / 2, r.y + r.h / 2, '255,213,79', 14);
  }

  emit('answer', { correct: ok, index: game.answeredCount, total: TOTAL });

  if (game.answeredCount >= TOTAL) {
    game.finished = true;
    delay(1.1, showWin);
  }
}

function nextQuestion() {
  if (!game.answered || game.finished || card.busy || win.shown) return;
  card.busy = true;
  tweenTo(card, 'alpha', 0, 0.22);
  tweenTo(card, 'shift', -44 * L.s, 0.22, easeOutCubic, () => {
    game.idx++;
    loadQuestion();
    card.shift = 48 * L.s;
    tweenTo(card, 'alpha', 1, 0.30);
    tweenTo(card, 'shift', 0, 0.42, easeOutBack, () => { card.busy = false; });
  });
}

function ratingStars() {
  if (game.correctCount >= TOTAL) return 3;
  if (game.correctCount >= TOTAL - 3) return 2;
  return 1;
}

function emit(type, detail) {
  if (hub && typeof hub.emit === 'function') hub.emit(type, detail);
}

function showWin() {
  win.shown = true;
  win.alpha = 0;
  win.rocketY = 0;
  win.starPop = [0, 0, 0];
  tweenTo(win, 'alpha', 1, 0.5);
  tweenTo(win, 'rocketY', -34, 1.2);
  const n = ratingStars();
  for (let i = 0; i < n; i++) {
    delay(0.5 + i * 0.24, () => { tweenTo(win.starPop, i, 1, 0.5, easeOutBack); });
  }
  delay(0.55, confetti);
  emit('gameover', { score: game.correctCount, total: TOTAL, stars: n });
}

function restart() {
  if (card.busy) return;
  card.busy = true;
  startGame();
  win.alpha = 1; win.shown = true;
  tweenTo(win, 'alpha', 0, 0.45, easeOutCubic, () => {
    win.shown = false; card.busy = false;
  });
}

// ===== ПАНЕЛЬ: ШАПКА =====
function drawChips(x, y, w, h, s) {
  let fs = 12 * s, padx = 13 * s;
  const gap = 8 * s;
  let widths = [], total = 0;
  for (let i = 0; i < CHIPS.length; i++) {
    widths[i] = measure(CHIPS[i].label, { size: fs, weight: 800, spacing: 0.8 * s }) + padx * 2;
    total += widths[i];
  }
  total += gap * (CHIPS.length - 1);
  if (total > w) {
    const k = w / total;
    fs *= k; padx *= k; total = 0;
    for (let i = 0; i < CHIPS.length; i++) {
      widths[i] = measure(CHIPS[i].label, { size: fs, weight: 800, spacing: 0.8 * s }) + padx * 2;
      total += widths[i];
    }
    total += gap * (CHIPS.length - 1);
  }
  let cx = x + (w - total) / 2;
  for (let i = 0; i < CHIPS.length; i++) {
    drawPill(cx, y, widths[i], h, CHIPS[i].label, CHIPS[i].color, fs, 0.8 * s);
    cx += widths[i] + gap;
  }
}

function drawProgress(x, y, w, h, s) {
  const label = game.answeredCount + ' / ' + TOTAL;
  const fs = 12.5 * s;
  const lw = measure(label, { size: fs, weight: 800, spacing: 1 * s }) + 4 * s;
  text(label, x, y + h / 2, { size: fs, weight: 800, spacing: 1 * s, color: C.cyan, baseline: 'middle' });

  const bx = x + lw + 10 * s;
  const bw = Math.max(20, w - lw - 10 * s);
  const bh = 8 * s;
  const by = y + h / 2 - bh / 2;

  ctx.fillStyle = 'rgba(64,224,255,0.12)';
  roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(64,224,255,0.25)'; ctx.lineWidth = 1;
  roundRect(bx, by, bw, bh, bh / 2); ctx.stroke();

  const fw = bw * clamp(game.progress, 0, 1);
  if (fw > 0.5) {
    ctx.save();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, C.cyan2); g.addColorStop(1, C.cyan);
    ctx.fillStyle = g;
    ctx.shadowColor = C.cyan; ctx.shadowBlur = 8 * s;
    roundRect(bx, by, Math.max(fw, bh), bh, bh / 2); ctx.fill();
    ctx.restore();
  }
}

// ===== ПАНЕЛЬ: КАРТОЧКА =====
function drawWordBlank(cx, y, h, q, s, t) {
  const fs = 26 * s;
  const o = { size: fs, weight: 800, spacing: 2 * s };
  const parts = q.blank.split('_');
  const fill = game.answered ? q.answer : '?';
  const w0 = measure(parts[0], o), wf = measure(fill, o), w1 = measure(parts[1], o);
  const total = w0 + wf + w1;
  const boxW = total + 46 * s;
  const bx = cx - boxW / 2;

  ctx.fillStyle = 'rgba(64,224,255,0.07)';
  roundRect(bx, y, boxW, h, 12 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(64,224,255,0.32)'; ctx.lineWidth = 1.5;
  roundRect(bx, y, boxW, h, 12 * s); ctx.stroke();

  const ty = y + h / 2;
  let tx = cx - total / 2;
  const base = { size: fs, weight: 800, spacing: 2 * s, baseline: 'middle', align: 'left' };

  text(parts[0], tx, ty, { ...base, color: C.cyan, glow: 12 * s, glowColor: 'rgba(64,224,255,0.5)' });
  tx += w0;
  const pulse = game.answered ? 1 : (0.72 + 0.28 * Math.abs(Math.sin(t * 3)));
  text(fill, tx, ty, {
    ...base,
    color: game.answered ? C.green : C.gold,
    glow: 14 * s * pulse,
    glowColor: game.answered ? 'rgba(105,255,71,0.85)' : 'rgba(255,213,79,0.9)',
    alpha: pulse
  });
  tx += wf;
  text(parts[1], tx, ty, { ...base, color: C.cyan, glow: 12 * s, glowColor: 'rgba(64,224,255,0.5)' });
}

function drawOptionBox(x, y, w, h, label, state, hover, s) {
  let bg = 'rgba(64,224,255,0.05)', bd = 'rgba(64,224,255,0.28)', fg = C.text, glow = 0, glowCol = '';
  if (state === 'correct')      { bg = 'rgba(105,255,71,0.12)'; bd = C.green; fg = C.green; glow = 18 * s; glowCol = 'rgba(105,255,71,0.5)'; }
  else if (state === 'wrong')   { bg = 'rgba(255,82,82,0.12)';  bd = C.red;   fg = C.red;   glow = 18 * s; glowCol = 'rgba(255,82,82,0.45)'; }
  else if (hover)               { bg = 'rgba(64,224,255,0.14)'; bd = C.cyan;  fg = C.cyan;  glow = 16 * s; glowCol = 'rgba(64,224,255,0.4)'; }

  ctx.save();
  if (glow) { ctx.shadowColor = glowCol; ctx.shadowBlur = glow; }
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, 14 * s); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = bd; ctx.lineWidth = 1.6;
  roundRect(x, y, w, h, 14 * s); ctx.stroke();

  text(label, x + w / 2, y + h / 2, {
    size: 24 * s, weight: 800, color: fg, align: 'center', baseline: 'middle', spacing: 2 * s,
    glow: glow ? 12 * s : 0, glowColor: glowCol || fg
  });
}

function drawOptions(x, y, w, h, s) {
  const gap = 12 * s;
  const bw = (w - gap) / 2;
  const blocked = game.answered || card.busy || win.shown;
  for (let i = 0; i < 2; i++) {
    const bx = x + i * (bw + gap);
    lastOptionRect[i] = { x: bx, y, w: bw, h };
    const id = 'opt' + i;
    const hover = !blocked && pointIn(bx, y, bw, h);
    addHotspot(id, bx, y, bw, h, () => chooseOption(i), blocked);

    const a = game.optAnim[i];
    let scale = 1 + 0.14 * Math.sin(Math.PI * (1 - a.pop));
    if (pressedId === id && hover) scale *= 0.97;
    const dx = Math.sin(a.shakeT * 42) * a.shake * 9 * s;

    ctx.save();
    ctx.translate(bx + bw / 2 + dx, y + h / 2);
    ctx.scale(scale, scale);
    drawOptionBox(-bw / 2, -h / 2, bw, h, game.options[i], optionState(i), hover, s);
    ctx.restore();
  }
}

function drawFeedback(x, y, w, h, s) {
  if (!game.answered) return;
  const ok = game.lastCorrect;
  const col = ok ? C.green : '#ff8a80';
  ctx.save();
  ctx.globalAlpha *= clamp(game.fbAlpha, 0, 1);
  ctx.fillStyle = ok ? 'rgba(105,255,71,0.08)' : 'rgba(255,82,82,0.08)';
  roundRect(x, y, w, h, 12 * s); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(105,255,71,0.32)' : 'rgba(255,82,82,0.32)';
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, 12 * s); ctx.stroke();

  const msg = (ok ? '✅ Верно! ' : '❌ ') + game.question.hint;
  const lines = wrapText(msg, w - 22 * s, { size: 13.5 * s, weight: 700 });
  const lh = 17 * s;
  const y0 = y + h / 2 - (lines.length - 1) * lh / 2;
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x + w / 2, y0 + i * lh, {
      size: 13.5 * s, weight: 700, color: col, align: 'center', baseline: 'middle'
    });
  }
  ctx.restore();
}

function drawNextButton(cx, y, h, s) {
  const label = 'Вперёд! →';
  const fs = 13 * s;
  const bw = Math.max(measure(label, { size: fs, weight: 800, spacing: 1 * s }) + 54 * s, 150 * s);
  const bx = cx - bw / 2;
  const disabled = !game.answered || game.finished || card.busy || win.shown;
  const hover = !disabled && pointIn(bx, y, bw, h);
  addHotspot('next', bx, y, bw, h, nextQuestion, disabled);

  ctx.save();
  ctx.globalAlpha *= disabled ? 0.28 : 1;
  const sc = ((pressedId === 'next' && hover) ? 0.97 : 1) * (hover ? 1.03 : 1);
  ctx.translate(bx + bw / 2, y + h / 2);
  ctx.scale(sc, sc);
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, C.cyan2); g.addColorStop(1, C.cyan);
  ctx.fillStyle = g;
  if (!disabled) { ctx.shadowColor = 'rgba(64,224,255,0.55)'; ctx.shadowBlur = hover ? 26 * s : 16 * s; }
  roundRect(-bw / 2, -h / 2, bw, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0;
  text(label, 0, 0, { size: fs, weight: 800, color: '#062033', align: 'center', baseline: 'middle', spacing: 1 * s });
  ctx.restore();
}

function drawCard(x, y, w, h, s, t) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30 * s; ctx.shadowOffsetY = 8 * s;
  ctx.fillStyle = C.cardBg;
  roundRect(x, y, w, h, 20 * s); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(64,224,255,0.35)'; ctx.lineWidth = 1.5;
  roundRect(x, y, w, h, 20 * s); ctx.stroke();

  ctx.save();
  roundRect(x, y, w, h, 20 * s); ctx.clip();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(64,224,255,0)');
  g.addColorStop(0.5, 'rgba(64,224,255,0.85)');
  g.addColorStop(1, 'rgba(64,224,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 1.5);
  ctx.restore();

  const q = game.question;
  if (!q) return;

  ctx.save();
  ctx.globalAlpha = clamp(card.alpha, 0, 1);

  const sx = x + card.shift;
  const px = MET.cardPadX * s, py = MET.cardPadY * s;
  const cx = sx + px, cw = w - px * 2;
  let cy = y + py;

  const rule = RULES[q.rule];
  const badgeLabel = 'Правило: ' + rule.label;
  const badgeFs = 11.5 * s;
  const badgeW = measure(badgeLabel, { size: badgeFs, weight: 800, spacing: 1.2 * s }) + 28 * s;
  drawPill(cx, cy, badgeW, MET.badge * s, badgeLabel, rule.color, badgeFs, 1.2 * s);
  cy += (MET.badge + MET.badgeGap) * s;

  text('Какую букву вставить?', sx + w / 2, cy + MET.qLabel * s * 0.5, {
    size: 14 * s, weight: 700, color: C.text, align: 'center', baseline: 'middle'
  });
  cy += (MET.qLabel + MET.qGap) * s;

  drawWordBlank(sx + w / 2, cy, MET.word * s, q, s, t);
  cy += (MET.word + MET.wordGap) * s;

  drawOptions(cx, cy, cw, MET.opt * s, s);
  cy += (MET.opt + MET.optGap) * s;

  drawFeedback(cx, cy, cw, MET.fb * s, s);
  cy += (MET.fb + MET.fbGap) * s;

  drawNextButton(sx + w / 2, cy, MET.next * s, s);

  ctx.restore();
}

function drawPanel(t) {
  const s = L.s, x = L.contentX, w = L.contentW;
  let y = L.contentY;

  const titleO = { size: 26 * s, weight: 800, color: C.cyan, align: 'center', spacing: 2.5 * s, glow: 22 * s, glowColor: 'rgba(64,224,255,0.7)', baseline: 'middle' };
  text('КОСМИЧЕСКОЕ', x + w / 2, y + MET.titleLine * s * 0.5, titleO);
  text('ПУТЕШЕСТВИЕ', x + w / 2, y + MET.titleLine * s * 1.5, titleO);
  y += MET.titleLine * 2 * s + MET.titleGap * s;

  text('Правила: жи-ши, чу-щу, ча-ща', x + w / 2, y + MET.sub * s * 0.5, {
    size: 13.5 * s, weight: 600, color: C.dim, align: 'center', baseline: 'middle'
  });
  y += (MET.sub + MET.subGap) * s;

  drawChips(x, y, w, MET.chip * s, s);
  y += (MET.chip + MET.chipGap) * s;

  drawProgress(x, y, w, MET.prog * s, s);
  y += (MET.prog + MET.progGap) * s;

  drawCard(x, y, w, cardHeight(s), s, t);
}

// ===== ФИНАЛЬНЫЙ ЭКРАН =====
function drawWinScreen(t) {
  if (win.alpha <= 0.001) return;
  const s = clamp(Math.min(W / 900, H / 780), 0.42, 1.5);

  ctx.save();
  ctx.globalAlpha = clamp(win.alpha, 0, 1);
  ctx.fillStyle = 'rgba(6,11,26,0.95)';
  ctx.fillRect(0, 0, W, H);

  const M = { rocket: 104, g1: 12, title: 34, g2: 14, stars: 48, g3: 10, sub: 20, g4: 18, rule: 112, g5: 22, btn: 48 };
  const total = (M.rocket + M.g1 + M.title + M.g2 + M.stars + M.g3 + M.sub + M.g4 + M.rule + M.g5 + M.btn) * s;
  const cx = W / 2;
  let y = Math.max(12 * s, (H - total) / 2);

  ctx.save();
  ctx.translate(cx, y + M.rocket * s * 0.55 + win.rocketY * s);
  ctx.rotate(-0.12 + Math.sin(t * 1.6) * 0.05);
  drawRocketShape(30 * s, 1, t);
  ctx.restore();
  y += (M.rocket + M.g1) * s;

  text('Планета достигнута!', cx, y + M.title * s * 0.5, {
    size: 30 * s, weight: 800, color: C.cyan, align: 'center', baseline: 'middle',
    spacing: 1.5 * s, glow: 28 * s, glowColor: 'rgba(64,224,255,0.7)'
  });
  y += (M.title + M.g2) * s;

  const earned = ratingStars();
  const sr = M.stars * s * 0.42, sgap = M.stars * s * 1.25;
  const sx0 = cx - sgap;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(sx0 + i * sgap, y + M.stars * s * 0.5);
    if (i < earned) {
      const k = clamp(win.starPop[i], 0, 1.35);
      ctx.scale(k, k);
      ctx.rotate((1 - k) * 1.2);
      ctx.fillStyle = '#ffd54f';
      ctx.shadowColor = 'rgba(255,213,79,0.9)'; ctx.shadowBlur = 22 * s;
      starPath(sr, 5, 0.45); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(232,244,255,0.22)'; ctx.lineWidth = 2;
      starPath(sr, 5, 0.45); ctx.stroke();
    }
    ctx.restore();
  }
  y += (M.stars + M.g3) * s;

  const pct = Math.round((game.correctCount / TOTAL) * 100);
  text('Правильных ответов: ' + game.correctCount + ' из ' + TOTAL + ' (' + pct + '%)', cx, y + M.sub * s * 0.5, {
    size: 15 * s, weight: 700, color: 'rgba(232,244,255,0.75)', align: 'center', baseline: 'middle'
  });
  y += (M.sub + M.g4) * s;

  const bw = Math.min(W - 40 * s, 430 * s);
  const bx = cx - bw / 2;
  ctx.fillStyle = 'rgba(64,224,255,0.07)';
  roundRect(bx, y, bw, M.rule * s, 16 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(64,224,255,0.25)'; ctx.lineWidth = 1;
  roundRect(bx, y, bw, M.rule * s, 16 * s); ctx.stroke();

  text('Запомни:', cx, y + 22 * s, {
    size: 14 * s, weight: 700, color: 'rgba(232,244,255,0.7)', align: 'center', baseline: 'middle'
  });
  const reminders = [
    { txt: 'жи-ши пишем с И', color: C.gold },
    { txt: 'чу-щу пишем с У', color: C.pink },
    { txt: 'ча-ща пишем с А', color: C.green }
  ];
  for (let i = 0; i < reminders.length; i++) {
    text(reminders[i].txt, cx, y + (46 + i * 22) * s, {
      size: 15 * s, weight: 800, color: reminders[i].color, align: 'center', baseline: 'middle', spacing: 0.5 * s
    });
  }
  y += (M.rule + M.g5) * s;

  const label = 'Лететь снова';
  const fs = 14 * s;
  const btnW = Math.max(measure(label, { size: fs, weight: 800, spacing: 1 * s }) + 60 * s, 190 * s);
  const btnH = M.btn * s;
  const btnX = cx - btnW / 2;
  const enabled = win.alpha > 0.75 && !card.busy;
  const hover = enabled && pointIn(btnX, y, btnW, btnH);
  addHotspot('restart', btnX, y, btnW, btnH, restart, !enabled);

  ctx.save();
  ctx.translate(cx, y + btnH / 2);
  const press = (pressedId === 'restart' && hover) ? 0.97 : (hover ? 1.04 : 1);
  ctx.scale(press, press);
  const g = ctx.createLinearGradient(-btnW / 2, 0, btnW / 2, 0);
  g.addColorStop(0, '#c2185b'); g.addColorStop(1, '#ff6ec7');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,110,199,0.55)'; ctx.shadowBlur = hover ? 28 * s : 18 * s;
  roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2); ctx.fill();
  ctx.shadowBlur = 0;
  text(label, 0, 0, { size: fs, weight: 800, color: '#ffffff', align: 'center', baseline: 'middle', spacing: 1 * s });
  ctx.restore();

  ctx.restore();
}

// ===== ГЛАВНЫЙ ЦИКЛ =====
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  hotspots = [];

  ctx.fillStyle = C.space;
  ctx.fillRect(0, 0, W, H);
  if (nebulaCanvas) ctx.drawImage(nebulaCanvas, 0, 0, W, H);
  drawStars();
  drawShooting();

  drawRouteScene(T);
  drawPanel(T);
  drawParticles(true);
  drawWinScreen(T);

  canvas.style.cursor = hitHotspot(pointer.x, pointer.y) ? 'pointer' : 'default';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) || 0;
  last = now;
  T += dt;

  updateTweens(dt);
  updateTimers(dt);
  updateStars(dt);
  updateShooting(dt);
  updateRocket(dt);
  updateParticles(dt);
  for (let i = 0; i < 2; i++) if (game.optAnim[i].shake > 0.001) game.optAnim[i].shakeT += dt;

  draw();
  hub.raf(frame);
}

// ===== ВВОД =====
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

hub.on('pointermove', e => { const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; }, canvas);
hub.on('pointerdown', e => {
  const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; pointer.down = true;
  const h = hitHotspot(p.x, p.y);
  pressedId = h ? h.id : null;
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
}, canvas);
hub.on('pointerup', e => {
  const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; pointer.down = false;
  const h = hitHotspot(p.x, p.y);
  if (h && h.id === pressedId && h.onClick) h.onClick();
  pressedId = null;
}, canvas);
hub.on('pointercancel', () => { pointer.down = false; pressedId = null; }, canvas);
hub.on('pointerleave', () => {
  pointer.x = -9999; pointer.y = -9999; pointer.down = false; pressedId = null;
}, canvas);

hub.on('keydown', e => {
  if (win.shown) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restart(); }
    return;
  }
  if (!game.answered) {
    if (e.key === '1' || e.key === 'ArrowLeft') chooseOption(0);
    else if (e.key === '2' || e.key === 'ArrowRight') chooseOption(1);
  } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
    e.preventDefault();
    nextQuestion();
  }
});

// ===== СТАРТ =====
// Хаб владеет CSS-размером, поэтому следим за ним сами.
const ro = new ResizeObserver(resize);
ro.observe(canvas);

resize();
startGame();
win.alpha = 0; win.shown = false;
last = performance.now();
hub.raf(frame);

return {
  destroy() {
    ro.disconnect();
    canvas.style.cursor = '';
  }
};

}
