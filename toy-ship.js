import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { heyboxMarkShapes } from './heybox-mark.js?v=journey-35';

/* Chunky toy starfighter, made like the RC jeep: flat-shaded boxes and
 * cylinders merged per material. +Y up, -Z forward. The returned root is
 * centred and exactly `length` units long, so the engine, muzzle and portal
 * layouts are already in the space the flight game and the portal use. */
const PALETTES = {
  player: { paint: 0x2a6fc4, cream: 0xe8c894, trim: 0x2b2b33, accent: 0xf0a92c, glass: 0x8fd6f5, flame: 0xffa34a, sticker: 0xf2d9a6 },
  enemy: { paint: 0x6d4b93, cream: 0xd8c8ea, trim: 0x2a2433, accent: 0xe0483a, glass: 0xff9d8a, flame: 0xff5a4a, sticker: 0x2a2433 }
};

export function createToyShip({ THREE: T, faction = 'player', length = 8.5 } = {}) {
  if (!T) throw new Error('createToyShip requires THREE');
  const colors = PALETTES[faction] || PALETTES.player;
  const root = new T.Group(); root.name = faction === 'enemy' ? 'toy-enemy-fighter' : 'toy-starfighter';
  const body = new T.Group(); body.name = 'toy-ship-body'; root.add(body);
  const materials = {};
  for (const [key, color] of Object.entries(colors)) materials[key] = new T.MeshStandardMaterial({ color, roughness: key === 'glass' ? .35 : .8, metalness: 0, flatShading: true });
  materials.glass.emissive = new T.Color(colors.glass).multiplyScalar(.18);
  materials.flame.emissive = new T.Color(colors.flame); materials.flame.emissiveIntensity = .9;
  const batches = new Map();
  const add = (g, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1)));
    if (!batches.has(key)) batches.set(key, []); batches.get(key).push(g.index ? g.toNonIndexed() : g);
  };
  const box = (key, w, h, d, ...p) => add(new T.BoxGeometry(w, h, d), key, ...p);
  // Cylinders lie along Z unless told otherwise.
  const tube = (key, rf, rb, len, x, y, z, n = 10) => add(new T.CylinderGeometry(rf, rb, len, n), key, x, y, z, Math.PI / 2);

  // Fuselage: a fat box with a cream nose block and an eight-sided cone.
  box('paint', 1.7, 1.45, 4.4, 0, 0, .3);
  box('cream', 1.74, .34, 4.3, 0, -.45, .3);
  box('cream', 1.45, 1.2, 1.1, 0, -.05, -2.4);
  tube('paint', .72, .02, 1.35, 0, -.05, -3.6, 8);
  box('accent', 1.76, .16, .3, 0, .2, -1.75);
  // Cockpit bubble on a cream collar, with a little pilot helmet inside.
  box('cream', 1.25, .22, 2.0, 0, .78, -.9);
  { const g = new T.SphereGeometry(.64, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, .95, 1.5); add(g, 'glass', 0, .86, -.95); }
  { const g = new T.SphereGeometry(.26, 8, 6); add(g, 'cream', 0, 1.1, -.75); }
  // Wings: chunky slabs, slightly swept, with yellow tips and a mark sticker.
  for (const s of [-1, 1]) {
    box('paint', 2.5, .28, 1.9, s * 1.95, -.2, .85, 0, s * .22, 0);
    box('accent', .42, .5, 1.25, s * 3.2, -.12, 1.25, 0, s * .22, 0);
    box('cream', 2.0, .1, .26, s * 1.9, -.03, .2, 0, s * .22, 0);
    for (const shape of heyboxMarkShapes(T, .78)) add(new T.ShapeGeometry(shape, 5), 'sticker', s * 2.05, -.055, 1.05, -Math.PI / 2, 0, s * .22);
    // Engine pods with cream intake rings and glowing exhausts.
    tube('trim', .52, .58, 2.5, s * 1.2, -.32, 1.95);
    tube('cream', .62, .62, .26, s * 1.2, -.32, .72);
    tube('accent', .6, .6, .14, s * 1.2, -.32, 3.1);
    tube('flame', .4, .4, .08, s * 1.2, -.32, 3.2);
    // Twin blasters and a small skid underneath.
    tube('trim', .1, .1, 1.0, s * .62, -.52, -2.65, 8);
    tube('accent', .14, .14, .16, s * .62, -.52, -2.2, 8);
    box('trim', .14, .26, 1.8, s * .55, -.85, .3);
  }
  box('trim', 1.24, .14, .14, 0, -.98, -.45); box('trim', 1.24, .14, .14, 0, -.98, 1.05);
  // Tail fin with a stripe, a rear plate and an antenna.
  box('paint', .24, 1.35, 1.45, 0, 1.25, 1.85, -.25, 0, 0);
  box('cream', .26, .22, 1.25, 0, 1.55, 1.95, -.25, 0, 0);
  box('trim', 1.3, 1.0, .25, 0, -.05, 2.55);
  tube('flame', .26, .26, .08, 0, -.05, 2.7);
  add(new T.CylinderGeometry(.035, .035, .7, 6), 'trim', -.45, 1.12, .7);
  add(new T.SphereGeometry(.09, 8, 6), 'accent', -.45, 1.5, .7);

  const geometries = [];
  for (const [key, list] of batches) {
    const merged = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (!merged) continue;
    geometries.push(merged); const mesh = new T.Mesh(merged, materials[key]); mesh.name = `toy-ship-${key}`; body.add(mesh);
  }
  // Recentre and scale once, then publish layouts in that final space.
  body.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(body), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const k = length / Math.max(size.x, size.y, size.z, .001);
  body.scale.setScalar(k); body.position.copy(center).multiplyScalar(-k);
  const place = ([x, y, z]) => [(x - center.x) * k, (y - center.y) * k, (z - center.z) * k];
  const engineLayout = [[-1.2, -.32, 3.25], [1.2, -.32, 3.25]].map(place);
  const muzzleLayout = [[-.62, -.52, -3.2], [.62, -.52, -3.2]].map(place);
  root.userData.toyShip = { faction, forwardAxis: '-Z', length };
  function dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()); }
  return { root, materials, engineLayout, muzzleLayout, engineRadius: .4 * k, dispose };
}

