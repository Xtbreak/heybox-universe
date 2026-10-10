// Epilogue particle field: thousands of points swirl and re-form into a new
// shape for each hovered link. Colour follows speed, so every morph glows.
const MARK = 'M228 87Q228 80 234 84L387 172Q395 176 395 184V327Q395 335 388 339L346 364Q339 368 339 360V219Q339 211 332 207L291 183Q283 178 283 186V220Q283 228 275 228H236Q228 228 228 220Z';
const FONT = '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';

function sampleShape(draw, count) {
  const w = 360, h = 220, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; draw(g, w, h);
  const data = g.getImageData(0, 0, w, h).data, hits = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 120) hits.push(x, y);
  const out = new Float32Array(count * 2), n = hits.length / 2;
  let s = 7331; const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const k = n ? Math.floor(rnd() * n) * 2 : 0;
    out[i * 2] = ((n ? hits[k] : w / 2) + rnd() * 2 - w / 2) / h;
    out[i * 2 + 1] = ((n ? hits[k + 1] : h / 2) + rnd() * 2 - h / 2) / h;
  }
  return out;
}
const text = (value, size = 150) => (g, w, h) => {
  g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fit = size; while (g.measureText(value).width > w * .92 && fit > 20) g.font = `900 ${fit -= 6}px ${FONT}`;
  g.fillText(value, w / 2, h / 2 + 6);
};
const SHAPES = {
  mark: (g, w, h) => {
    const p = new Path2D(MARK), scale = h * .9 / 408;
    g.save(); g.translate(w / 2, h / 2); g.scale(scale, scale); g.translate(-256, -256);
    g.fill(p); g.translate(256, 256); g.rotate(Math.PI); g.translate(-256, -256); g.fill(p); g.restore();
  },
  brand: text('小黑盒'),
  helmet: text('SOS'),
  robot: text('S-07'),
  car: text('PARK'),
  credits: text('3D'),
  up: (g, w, h) => { g.beginPath(); g.moveTo(w / 2, h * .06); g.lineTo(w / 2 + h * .36, h * .48); g.lineTo(w / 2 + h * .13, h * .48); g.lineTo(w / 2 + h * .13, h * .94); g.lineTo(w / 2 - h * .13, h * .94); g.lineTo(w / 2 - h * .13, h * .48); g.lineTo(w / 2 - h * .36, h * .48); g.closePath(); g.fill(); }
};

export function createParticleMorph({ canvas, triggers = [], coarse = false }) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return { dispose() {} };
  const COUNT = coarse ? 1500 : 3200;
  const targets = {}; const shape = name => (targets[name] ||= sampleShape(SHAPES[name] || SHAPES.mark, COUNT));
  const px = new Float32Array(COUNT), py = new Float32Array(COUNT), vx = new Float32Array(COUNT), vy = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  let width = 1, height = 1, dpr = 1, raf = 0, visible = false, current = 'mark', morphAt = -9, pointer = { x: -1e4, y: -1e4 };
  for (let i = 0; i < COUNT; i++) { const a = Math.random() * Math.PI * 2, r = Math.random(); px[i] = Math.cos(a) * r * 3; py[i] = Math.sin(a) * r * 3; seed[i] = Math.random(); }
  function resize() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    width = Math.max(1, r.width); height = Math.max(1, r.height); canvas.width = width * dpr; canvas.height = height * dpr;
  }
  function morph(name) {
    if (!SHAPES[name] || name === current) return;
    current = name; morphAt = performance.now() / 1000;
    // A tangential kick makes particles orbit before they settle.
    for (let i = 0; i < COUNT; i++) { const s = (seed[i] - .5) * 2.4; vx[i] += -py[i] * s; vy[i] += px[i] * s; }
  }
  const palette = ['#5f8ea6', '#9fd8f2', '#e4f7ff', '#ffd2f4'];
  const buckets = palette.map(() => []);
  let last = performance.now();
  function frame(nowMs) {
    raf = 0; if (!visible) return;
    const now = nowMs / 1000, dt = Math.min(.033, (nowMs - last) / 1000); last = nowMs;
    const target = shape(current), scale = Math.min(height * .78, width * .5), cx = width / 2, cy = height / 2;
    const glow = Math.max(0, 1 - (now - morphAt) / 1.4), mx = (pointer.x - cx) / scale, my = (pointer.y - cy) / scale;
    buckets.forEach(b => (b.length = 0));
    for (let i = 0; i < COUNT; i++) {
      const tx = target[i * 2], ty = target[i * 2 + 1], s = seed[i];
      const k = 9 + s * 7, swirl = Math.sin(now * .7 + s * 40) * .012;
      let ax = (tx - px[i]) * k - py[i] * swirl * 6, ay = (ty - py[i]) * k + px[i] * swirl * 6;
      const dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
      if (d2 < .05) { const f = (.05 - d2) * 260; ax += dx * f; ay += dy * f; }
      vx[i] = (vx[i] + ax * dt) * (1 - dt * (4.2 + s * 2)); vy[i] = (vy[i] + ay * dt) * (1 - dt * (4.2 + s * 2));
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      const speed = Math.hypot(vx[i], vy[i]);
      buckets[speed > 1.6 ? 3 : speed > .7 ? 2 : speed > .18 || s > .82 ? 1 : 0].push(i);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(4,8,12,.34)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const size = 1.25 + glow * .9;
    buckets.forEach((list, b) => {
      ctx.fillStyle = palette[b]; ctx.globalAlpha = b === 0 ? .55 : .8 + glow * .2;
      const z = size * (b === 3 ? 1.5 : b === 2 ? 1.25 : 1);
      for (const i of list) ctx.fillRect(cx + px[i] * scale - z / 2, cy + py[i] * scale - z / 2, z, z);
    });
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { resize(); last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(canvas);
  const listeners = [];
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); listeners.push(() => el.removeEventListener(type, fn, opt)); };
  on(window, 'resize', resize);
  on(canvas.parentElement || canvas, 'pointermove', e => { const r = canvas.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; }, { passive: true });
  on(canvas.parentElement || canvas, 'pointerleave', () => { pointer = { x: -1e4, y: -1e4 }; });
  for (const el of triggers) {
    const name = el.dataset.morph;
    on(el, 'pointerenter', () => morph(name)); on(el, 'focus', () => morph(name));
    on(el, 'pointerleave', () => morph('mark')); on(el, 'blur', () => morph('mark'));
  }
  return { morph, dispose() { cancelAnimationFrame(raf); io.disconnect(); listeners.forEach(d => d()); } };
}
