/* Home page script. Loaded with `defer`, so the whole DOM exists when it runs.
 * Nothing here depends on a CDN: three.js, React and the dashboard are loaded
 * later, on demand, and the page works without them. */
const $ = s => document.querySelector(s);
function safe(fn) { try { fn(); } catch (e) { console.error(e); } }
const ROOT = document.documentElement;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// True while the loader's opaque backdrop hides the page: background animations can wait until it starts to fade.
let introCovers = ROOT.classList.contains('intro-play');
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

/* ── LOADER NETWORK ───────────────────────── */
// The loader's centrepiece: the hero molecule's network (molGeometry) on a canvas. It sways slowly in 3D, light
// pulses travel along its bonds, and two thin orbits circle it. It uses the camera of #mol-sym and the 3D molecule
// (fov 48°, z = 9, a 400-unit box), so at rest it lines up exactly with #hero-mol and can settle into it.
// Returns { canvas, shown, fly(rect, ms), fadeOut(ms) }, or null if there is nothing to draw on.
function initLoaderNet() {
  const cv = $('#loader-net'), stage = $('.l-stage'), cx = cv && stage && cv.getContext('2d');
  if (!cx) return null;
  const TAU = Math.PI * 2, F = 1 / Math.tan(24 * Math.PI / 180), CAM = 9;
  const { nodes, dust: cloud, bonds } = molGeometry();
  const atRest = p => F / (CAM - p[2]);
  const dust = cloud.filter(p => Math.abs(p[0] * atRest(p)) <= 1 && Math.abs(p[1] * atRest(p)) <= 1); // the specks the SVG shows
  const adj = nodes.map(() => []); bonds.forEach(([i, j]) => { adj[i].push(j); adj[j].push(i); });
  const CY = '0,245,255', PU = '191,0,255', tint = i => (i % 2 ? PU : CY);
  const CORE = [[[0, '#e8ffff'], [.45, '#00f5ff'], [1, '#007a85']], [[0, '#f6e0ff'], [.45, '#bf00ff'], [1, '#5c0080']]]; // as in #mol-sym
  // Orbits: circles tilted towards the viewer and rolled in the screen plane. w: speed of the light along it (rad/s).
  const ORBITS = [{ r: 4.25, tilt: .34, roll: -.32, w: .42, c: CY, a: .22, th: 2.4 }, { r: 3.7, tilt: .5, roll: .46, w: -.3, c: PU, a: .13, th: 5.5 }];
  const INTRO = .6; // seconds for the network to fade and grow in
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
  const easeOut = u => 1 - Math.pow(1 - u, 3), easeInOut = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

  let W = 0, H = 0, home = null, painted = null;
  const view = { x: 0, y: 0, s: 0, yaw: 0, pitch: 0 }; // where the 400-unit box sits on screen, and its rotation
  function measure() {
    W = innerWidth; H = innerHeight; fitCanvas(cv, cx, W, H); painted = null;
    const r = stage.getBoundingClientRect(); home = { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width };
  }
  measure();
  const onResize = () => { if (cv.isConnected) measure(); };
  window.addEventListener('resize', onResize);

  // Yaw about y, then pitch about x (the 3D molecule's order), then perspective. k = px per unit at that depth.
  let cosY = 1, sinY = 0, cosP = 1, sinP = 0;
  const turn = p => { const x = p[0] * cosY + p[2] * sinY, z = p[2] * cosY - p[0] * sinY; return [x, p[1] * cosP - z * sinP, p[1] * sinP + z * cosP]; };
  const put = q => { const k = F / (CAM - q[2]) * view.s / 2; return { x: view.x + q[0] * k, y: view.y - q[1] * k, k, z: q[2] }; };

  const pulses = [], ripples = [], ping = new Float32Array(nodes.length);
  // t: animation time (frame steps capped at 50 ms, so nothing jumps after a stall). born: first frame, wall clock.
  let t = 0, last = 0, born = 0, nextPulse = .8, fly = null, fade = null, revealed;
  const shown = new Promise(r => { revealed = r; });
  function spawn(from, prev, hop) {
    const next = adj[from].filter(n => n !== prev); if (!next.length) return;
    pulses.push({ a: from, b: next[(Math.random() * next.length) | 0], p: 0, d: 1.1 + Math.random() * .6, hop, c: Math.random() < .2 ? PU : CY });
  }
  function step(dt) {
    t += dt;
    const calm = fly || fade;
    if (!calm && t > nextPulse && pulses.length < 3) { spawn((Math.random() * nodes.length) | 0, -1, 0); nextPulse = t + .7 + Math.random() * 1.4; }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const q = pulses[i]; q.p += dt / q.d; if (q.p < 1) continue;
      pulses.splice(i, 1); ping[q.b] = 1;
      // A pulse often hands on to a neighbour; a chain that ends sends out a small ripple.
      if (!calm && q.hop < 3 && Math.random() < .6) spawn(q.b, q.a, q.hop + 1); else if (q.hop > 0) ripples.push({ n: q.b, p: 0 });
    }
    for (let i = 0; i < ping.length; i++) ping[i] = Math.max(0, ping[i] - dt / .9);
    for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].p += dt / 1.4) >= 1) ripples.splice(i, 1);
  }

  function orbit(o, front, al) {
    const ct = Math.cos(o.tilt), st = Math.sin(o.tilt), cr = Math.cos(o.roll), sr = Math.sin(o.roll), zr = o.r * ct;
    const at = th => { const c = Math.cos(th) * o.r, s = Math.sin(th) * o.r; return put([c * cr + s * st * sr, c * sr - s * st * cr, s * ct]); };
    const span = REDUCED ? TAU : TAU * easeOut(clamp01((t - .1) / 1.6)), N = 72; // the line draws itself in
    cx.lineWidth = .9; cx.strokeStyle = cx.fillStyle = `rgb(${o.c})`;
    let p0 = at(o.th);
    for (let k = 1; k <= N; k++) {
      const p1 = at(o.th + span * k / N), z = (p0.z + p1.z) / 2;
      if ((z > 0) === front) { cx.globalAlpha = al * o.a * (.3 + .7 * smooth(-zr, zr, z)); cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke(); }
      p0 = p1;
    }
    if (REDUCED) return;
    // A light travelling along the orbit, with a fading tail. Drawn with the half of the orbit its head is on.
    const head = o.th + o.w * t, dir = Math.sign(o.w), hp = at(head), on = al * smooth(1.2, 1.8, t);
    if ((hp.z > 0) !== front || on < .01) return;
    cx.lineWidth = 1.2; p0 = at(head - dir * .9);
    for (let k = 1; k <= 14; k++) { const p1 = at(head - dir * .9 * (1 - k / 14)); cx.globalAlpha = on * .8 * (k / 14) ** 2 * (.4 + .6 * smooth(-zr, zr, p1.z)); cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke(); p0 = p1; }
    cx.globalAlpha = on * (.55 + .45 * smooth(-zr, zr, hp.z)); cx.beginPath(); cx.arc(hp.x, hp.y, 1.5, 0, TAU); cx.fill();
  }

  // a: overall opacity. extra: orbits, pulses and ripples. hero: 0 while idle, 1 when the style matches #mol-sym
  // exactly (it rises as the network lands, so the hand-over to the SVG is invisible). While idle the purple is quieter.
  function draw(a, extra, hero) {
    // Clear only what was painted last frame plus what will be painted now.
    const h = view.s / 2, m = h * 1.5 + 16, box = [view.x - m, view.y - m, view.x + m, view.y + m];
    const c = painted ? [Math.min(painted[0], box[0]), Math.min(painted[1], box[1]), Math.max(painted[2], box[2]), Math.max(painted[3], box[3])] : [0, 0, W, H];
    cx.clearRect(c[0], c[1], c[2] - c[0], c[3] - c[1]); painted = box;
    if (a < .005) return;
    cosY = Math.cos(view.yaw); sinY = Math.sin(view.yaw); cosP = Math.cos(view.pitch); sinP = Math.sin(view.pitch);
    const P = nodes.map(n => put(turn(n))), sc = Math.max(.7, Math.min(1.3, h / 140)), mix = (v, svg) => v + (svg - v) * hero;
    if (extra > .005) ORBITS.forEach(o => orbit(o, false, a * extra));
    // Dust: the SVG's specks, fading out towards the edge of the box (all of them, at .4, once it matches the SVG).
    cx.fillStyle = `rgb(${CY})`;
    for (const d of dust) {
      const q = put(turn(d)), r = Math.hypot(q.x - view.x, q.y - view.y) / h; if (r > 1.2 + .3 * hero) continue;
      const al = a * mix(.3 * (1 - smooth(.8, 1.15, r)) * (.45 + .55 * smooth(-4.5, 4.5, q.z)), .4); if (al < .01) continue;
      cx.globalAlpha = al; cx.beginPath(); cx.arc(q.x, q.y, Math.max(.6, .0175 * q.k), 0, TAU); cx.fill();
    }
    // Bonds: one unit wide like the SVG (never under .8px); nearer ones brighter, the purple ones quieter.
    cx.lineWidth = Math.max(.8, h / 200);
    for (const [i, j] of bonds) {
      const A = P[i], B = P[j], d = smooth(-3.2, 3.2, (A.z + B.z) / 2), pu = (i + j) % 2;
      cx.globalAlpha = a * mix(pu ? .07 + .13 * d : .1 + .2 * d, .3); cx.strokeStyle = `rgb(${pu ? PU : CY})`;
      cx.beginPath(); cx.moveTo(A.x, A.y); cx.lineTo(B.x, B.y); cx.stroke();
    }
    // Pulses: a bright head with a short tail, eased along the bond in 3D so they turn with the network.
    for (const q of pulses) {
      const al = a * extra * smooth(0, .12, q.p) * (1 - smooth(.88, 1, q.p)); if (al < .01) continue;
      const A = nodes[q.a], B = nodes[q.b];
      const at = s => { const e = s <= 0 ? 0 : s >= 1 ? 1 : (1 - Math.cos(Math.PI * s)) / 2; return put(turn([A[0] + (B[0] - A[0]) * e, A[1] + (B[1] - A[1]) * e, A[2] + (B[2] - A[2]) * e])); };
      cx.lineWidth = 1.3 * sc; cx.strokeStyle = `rgb(${q.c})`;
      let p0 = at(q.p - .2);
      for (let k = 1; k <= 6; k++) { const p1 = at(q.p - .2 + .2 * k / 6); cx.globalAlpha = al * .75 * (k / 6) ** 2; cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke(); p0 = p1; }
      const g = cx.createRadialGradient(p0.x, p0.y, 0, p0.x, p0.y, 7 * sc);
      g.addColorStop(0, `rgba(${q.c},.5)`); g.addColorStop(1, `rgba(${q.c},0)`);
      cx.globalAlpha = al; cx.fillStyle = g; cx.beginPath(); cx.arc(p0.x, p0.y, 7 * sc, 0, TAU); cx.fill();
      cx.fillStyle = '#eaffff'; cx.beginPath(); cx.arc(p0.x, p0.y, 1.4 * sc, 0, TAU); cx.fill();
    }
    // Nodes, far to near: a soft halo (brighter for a moment when a pulse arrives) and the SVG's shaded core.
    // The SVG's halo is a flat disc at .12; the soft one gives way to it as the network lands.
    P.map((p, i) => i).sort((i, j) => P[i].z - P[j].z).forEach(i => {
      const p = P[i], R = .13 * p.k, HR = .27 * p.k * (1.15 + .5 * ping[i]), op = a * (.7 + .3 * smooth(-3.2, 3.2, p.z)) * (i % 2 ? mix(.72, 1) : 1);
      const g = cx.createRadialGradient(p.x, p.y, R * .5, p.x, p.y, HR);
      g.addColorStop(0, `rgba(${tint(i)},${.16 + .3 * ping[i]})`); g.addColorStop(1, `rgba(${tint(i)},0)`);
      cx.globalAlpha = op * (1 - hero); cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, HR, 0, TAU); cx.fill();
      if (hero > 0) { cx.globalAlpha = op * hero * .12; cx.fillStyle = `rgb(${tint(i)})`; cx.beginPath(); cx.arc(p.x, p.y, .27 * p.k, 0, TAU); cx.fill(); }
      const gx = p.x - .24 * R, gy = p.y - .3 * R, cg = cx.createRadialGradient(gx, gy, 0, gx, gy, 1.4 * R);
      CORE[i % 2].forEach(([o, col]) => cg.addColorStop(o, col));
      cx.globalAlpha = op; cx.fillStyle = cg; cx.beginPath(); cx.arc(p.x, p.y, R, 0, TAU); cx.fill();
    });
    if (extra > .005) ORBITS.forEach(o => orbit(o, true, a * extra));
    for (const r of ripples) {
      const p = P[r.n]; cx.globalAlpha = a * extra * .4 * (1 - r.p) ** 2; cx.strokeStyle = `rgb(${tint(r.n)})`; cx.lineWidth = .8;
      cx.beginPath(); cx.arc(p.x, p.y, .13 * p.k + (4 + 16 * easeOut(r.p)) * sc, 0, TAU); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  function frame(now) {
    if (!cv.isConnected) { window.removeEventListener('resize', onResize); return; } // the loader has been removed
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (REDUCED) t = INTRO; else step(dt);
    // The fade-in runs on the wall clock, so slow first frames can't hold the loader up.
    if (!born) born = now;
    const age = (now - born) / 1000, intro = REDUCED ? 1 : easeOut(clamp01(age / INTRO)), amp = REDUCED ? 0 : smooth(0, 1.2, t);
    let a = intro, extra = 1, hero = 0, finished = null;
    if (fly) { // glide to the hero molecule while the sway eases back to the resting angle
      const u = clamp01((now - fly.t0) / fly.ms), e = easeInOut(u);
      for (const k in fly.to) view[k] = fly.from[k] + (fly.to[k] - fly.from[k]) * e;
      extra = 1 - smooth(0, .4, u); hero = smooth(.35, 1, u); if (u >= 1) finished = fly;
    } else {
      view.x = home.x; view.y = home.y; view.s = home.s * (.92 + .08 * intro);
      view.yaw = amp * .5 * Math.sin(TAU * t / 11); view.pitch = amp * .15 * Math.sin(TAU * t / 8 + .8);
      if (fade) { const u = clamp01((now - fade.t0) / fade.ms); a *= 1 - easeOut(u); view.s *= 1 - .04 * u; if (u >= 1) finished = fade; }
    }
    draw(a, extra, hero);
    if (age >= INTRO || REDUCED) revealed();
    if (finished) { finished.res(); return; } // the last frame stays on the canvas
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(now => { last = now; frame(now); });

  return {
    canvas: cv, shown,
    fly: (rect, ms) => new Promise(res => { fly = { from: { ...view }, to: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, s: rect.width, yaw: 0, pitch: 0 }, t0: performance.now(), ms, res }; }),
    fadeOut: ms => new Promise(res => { fade = { t0: performance.now(), ms, res }; })
  };
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
  // Instead: stop while the tab is hidden or the loader covers the page, and run at ~30 fps once past the hero.
  let skip = false;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden || introCovers) return;
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
    // Spin up from rest over ~3 s, so the 3D molecule lines up with the SVG while they cross-fade.
    t += .008; const ramp = Math.min(1, t / 1.6), spin = ramp * ramp * (3 - 2 * ramp);
    bY += .004 * spin; bX += .0014 * spin; smx += (mx - smx) * .04; smy += (my - smy) * .04;
    grp.rotation.y = bY + smx * .45 * spin; grp.rotation.x = bX + smy * .3 * spin;
    cL.intensity = 2.4 + Math.sin(t * 1.7) * .9; pL.intensity = 2.4 + Math.cos(t * 1.3) * .9;
    ms.forEach((m, i) => { m.material.emissiveIntensity = .6 + Math.sin(t + i * .72) * .25; });
    R.render(scene, cam);
    if (!shown) { shown = true; wrap.classList.add('mol-3d'); } // cross-fade from the SVG after the first real frame
  }
  loop();
  window.addEventListener('resize', () => { const s = size(); R.setSize(s.w, s.h, false); cam.aspect = s.w / s.h; cam.updateProjectionMatrix(); });
}

