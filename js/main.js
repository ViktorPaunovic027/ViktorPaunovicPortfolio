/* Home page script. Loaded with `defer`, so the whole DOM exists when it runs.
 * Nothing here depends on a CDN: three.js, React and the dashboard are loaded
 * later, on demand, and the page works without them. */
const $ = s => document.querySelector(s);
function safe(fn) { try { fn(); } catch (e) { console.error(e); } }
const ROOT = document.documentElement;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = matchMedia('(hover:none) and (pointer:coarse)').matches || 'ontouchstart' in window;

/* ── HELPERS ──────────────────────────────── */
// Size a canvas for the screen's pixel ratio so lines and text stay sharp. Drawing code uses CSS pixels.
function fitCanvas(cv, ctx, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}

// Seeded random numbers, so the molecule has the same shape on every visit and
// matches the static SVG version in index.html (generated from this same function).
function seededRandom(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function molGeometry() {
  const r = seededRandom(27), N = 15, PHI = Math.PI * (3 - Math.sqrt(5)), nodes = [], dust = [], bonds = [];
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = PHI * i, s = 2.7 + (r() - .5) * .7; nodes.push([Math.cos(th) * rad * s, y * s, Math.sin(th) * rad * s]); }
  for (let i = 0; i < 120; i++) dust.push([(r() - .5) * 9, (r() - .5) * 9, (r() - .5) * 9]);
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (d(nodes[i], nodes[j]) <= 3.6) bonds.push([i, j]);
  return { nodes, dust, bonds };
}

