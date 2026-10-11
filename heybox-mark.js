// The app mark from heybox-mark.svg: two interlocking hooks, point-symmetric
// about (256, 256) in a 368 x 408 view box. Shared by the toy ship sticker and
// the small marks hidden around the living room.
const HOOK = 'M228 87Q228 80 234 84L387 172Q395 176 395 184V327Q395 335 388 339L346 364Q339 368 339 360V219Q339 211 332 207L291 183Q283 178 283 186V220Q283 228 275 228H236Q228 228 228 220Z';
const STEPS = [['M', 228, 87], ['Q', 228, 80, 234, 84], ['L', 387, 172], ['Q', 395, 176, 395, 184], ['L', 395, 327], ['Q', 395, 335, 388, 339], ['L', 346, 364],
  ['Q', 339, 368, 339, 360], ['L', 339, 219], ['Q', 339, 211, 332, 207], ['L', 291, 183], ['Q', 283, 178, 283, 186], ['L', 283, 220], ['Q', 283, 228, 275, 228], ['L', 236, 228], ['Q', 228, 228, 228, 220]];

// Two THREE.Shapes, centred on the origin, `size` units tall, +Y up.
export function heyboxMarkShapes(T, size = 1) {
  const k = size / 408;
  return [false, true].map(turned => {
    const shape = new T.Shape(), at = (x, y) => turned ? [(256 - x) * k, (y - 256) * k] : [(x - 256) * k, (256 - y) * k];
    for (const [op, ...v] of STEPS) {
      if (op === 'M') shape.moveTo(...at(v[0], v[1]));
      else if (op === 'L') shape.lineTo(...at(v[0], v[1]));
      else shape.quadraticCurveTo(...at(v[0], v[1]), ...at(v[2], v[3]));
    }
    shape.closePath(); return shape;
  });
}

// Fill the mark on a 2D canvas, centred at (x, y), `size` px tall.
export function drawHeyboxMark(ctx, x, y, size, color) {
  if (!ctx || typeof Path2D === 'undefined') return;
  const path = new Path2D(HOOK);
  ctx.save(); ctx.fillStyle = color; ctx.translate(x, y); ctx.scale(size / 408, size / 408); ctx.translate(-256, -256);
  ctx.fill(path); ctx.translate(256, 256); ctx.rotate(Math.PI); ctx.translate(-256, -256); ctx.fill(path);
  ctx.restore();
}
