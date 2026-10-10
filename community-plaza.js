import { GLTFLoader } from './vendor/GLTFLoader.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// The finale living room: six Kenney Mini Characters (CC0) gathered with their
// own devices. Furniture and devices are procedural and merged per material;
// only the screens, the string lights and the characters are separate draws.
const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const DEG = Math.PI / 180;

export function createCommunityPlaza({ THREE: T, parent, position = [0, -2.2, -494], scale = 1.8 }) {
  const group = new T.Group(); group.name = 'community-plaza'; group.position.set(...position); group.scale.setScalar(scale); group.visible = false; parent.add(group);
  const owned = new Set(), keep = v => (owned.add(v), v);
  const std = (color, o = {}) => keep(new T.MeshStandardMaterial({ color, roughness: .78, metalness: .04, ...o }));
  const glowing = (color, power = 2.2) => { const m = keep(new T.MeshBasicMaterial({ color, toneMapped: false })); m.color.multiplyScalar(power); return m; };
  const mats = {
    floor: std(0x3a2619), wood: std(0x7a4a2c), woodDark: std(0x46291a), rug: std(0x8f3f2c, { roughness: .95 }), rugInner: std(0xd08a52, { roughness: .95 }),
    wall: std(0x1d2430, { side: T.DoubleSide }), frame: std(0xc9a274), sofa: std(0x35556f, { roughness: .9 }), cushion: std(0x46708f, { roughness: .9 }),
    black: std(0x17191e, { roughness: .45 }), white: std(0xe8ecf1, { roughness: .4 }), grey: std(0x30343b, { roughness: .5 }), metal: std(0x9aa3ab, { metalness: .6, roughness: .35 }),
    beanbag: std(0xd9853b, { roughness: .95 }), pillow: std(0xe9b85c, { roughness: .95 }), pillow2: std(0x6aa58c, { roughness: .95 }), chair: std(0x23262c), red: std(0xd8433b), blue: std(0x2f9fe0),
    leaf: std(0x3f7f4c), pot: std(0xb5653b), poster1: std(0x2c6f8f), poster2: std(0xc8573d), poster3: std(0xe0b04a),
    lamp: glowing(0xffc483, 2.4), edge: glowing(0xffa25a, 1.6), rgbA: glowing(0x3fe6ff, 2.6), rgbB: glowing(0xff4fd8, 2.6), xbox: glowing(0x4dff6a, 3), ps: glowing(0x3d8bff, 3)
  };
  const batches = new Map(), screens = [], anchors = {}, characters = [];
  const M = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
  const at = (frame, ...args) => frame.clone().multiply(M(...args));
  function put(frame, key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    geo.applyMatrix4(at(frame, x, y, z, ry, rx, rz)); if (!batches.has(key)) batches.set(key, []); batches.get(key).push(geo);
  }
  const box = (f, key, w, h, d, ...p) => put(f, key, new T.BoxGeometry(w, h, d), ...p);
  const cyl = (f, key, rt, rb, h, ...p) => put(f, key, new T.CylinderGeometry(rt, rb, h, 20), ...p);
  const ball = (f, key, r, sy, ...p) => { const g = new T.SphereGeometry(r, 16, 10); g.scale(1, sy, 1); put(f, key, g, ...p); };
  const origin = new T.Matrix4();

  // Canvas screens: three show the worlds you just left; two show everyday play.
  const draw = {
    helmet(g, w, h, t) { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#081a33'); bg.addColorStop(1, '#0d3a63'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#cfefff'; for (let i = 0; i < 46; i++) { const x = ((i * 97.3) % w - t * (18 + i % 5 * 14)) % w; g.fillRect(x < 0 ? x + w : x, (i * 53.7) % h, 1.6, 1.6); }
      const y = h * .55 + Math.sin(t * 1.6) * 9; g.fillStyle = '#7fe0ff'; g.beginPath(); g.moveTo(w * .3 + 34, y); g.lineTo(w * .3 - 14, y - 13); g.lineTo(w * .3 - 6, y); g.lineTo(w * .3 - 14, y + 13); g.fill();
      g.fillStyle = '#ff7a59'; for (let i = 0; i < 3; i++) { const x = w * .78 + Math.sin(t + i * 2) * 18; g.fillRect(x, h * (.3 + i * .2), 7, 7); }
      g.strokeStyle = '#7fe0ff88'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20); },
    robot(g, w, h, t) { g.fillStyle = '#04201c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2fd6b3aa'; g.lineWidth = 1.4;
      for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(w / 2 + i * 6, h * .42); g.lineTo(w / 2 + i * 44, h); g.stroke(); }
      for (let i = 0; i < 7; i++) { const k = ((i + t * .8) % 7) / 7, y = h * .42 + Math.pow(k, 2) * h * .58; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#ffa04a'; g.fillRect(w / 2 - 26, h * .14, 52, h * .28); g.fillStyle = '#04201c'; g.fillRect(w / 2 - 20, h * .19, 40, h * .23);
      g.strokeStyle = '#ffffffcc'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h * .62, 9, 0, 7); g.moveTo(w / 2 - 16, h * .62); g.lineTo(w / 2 + 16, h * .62); g.stroke(); },
    car(g, w, h, t) { g.fillStyle = '#5aa04f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2dfb2'; g.lineWidth = 14; g.beginPath(); g.ellipse(w / 2, h / 2, w * .36, h * .3, 0, 0, 7); g.stroke();
      g.fillStyle = '#2f7a3c'; for (const [x, y] of [[.12, .2], [.88, .25], [.5, .5], [.18, .82], [.85, .8]]) { g.beginPath(); g.arc(x * w, y * h, 11, 0, 7); g.fill(); }
      const a = t * 1.3, x = w / 2 + Math.cos(a) * w * .36, y = h / 2 + Math.sin(a) * h * .3; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = '#e54732'; g.fillRect(-7, -11, 14, 22); g.restore(); },
    deck(g, w, h, t) { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a0f4f'); bg.addColorStop(.6, '#ff5e8a'); bg.addColorStop(1, '#ffb15e'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(w / 2, h * .62, h * .28, Math.PI, 0); g.fill(); g.fillStyle = '#1a0830'; g.fillRect(0, h * .62, w, h * .38);
      g.strokeStyle = '#ff5ed8'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y = h * .62 + Math.pow(((i + t) % 6) / 6, 2) * h * .38; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } },
    phone(g, w, h, t) { g.fillStyle = '#10141b'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8483a'; g.fillRect(0, 0, w, h * .1);
      const off = (t * 22) % 70; for (let i = -1; i < 6; i++) { const y = h * .14 + i * 70 - off; g.fillStyle = ['#2e3a4c', '#3a2e4c', '#2e4c43'][(i + 3) % 3]; g.fillRect(12, y, w - 24, 58); g.fillStyle = '#ffffff55'; g.fillRect(20, y + 40, (w - 40) * .6, 6); } }
  };
  function screen(frame, kind, w, h, x, y, z, ry = 0, power = 1.35, res = [256, 144]) {
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let texture = null; if (canvas) { canvas.width = res[0]; canvas.height = res[1]; texture = keep(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; }
    const material = keep(new T.MeshBasicMaterial({ color: 0xffffff, map: texture, toneMapped: false }));
    material.color.setScalar(power);
    const geo = keep(new T.PlaneGeometry(w, h)); const mesh = new T.Mesh(geo, material);
    at(frame, x, y, z, ry).decompose(mesh.position, mesh.quaternion, mesh.scale); group.add(mesh);
    const anchor = new T.Object3D(); anchor.position.set(0, 0, .02); mesh.add(anchor);
    const s = { kind, mesh, material, canvas, ctx: canvas?.getContext('2d'), texture, power, flash: 0 }; screens.push(s); return s;
  }

  // Floating floor, rug and a curved back wall with framed posters.
  cyl(origin, 'floor', 5.4, 5.25, .3, 0, -.15, 0); cyl(origin, 'rug', 2.7, 2.7, .02, 0, .01, -.5); cyl(origin, 'rugInner', 1.8, 1.8, .025, 0, .015, -.5);
  { const g = new T.TorusGeometry(5.38, .035, 6, 96); g.rotateX(Math.PI / 2); put(origin, 'edge', g); }
  { const g = new T.CylinderGeometry(5.15, 5.15, 2.7, 48, 1, true, Math.PI - 1.15, 2.3); g.translate(0, 1.35, 0); put(origin, 'wall', g); }
  for (const [a, key, w, h, y] of [[-.55, 'poster1', .8, 1, 1.6], [-.2, 'poster3', .55, .7, 1.75], [.35, 'poster2', .9, .65, 1.65]]) {
    const f = M(Math.sin(Math.PI + a) * 5.05, 0, Math.cos(Math.PI + a) * 5.05, a);
    box(f, 'frame', w + .08, h + .08, .04, 0, y, 0); box(f, key, w, h, .05, 0, y, .01);
  }
  // Sofa against the wall, coffee table, plant and a floor lamp.
  const sofa = M(0, 0, -2.85);
  box(sofa, 'sofa', 2.7, .34, .95, 0, .17, 0); box(sofa, 'cushion', 1.25, .14, .82, -.64, .41, .05); box(sofa, 'cushion', 1.25, .14, .82, .64, .41, .05);
  box(sofa, 'sofa', 2.7, .75, .26, 0, .7, -.36); for (const s of [-1, 1]) box(sofa, 'sofa', .26, .58, .95, s * 1.42, .42, 0);
  box(sofa, 'pillow', .34, .3, .12, -1.12, .62, -.18, -.2, .3); box(sofa, 'pillow2', .34, .3, .12, 1.12, .62, -.18, -.2, -.3);
  const table = M(0, 0, -.55);
  cyl(table, 'wood', .78, .78, .06, 0, .38, 0); cyl(table, 'woodDark', .09, .12, .35, 0, .18, 0); cyl(table, 'woodDark', .42, .42, .03, 0, .015, 0);
  cyl(table, 'beanbag', .17, .13, .08, -.42, .45, .18); cyl(table, 'white', .05, .045, .12, .42, .47, .22); cyl(table, 'red', .05, .045, .12, .5, .47, .02);
  const plant = M(2.25, 0, -3.65); cyl(plant, 'pot', .24, .18, .42, 0, .21, 0); ball(plant, 'leaf', .38, 1.25, 0, .82, 0); ball(plant, 'leaf', .26, 1.2, .18, 1.15, .08);
  const lampFrame = M(-2.3, 0, -3.7); cyl(lampFrame, 'black', .24, .26, .05, 0, .025, 0); cyl(lampFrame, 'metal', .025, .025, 1.85, 0, .95, 0); cyl(lampFrame, 'lamp', .2, .32, .38, 0, 1.95, 0);

  // Left: PC battle station. Its monitor faces back toward the arriving camera.
  const pc = M(-3.55, 0, -1.05, .95);
  box(pc, 'wood', 1.7, .06, .78, 0, .64, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(pc, 'woodDark', .06, .64, .06, sx * .78, .32, sz * .33);
  box(pc, 'black', .32, .02, .2, 0, .68, -.2); box(pc, 'black', .06, .4, .06, 0, .88, -.24); box(pc, 'black', 1.2, .7, .05, 0, 1.22, -.24);
  const monitor = screen(pc, 'helmet', 1.12, .62, 0, 1.22, -.213);
  box(pc, 'black', .72, .03, .22, -.05, .685, .1); box(pc, 'rgbA', .72, .012, .012, -.05, .672, .21); box(pc, 'black', .07, .035, .11, .48, .69, .12);
  box(pc, 'black', .3, .64, .62, 1.12, .32, -.05); box(pc, 'rgbB', .012, .5, .012, 1.27, .34, .26); box(pc, 'rgbA', .012, .5, .012, 1.27, .34, -.36);
  const chair = at(pc, 0, 0, .78);
  cyl(chair, 'black', .32, .32, .04, 0, .03, 0); cyl(chair, 'metal', .04, .04, .4, 0, .24, 0); box(chair, 'chair', .6, .09, .58, 0, .46, 0);
  box(chair, 'chair', .6, .32, .09, 0, .66, .29); box(chair, 'red', .14, .3, .095, 0, .66, .29);
  // Right: TV with both consoles. Its screen also turns toward the camera.
  const tv = M(3.55, 0, -1.05, -.95);
  box(tv, 'woodDark', 1.9, .46, .48, 0, .23, -.25); box(tv, 'black', 2.05, 1.18, .06, 0, 1.25, -.33);
  const tvScreen = screen(tv, 'robot', 1.95, 1.08, 0, 1.25, -.299, 0, 1.3, [320, 180]);
  box(tv, 'white', .16, .6, .5, -.68, .76, -.25); box(tv, 'black', .07, .58, .4, -.68, .76, -.25);
  box(tv, 'black', .3, .3, .3, .64, .61, -.25); box(tv, 'xbox', .2, .012, .2, .64, .765, -.25);
  ball(tv, 'beanbag', .55, .55, 0, .3, 1.05); ball(tv, 'beanbag', .42, .9, 0, .5, 1.42);

  // Front cushions sit on the rug edge, turned away so we can see their screens.
  const cushionL = M(-1.35, 0, 1.35), cushionR = M(1.3, 0, 1.4);
  cyl(cushionL, 'pillow2', .4, .42, .16, 0, .08, 0); cyl(cushionR, 'pillow', .4, .42, .16, 0, .08, 0);

  // Devices are built in each player's frame. +Z is the character's front.
  const HAND = .2, REACH = .3;
  const controller = (f, body, accent) => { box(f, body, .42, .085, .17, 0, HAND, REACH); for (const s of [-1, 1]) box(f, body, .13, .09, .2, s * .17, HAND - .02, REACH - .06, 0, s * .25);
    box(f, 'black', .14, .012, .07, 0, HAND + .047, REACH); box(f, accent, accent === 'ps' ? .16 : .045, .012, .03, 0, HAND + .05, REACH + (accent === 'ps' ? -.05 : .05)); };
  const handheld = (f, kind) => {
    const d = at(f, 0, HAND + .03, REACH, 0, .9);
    if (kind === 'switch') { box(d, 'black', .36, .2, .03, 0, 0, 0); box(d, 'red', .1, .2, .036, -.23, 0, 0); box(d, 'blue', .1, .2, .036, .23, 0, 0);
      return screen(d, 'car', .32, .18, 0, 0, -.019, Math.PI, 1.45, [256, 144]); }
    box(d, 'grey', .64, .24, .045, 0, 0, 0); box(d, 'black', .07, .07, .05, -.25, -.03, 0); box(d, 'black', .07, .07, .05, .25, -.03, 0);
    return screen(d, 'deck', .32, .19, 0, 0, -.024, Math.PI, 1.4, [256, 144]);
  };
  const phone = f => { const d = at(f, .3, HAND + .06, REACH - .06, 0, .9); box(d, 'black', .11, .21, .015, 0, 0, 0); return screen(d, 'phone', .095, .19, 0, 0, -.009, Math.PI, 1.4, [96, 192]); };

  // Character placement. `turn` is how far the player can turn to greet us.
  const roster = [
    { file: 'male-a', frame: at(chair, 0, .5, -.02, Math.PI), sit: true, arms: 'hold', wave: 1, lag: .1 },
    { file: 'male-f', frame: at(sofa, -.62, .46, .08), sit: true, arms: 'hold', nod: true, lag: .3 },
    { file: 'female-f', frame: at(sofa, .62, .46, .08), sit: true, arms: 'phone', wave: 1, lag: 0 },
    { file: 'female-b', frame: at(tv, 0, .5, 1.0, Math.PI), sit: true, arms: 'hold', nod: true, lag: .45 },
    { file: 'male-b', frame: at(cushionL, 0, .16, 0, Math.PI + .55), sit: true, arms: 'hold', wave: 1, lag: .25 },
    { file: 'female-c', frame: at(cushionR, 0, .16, 0, Math.PI - .5), sit: true, arms: 'hold', nod: true, lag: .15 }
  ];
  controller(roster[1].frame, 'black', 'xbox'); controller(roster[3].frame, 'white', 'ps');
  const deckScreen = handheld(roster[4].frame, 'deck'), switchScreen = handheld(roster[5].frame, 'switch'); phone(roster[2].frame);
  anchors.helmet = monitor.mesh.children[0]; anchors.robot = tvScreen.mesh.children[0]; anchors.car = switchScreen.mesh.children[0];
  const screenOf = { helmet: monitor, robot: tvScreen, car: switchScreen };
  anchors.box = new T.Object3D(); anchors.box.position.set(0, .41, -.55); group.add(anchors.box);

  for (const [key, list] of batches) {
    const merged = mergeGeometries(list.filter(g => g.attributes.position.count), false); list.forEach(g => g.dispose());
    if (!merged) continue; keep(merged); const mesh = new T.Mesh(merged, mats[key]); mesh.name = 'plaza-' + key; group.add(mesh);
  }
  // String lights along the top of the wall.
  const BULBS = 44, bulbs = new T.InstancedMesh(keep(new T.SphereGeometry(.05, 8, 6)), glowing(0xffc27a, 3.2), BULBS), dummy = new T.Object3D();
  for (let i = 0; i < BULBS; i++) { const u = i / (BULBS - 1), a = Math.PI - 1.1 + u * 2.2, sag = Math.abs(Math.sin(u * Math.PI * 5)) * .16;
    dummy.position.set(Math.sin(a) * 5.0, 2.62 - sag, Math.cos(a) * 5.0); dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix); }
  group.add(bulbs);
  const lampLight = new T.PointLight(0xffb070, 0, 0, 2); lampLight.position.set(-2.3, 2.1, -3.4); group.add(lampLight);
  const roomLight = new T.PointLight(0xffc89a, 0, 0, 2); roomLight.position.set(.4, 3.2, .6); group.add(roomLight);

  // Kenney rigs: root, torso, head, arm-left/right, leg-left/right. Rest pose is a T-pose.
  const rot = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x * DEG, y * DEG, z * DEG));
  const POSE = { down: [rot(0, 0, -45), rot(0, 0, 45)], hold: [rot(0, -60, -12), rot(0, 60, 12)], phone: [rot(0, -62, -8), rot(0, 0, 45)] };
  const WAVE_A = rot(0, 40, -20), WAVE_B = rot(0, 40, -75), qa = new T.Quaternion(), qb = new T.Quaternion();
  let loadState = 'idle', disposed = false;
  function load() {
    if (loadState !== 'idle' || disposed) return; loadState = 'loading';
    const loader = new GLTFLoader();
    Promise.all(roster.map(r => loader.loadAsync(new URL(`./models/players/character-${r.file}.glb`, import.meta.url).href).then(gltf => {
      if (disposed) { dispose(gltf.scene); return; }
      const model = gltf.scene; model.scale.setScalar(1.5); r.frame.decompose(model.position, model.quaternion, new T.Vector3());
      model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; owned.add(o.geometry); for (const m of [o.material].flat()) { owned.add(m); if (m.map) owned.add(m.map); m.envMapIntensity = .3; m.color.setScalar(.72); } } });
      const bone = n => model.getObjectByName(n);
      const c = { ...r, model, root: bone('root'), torso: bone('torso'), head: bone('head'), armL: bone('arm-left'), armR: bone('arm-right'), legL: bone('leg-left'), legR: bone('leg-right'), yaw: (v => Math.atan2(v.x, v.z))(new T.Vector3(0, 0, 1).transformDirection(r.frame)), seed: characters.length * 1.7 };
      group.add(model); characters.push(c);
    }).catch(error => console.warn('[plaza] player model unavailable', r.file, error)))).then(() => { loadState = 'loaded'; });
  }
  const camLocal = new T.Vector3(), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function pose(c, t, greet, reduced) {
    if (c.root) c.root.position.y = c.sit ? -.15 : 0;
    for (const leg of [c.legL, c.legR]) leg?.quaternion.copy(c.sit ? rot(-78, 0, 0) : rot(0, 0, 0));
    const base = POSE[c.arms] || POSE.down;
    c.armL?.quaternion.copy(base[0]); c.armR?.quaternion.copy(base[1]);
    const g = clamp((greet - c.lag) / .45), breathe = reduced ? 0 : Math.sin(t * 1.7 + c.seed) * .025;
    // Turn torso and head toward the camera, sharing the twist between them.
    const want = wrap(Math.atan2(camLocal.x - c.model.position.x, camLocal.z - c.model.position.z) - c.yaw), turn = Math.max(-1.9, Math.min(1.9, want)) * (c.wave || c.nod ? g : g * .6);
    c.torso?.quaternion.setFromEuler(new T.Euler(breathe, turn * .4, 0));
    c.head?.quaternion.setFromEuler(new T.Euler((c.nod && !reduced ? Math.max(0, Math.sin(t * 7)) * .22 * g : 0) - .08 * g, turn * .6, reduced ? 0 : Math.sin(t * .9 + c.seed) * .04));
    if (c.wave && c.armR) { const w = g * c.wave; if (!reduced) { qa.copy(WAVE_A).slerp(WAVE_B, .5 + .5 * Math.sin(t * 9 + c.seed)); } else qa.copy(WAVE_A); c.armR.quaternion.slerp(qa, w); }
  }

  let paintTick = 0, quality = 'standard';
  function update({ progress = 0, time = 0, dt = 0, reduced = false, camera, quality: q = 'standard' } = {}) {
    const p = progress; if (p > .85) load();
    const visible = p > .975; group.visible = visible; if (!visible) return;
    if (q !== quality) quality = q;
    const ultra = quality === 'ultra', arrive = smooth(1.0, 1.1, p);
    bulbs.count = ultra ? BULBS : Math.ceil(BULBS / 2);
    lampLight.intensity = 26 * arrive; roomLight.intensity = (ultra ? 42 : 34) * arrive;
    // Screens flash once as their world lands in them.
    const lands = { helmet: 1.06, robot: 1.07, car: 1.08 };
    for (const [name, s] of Object.entries(screenOf)) { const at = lands[name]; s.flash = smooth(at - .006, at, p) * (1 - smooth(at + .004, at + .04, p)); }
    for (const s of screens) s.material.color.setScalar(s.power * (.25 + .75 * smooth(.99, 1.05, p)) + s.flash * 3.2);
    if (camera) { camLocal.copy(camera.position); group.worldToLocal(camLocal); }
    const greet = smooth(1.09, 1.16, p);
    for (const c of characters) pose(c, time, greet, reduced);
    // Repaint screens at ~20 Hz; the reduced setting keeps a still frame.
    paintTick += dt; if (paintTick < .05 && screens[0].painted) return; paintTick = 0;
    for (const s of screens) { if (!s.ctx || (reduced && s.painted)) continue; draw[s.kind](s.ctx, s.canvas.width, s.canvas.height, reduced ? 0 : time); s.texture.needsUpdate = true; s.painted = true; }
  }
  function dispose(object) {
    if (object) { object.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat()) { m?.map?.dispose?.(); m?.dispose?.(); } }); return; }
    disposed = true; group.removeFromParent(); owned.forEach(r => r.dispose?.()); owned.clear(); Object.values(mats).forEach(m => m.dispose()); bulbs.dispose?.();
  }
  return { group, anchors, update, load, dispose: () => dispose() };
}