/* ── LOADER: READY, THEN LEAVE ────────────── */
// The head script chooses `intro-play` (entering the site) or `intro-skip` (reload, arrival from another page of
// the site, reduced motion, or the failsafe already showed the page).
// The loader leaves as soon as the page is ready: the DOM is parsed (this script is deferred), the web fonts have
// loaded, and the window `load` event has fired. No timer holds it. The only floor is the short identity reveal,
// so the screen never flashes, and READY_CAP stops a slow asset from holding it longer.
const READY_CAP = 4000;
function playIntro() {
  window.__mainRan = true; // tells the head failsafe that the intro is handled from here
  const loader = $('#loader'); if (!loader) { finishIntro(); return; }
  let net = null;
  try { net = initLoaderNet(); } catch (e) { console.error(e); } // without the network the loader still works
  const settle = p => Promise.resolve(p).catch(() => {});
  const fonts = document.fonts ? settle(document.fonts.ready) : null;
  const loaded = document.readyState === 'complete' ? null : new Promise(r => window.addEventListener('load', r, { once: true }));
  const prog = $('.l-progress'), reveal = prog && prog.getAnimations ? Promise.all(prog.getAnimations().map(a => settle(a.finished))) : null;
  const cap = new Promise(r => setTimeout(r, READY_CAP));
  Promise.race([Promise.all([fonts, loaded, reveal, net && net.shown]), cap]).then(ready);
  setTimeout(finishIntro, READY_CAP + 3000); // last resort: never leave the page covered

  let leaving = false;
  function ready() {
    if (leaving || window.__introDone) return; leaving = true;
    const status = $('.l-status'); if (status) status.textContent = 'Ready'; // announced by the live region
    loader.classList.add('is-ready');
    setTimeout(leave, 160); // a beat for the completed bar to register
  }
  function leave() {
    if (window.__introDone) return;
    const page = $('#page-content'), heroMol = $('#hero-mol');
    loader.classList.add('is-leaving'); // CSS fades the backdrop, charts and text
    introCovers = false; // the page shows through from now on
    if (page) { page.style.transition = 'opacity .6s ease .1s'; page.style.opacity = '1'; } // after the name has mostly gone
    // Settle into the hero molecule only if it is on screen (not when the page opened at a #section, or the hero
    // sits below the fold on a short landscape screen). Otherwise the network just fades.
    const to = heroMol && heroMol.getBoundingClientRect();
    const heroOnScreen = !!to && to.width > 0 && to.bottom > 0 && to.top < innerHeight && to.right > 0 && to.left < innerWidth;
    let done = false;
    const end = () => { if (done) return; done = true; window.removeEventListener('resize', end); finishIntro(); };
    window.addEventListener('resize', end); // the measured target is stale after a resize: finish now
    if (net && heroOnScreen && !REDUCED) {
      net.fly(to, 800).then(() => {
        // The canvas now matches #hero-mol exactly (place, size and angle): show the SVG beneath it, fade the canvas.
        heroMol.style.visibility = 'visible';
        net.canvas.style.transition = 'opacity .25s ease'; net.canvas.style.opacity = '0';
        setTimeout(end, 260);
      });
    } else {
      if (net) net.fadeOut(450);
      setTimeout(end, 600);
    }
    setTimeout(end, 1600); // backstop, e.g. if the tab goes to the background and frames stop
  }
}

function finishIntro() {
  window.__mainRan = true;
  if (window.__introDone) return;
  window.__introDone = true; introCovers = false;
  ROOT.classList.remove('intro-play'); ROOT.classList.add('intro-done');
  const loader = $('#loader'); if (loader) loader.remove();
  const page = $('#page-content'); if (page) { page.style.opacity = ''; page.style.transition = ''; }
  const heroMol = $('#hero-mol'); if (heroMol) heroMol.style.visibility = '';
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
