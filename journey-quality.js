export const QUALITY_LEVELS = ['standard', 'ultra'];
export const normalizeQuality = value => QUALITY_LEVELS.includes(value) ? value : 'standard';
// No manual quality switch: desktop always starts at ultra; slow frames only downgrade the current visit.
export function initialQuality(storage, touch) {
  try { storage?.removeItem('heybox-quality'); } catch {}
  return touch ? 'standard' : 'ultra';
}

// Use real elapsed frame time, never the animation's capped physics dt.
// Three consecutive one-second averages must each be below 40 FPS.
export function createQualityMonitor(onDowngrade) {
  let elapsed = 0, frames = 0, slow = 0, notified = false;
  const reset = () => { elapsed = frames = slow = 0; };
  return {
    reset,
    sample(seconds, active) {
      if (!active || !Number.isFinite(seconds) || seconds <= 0) { reset(); return; }
      elapsed += seconds; frames++;
      if (elapsed < 1 - 1e-6) return;
      const fps = frames / elapsed;
      slow = fps < 40 ? slow + elapsed : 0;
      elapsed = frames = 0;
      if (slow >= 3 - 1e-6) {
        reset();
        onDowngrade({ fps, notify: !notified });
        notified = true;
      }
    }
  };
}