/* ── LOADER DASHBOARD BG ──────────────────── */
function initLoaderBg() {
  const dc = $('#dash-canvas'); if (!dc) return;
  const cx = dc.getContext('2d');
  let W = 0, H = 0;
  function resize() { W = innerWidth; H = innerHeight; fitCanvas(dc, cx, W, H); }
  resize();
  window.addEventListener('resize', () => { if (!dc.isConnected) return; resize(); init(); });
  const rnd = (a, b) => a + Math.random() * (b - a), cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const TOP = 28; // chart lines and bars stay below this strip, which holds the label and value
  function grid() { const C = 52; cx.lineWidth = 1; cx.strokeStyle = 'rgba(0,245,255,.028)'; for (let x = 0; x < W; x += C) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); } for (let y = 0; y < H; y += C) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); } }
  let scanY = 0; function scan() { const g = cx.createLinearGradient(0, scanY - 50, 0, scanY + 50); g.addColorStop(0, 'rgba(0,245,255,0)'); g.addColorStop(.5, 'rgba(0,245,255,.045)'); g.addColorStop(1, 'rgba(0,245,255,0)'); cx.fillStyle = g; cx.fillRect(0, scanY - 50, W, 100); scanY = (scanY + 1) % H; }
  function brk(x, y, w, h, col, a) { const L = 14; cx.strokeStyle = `rgba(${col},${a})`; cx.lineWidth = 1.5; [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([bx, by, sx, sy]) => { cx.beginPath(); cx.moveTo(bx, by + sy * L); cx.lineTo(bx, by); cx.lineTo(bx + sx * L, by); cx.stroke(); }); }
  function labels(p, value) {
    const [r, g, b] = p.col;
    cx.font = '600 11px Inter,system-ui,sans-serif';
    cx.textAlign = 'left'; cx.fillStyle = `rgba(${r},${g},${b},.75)`; cx.fillText(p.label, p.x + 12, p.y + 20);
    cx.textAlign = 'right'; cx.fillStyle = 'rgba(240,240,255,.6)'; cx.fillText(Math.round(value).toLocaleString('en-GB'), p.x + p.w - 12, p.y + 20);
    cx.textAlign = 'left';
  }
  class SC {
    constructor(c) { Object.assign(this, c); this.pts = []; this.off = 0; let v = rnd(.3, .7); for (let i = 0; i < 70; i++) { v = cl(v + rnd(-.07, .07), .05, .95); this.pts.push(v); } }
    update(dt) { this.off += this.spd * dt * 60; if (this.off >= 1) { this.off -= 1; let l = this.pts[this.pts.length - 1]; l = cl(l + rnd(-.07, .07), .05, .95); this.pts.push(l); if (this.pts.length > 80) this.pts.shift(); } }
    draw() {
      const [r, g, b] = this.col, S = 42, step = this.w / S, sl = this.pts.slice(-S), ph = this.h - TOP, base = this.y + this.h;
      cx.beginPath(); sl.forEach((p, i) => { const px = this.x + (i - this.off) * step, py = base - p * ph; i === 0 && cx.moveTo(px, base); cx.lineTo(px, py); }); cx.lineTo(this.x + (sl.length - 1 - this.off) * step, base); cx.closePath();
      const ga = cx.createLinearGradient(this.x, this.y + TOP, this.x, base); ga.addColorStop(0, `rgba(${r},${g},${b},.13)`); ga.addColorStop(1, `rgba(${r},${g},${b},0)`); cx.fillStyle = ga; cx.fill();
      cx.beginPath(); cx.strokeStyle = `rgba(${r},${g},${b},.6)`; cx.lineWidth = 1.5; sl.forEach((p, i) => { const px = this.x + (i - this.off) * step, py = base - p * ph; i === 0 ? cx.moveTo(px, py) : cx.lineTo(px, py); }); cx.stroke();
      brk(this.x, this.y, this.w, this.h, `${r},${g},${b}`, .35);
      labels(this, sl[sl.length - 1] * 1000);
    }
  }
  class BC {
    constructor(c) { Object.assign(this, c); this.vals = Array.from({ length: 8 }, () => rnd(.2, .9)); this.tgts = [...this.vals]; this.tmr = 0; }
    update(dt) { this.vals = this.vals.map((v, i) => v + (this.tgts[i] - v) * .06); this.tmr += dt; if (this.tmr > 2.2) { this.tmr = 0; this.tgts = Array.from({ length: 8 }, () => rnd(.1, .95)); } }
    draw() {
      const [r, g, b] = this.col, gap = 3, bw = (this.w - gap * (this.vals.length - 1)) / this.vals.length, ph = this.h - TOP, base = this.y + this.h;
      this.vals.forEach((v, i) => { const bx = this.x + i * (bw + gap), bh = v * ph, by = base - bh; cx.fillStyle = `rgba(${r},${g},${b},.07)`; cx.fillRect(bx, this.y + TOP, bw, ph); const gb = cx.createLinearGradient(bx, by, bx, base); gb.addColorStop(0, `rgba(${r},${g},${b},.55)`); gb.addColorStop(1, `rgba(${r},${g},${b},.08)`); cx.fillStyle = gb; cx.fillRect(bx, by, bw, bh); });
      brk(this.x, this.y, this.w, this.h, `${r},${g},${b}`, .3);
      labels(this, this.vals.reduce((a, v) => a + v, 0) * 100);
    }
  }
  let charts, bars;
  function init() {
    const M = 28, CW = Math.min(W * .21, 230), CH = Math.min(H * .21, 148), BW = Math.min(W * .15, 170), BH = Math.min(H * .17, 120);
    charts = [new SC({ x: M, y: H * .10, w: CW, h: CH, col: [0, 245, 255], label: 'SESSIONS', spd: .45 }), new SC({ x: W - M - CW, y: H * .10, w: CW, h: CH, col: [191, 0, 255], label: 'REVENUE', spd: .30 }), new SC({ x: M, y: H * .63, w: CW, h: CH, col: [0, 245, 255], label: 'EVENTS', spd: .55 }), new SC({ x: W - M - CW, y: H * .63, w: CW, h: CH, col: [0, 255, 136], label: 'USERS', spd: .38 })];
    bars = [new BC({ x: M, y: H * .40, w: BW, h: BH, col: [0, 245, 255], label: 'DEPOSITS' }), new BC({ x: W - M - BW, y: H * .40, w: BW, h: BH, col: [191, 0, 255], label: 'FTDS' })];
  }
  init();
  let last = 0;
  function frame(ts) {
    if (!dc.isConnected) return; // the loader has been removed
    const dt = Math.min((ts - last) / 1000, .05); last = ts;
    cx.clearRect(0, 0, W, H); grid(); scan();
    charts.forEach(c => { c.update(dt); c.draw(); }); bars.forEach(b => { b.update(dt); b.draw(); });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(ts => { last = ts; frame(ts); });
}

