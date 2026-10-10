/**
 * A light wheel damper plus user-driven chapter magnets. Camera progress stays
 * continuous: there is no CSS scroll-snap, page-sized wheel lock or scroll loop.
 * Pixel-precise / high-frequency trackpad gestures keep their native momentum.
 * Only real user scrolling arms a magnet; restore, navigation and game entry do
 * not. Call holdUntilUserScroll() before body locking and restorePosition(y)
 * after unlocking. onState publishes CSS px/sec velocity and entry stability.
 */
export function createIdleWorldSnap({
  getEnabled = () => true,
  getReducedMotion = () => false,
  window: view = globalThis.window,
  document: doc = view?.document,
  onState = () => {},
  stableDelay = 250,
  idleDelay = 300,
  duration = 440,
  wheelDuration = 230,
} = {}) {
  if (!view || !doc) {
    const getState = () => ({ stable: false, scrolling: false, snapping: false, velocity: 0, held: true });
    return { cancel() {}, dispose() {}, holdUntilUserScroll() {}, restorePosition() {}, getState, isSettling: () => false };
  }
  // Never weaken the entry safety window through an application option.
  stableDelay = Math.min(400, Math.max(250, Number(stableDelay) || 250));
  idleDelay = Math.min(600, Math.max(stableDelay + 50, Number(idleDelay) || 300));

  // These poses put the cinematic titles over the intended camera composition.
  // The last section uses its *reachable* bottom; sample.js maps that to p = 1.
  const poses = { dive: .19, warp: .285, equipment: .395, drift: .495,
    companion: .600, 'time-rift': .715, drive: .835 };
  const epsilon = 1;
  const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar', 'Space']);
  const heldKeys = new Set(), listeners = [];
  const now = () => view.performance.now();
  const readY = () => Number(view.scrollY ?? view.pageYOffset) || 0;
  const readX = () => Number(view.scrollX ?? view.pageXOffset) || 0;
  const maxY = () => Math.max(0, doc.documentElement.scrollHeight - view.innerHeight);
  const clampY = y => Math.max(0, Math.min(maxY(), y));
  let disposed = false, idleTimer = null, animation = null, raf = null;
  let restoreStyles = null, writing = false, lastOwnY = null, lastObservedY = readY();
  let lastActivity = -Infinity, lastInput = -Infinity, cooldownUntil = -Infinity;
  let intent = false, armed = false, touches = 0, mouseDown = false, direction = 0;
  let departed = null, wheelAt = -Infinity, wheelMagnitude = 0, nativeUntil = -Infinity;

  let stateTimer = null, stateY = readY(), stateAt = now(), velocity = 0;
  let quietSince = now(), lastState = null, held = false, heldY = null;
  let wheelGestureAt = -Infinity, returnWheelAt = -Infinity, freshTouch = false;

  function stateValue() {
    const snapping = animation?.kind === 'snap';
    const scrolling = !!animation || Math.abs(velocity) >= 5 || touches > 0 || mouseDown || heldKeys.size > 0;
    return { stable: !disposed && allowed(false) && !scrolling && !armed && now() - quietSince >= stableDelay,
      scrolling: !!scrolling, snapping, velocity, held };
  }
  function publishState() {
    const state = stateValue();
    if (!lastState || Object.keys(state).some(key => state[key] !== lastState[key])) {
      lastState = state;
      onState({ ...state });
    }
    return { ...state };
  }
  function sampleState() {
    stateTimer = null;
    const time = now(), y = readY(), elapsed = time - stateAt;
    if (elapsed > 0) velocity = (y - stateY) * 1000 / elapsed;
    stateY = y; stateAt = time;
    if (Math.abs(velocity) >= 5 || animation || touches || mouseDown || heldKeys.size) quietSince = time;
    publishState();
    if (!disposed && (animation || armed || touches || mouseDown || heldKeys.size || time - quietSince < stableDelay)) {
      stateTimer = view.setTimeout(sampleState, 50);
    }
  }
  function noteMotion() {
    quietSince = now();
    if (stateTimer === null && !disposed) stateTimer = view.setTimeout(sampleState, 50);
    publishState();
  }
  function getState() {
    // Also refresh guards when an app changes state without a DOM event.
    return publishState();
  }
  function holdUntilUserScroll() {
    clearGesture(); departed = null; direction = 0;
    touches = 0; mouseDown = false; heldKeys.clear(); freshTouch = false;
    held = true; heldY = readY(); returnWheelAt = wheelGestureAt;
    wheelAt = -Infinity; wheelMagnitude = 0; nativeUntil = -Infinity;
    velocity = 0; stateY = readY(); stateAt = now();
    noteMotion();
  }
  function restorePosition(y) {
    holdUntilUserScroll();
    holdInstantScroll(); writeY(Number.isFinite(Number(y)) ? Number(y) : readY());
    restoreStyles?.(); restoreStyles = null;
    heldY = readY(); stateY = heldY; stateAt = now();
    noteMotion();
    return heldY;
  }
  function releaseHold(event) {
    if (!held) return true;
    if (event?.isTrusted === false || nativeSurface(event?.target) || !allowed(false)) return false;
    held = false; heldY = null; cooldownUntil = -Infinity;
    noteMotion();
    return true;
  }

  function listen(target, type, handler, options = { passive: true, capture: true }) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function textEntry(element) {
    return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName || '') ||
      !!element.closest?.('[contenteditable=""], [contenteditable="true"], [role="textbox"]'));
  }
  function allowed(motion = true) {
    if (disposed || !getEnabled() || (motion && getReducedMotion()) || doc.hidden || doc.visibilityState === 'hidden' ||
        (doc.hasFocus && !doc.hasFocus()) || textEntry(doc.activeElement)) return false;
    if (doc.body?.style.position === 'fixed' || doc.body?.style.overflowY === 'hidden' ||
        doc.body?.classList.contains('exploring') || doc.pointerLockElement) return false;
    if (doc.querySelector?.('#audio-settings[open], dialog[open], [aria-modal="true"]:not([hidden])')) return false;
    const selection = doc.getSelection?.();
    return !selection || selection.isCollapsed !== false;
  }
  function nativeSurface(target) {
    if (textEntry(target) || target?.closest?.('#audio-tools, #play-hud, dialog, [role="dialog"], [data-scroll-native]')) return true;
    // A scrollable panel retains its wheel even at an edge; never steal its input.
    for (let el = target?.nodeType === 1 ? target : target?.parentElement;
      el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /^(auto|scroll|overlay)$/.test(view.getComputedStyle?.(el)?.overflowY || '')) return true;
    }
    return false;
  }
  function anchors() {
    const y = readY(), vh = Number(view.innerHeight) || 0, endY = maxY();
    if (vh <= 0) return [];
    return [...doc.querySelectorAll('#journey > .frame')].map((section, index, all) => {
      const height = section.offsetHeight, top = section.getBoundingClientRect().top + y;
      const start = Number(section.dataset.p), end = Number(section.dataset.end);
      if (!(height > 0 && end > start)) return null;
      const progress = poses[section.id] ?? (start + end) / 2;
      const anchor = index === 0 ? 0 : index === all.length - 1 ? endY :
        top - vh * .2 + (progress - start) / (end - start) * height;
      return { id: section.id, y: clampY(anchor), top, height };
    }).filter(Boolean);
  }
  function clearIdle() {
    if (idleTimer !== null) view.clearTimeout(idleTimer);
    idleTimer = null;
  }
  function stopAnimation() {
    if (raf !== null) view.cancelAnimationFrame(raf);
    raf = null; animation = null;
    restoreStyles?.(); restoreStyles = null;
  }
  function clearGesture() {
    clearIdle(); stopAnimation(); armed = false; intent = false;
    lastOwnY = null; lastObservedY = readY();
    noteMotion();
  }
  function cancel({ cooldown = 600 } = {}) {
    clearGesture(); departed = null; direction = 0;
    cooldownUntil = Math.max(cooldownUntil, now() + Math.max(0, Number(cooldown) || 0));
  }
  function holdInstantScroll() {
    if (restoreStyles) return;
    const saved = [doc.documentElement, doc.body].filter(Boolean).map(element => {
      const style = element.style, value = style.getPropertyValue('scroll-behavior');
      const priority = style.getPropertyPriority('scroll-behavior');
      style.setProperty('scroll-behavior', 'auto', 'important');
      return { style, value, priority };
    });
    restoreStyles = () => {
      for (const { style, value, priority } of saved) {
        if (style.getPropertyValue('scroll-behavior') !== 'auto' || style.getPropertyPriority('scroll-behavior') !== 'important') continue;
        if (value) style.setProperty('scroll-behavior', value, priority);
        else style.removeProperty('scroll-behavior');
      }
    };
  }
  function writeY(y) {
    writing = true;
    try {
      view.scrollTo({ left: readX(), top: clampY(y), behavior: 'instant' });
      lastOwnY = readY(); lastObservedY = lastOwnY;
    } finally { writing = false; }
  }
  function noteDirection(next, y = readY(), canDepart = true) {
    if (!next) return;
    if (direction && next !== direction) departed = null;
    direction = next;
    const landed = anchors().find(anchor => Math.abs(anchor.y - y) <= Math.max(2, view.innerHeight * .025));
    // Leaving a settled chapter releases its magnet until the user reverses.
    // This is what lets several small, separated wheel ticks make progress.
    if (canDepart && landed) departed = { id: landed.id, direction: next };
  }
  function targetAt(y) {
    const vh = view.innerHeight, radius = Math.min(620, vh * .70);
    let nearest = null;
    for (const anchor of anchors()) {
      if (departed?.id === anchor.id && departed.direction === direction) continue;
      // A release may finish a few pixels past its target, but never pull the
      // camera a sizeable distance against the user's latest scroll direction.
      if (direction && (anchor.y - y) * direction < -Math.min(48, vh * .05)) continue;
      if (y < anchor.top - vh * .48 || y > anchor.top + anchor.height - vh * .35) continue;
      const distance = Math.abs(anchor.y - y);
      // Bounded capture never crosses a whole intervening cinematic chapter.
      if (distance > radius) continue;
      if (!nearest || distance < nearest.distance) nearest = { ...anchor, distance };
    }
    return nearest;
  }
  function runFrame() {
    raf = null;
    const current = animation;
    if (!current) return;
    if (!allowed() || touches || mouseDown || heldKeys.size) { clearGesture(); return; }
    // Native scrollbars, accessibility navigation and newer script navigation win.
    if (Math.abs(readY() - (lastOwnY ?? current.from)) > epsilon) { clearGesture(); return; }
    let finished;
    if (current.kind === 'wheel') {
      advanceWheel(current, now());
      finished = Math.abs(current.to - current.position) < .15 && Math.abs(current.speed) < 2;
      writeY(finished ? current.to : current.position);
    } else {
      const t = Math.min(1, Math.max(0, (now() - current.started) / current.duration));
      // Idle attraction starts and ends at rest, without the old cubic's kick.
      const eased = t * t * t * (10 + t * (-15 + 6 * t));
      finished = t >= 1;
      writeY(finished ? current.to : current.from + (current.to - current.from) * eased);
    }
    if (!finished) { raf = view.requestAnimationFrame(runFrame); return; }
    stopAnimation();
    noteMotion();
    if (current.kind === 'wheel') { lastActivity = now(); schedule(); }
    else { armed = false; intent = false; departed = null; }
  }
  // Exact critically damped solution: target changes retain both position and
  // velocity, and the same trajectory is sampled at 30/60/120 Hz. No per-frame
  // lerp or elapsed-time clamp that makes slower displays travel differently.
  function advanceWheel(current, time) {
    const dt = Math.max(0, (time - current.updated) / 1000);
    const omega = 5.5 / (Math.max(100, wheelDuration) / 1000);
    const offset = current.position - current.to;
    const coefficient = current.speed + omega * offset;
    const decay = Math.exp(-omega * dt);
    current.position = current.to + (offset + coefficient * dt) * decay;
    current.speed = (current.speed - omega * coefficient * dt) * decay;
    current.updated = time;
  }
  function startAnimation(kind, to, milliseconds, id = null) {
    const from = readY();
    stopAnimation(); holdInstantScroll(); lastOwnY = from;
    animation = { kind, from, to: clampY(to), started: now(), duration: Math.max(1, milliseconds), id, position: from, speed: 0, updated: now() };
    noteMotion();
    raf = view.requestAnimationFrame(runFrame);
  }
  function settle() {
    idleTimer = null;
    if (held || !armed || !allowed() || animation || touches || mouseDown || heldKeys.size || now() < cooldownUntil) return;
    const remaining = idleDelay - (now() - lastActivity);
    if (remaining > 0) { idleTimer = view.setTimeout(settle, remaining); return; }
    armed = false; intent = false;
    const target = targetAt(readY());
    if (!target || target.distance <= epsilon) return;
    startAnimation('snap', target.y, Math.min(580, Math.max(260, duration * Math.sqrt(target.distance / 400))), target.id);
  }
  function schedule() {
    clearIdle();
    if (held || !armed || !allowed() || animation || touches || mouseDown || heldKeys.size || now() < cooldownUntil) return;
    idleTimer = view.setTimeout(settle, Math.max(0, idleDelay - (now() - lastActivity)));
  }
  function input(event, isScrollIntent = true, nextDirection = 0, preserveWheel = false) {
    const wasArmed = armed;
    clearIdle();
    if (!preserveWheel) stopAnimation();
    lastActivity = now(); lastInput = lastActivity;
    noteMotion();
    const accept = !held && event?.isTrusted !== false && isScrollIntent && !nativeSurface(event?.target) && allowed() && now() >= cooldownUntil;
    intent = accept; armed = accept && wasArmed;
    if (accept) noteDirection(nextDirection);
    schedule();
    return accept;
  }
  function discreteWheel(event) {
    const mode = Number(event.deltaMode) || 0, magnitude = Math.abs(event.deltaY), time = now();
    if (mode === 1 || mode === 2) { wheelAt = time; wheelMagnitude = magnitude; return true; }
    const gap = time - wheelAt, previous = wheelMagnitude;
    wheelAt = time; wheelMagnitude = magnitude;
    // WheelEvent has no reliable device identity. Be conservative: precise or
    // varying high-frequency pixel streams remain native for their whole tail.
    const precise = magnitude < 50 || !Number.isInteger(magnitude) ||
      (gap < 45 && Math.abs(magnitude - previous) > 1);
    if (precise) nativeUntil = time + 240;
    if (time < nativeUntil) return false;
    return [60, 80, 100, 120, 125, 150].some(unit => magnitude >= unit && Math.abs(magnitude / unit - Math.round(magnitude / unit)) < .001);
  }
  function onWheel(event) {
    const dy = Number(event.deltaY) || 0, dx = Number(event.deltaX) || 0;
    const usable = dy && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && Math.abs(dy) > Math.abs(dx);
    const time = now(), wheelGap = time - wheelGestureAt;
    wheelGestureAt = time;
    if (held) {
      // Browsers do not identify momentum packets. A wheel stream with no
      // 250ms quiet boundary is conservatively treated as the previous gesture.
      const fresh = usable && time - returnWheelAt >= stableDelay && wheelGap >= stableDelay;
      returnWheelAt = time;
      if (!fresh || !releaseHold(event)) {
        if (usable && event.cancelable && !nativeSurface(event.target) && allowed(false)) event.preventDefault();
        return;
      }
    }
    const damped = usable && event.cancelable && discreteWheel(event);
    const wasWheel = animation?.kind === 'wheel', previousTarget = animation?.to;
    const previousDirection = direction;
    const preserveWheel = wasWheel && damped && event?.isTrusted !== false &&
      !nativeSurface(event.target) && allowed() && now() >= cooldownUntil;
    const accept = input(event, !!usable, Math.sign(dy), preserveWheel);
    if (!accept || !damped) return;
    const y = readY(), sign = Math.sign(dy);
    if ((sign < 0 && y <= epsilon) || (sign > 0 && y >= maxY() - epsilon)) return;
    event.preventDefault();
    if (!event.defaultPrevented) return;
    const vh = view.innerHeight, mode = Number(event.deltaMode) || 0;
    const amount = mode === 2 ? Math.min(vh * 1.5, Math.abs(dy) * vh * .85) :
      Math.min(230, Math.max(110, vh * .22)) * Math.sqrt(Math.min(4, Math.max(.4, Math.abs(dy) / (mode === 1 ? 3 : 100))));
    const base = wasWheel && previousDirection === sign ? previousTarget : y;
    // Keep the input queue short. Reversing direction discards the old tail.
    const to = clampY(Math.max(y - vh * .9, Math.min(y + vh * .9, base + amount * sign)));
    armed = true; intent = true;
    if (preserveWheel) {
      // Integrate the old target up to this packet before changing the target.
      // Reversal discards queued distance, but decelerates existing velocity.
      advanceWheel(animation, time);
      animation.to = to;
    } else startAnimation('wheel', to, wheelDuration);
  }
  function onScroll() {
    const y = readY();
    if (writing) { lastObservedY = y; return; }
    if (heldY !== null) heldY = clampY(heldY);
    if (held && heldY !== null && Math.abs(y - heldY) > .01 && allowed(false)) {
      // Drop native momentum/history/focus scroll after restoring the snapshot.
      holdInstantScroll(); writeY(heldY); restoreStyles?.(); restoreStyles = null;
      noteMotion(); return;
    }
    if (Math.abs(y - stateY) > .01) noteMotion();
    if (writing || (lastOwnY !== null && Math.abs(y - lastOwnY) <= epsilon)) { lastObservedY = y; return; }
    lastOwnY = null;
    if (animation) { clearGesture(); return; }
    const delta = y - lastObservedY, oldY = lastObservedY;
    lastObservedY = y;
    if (Math.abs(delta) <= .01) return;
    const staleIntent = !armed && !touches && !mouseDown && !heldKeys.size && now() - lastInput > Math.max(300, idleDelay * 2);
    if (!intent || staleIntent || !allowed() || now() < cooldownUntil) { clearIdle(); armed = false; intent = false; return; }
    noteDirection(Math.sign(delta), oldY, !armed);
    armed = true; lastActivity = now(); schedule();
  }
  function onKeyDown(event) {
    const key = event.key || event.code;
    const find = ((event.ctrlKey || event.metaKey) && ['f', 'g'].includes(String(key).toLowerCase())) || key === 'F3' || key === '/' || key === "'";
    if (find || key === 'Escape') { cancel({ cooldown: 900 }); return; }
    if (!scrollKeys.has(key)) return;
    if (event.ctrlKey || event.metaKey || event.altKey || nativeSurface(event.target)) { input(event, false); return; }
    if (!releaseHold(event)) return;
    heldKeys.add(key);
    input(event, true, ['ArrowUp', 'PageUp', 'Home'].includes(key) || ([' ', 'Spacebar', 'Space'].includes(key) && event.shiftKey) ? -1 : 1);
  }
  function onKeyUp(event) {
    if (!heldKeys.delete(event.key || event.code)) return;
    lastActivity = now(); schedule();
  }
  function onNavigation(event) {
    const anchor = event.target?.closest?.('a[href]'), href = anchor?.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(href, view.location.href);
      if (url.hash && url.origin === view.location.origin && url.pathname === view.location.pathname && url.search === view.location.search) cancel({ cooldown: 900 });
    } catch { /* A custom protocol is not journey navigation. */ }
  }

  listen(view, 'scroll', onScroll);
  listen(view, 'wheel', onWheel, { passive: false, capture: true });
  listen(view, 'touchstart', event => { freshTouch = event.isTrusted !== false && !nativeSurface(event.target); touches = event.touches?.length ?? 1; input(event); });
  listen(view, 'touchmove', event => { if (held && freshTouch && releaseHold(event)) input(event); touches = event.touches?.length ?? touches; lastActivity = now(); clearIdle(); noteMotion(); });
  listen(view, 'touchend', event => { touches = event.touches?.length ?? 0; lastActivity = now(); schedule(); });
  listen(view, 'touchcancel', () => { touches = 0; cancel({ cooldown: 220 }); });
  listen(view, 'mousedown', event => {
    const scrollbar = event.button === 0 && Number.isFinite(event.clientX) && doc.documentElement.clientWidth > 0 && event.clientX >= doc.documentElement.clientWidth;
    if (scrollbar) releaseHold(event);
    mouseDown = true; input(event, event.button === 0);
  });
  listen(view, 'mouseup', () => { mouseDown = false; lastActivity = now(); schedule(); });
  listen(view, 'keydown', onKeyDown); listen(view, 'keyup', onKeyUp);
  listen(doc, 'click', onNavigation);
  listen(doc, 'focusin', event => { if (textEntry(event.target) || nativeSurface(event.target)) cancel(); });
  listen(doc, 'beforematch', () => cancel({ cooldown: 900 }));
  listen(doc, 'visibilitychange', () => { touches = 0; mouseDown = false; heldKeys.clear(); cancel(); });
  listen(view, 'blur', () => { touches = 0; mouseDown = false; heldKeys.clear(); cancel(); });
  for (const event of ['resize', 'orientationchange', 'hashchange', 'popstate', 'pageshow', 'pagehide']) {
    listen(view, event, () => cancel({ cooldown: event === 'resize' ? 220 : 900 }));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; clearGesture();
    if (stateTimer !== null) view.clearTimeout(stateTimer);
    stateTimer = null; publishState();
    for (const remove of listeners) remove();
    listeners.length = 0; heldKeys.clear();
  }
  noteMotion();
  return { cancel, dispose, getState, holdUntilUserScroll, restorePosition, isSettling: () => animation?.kind === 'snap' };
}
