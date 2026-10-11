// Scroll-velocity driven page layer: giant lettering drifts and shears with
// speed, copy lines rise in when a chapter arrives, counters run once per visit
// and a light ribbon follows a fine pointer. The 3D camera is never touched.
export function createScrollFx({ root = document, isPaused = () => false } = {}) {
  const body = root.body, view = root.defaultView || globalThis;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const disposers = [];
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); disposers.push(() => target.removeEventListener(type, fn, options)); };

  // Lines separated by <br> become independently masked rows.
  for (const el of root.querySelectorAll('.frame .body-copy, [data-lines]')) {
    const rows = [[]];
    for (const node of [...el.childNodes]) { if (node.nodeName === 'BR') rows.push([]); else rows.at(-1).push(node); }
    el.textContent = '';
    rows.filter(row => row.some(n => n.textContent.trim())).forEach((row, i) => {
      const line = root.createElement('span'), inner = root.createElement('span');
      line.className = 'line'; inner.style.setProperty('--i', i); row.forEach(n => inner.appendChild(n));
      line.appendChild(inner); el.appendChild(line);
    });
  }

  const counters = [...root.querySelectorAll('[data-count]')];
  function runCounter(el) {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    const to = Number(el.dataset.count) || 0, pad = Number(el.dataset.pad) || 0, start = performance.now(), dur = 1300;
    const format = n => (to >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)).padStart(pad, '0'));
    const step = now => { const t = clamp((now - start) / dur), e = 1 - Math.pow(1 - t, 4); el.textContent = format(to * e); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const reveals = [...root.querySelectorAll('#journey > .frame, [data-reveal]')];
  const io = new IntersectionObserver(items => {
    for (const item of items) {
      item.target.classList.toggle('in-view', item.isIntersecting);
      if (item.isIntersecting) item.target.querySelectorAll('[data-count]').forEach(runCounter);
      else item.target.querySelectorAll('[data-count]').forEach(el => { delete el.dataset.counted; });
    }
  }, { rootMargin: '-18% 0px -18% 0px' });
  reveals.forEach(el => io.observe(el));

  const frames = [...root.querySelectorAll('#journey > .frame, #epilogue')];
  const pill = root.querySelector('#speed-pill'), pillValue = pill?.querySelector('b');
  let lastY = view.scrollY, lastT = performance.now(), velocity = 0, raf = 0, quietFrames = 0;
  function tick(now) {
    raf = 0;
    const dt = Math.max(.001, Math.min(.1, (now - lastT) / 1000)), y = view.scrollY;
    const raw = isPaused() ? 0 : (y - lastY) / dt;
    lastY = y; lastT = now;
    velocity += (raw - velocity) * (1 - Math.exp(-dt * 7));
    const n = clamp(velocity / 3200, -1, 1);
    body.style.setProperty('--vel', n.toFixed(4));
    body.style.setProperty('--speed', Math.abs(n).toFixed(4));
    const vh = view.innerHeight;
    for (const frame of frames) {
      const r = frame.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) continue;
      frame.style.setProperty('--local', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
    }
    if (pillValue) pillValue.textContent = String(Math.min(999, Math.round(Math.abs(velocity) / 10))).padStart(3, '0');
    pill?.classList.toggle('surging', Math.abs(n) > .28);
    quietFrames = Math.abs(velocity) < 2 ? quietFrames + 1 : 0;
    if (quietFrames < 20) raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf) { lastT = performance.now(); lastY = view.scrollY; quietFrames = 0; raf = requestAnimationFrame(tick); } };
  on(view, 'scroll', wake, { passive: true }); on(view, 'resize', wake);
  wake();

  // Ice-blue light ribbon. pointer-events:none keeps 3D hover hit-testing exact.
  const trail = root.querySelector('#pointer-trail'), ctx = trail?.getContext('2d');
  const fine = view.matchMedia?.('(pointer: fine)').matches;
  const points = []; let trailRaf = 0, dpr = 1;
  function sizeTrail() { if (!trail) return; dpr = Math.min(2, view.devicePixelRatio || 1); trail.width = innerWidth * dpr; trail.height = innerHeight * dpr; }
  function drawTrail() {
    trailRaf = 0; if (!ctx) return;
    const now = performance.now();
    while (points.length && now - points[0].t > 420) points.shift();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, trail.width, trail.height);
    if (points.length > 2) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], life = 1 - (now - b.t) / 420, k = i / points.length;
        ctx.strokeStyle = `hsla(198,70%,${72 + k * 18}%,${life * k * .4})`;
        ctx.lineWidth = 1 + k * 2.5 * life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    if (points.length) trailRaf = requestAnimationFrame(drawTrail);
    else ctx.clearRect(0, 0, trail.width, trail.height);
  }
  if (trail && ctx && fine) {
    sizeTrail(); on(view, 'resize', sizeTrail);
    on(view, 'pointermove', event => {
      if (body.classList.contains('exploring') || event.pointerType !== 'mouse') return;
      points.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      if (points.length > 40) points.shift();
      if (!trailRaf) trailRaf = requestAnimationFrame(drawTrail);
    }, { passive: true });
  }

  return {
    getVelocity: () => velocity,
    dispose() { cancelAnimationFrame(raf); cancelAnimationFrame(trailRaf); io.disconnect(); disposers.forEach(d => d()); }
  };
}