/* ── PARTICLES ────────────────────────────── */
function initParticles() {
  const cv = $('#particle-canvas'); if (!cv) return;
  const ctx = cv.getContext('2d'); let W, H;
  function resize() { W = innerWidth; H = innerHeight; fitCanvas(cv, ctx, W, H); }
  resize();
  // Adaptive count: fewer particles on small screens. The O(n²) connection loop dominates the cost.
  const COUNT = innerWidth < 700 ? 28 : innerWidth < 1100 ? 40 : 55;
  const MAX_D = 110, MAX_D2 = MAX_D * MAX_D;
  const pts = Array.from({ length: COUNT }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, r: Math.random() * 1.4 + .4, a: Math.random() * .2 + .04, col: Math.random() > .55 ? '0,245,255' : '191,0,255' }));
  function move() { for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0; } }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = `rgba(${p.col},${p.a})`; ctx.fill(); }
    // Squared-distance check skips the sqrt for most pairs.
    ctx.lineWidth = .5;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d2 = dx * dx + dy * dy; if (d2 < MAX_D2) { const d = Math.sqrt(d2); ctx.beginPath(); ctx.strokeStyle = `rgba(0,245,255,${.07 * (1 - d / MAX_D)})`; ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); } }
  }
  if (REDUCED) { // one still frame, no animation
    draw(); window.addEventListener('resize', () => { resize(); draw(); });
    return;
  }
  window.addEventListener('resize', resize);
  // The canvas is position:fixed, so it is always "visible" to an IntersectionObserver.
  // Instead: stop while the tab is hidden, and run at ~30 fps once past the hero.
  let skip = false;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (scrollY > innerHeight) { skip = !skip; if (skip) return; }
    move(); draw();
  }
  frame();
}

