export const QUALITY_LEVELS = ['low', 'standard', 'ultra'];
export const QUALITY_LABELS = { low: '省性能画质', standard: '标准画质', ultra: '极致画质' };
export const normalizeQuality = value => QUALITY_LEVELS.includes(value) ? value : 'standard';
export function initialQuality(storage, touch) {
  try {
    const saved = storage?.getItem('heybox-quality');
    if (QUALITY_LEVELS.includes(saved)) return saved;
  } catch {}
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