// The rescue mothership from the same toy box: a chunky cream cruiser with a
// blue stripe, a bridge tower and four engines. Built at `length` units long.
export function createToyCarrier({ THREE: T, length = 24 } = {}) {
  if (!T) throw new Error('createToyCarrier requires THREE');
  const colors = { hull: 0xe8dcc4, stripe: 0x2a6fc4, trim: 0x2b2b33, accent: 0xf0a92c, glass: 0x8fd6f5, flame: 0xffa34a };
  const root = new T.Group(); root.name = 'toy-rescue-carrier';
  const body = new T.Group(); root.add(body);
  const materials = {};
  for (const [key, color] of Object.entries(colors)) materials[key] = new T.MeshStandardMaterial({ color, roughness: key === 'glass' ? .35 : .8, metalness: 0, flatShading: true });
  materials.glass.emissive = new T.Color(colors.glass).multiplyScalar(.45);
  materials.flame.emissive = new T.Color(colors.flame); materials.flame.emissiveIntensity = .9;
  const batches = new Map();
  const add = (g, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1)));
    if (!batches.has(key)) batches.set(key, []); batches.get(key).push(g.index ? g.toNonIndexed() : g);
  };
  const box = (key, w, h, d, ...p) => add(new T.BoxGeometry(w, h, d), key, ...p);
  const tube = (key, rf, rb, len, x, y, z, n = 10) => add(new T.CylinderGeometry(rf, rb, len, n), key, x, y, z, Math.PI / 2);

  // Hull, belly stripe, bow block and a blunt eight-sided nose.
  box('hull', 3.2, 2.2, 9, 0, 0, 0);
  box('stripe', 3.26, .5, 8.8, 0, -.55, 0);
  box('hull', 2.6, 1.8, 1.6, 0, -.1, -5.2);
  tube('stripe', 1.15, .1, 1.5, 0, -.1, -6.7, 8);
  // Bridge tower with a glowing window band and an antenna.
  box('hull', 1.5, 1.3, 2.1, 0, 1.75, 2.2);
  box('glass', 1.54, .32, .2, 0, 1.95, 1.12);
  box('trim', 1.6, .14, 2.2, 0, 2.45, 2.2);
  add(new T.CylinderGeometry(.05, .05, 1.1, 6), 'trim', .4, 3.0, 2.6);
  add(new T.SphereGeometry(.14, 8, 6), 'accent', .4, 3.6, 2.6);
  // Cargo crates riding on the deck.
  [[-.75, -1.2, 'accent'], [.75, -1.2, 'stripe'], [-.75, .1, 'stripe'], [.75, .1, 'accent']].forEach(([x, z, k]) => box(k, 1.1, .7, 1.1, x, 1.45, z));
  for (const s of [-1, 1]) {
    // Side pods with a yellow stripe and a row of porthole windows.
    box('trim', 1.2, 1.4, 6.2, s * 2.25, -.25, 1.1);
    box('accent', 1.24, .22, 5.8, s * 2.25, .5, 1.1);
    for (let i = 0; i < 6; i++) box('glass', .08, .32, .42, s * 2.86, 0, -1.4 + i * .95);
    for (const shape of heyboxMarkShapes(T, 1.3)) add(new T.ShapeGeometry(shape, 5), 'stripe', s * 1.611, .15, -3.3, 0, s * Math.PI / 2, 0);
    // Four fat engines at the stern.
    for (const y of [-.55, .55]) {
      tube('trim', .5, .58, 1.5, s * 1.05, y, 5.1);
      tube('accent', .6, .6, .16, s * 1.05, y, 5.8);
      tube('flame', .4, .4, .08, s * 1.05, y, 5.9);
    }
  }
  for (const shape of heyboxMarkShapes(T, 1.6)) add(new T.ShapeGeometry(shape, 5), 'stripe', 0, 1.111, -3.2, -Math.PI / 2, 0, 0);

  const geometries = [];
  for (const [key, list] of batches) {
    const merged = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (!merged) continue;
    geometries.push(merged); const mesh = new T.Mesh(merged, materials[key]); mesh.name = `toy-carrier-${key}`; body.add(mesh);
  }
  body.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(body), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const k = length / Math.max(size.x, size.y, size.z, .001);
  body.scale.setScalar(k); body.position.copy(center).multiplyScalar(-k);
  const place = ([x, y, z]) => [(x - center.x) * k, (y - center.y) * k, (z - center.z) * k];
  const engineLayout = [[-1.05, -.55, 5.95], [-1.05, .55, 5.95], [1.05, -.55, 5.95], [1.05, .55, 5.95]].map(place);
  function dispose() { root.removeFromParent(); geometries.forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()); }
  return { root, engineLayout, engineRadius: .4 * k, dispose };
}