/* ── THREE.JS MOLECULE (progressive enhancement) ── */
// The hero shows a static SVG molecule first. On desktop, three.js loads once the
// hero is visible and the 3D molecule fades in over it. Phones, reduced-motion
// visitors and devices without WebGL keep the SVG and skip the 121 KB download.
function canUse3D() {
  if (REDUCED || IS_TOUCH || innerWidth < 900) return false;
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (_) { return false; }
}
function initMolecule3D() {
  if (!canUse3D()) return;
  const start = () => loadScript('vendor/three-r128.min.js').then(buildMolecule).catch(() => { /* keep the SVG */ });
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 }); else setTimeout(start, 600);
}
function buildMolecule() {
  const wrap = $('#hero-right'); if (!window.THREE || !wrap) return;
  const mc = document.createElement('canvas'); mc.id = 'mol-canvas'; mc.setAttribute('aria-hidden', 'true');
  let R;
  try { R = new THREE.WebGLRenderer({ canvas: mc, alpha: true, antialias: true }); }
  catch (_) { return; } // no WebGL after all: the SVG stays
  const size = () => ({ w: wrap.clientWidth || 1, h: wrap.clientHeight || 1 });
  let { w, h } = size();
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.setSize(w, h, false);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(48, w / h, .1, 100); cam.position.z = 9;
  const grp = new THREE.Group(); scene.add(grp);
  const geo = molGeometry(), pos = geo.nodes.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const cg = new THREE.SphereGeometry(.13, 20, 20), hg = new THREE.SphereGeometry(.27, 16, 16), ms = [];
  pos.forEach((p, i) => { const c = i % 2 === 0 ? 0x00f5ff : 0xbf00ff; const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .75, metalness: .3, roughness: .25 })); m.position.copy(p); grp.add(m); ms.push(m); const h2 = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .1, side: THREE.BackSide })); h2.position.copy(p); grp.add(h2); });
  const pa = new Float32Array(geo.dust.length * 3); geo.dust.forEach((p, i) => { pa[i * 3] = p[0]; pa[i * 3 + 1] = p[1]; pa[i * 3 + 2] = p[2]; });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pa, 3)); grp.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x00f5ff, size: .04, transparent: true, opacity: .4 })));
  geo.bonds.forEach(([i, j]) => { const c = (i + j) % 2 === 0 ? 0x00f5ff : 0xbf00ff; const g2 = new THREE.BufferGeometry().setFromPoints([pos[i], pos[j]]); grp.add(new THREE.Line(g2, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: .2 }))); });
  scene.add(new THREE.AmbientLight(0x0a0a1e, 2.5));
  const cL = new THREE.PointLight(0x00f5ff, 3, 22); cL.position.set(4, 3, 4); scene.add(cL);
  const pL = new THREE.PointLight(0xbf00ff, 3, 22); pL.position.set(-4, -3, -4); scene.add(pL);
  let mx = 0, my = 0, smx = 0, smy = 0; document.addEventListener('mousemove', e => { mx = (e.clientX / innerWidth - .5) * 2; my = (e.clientY / innerHeight - .5) * 2; });
  let bY = 0, bX = 0, t = 0, visible = true, shown = false;
  // Pause rendering while the hero is off-screen.
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(wrap);
  wrap.appendChild(mc);
  function loop() {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    t += .008; bY += .004; bX += .0014; smx += (mx - smx) * .04; smy += (my - smy) * .04;
    grp.rotation.y = bY + smx * .45; grp.rotation.x = bX + smy * .3;
    cL.intensity = 2.4 + Math.sin(t * 1.7) * .9; pL.intensity = 2.4 + Math.cos(t * 1.3) * .9;
    ms.forEach((m, i) => { m.material.emissiveIntensity = .6 + Math.sin(t + i * .72) * .25; });
    R.render(scene, cam);
    if (!shown) { shown = true; wrap.classList.add('mol-3d'); } // cross-fade from the SVG after the first real frame
  }
  loop();
  window.addEventListener('resize', () => { const s = size(); R.setSize(s.w, s.h, false); cam.aspect = s.w / s.h; cam.updateProjectionMatrix(); });
}

