export const QUALITY_LEVELS = ['standard', 'ultra'];
export const normalizeQuality = value => QUALITY_LEVELS.includes(value) ? value : 'standard';
// No manual quality switch: desktop always starts at ultra; quality never downgrades automatically.
export function initialQuality(storage, touch) {
  try { storage?.removeItem('heybox-quality'); } catch {}
  return touch ? 'standard' : 'ultra';
}