/* ── LOADER TRANSITION ────────────────────── */
// The head script decides between `intro-play` (first visit this session) and
// `intro-skip` (repeat visit, reduced motion, or the failsafe already showed the page).
function playIntro() {
  window.__mainRan = true; // tells the head failsafe that the intro is handled from here
  safe(initLoaderBg);
  const MIN = 1200, MAX_WAIT = 4000;
  let pageReady = document.readyState === 'complete', timerDone = false, started = false;
  const tryStart = () => { if (pageReady && timerDone) run(); };
  setTimeout(() => { timerDone = true; tryStart(); }, MIN);
  if (!pageReady) window.addEventListener('load', () => { pageReady = true; tryStart(); }, { once: true });
  setTimeout(() => { pageReady = true; timerDone = true; tryStart(); }, MAX_WAIT); // never wait on a slow asset

  function run() {
    if (started) return; started = true;
    const loader = $('#loader'), fly = $('#loader-mol'), heroMol = $('#hero-mol'), page = $('#page-content');
    if (!loader || !fly || !heroMol) { finishIntro(); return; }
    const bar = $('.l-bar-fill'); if (bar) bar.classList.add('done');
    const from = fly.getBoundingClientRect(), to = heroMol.getBoundingClientRect();
    document.querySelectorAll('.l-ring').forEach(r => { r.style.transition = 'opacity .25s'; r.style.opacity = '0'; });
    const texts = $('#loader-texts'); texts.style.transition = 'opacity .25s'; texts.style.opacity = '0';
    // Lift the molecule out of the loader so it stays solid while the loader fades.
    fly.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;z-index:10001;pointer-events:none;will-change:transform;transform-origin:50% 50%;`;
    document.body.appendChild(fly);
    loader.style.pointerEvents = 'none';
    // Fly into the hero only if the hero is on screen (not when the page opened at a #section,
    // or the hero sits below the fold on a short landscape screen). Otherwise just fade out.
    const heroOnScreen = to.width > 0 && to.bottom > 0 && to.top < innerHeight && to.right > 0 && to.left < innerWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (heroOnScreen) {
        const dx = (to.left + to.width / 2) - (from.left + from.width / 2), dy = (to.top + to.height / 2) - (from.top + from.height / 2), sc = to.width / from.width;
        fly.style.transition = 'transform .9s cubic-bezier(.4,0,.2,1)'; fly.style.transform = `translate(${dx}px,${dy}px) scale(${sc})`;
      } else {
        fly.style.transition = 'opacity .5s ease .2s'; fly.style.opacity = '0';
      }
      page.style.transition = 'opacity .7s ease .25s'; page.style.opacity = '1';
      loader.style.transition = 'opacity .5s ease .45s'; loader.style.opacity = '0';
    }));
    let done = false;
    const end = () => { if (done) return; done = true; window.removeEventListener('resize', end); fly.remove(); finishIntro(); };
    window.addEventListener('resize', end); // the measured target is stale after a resize: finish now
    setTimeout(end, 950);
  }
}

function finishIntro() {
  window.__mainRan = true;
  if (window.__introDone) return;
  window.__introDone = true;
  ROOT.classList.remove('intro-play'); ROOT.classList.add('intro-done');
  const loader = $('#loader'); if (loader) loader.remove();
  const fly = $('#loader-mol'); if (fly) fly.remove();
  const page = $('#page-content'); if (page) page.style.opacity = '';
  [initScrollObs, initNav, initExtras, initMolecule3D].forEach(safe);
}

function initExtras() { [initTypewriter, initTilt, initCounters, initForm, initScrollProgress, initBackTop, initMaltaClock].forEach(safe); }

/* ── MALTA TIME WIDGETS (hero + contact card) ── */
function initMaltaClock() {
  const heroEl = document.getElementById('malta-time'), ciEl = document.getElementById('ci-time');
  if (!heroEl && !ciEl) return;
  function tick() {
    try {
      const full = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Malta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      if (heroEl) heroEl.textContent = full;
      if (ciEl) ciEl.textContent = full.slice(0, 5); // HH:MM only in the contact card
    } catch {
      const fb = new Date().toTimeString().slice(0, 8);
      if (heroEl) heroEl.textContent = fb;
      if (ciEl) ciEl.textContent = fb.slice(0, 5);
    }
  }
  tick();
  setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - Date.now() % 1000);
}

/* ── CURSOR ───────────────────────────────── */
// Runs from the very start (including during the loader). The native cursor is
// hidden only once this custom one is running, via the `has-cursor` class.
function initCursor() {
  const dot = document.getElementById('cursor'), ring = document.getElementById('cursor-ring'), trail = document.getElementById('cursor-trail');
  if (!dot || !ring || !trail) return;
  if (IS_TOUCH) { dot.style.display = 'none'; ring.style.display = 'none'; trail.style.display = 'none'; return; }
  const tc = trail.getContext('2d');
  ROOT.classList.add('has-cursor');
  function resize() { fitCanvas(trail, tc, innerWidth, innerHeight); } resize(); window.addEventListener('resize', resize);
  let cx = -9999, cy = -9999, seen = false, hideTimer = 0; const particles = [];
  class CP {
    constructor(x, y) { this.x = x; this.y = y; this.vx = (Math.random() - .5) * 2; this.vy = (Math.random() - .5) * 2 - .4; this.life = 1; this.decay = .028 + Math.random() * .018; this.r = Math.random() * 2.5 + 1; this.col = Math.random() > .5 ? [0, 245, 255] : [191, 0, 255]; }
    update() { this.x += this.vx; this.y += this.vy; this.vy += .04; this.life -= this.decay; }
    draw() { const [r, g, b] = this.col; tc.beginPath(); tc.arc(this.x, this.y, this.r * this.life, 0, Math.PI * 2); tc.fillStyle = `rgba(${r},${g},${b},${this.life * .55})`; tc.fill(); }
  }
  let ls = 0;
  function show() { dot.style.opacity = '1'; ring.style.opacity = '1'; }
  function hide() { dot.style.opacity = '0'; ring.style.opacity = '0'; }
  document.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    dot.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    if (!seen) { seen = true; show(); }
  });
  document.addEventListener('mouseleave', hide);
  document.addEventListener('mouseenter', () => { if (seen) show(); });
  document.addEventListener('mousedown', () => dot.classList.add('click')); document.addEventListener('mouseup', () => dot.classList.remove('click'));
  // Hybrid devices (laptop with touchscreen): if a real touch happens, hide the cursor 1 s later.
  document.addEventListener('touchstart', () => { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { hide(); seen = false; }, 1000); }, { passive: true });
  // Delegated, so it also covers the dashboard, which mounts later.
  const HOVER = 'a,button,.g-card,.db-card,.db-tab,#back-top,#mnav-btn';
  document.addEventListener('mouseover', e => { if (e.target.closest && e.target.closest(HOVER)) dot.classList.add('hovering'); });
  document.addEventListener('mouseout', e => { const to = e.relatedTarget; if (!to || !to.closest || !to.closest(HOVER)) dot.classList.remove('hovering'); });
  if (REDUCED) return; // keep the cursor, skip the particle trail
  function loop() {
    requestAnimationFrame(loop);
    if (particles.length === 0 && !seen) return;
    tc.clearRect(0, 0, innerWidth, innerHeight);
    const now = Date.now();
    if (seen && now - ls > 55 && cx > 0) { ls = now; particles.push(new CP(cx, cy)); }
    // Remove a particle as soon as it dies: drawing it with a negative radius would throw.
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.update(); if (p.life <= 0) { particles.splice(i, 1); continue; } p.draw(); }
  }
  loop();
}

/* ── TYPEWRITER ───────────────────────────── */
function initTypewriter() {
  const el = document.getElementById('typewriter'); if (!el) return;
  const titles = ['Data Analyst', 'SQL Specialist', 'BI Developer', 'Python Enthusiast', 'Dashboard Builder'];
  if (REDUCED) { el.textContent = titles[0]; return; }
  let ti = 0, ci = 0, del = false;
  function tick() { const cur = titles[ti]; if (!del) { ci++; el.textContent = cur.slice(0, ci); if (ci === cur.length) { del = true; setTimeout(tick, 1800); return; } setTimeout(tick, 85); } else { ci--; el.textContent = cur.slice(0, ci); if (ci === 0) { del = false; ti = (ti + 1) % titles.length; setTimeout(tick, 320); return; } setTimeout(tick, 48); } }
  tick();
}

/* ── TILT ─────────────────────────────────── */
function initTilt() {
  // Skip on touch devices (no hover) and for visitors who asked for less motion.
  if (IS_TOUCH || REDUCED) return;
  // rAF-throttled: at most one update per frame, not one per mousemove event.
  document.querySelectorAll('.g-card').forEach(card => {
    let pending = null, raf = 0;
    function apply() { const e = pending; pending = null; raf = 0; if (!e) return; const r = card.getBoundingClientRect(), dx = (e.x - r.left - r.width / 2) / (r.width / 2), dy = (e.y - r.top - r.height / 2) / (r.height / 2); card.style.transform = `perspective(900px) rotateY(${dx * 6}deg) rotateX(${-dy * 6}deg) translateZ(6px)`; card.style.boxShadow = `${-dx * 8}px ${-dy * 8}px 30px rgba(0,245,255,.06)`; }
    card.addEventListener('mousemove', e => { pending = { x: e.clientX, y: e.clientY }; if (!raf) { card.style.transition = 'transform .08s ease,border-color .3s,background .3s,box-shadow .3s'; raf = requestAnimationFrame(apply); } });
    card.addEventListener('mouseleave', () => { pending = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } card.style.transition = 'transform .5s ease,border-color .3s,background .3s,box-shadow .5s'; card.style.transform = ''; card.style.boxShadow = ''; });
  });
}

/* ── COUNTERS ─────────────────────────────── */
// The real numbers are in the HTML, so the page reads correctly without JavaScript.
// The animation counts up from 0 to the value in data-target.
function initCounters() {
  if (REDUCED) return;
  const nums = document.querySelectorAll('.stat-num[data-target]');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, tgt = +el.dataset.target, sfx = el.dataset.suffix || '', dur = 1400; let st = null;
      function step(now) { if (!st) st = now; const p = Math.min((now - st) / dur, 1), eased = 1 - Math.pow(1 - p, 3); el.textContent = Math.floor(eased * tgt) + sfx; if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step); obs.unobserve(el);
    });
  }, { threshold: .5 });
  nums.forEach(n => {
    const r = n.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) return; // already on screen: leave the final number
    n.textContent = '0' + (n.dataset.suffix || ''); obs.observe(n);
  });
}

/* ── FORM ─────────────────────────────────── */
function initForm() {
  const form = document.getElementById('contact-form'); if (!form) return;
  form.addEventListener('submit', async e => { e.preventDefault(); const btn = form.querySelector('.btn-send'); btn.textContent = 'Sending…'; btn.disabled = true; try { const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } }); if (res.ok) { form.reset(); document.getElementById('form-success').style.display = 'block'; btn.textContent = 'Sent ✓'; } else { btn.textContent = 'Error, try again'; btn.disabled = false; } } catch { btn.textContent = 'Error, try again'; btn.disabled = false; } });
}

/* ── SCROLL OBSERVER ──────────────────────── */
function initScrollObs() {
  const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } }); }, { threshold: .12 });
  document.querySelectorAll('.fade-in,.stagger').forEach(el => obs.observe(el));
  const sw = document.getElementById('skills-wrap'); if (!sw) return;
  const so = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.querySelectorAll('.sk-fill').forEach(b => { b.style.width = b.dataset.w + '%'; }); so.unobserve(e.target); } }); }, { threshold: .15 });
  so.observe(sw);
}

/* ── SMOOTH SCROLL (60fps, eased) ──────────── */
// `target` is a number (page Y) or an element. For an element, its position is
// re-measured every frame: sections use content-visibility:auto, so their real
// heights only appear as they render during the scroll.
let __scrollRaf = 0;
function smoothScrollTo(target, opts = {}) {
  if (__scrollRaf) { cancelAnimationFrame(__scrollRaf); __scrollRaf = 0; }
  const goal = () => {
    const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY;
    return Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, y));
  };
  const startY = scrollY;
  const dist = goal() - startY;
  if (REDUCED || Math.abs(dist) < 2) { window.scrollTo(0, goal()); return; }
  // Duration scales with distance: ~0.6ms per px, clamped to [450, 1100]ms.
  const dur = opts.duration || Math.min(1100, Math.max(450, Math.abs(dist) * .6));
  const t0 = performance.now();
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // cubic ease-in-out
  let cancelled = false;
  const cancel = () => { cancelled = true; cleanup(); };
  function cleanup() { window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel); window.removeEventListener('keydown', keyCancel); }
  function keyCancel(e) { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) cancel(); }
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  window.addEventListener('keydown', keyCancel);
  function step(now) {
    if (cancelled) { __scrollRaf = 0; return; }
    const p = Math.min(1, (now - t0) / dur), e = ease(p);
    window.scrollTo(0, startY + (goal() - startY) * e);
    if (p < 1) { __scrollRaf = requestAnimationFrame(step); return; }
    __scrollRaf = 0; cleanup();
    // Late layout changes (the dashboard mounting, a section rendering) can still move
    // the target after the animation ends: settle on it once more, unless the visitor scrolled.
    if (typeof target !== 'number') setTimeout(() => { if (!cancelled && !__scrollRaf && Math.abs(target.getBoundingClientRect().top) > 4) window.scrollTo(0, goal()); }, 350);
  }
  __scrollRaf = requestAnimationFrame(step);
}

/* ── SCROLL PROGRESS BAR ───────────────────── */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress'); if (!bar) return;
  let raf = 0;
  function update() { const max = document.documentElement.scrollHeight - innerHeight; const p = max > 0 ? Math.min(100, (scrollY / max) * 100) : 0; bar.style.width = p + '%'; raf = 0; }
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}

/* ── BACK TO TOP ───────────────────────────── */
function initBackTop() {
  const btn = document.getElementById('back-top'); if (!btn) return;
  const hero = document.getElementById('home');
  let raf = 0;
  function update() { const trigger = hero ? hero.offsetHeight * .6 : 600; btn.classList.toggle('visible', scrollY > trigger); raf = 0; }
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true }); update();
  btn.addEventListener('click', () => smoothScrollTo(0, { duration: 900 }));
}

/* ── NAV ──────────────────────────────────── */
function initNav() {
  const secs = [...document.querySelectorAll('section[id]')];
  const links = [...document.querySelectorAll('.fnav a, #mnav-drawer a')];
  const mbtn = document.getElementById('mnav-btn'), mback = document.getElementById('mnav-backdrop'), mdraw = document.getElementById('mnav-drawer');
  function closeMenu() { if (!mbtn) return; mbtn.classList.remove('open'); mback.classList.remove('open'); mdraw.classList.remove('open'); mbtn.setAttribute('aria-expanded', 'false'); mdraw.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  function openMenu() { mbtn.classList.add('open'); mback.classList.add('open'); mdraw.classList.add('open'); mbtn.setAttribute('aria-expanded', 'true'); mdraw.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  if (mbtn) {
    mbtn.addEventListener('click', () => { mbtn.classList.contains('open') ? closeMenu() : openMenu(); });
    mback.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && mbtn.classList.contains('open')) closeMenu(); });
  }
  links.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href')); if (!t) return;
      const isMobile = a.closest('#mnav-drawer');
      if (isMobile) closeMenu();
      // Small delay when closing the drawer, so the slide-out doesn't compete with the scroll.
      setTimeout(() => smoothScrollTo(t), isMobile ? 180 : 0);
    });
  });
  let nraf = 0;
  function update() { const mid = innerHeight * .5; let cur = secs[0].id; secs.forEach(s => { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) cur = s.id; }); links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur)); nraf = 0; }
  window.addEventListener('scroll', () => { if (!nraf) nraf = requestAnimationFrame(update); }, { passive: true }); update();
}

/* ── DASHBOARD (lazy) ─────────────────────── */
// React and the dashboard load only when the visitor scrolls near the section.
function initDashboardLoader() {
  const root = document.getElementById('db-root'), section = document.getElementById('analytics');
  if (!root || !section) return;
  let started = false;
  async function load() {
    if (started) return; started = true;
    try {
      await loadScript('vendor/react-18.3.1.production.min.js');
      await loadScript('vendor/react-dom-18.3.1.production.min.js');
      await loadScript('js/dashboard.min.js');
    } catch (_) {
      root.textContent = 'The dashboard could not load. Please refresh the page.';
      root.classList.add('db-failed');
    }
  }
  if (!('IntersectionObserver' in window)) { load(); return; }
  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); load(); }, { rootMargin: '600px 0px' });
  io.observe(section);
}

/* ── START ────────────────────────────────── */
// Each feature starts on its own, so one failure can't stop the page from appearing.
safe(initCursor);
safe(initParticles);
safe(initDashboardLoader);
if (ROOT.classList.contains('intro-play')) {
  try { playIntro(); } catch (e) { console.error(e); finishIntro(); }
} else finishIntro();
