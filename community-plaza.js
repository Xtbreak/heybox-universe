import { GLTFLoader } from './vendor/GLTFLoader.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { heyboxMarkShapes, drawHeyboxMark } from './heybox-mark.js?v=journey-41';

// The journey ends in a friend's living room: a small toy house at the end of
// the park road. You walk in through the front door, six friends (Kenney Mini
// Characters, CC0) turn around to greet you, and one holds out a spare pad.
// Furniture is procedural and merged per material. Heybox marks are hidden in
// the room: the box on the table, the neon, the rug, cushions, the mug, the
// door plate, the doormat, the attic window, the TV's P4 slot and the stars.
const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const DEG = Math.PI / 180;

export function createCommunityPlaza({ THREE: T, parent, core = null, position = [2, -1.96, -417.8], scale = 1.6 }) {
  const group = new T.Group(); group.name = 'friends-living-room'; group.position.set(...position); group.scale.setScalar(scale); group.visible = false; parent.add(group);
  // Lights live outside the hidden group so the scene's light count never
  // changes; a changing count would recompile every material mid-scroll.
  const rig = new T.Group(); rig.name = 'living-room-lights'; rig.position.copy(group.position); rig.scale.copy(group.scale); parent.add(rig);
  const owned = new Set(), keep = v => (owned.add(v), v);
  const hasDOM = typeof document !== 'undefined';
  function canvasTexture(w, h, paint, repeat) {
    if (!hasDOM) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (!g) return null; paint(g, w, h);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); } return t;
  }
  const std = (color, o = {}) => keep(new T.MeshStandardMaterial({ color, roughness: .8, metalness: 0, flatShading: true, ...o }));
  const glowing = (color, power = 2.2) => { const m = keep(new T.MeshBasicMaterial({ color, toneMapped: false })); m.color.multiplyScalar(power); return m; };

  // Painted surfaces.
  const floorMap = canvasTexture(256, 256, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = ['#a8703f', '#9c6638', '#b07a48', '#a26b3c'][i % 4]; g.fillRect(0, i * 32, w, 32); g.fillStyle = '#6e4325'; g.fillRect(0, i * 32, w, 2); g.fillRect(((i * 97) % 200) + 30, i * 32, 2, 32); }
  }, [4, 3.5]);
  const rugMap = canvasTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#b5513a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0d9b0'; g.fillRect(26, 26, w - 52, h - 52); g.fillStyle = '#d98a4e'; g.fillRect(44, 44, w - 88, h - 88);
    g.fillStyle = '#f0d9b0'; for (let x = 0; x < 9; x++) for (let y = 0; y < 6; y++) { const cx = 70 + x * 46, cy = 70 + y * 49; g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 9); g.lineTo(cx - 9, cy); g.fill(); }
    g.fillStyle = '#d98a4e'; g.beginPath(); g.ellipse(w / 2, h / 2, 92, 92, 0, 0, 7); g.fill();
    drawHeyboxMark(g, w / 2, h / 2, 140, '#b5513a');
  });
  const sky = (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0b1430'); bg.addColorStop(1, '#27305a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let s = 81; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#dfe9ff'; for (let i = 0; i < 70; i++) g.fillRect(r() * w, r() * h, 1.2, 1.2);
    // A constellation in the shape of the mark.
    const k = h * .62 / 408, ox = w * .68, oy = h * .48, pts = [[228, 87], [387, 172], [395, 327], [346, 364], [339, 219], [291, 183], [283, 228], [228, 228]];
    g.strokeStyle = '#9fb8ff55'; g.lineWidth = 1; for (const turn of [1, -1]) { g.beginPath(); pts.forEach(([x, y], i) => { const px = ox + (x - 256) * k * turn, py = oy + (y - 256) * k * turn; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.stroke();
      g.fillStyle = '#ffffff'; for (const [x, y] of pts) { g.beginPath(); g.arc(ox + (x - 256) * k * turn, oy + (y - 256) * k * turn, 2.2, 0, 7); g.fill(); } }
    g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(w * .2, h * .28, h * .11, 0, 7); g.fill(); g.fillStyle = '#0f1836'; g.beginPath(); g.arc(w * .2 + h * .05, h * .25, h * .1, 0, 7); g.fill();
  };
  const skyMap = canvasTexture(256, 192, sky);
  const posterMap = canvasTexture(256, 352, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1e2a52'); bg.addColorStop(.62, '#e8664a'); bg.addColorStop(1, '#f4b25a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(w / 2, h * .62, 70, Math.PI, 0); g.fill(); g.fillStyle = '#2a1838'; g.fillRect(0, h * .62, w, h * .38);
    drawHeyboxMark(g, w / 2, h * .3, 96, '#fff4e0'); g.strokeStyle = '#fff4e0'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  });
  const welcomeMap = canvasTexture(768, 326, (g, w, h) => {
    g.fillStyle = '#f6ecd8'; g.fillRect(0, 0, w, h);
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,80,40,${.03 + r() * .05})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
    g.fillStyle = '#e8553e'; g.beginPath(); g.arc(w * .86, h * .3, 34, 0, 7); g.fill();
    g.fillStyle = '#2b2320'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `400 ${Math.round(h * .38)}px "Kaiti SC","STKaiti","KaiTi","Songti SC",serif`; g.fillText('欢迎回来', w * .47, h * .47);
    g.font = `500 ${Math.round(h * .07)}px ui-monospace,Menlo,monospace`; g.fillStyle = '#7a6a5c'; g.fillText('W E L C O M E   B A C K', w * .47, h * .82);
    g.fillStyle = '#c84a36'; g.fillRect(w * .86 - 18, h * .66, 36, 36); g.fillStyle = '#f6ecd8'; g.font = `700 ${Math.round(h * .07)}px "Kaiti SC","STKaiti",serif`; g.fillText('盒', w * .86, h * .66 + 19);
  });
  const toyPosterMap = canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = '#7cc0a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6e3b4'; g.beginPath(); g.ellipse(w / 2, h * .78, w * .46, h * .2, 0, 0, 7); g.fill();
    g.fillStyle = '#e54732'; g.fillRect(w / 2 - 34, h * .48, 68, 30); g.fillRect(w / 2 - 20, h * .37, 40, 18); g.fillStyle = '#2b2a31';
    for (const x of [-22, 22]) { g.beginPath(); g.arc(w / 2 + x, h * .48 + 32, 11, 0, 7); g.fill(); }
  });

  const mats = {
    floor: std(0xffffff, { map: floorMap, flatShading: false }), rug: std(0xffffff, { map: rugMap, roughness: .95, flatShading: false }),
    wallIn: std(0xead6b4), wainscot: std(0xb97a4e), wallOut: std(0xf4e7cd), ceiling: std(0xf1e2c6), roof: std(0xc9573c), roofDark: std(0x6e2b1f), brick: std(0xa8553d),
    trim: std(0xfbf4e6), door: std(0x3f8a76), gold: std(0xe9b85a, { metalness: .4, roughness: .4 }), stone: std(0xc9bfae), grass: std(0x7db45b), dirt: std(0x8d5c3b), dirtDark: std(0x6c4430),
    mat: std(0x8f4a2f, { roughness: 1 }), wood: std(0x9e6539), woodDark: std(0x5e3a23), sofa: std(0x4c7da3, { roughness: .95 }), cushion: std(0x6a9bc0, { roughness: .95 }),
    black: std(0x1b1d22, { roughness: .45 }), white: std(0xf1f1ee, { roughness: .45 }), grey: std(0x3a3e46, { roughness: .5 }), metal: std(0xa7aeb5, { metalness: .5, roughness: .4 }),
    beanbag: std(0xe08a3c, { roughness: .95 }), pillow: std(0xf2c35f, { roughness: .95 }), pillow2: std(0x74b596, { roughness: .95 }), chair: std(0x2a2d34), red: std(0xe0483a), blue: std(0x2f9fe0),
    yellow: std(0xf3c33c), leaf: std(0x4f9a52), leafDark: std(0x3a7a40), pot: std(0xc06a3d), cat: std(0xeb9a4c), catLight: std(0xfbe2c0), ink: std(0x2b2320), markInk: std(0xfff6e6),
    welcome: std(0xffffff, { map: welcomeMap, roughness: .9, flatShading: false }), poster: std(0xffffff, { map: posterMap, flatShading: false }), toyPoster: std(0xffffff, { map: toyPosterMap, flatShading: false }),
    sky: keep(new T.MeshBasicMaterial({ color: 0xffffff, map: skyMap })),
    lamp: glowing(0xffc483, 1.6), windowWarm: glowing(0xffc06e, 1.05), neon: glowing(0xff6b4f, 3.1), rgbA: glowing(0x3fe6ff, 2.6), rgbB: glowing(0xff4fd8, 2.6), xbox: glowing(0x4dff6a, 3), ps: glowing(0x3d8bff, 3), ember: glowing(0xffd27a, 2.8)
  };
  const batches = new Map(), screens = [], characters = [], bubbles = [];
  const M = (x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
  const at = (frame, ...args) => frame.clone().multiply(M(...args));
  function put(frame, key, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    geo.applyMatrix4(at(frame, x, y, z, ry, rx, rz)); if (!batches.has(key)) batches.set(key, []); batches.get(key).push(geo);
  }
  const box = (f, key, w, h, d, ...p) => put(f, key, new T.BoxGeometry(w, h, d), ...p);
  const cyl = (f, key, rt, rb, h, ...p) => put(f, key, new T.CylinderGeometry(rt, rb, h, 14), ...p);
  const ball = (f, key, r, sy, ...p) => { const g = new T.SphereGeometry(r, 12, 8); g.scale(1, sy, 1); put(f, key, g, ...p); };
  // A flat mark facing the frame's +Z, `size` tall.
  const mark = (f, key, size, ...p) => { for (const s of heyboxMarkShapes(T, size)) put(f, key, new T.ShapeGeometry(s, 6), ...p); };
  const O = new T.Matrix4();

  function screen(frame, kind, w, h, x, y, z, ry = 0, power = 1.3, res = [256, 144]) {
    const canvas = hasDOM ? document.createElement('canvas') : null;
    let texture = null; if (canvas) { canvas.width = res[0]; canvas.height = res[1]; texture = keep(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; }
    const material = keep(new T.MeshBasicMaterial({ color: 0xffffff, map: texture, toneMapped: false })); material.color.setScalar(power);
    const mesh = new T.Mesh(keep(new T.PlaneGeometry(w, h)), material); at(frame, x, y, z, ry).decompose(mesh.position, mesh.quaternion, mesh.scale); group.add(mesh);
    const s = { kind, mesh, material, canvas, ctx: canvas?.getContext('2d'), texture, power }; screens.push(s); return s;
  }

  // ---- The house: a toy diorama on a floating lawn. Inside is 8 x 7.2 x 2.7. ----
  const W = 4, D = 3.6, H = 2.7, DOOR = .62, DOOR_H = 2.05;
  box(O, 'grass', 9.6, .16, 9.6, 0, -.09, .5); box(O, 'dirt', 9.2, .8, 9.2, 0, -.56, .5); box(O, 'dirtDark', 7.8, .7, 7.8, 0, -1.2, .5);
  box(O, 'floor', 2 * W, .05, 2 * D, 0, -.024, 0);
  for (const [x, z, s] of [[0, 4.4, .42], [.1, 4.9, .36]]) cyl(O, 'stone', s, s, .03, x, .015, z);
  // Walls. The front wall leaves a door opening and gets a cream cladding outside.
  box(O, 'wallIn', 2 * W, H, .14, 0, H / 2, -D); for (const s of [-1, 1]) box(O, 'wallIn', .14, H, 2 * D, s * W, H / 2, 0);
  const sideW = W - DOOR, sideX = (W + DOOR) / 2;
  for (const s of [-1, 1]) { box(O, 'wallIn', sideW, H, .14, s * sideX, H / 2, D); box(O, 'wallOut', sideW, H, .03, s * sideX, H / 2, D + .085); }
  box(O, 'wallIn', DOOR * 2, H - DOOR_H, .14, 0, (H + DOOR_H) / 2, D); box(O, 'wallOut', DOOR * 2, H - DOOR_H, .03, 0, (H + DOOR_H) / 2, D + .085);
  // Wainscot band and skirting inside.
  box(O, 'wainscot', 2 * W - .3, .9, .03, 0, .45, -D + .085); for (const s of [-1, 1]) box(O, 'wainscot', .03, .9, 2 * D - .3, s * (W - .085), .45, 0);
  for (const s of [-1, 1]) box(O, 'wainscot', sideW - .15, .9, .03, s * (sideX + .075), .45, D - .085);
  box(O, 'ceiling', 2 * W + .1, .12, 2 * D + .1, 0, H + .06, 0); for (const z of [-2.3, 0, 2.3]) box(O, 'woodDark', 2 * W - .2, .14, .2, 0, H - .07, z);
  // Gabled roof, ridge front to back, with an attic window and a chimney.
  const roofHalf = W + .35, rise = 2.1, slope = Math.hypot(roofHalf, rise), pitch = Math.atan2(rise, roofHalf);
  for (const s of [-1, 1]) box(O, 'roof', slope + .2, .22, 2 * D + 1.1, s * roofHalf / 2, H + .12 + rise / 2, .2, 0, 0, -s * pitch);
  { const tri = new T.Shape([new T.Vector2(-W - .05, 0), new T.Vector2(W + .05, 0), new T.Vector2(0, rise * (W + .05) / roofHalf)]);
    for (const z of [D + .02, -D - .16]) put(O, 'wallOut', new T.ExtrudeGeometry(tri, { depth: .14, bevelEnabled: false }), 0, H + .12, z); }
  put(O, 'windowWarm', new T.CircleGeometry(.36, 20), 0, H + .85, D + .17); cyl(O, 'trim', .43, .43, .05, 0, H + .85, D + .15, Math.PI / 2);
  mark(O, 'roofDark', .52, 0, H + .85, D + .18);
  box(O, 'brick', .56, 1.4, .56, 2.2, H + 1.5, -1.5); box(O, 'roofDark', .68, .12, .68, 2.2, H + 2.23, -1.5);
  // Door frame, porch step, doormat with the mark, a porch lamp and window boxes.
  for (const s of [-1, 1]) box(O, 'trim', .12, DOOR_H + .1, .2, s * (DOOR + .06), DOOR_H / 2, D + .02); box(O, 'trim', DOOR * 2 + .36, .14, .22, 0, DOOR_H + .07, D + .02);
  box(O, 'stone', 2.0, .12, .7, 0, .06, D + .45); box(O, 'mat', 1.1, .02, .55, 0, .13, D + .45); mark(O, 'markInk', .4, 0, .142, D + .45, -Math.PI / 2);
  box(O, 'black', .16, .26, .14, DOOR + .45, 2.05, D + .16); box(O, 'lamp', .11, .18, .1, DOOR + .45, 2.03, D + .2);
  const frontWindows = [-2.3, 2.3];
  for (const x of frontWindows) {
    box(O, 'trim', 1.62, 1.22, .06, x, 1.6, D + .1); box(O, 'windowWarm', 1.44, 1.04, .02, x, 1.6, D + .135); box(O, 'trim', .06, 1.04, .03, x, 1.6, D + .15); box(O, 'trim', 1.44, .06, .03, x, 1.6, D + .15);
    box(O, 'wood', 1.6, .22, .3, x, .92, D + .22); for (let i = 0; i < 5; i++) ball(O, i % 2 ? 'red' : 'yellow', .09, 1, x - .6 + i * .3, 1.1, D + .24); ball(O, 'leaf', .5, .35, x, 1.06, D + .22);
    // The inside of the same window shows the night outside.
    put(O, 'sky', new T.PlaneGeometry(1.4, 1), x, 1.6, D - .075, 0, Math.PI); box(O, 'trim', 1.56, 1.16, .04, x, 1.6, D - .07);
  }
  // The yard: a small tree and a mailbox with the mark on its flag.
  cyl(O, 'woodDark', .1, .14, 1.1, -4.15, .55, 4.4); ball(O, 'leaf', .58, 1.1, -4.15, 1.42, 4.4); ball(O, 'leafDark', .4, 1, -3.92, 1.8, 4.25);
  cyl(O, 'woodDark', .05, .05, .9, 3.6, .45, 4.75); box(O, 'red', .34, .3, .5, 3.6, 1.0, 4.75); mark(O, 'markInk', .16, 3.775, 1.02, 4.75, 0, Math.PI / 2);

  // ---- Living room. Sofa on the left wall, TV on the right, PC at the back. ----
  box(O, 'rug', 3.6, .016, 2.7, -.45, .008, -.45);
  // Sofa faces +X (towards the TV). Its frame +X is world -Z.
  const sofa = M(-2.6, 0, -.45, Math.PI / 2);
  box(sofa, 'sofa', 2.7, .34, .95, 0, .17, 0); box(sofa, 'cushion', 1.25, .14, .82, -.64, .41, .05); box(sofa, 'cushion', 1.25, .14, .82, .64, .41, .05);
  box(sofa, 'sofa', 2.7, .75, .26, 0, .7, -.36); for (const s of [-1, 1]) box(sofa, 'sofa', .26, .58, .95, s * 1.42, .42, 0);
  box(sofa, 'pillow', .36, .32, .12, -1.1, .64, -.18, -.2, .3); box(sofa, 'pillow2', .36, .32, .12, 1.1, .64, -.18, -.2, -.3);
  mark(at(sofa, -1.1, .64, -.18, .3, -.2), 'markInk', .17, 0, 0, .062); mark(at(sofa, 1.1, .64, -.18, -.3, -.2), 'markInk', .17, 0, 0, .062);
  // Window above the sofa with the constellation in its sky.
  { const f = M(-W + .075, 1.85, -.45, Math.PI / 2); box(f, 'trim', 1.9, 1.3, .05); put(f, 'sky', new T.PlaneGeometry(1.74, 1.14), 0, 0, .03); box(f, 'trim', .05, 1.14, .02, 0, 0, .04); box(f, 'trim', 1.74, .05, .02, 0, 0, .04); box(f, 'wood', 2.0, .06, .18, 0, -.68, .08); }
  // Coffee table: the little heybox, a mug, snacks and a spare pad.
  const table = M(-.85, 0, -.45);
  cyl(table, 'wood', .72, .72, .06, 0, .38, 0); cyl(table, 'woodDark', .09, .12, .35, 0, .18, 0); cyl(table, 'woodDark', .42, .42, .03, 0, .015, 0);
  cyl(table, 'woodDark', .2, .2, .03, 0, .425, 0);
  cyl(table, 'white', .065, .058, .14, .42, .48, .28); box(table, 'white', .02, .07, .05, .49, .48, .28); mark(table, 'red', .07, .42, .485, .346, 0, .35);
  cyl(table, 'beanbag', .17, .12, .08, -.38, .45, .3); for (let i = 0; i < 5; i++) ball(table, 'yellow', .045, .7, -.38 + Math.cos(i * 1.3) * .08, .5, .3 + Math.sin(i * 1.3) * .08);
  // TV wall. The frame faces -X; its +X is world +Z.
  const tv = M(W - .32, 0, -.45, -Math.PI / 2);
  box(tv, 'woodDark', 2.2, .46, .5, 0, .23, .02); box(tv, 'black', 2.4, 1.36, .07, 0, 1.45, -.17);
  screen(tv, 'split', 2.3, 1.26, 0, 1.45, -.13, 0, 1.25, [512, 288]);
  box(tv, 'white', .16, .58, .44, -.75, .75, .02); box(tv, 'black', .07, .56, .36, -.75, .75, .02); box(tv, 'black', .34, .32, .32, .72, .62, .02); box(tv, 'xbox', .2, .012, .2, .72, .785, .02);
  // Back wall: PC corner, the neon mark, posters and a shelf of toys from the three worlds.
  const pc = M(-2.1, 0, -D + .46);
  box(pc, 'wood', 1.7, .06, .78, 0, .64, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(pc, 'woodDark', .06, .64, .06, sx * .78, .32, sz * .33);
  box(pc, 'black', .32, .02, .2, 0, .68, -.2); box(pc, 'black', .06, .4, .06, 0, .88, -.24); box(pc, 'black', 1.2, .7, .05, 0, 1.22, -.24);
  screen(pc, 'feed', 1.12, .62, 0, 1.22, -.213, 0, 1.25);
  box(pc, 'black', .72, .03, .22, -.05, .685, .1); box(pc, 'rgbA', .72, .012, .012, -.05, .672, .21); box(pc, 'black', .07, .035, .11, .48, .69, .12);
  box(pc, 'black', .3, .64, .62, 1.12, .32, -.05); box(pc, 'rgbB', .012, .5, .012, 1.27, .34, .26); box(pc, 'rgbA', .012, .5, .012, 1.27, .34, -.36);
  // He has spun his chair round to say hi.
  const chair = at(pc, .55, 0, .95, Math.PI * .78);
  cyl(chair, 'black', .32, .32, .04, 0, .03, 0); cyl(chair, 'metal', .04, .04, .4, 0, .24, 0); box(chair, 'chair', .6, .09, .58, 0, .46, 0);
  box(chair, 'chair', .6, .62, .09, 0, .82, .29); box(chair, 'red', .14, .6, .095, 0, .82, .29);
  box(O, 'trim', .7, .94, .03, -3.35, 1.75, -D + .085); box(O, 'poster', .6, .84, .02, -3.35, 1.75, -D + .1);
  mark(O, 'neon', .62, -2.1, 2.2, -D + .1); box(O, 'woodDark', .9, .82, .02, -2.1, 2.2, -D + .08);
  box(O, 'trim', .9, .7, .03, 2.95, 1.95, -D + .085); box(O, 'toyPoster', .8, .6, .02, 2.95, 1.95, -D + .1);
  // The welcome sign is a framed painting over the sofa corner, lit by a small picture lamp.
  box(O, 'woodDark', 1.5, .74, .05, -.62, 1.98, -D + .095); box(O, 'gold', 1.4, .64, .02, -.62, 1.98, -D + .12); box(O, 'welcome', 1.32, .56, .01, -.62, 1.98, -D + .132);
  box(O, 'black', .5, .05, .1, -.62, 2.42, -D + .17); box(O, 'lamp', .44, .015, .05, -.62, 2.395, -D + .19);
  const shelf = M(1.2, 0, -D + .22);
  for (const y of [1.15, 1.7]) box(shelf, 'wood', 1.5, .05, .32, 0, y, 0);
  box(shelf, 'red', .22, .1, .14, -.45, 1.26, 0); for (const x of [-.53, -.37]) cyl(shelf, 'black', .035, .035, .16, x, 1.215, 0, 0, 0, Math.PI / 2);
  box(shelf, 'yellow', .13, .16, .1, -.05, 1.26, 0); box(shelf, 'yellow', .11, .09, .09, -.05, 1.39, 0); box(shelf, 'black', .07, .02, .01, -.05, 1.4, .046);
  cyl(shelf, 'white', .0, .06, .26, .38, 1.27, 0, Math.PI / 2); box(shelf, 'red', .3, .02, .08, .38, 1.24, .04);
  for (let i = 0; i < 6; i++) box(shelf, ['red', 'blue', 'yellow', 'pillow2', 'white', 'black'][i], .06, .3, .22, -.55 + i * .08, 1.875, 0);
  ball(shelf, 'leaf', .14, 1, .45, 1.86, 0); cyl(shelf, 'pot', .09, .07, .14, .45, 1.79, 0);
  // Corners: floor lamp beside the sofa, plants, a beanbag and two floor cushions.
  const lampFrame = M(-3.45, 0, -1.95); cyl(lampFrame, 'black', .24, .26, .05, 0, .025, 0); cyl(lampFrame, 'metal', .025, .025, 1.65, 0, .85, 0); cyl(lampFrame, 'lamp', .2, .32, .36, 0, 1.75, 0);
  for (const [x, z, s] of [[3.45, -3.05, 1], [3.45, 2.0, .8]]) { const f = M(x, 0, z); cyl(f, 'pot', .24 * s, .18 * s, .42 * s, 0, .21 * s, 0); ball(f, 'leaf', .38 * s, 1.25, 0, .82 * s, 0); ball(f, 'leafDark', .26 * s, 1.2, .18 * s, 1.15 * s, .08 * s); }
  const bean = M(2.6, 0, -1.25); ball(bean, 'beanbag', .55, .55, 0, .3, 0); ball(bean, 'beanbag', .42, .9, -.32, .5, 0);
  const cushionA = M(1.2, 0, -.05), cushionB = M(-1.75, 0, 1.3);
  cyl(cushionA, 'pillow2', .4, .42, .16, 0, .08, 0); cyl(cushionB, 'pillow', .42, .44, .16, 0, .08, 0); mark(cushionB, 'markInk', .3, 0, .162, 0, -Math.PI / 2);

  // Devices are built in each player's frame. +Z is the character's front.
  const HAND = .2, REACH = .3;
  const controller = (f, body, accent) => { box(f, body, .42, .085, .17, 0, HAND, REACH); for (const s of [-1, 1]) box(f, body, .13, .09, .2, s * .17, HAND - .02, REACH - .06, 0, s * .25);
    box(f, 'black', .14, .012, .07, 0, HAND + .047, REACH); box(f, accent, accent === 'ps' ? .16 : .045, .012, .03, 0, HAND + .05, REACH + (accent === 'ps' ? -.05 : .05)); };
  const handheld = f => { const d = at(f, 0, HAND + .03, REACH, 0, .9);
    box(d, 'grey', .64, .24, .045, 0, 0, 0); box(d, 'black', .07, .07, .05, -.25, -.03, 0); box(d, 'black', .07, .07, .05, .25, -.03, 0);
    return screen(d, 'deck', .32, .19, 0, 0, -.024, Math.PI, 1.35); };

  // Six friends. Kenney models face +Z; `toView` turns a frame towards your seat by the door.
  const toView = (x, z) => Math.atan2(-.5 - x, 3.3 - z);
  const roster = [
    { file: 'male-a', frame: at(chair, 0, .5, -.02, Math.PI), sit: true, arms: 'down', wave: 1, lag: .05 },
    { file: 'male-f', frame: at(sofa, .62, .46, .08), sit: true, arms: 'hold', nod: true, lag: .3 },
    { file: 'female-f', frame: at(sofa, -.62, .46, .08), sit: true, arms: 'hold', wave: 1, lag: 0 },
    { file: 'female-b', frame: at(bean, .05, .45, .1, Math.PI / 2), sit: true, arms: 'hold', nod: true, lag: .4 },
    { file: 'female-c', frame: at(cushionA, 0, .16, 0, toView(1.2, -.05)), sit: true, arms: 'hold', offer: true, lag: .12 },
    { file: 'male-b', frame: M(.55, 0, -2.85, toView(.55, -2.85)), sit: false, arms: 'phone', wave: 1, lag: .22 }
  ];
  bubble('heart', roster[2].frame, .1, 1.15); bubble('smile', roster[5].frame, .3, 1.35); bubble('mark', roster[1].frame, .5, 1.15);
  controller(roster[1].frame, 'black', 'xbox'); controller(roster[2].frame, 'white', 'ps');
  handheld(roster[3].frame);
  { const f = roster[5].frame; cyl(f, 'white', .055, .05, .12, .3, HAND + .2, REACH - .05); mark(f, 'red', .06, .3, HAND + .2, REACH + .007); }
  // The spare pad the friend on the cushion holds out to you.
  const spare = new T.Group(); spare.name = 'spare-controller'; group.add(spare);
  { const parts = []; const add = (g, x, y, z, ry = 0) => { g.applyMatrix4(M(x, y, z, ry)); parts.push(g); };
    add(new T.BoxGeometry(.42, .085, .17), 0, 0, 0); for (const s of [-1, 1]) add(new T.BoxGeometry(.13, .09, .2), s * .17, -.02, -.06, s * .25);
    const m = new T.Mesh(keep(mergeGeometries(parts)), mats.red); parts.forEach(g => g.dispose()); spare.add(m);
    const pads = new T.Mesh(keep(new T.BoxGeometry(.3, .012, .06)), mats.black); pads.position.y = .048; spare.add(pads); }
  const spareFrom = new T.Vector3().setFromMatrixPosition(at(roster[4].frame, 0, HAND, REACH)), spareTo = new T.Vector3(), spareQ = new T.Quaternion().setFromRotationMatrix(roster[4].frame);

  // Little greeting bubbles pop up over the friends: a heart, a smile and the mark.
  function bubble(icon, frame, lag, lift = 1.35) {
    const map = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#fff8ec'; g.strokeStyle = '#3a2a22'; g.lineWidth = 6; g.beginPath(); g.roundRect(10, 10, 108, 88, 30); g.moveTo(52, 96); g.lineTo(60, 120); g.lineTo(76, 96); g.fill(); g.stroke();
      g.fillStyle = '#fff8ec'; g.fillRect(50, 88, 28, 10);
      if (icon === 'heart') { g.fillStyle = '#ef5b4c'; g.beginPath(); g.moveTo(64, 82); g.bezierCurveTo(20, 54, 34, 18, 64, 40); g.bezierCurveTo(94, 18, 108, 54, 64, 82); g.fill(); }
      else if (icon === 'smile') { g.fillStyle = '#f3c33c'; g.beginPath(); g.arc(64, 54, 30, 0, 7); g.fill(); g.fillStyle = '#3a2a22'; g.fillRect(52, 42, 6, 10); g.fillRect(70, 42, 6, 10); g.lineWidth = 5; g.beginPath(); g.arc(64, 56, 16, .3, Math.PI - .3); g.stroke(); }
      else drawHeyboxMark(g, 64, 54, 60, '#ef5b4c');
    });
    if (!map) return; const sprite = new T.Sprite(keep(new T.SpriteMaterial({ map, transparent: true, depthWrite: false })));
    sprite.position.setFromMatrixPosition(frame).y += lift; sprite.scale.setScalar(0); group.add(sprite); bubbles.push({ sprite, lag, base: sprite.position.y, seed: bubbles.length * 2.1 });
  }

  // A sleepy cat on the rug, tail swishing.
  const cat = new T.Group(); cat.name = 'rug-cat'; cat.position.set(-.1, 0, .85); cat.rotation.y = .6; group.add(cat);
  const catBody = new T.Mesh(keep(new T.SphereGeometry(.2, 12, 8)), mats.cat); catBody.scale.set(1.2, .62, .85); catBody.position.y = .12; cat.add(catBody);
  const catHead = new T.Group(); catHead.position.set(.22, .17, .05); cat.add(catHead);
  { const head = new T.Mesh(keep(new T.SphereGeometry(.11, 12, 8)), mats.cat); head.scale.set(1, .9, 1); catHead.add(head);
    const ear = keep(new T.ConeGeometry(.045, .08, 4)); for (const s of [-1, 1]) { const e = new T.Mesh(ear, mats.cat); e.position.set(.01, .09, s * .055); catHead.add(e); }
    const muzzle = new T.Mesh(keep(new T.SphereGeometry(.05, 8, 6)), mats.catLight); muzzle.position.set(.08, -.02, 0); catHead.add(muzzle); }
  const tail = new T.Group(); tail.position.set(-.22, .1, 0); cat.add(tail);
  { const t = new T.Mesh(keep(new T.CylinderGeometry(.03, .035, .32, 6)), mats.cat); t.rotation.z = Math.PI / 2.3; t.position.set(-.12, .04, 0); tail.add(t); }

  // Everything solid casts into the room light; ceilings, roof and flat floor layers only receive.
  const NO_CAST = new Set(['ceiling', 'roof', 'roofDark', 'sky', 'windowWarm', 'lamp', 'floor', 'rug', 'grass', 'dirt', 'dirtDark', 'mat', 'markInk']);
  for (const [key, list] of batches) {
    const merged = mergeGeometries(list.filter(g => g.attributes.position.count).map(g => g.index ? g.toNonIndexed() : g), false); list.forEach(g => g.dispose());
    if (!merged) continue; keep(merged); const mesh = new T.Mesh(merged, mats[key]); mesh.name = 'room-' + key; group.add(mesh);
    mesh.receiveShadow = true; mesh.castShadow = !NO_CAST.has(key);
  }
  // The front door swings out onto the porch on its left hinge.
  const door = new T.Group(); door.name = 'front-door'; door.position.set(-DOOR, 0, D + .01); group.add(door);
  { const slab = new T.Mesh(keep(new T.BoxGeometry(DOOR * 2 - .02, DOOR_H - .02, .08)), mats.door); slab.position.set(DOOR, DOOR_H / 2, 0); door.add(slab);
    const glass = new T.Mesh(keep(new T.CircleGeometry(.17, 16)), mats.windowWarm); glass.position.set(DOOR, 1.62, .045); door.add(glass);
    const knob = new T.Mesh(keep(new T.SphereGeometry(.05, 10, 8)), mats.gold); knob.position.set(DOOR * 2 - .16, 1.0, .07); door.add(knob);
    const plate = new T.Mesh(keep(new T.BoxGeometry(.3, .2, .02)), mats.gold); plate.position.set(DOOR, 1.25, .05); door.add(plate);
    for (const s of heyboxMarkShapes(T, .15)) { const m = new T.Mesh(keep(new T.ShapeGeometry(s, 6)), mats.ink); m.position.set(DOOR, 1.25, .062); door.add(m); } }
  for (const o of [door, cat, spare]) o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  // String lights: along the roof edges outside, and across the room inside.
  const bulbSpots = [];
  for (let i = 0; i < 22; i++) { const u = i / 21, s = u < .5 ? -1 : 1, k = u < .5 ? u * 2 : (1 - u) * 2; bulbSpots.push([s * roofHalf * (1 - k), H + .02 + rise * k, D + .66]); }
  for (let i = 0; i < 26; i++) { const u = i / 25, sag = Math.abs(Math.sin(u * Math.PI * 4)) * .18; bulbSpots.push(u < .5 ? [-W + .15, H - .25 - sag, -D + .2 + u * 2 * (2 * D - .8)] : [-W + .2 + (u - .5) * 2 * (2 * W - .4), H - .25 - sag, -D + .15]); }
  const bulbs = new T.InstancedMesh(keep(new T.SphereGeometry(.05, 8, 6)), glowing(0xffc27a, 3.2), bulbSpots.length), dummy = new T.Object3D();
  bulbSpots.forEach((p, i) => { dummy.position.set(...p); dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix); }); bulbs.frustumCulled = false; group.add(bulbs);
  // The real heybox sits on the coffee table on a slow turntable.
  const boxHolder = new T.Group(); boxHolder.name = 'table-heybox'; boxHolder.position.set(-.85, .44, -.45); group.add(boxHolder);
  if (core?.group) {
    core.group.removeFromParent(); core.group.position.set(0, 0, 0); core.group.rotation.set(0, 0, 0); core.group.scale.setScalar(1); boxHolder.add(core.group);
    // Measure the closed box on its own, so the fit is in table space.
    core.ready?.then(() => { if (disposed) return; core.update(0, 0); boxHolder.remove(core.group); core.group.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(core.group), s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3()), k = .8 / Math.max(.001, s.x, s.y);
      core.group.scale.setScalar(k); core.group.position.set(-c.x * k, -b.min.y * k + .005, -c.z * k); boxHolder.add(core.group);
      core.group.traverse(m => { if (m.isMesh) m.castShadow = true; }); }); }

  const lampLight = new T.PointLight(0xffb070, 0, 0, 2); lampLight.position.set(-3.3, 2.0, -1.8);
  const roomLight = new T.PointLight(0xffc89a, 0, 0, 2); roomLight.position.set(.1, 2.35, .3);
  const porchLight = new T.PointLight(0xffb469, 0, 0, 2); porchLight.position.set(DOOR + .45, 2.0, D + .6);
  const warmth = new T.HemisphereLight(0xffe4c4, 0x6b4630, 0);
  // Ceiling key light: the one light that casts, so furniture and friends sit on the floor.
  const keyLight = new T.SpotLight(0xffd9b0, 0, 0, 1.2, .8, 1); keyLight.position.set(1.5, 2.55, 1.6); keyLight.target.position.set(-.9, 0, -1.4);
  keyLight.castShadow = true; keyLight.shadow.camera.near = .2; keyLight.shadow.camera.far = 9; keyLight.shadow.normalBias = .02; keyLight.shadow.bias = -.0004; keyLight.shadow.radius = 4; keyLight.shadow.blurSamples = 12;
  rig.add(lampLight, roomLight, porchLight, warmth, keyLight, keyLight.target);

  // Kenney rigs: root, torso, head, arm-left/right, leg-left/right. Rest pose is a T-pose.
  const rot = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x * DEG, y * DEG, z * DEG));
  const POSE = { down: [rot(0, 0, -45), rot(0, 0, 45)], hold: [rot(0, -60, -12), rot(0, 60, 12)], phone: [rot(0, -62, -8), rot(0, 0, 45)], offer: [rot(0, -78, 6), rot(0, 78, -6)] };
  const SIT = rot(-78, 0, 0), STAND = rot(0, 0, 0), WAVE_A = rot(0, 40, -20), WAVE_B = rot(0, 40, -75), qa = new T.Quaternion();
  let loadState = 'idle', disposed = false;
  function load() {
    if (loadState !== 'idle' || disposed) return; loadState = 'loading';
    const loader = new GLTFLoader();
    Promise.all(roster.map(r => loader.loadAsync(new URL(`./models/players/character-${r.file}.glb`, import.meta.url).href).then(gltf => {
      if (disposed) { dispose(gltf.scene); return; }
      const model = gltf.scene; model.scale.setScalar(1.5); r.frame.decompose(model.position, model.quaternion, new T.Vector3());
      model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; owned.add(o.geometry); for (const m of [o.material].flat()) { owned.add(m); if (m.map) owned.add(m.map); m.envMapIntensity = .3; m.color.setScalar(.82); } o.castShadow = o.receiveShadow = true; } });
      const bone = n => model.getObjectByName(n);
      const c = { ...r, model, root: bone('root'), torso: bone('torso'), head: bone('head'), armL: bone('arm-left'), armR: bone('arm-right'), legL: bone('leg-left'), legR: bone('leg-right'), yaw: (v => Math.atan2(v.x, v.z))(new T.Vector3(0, 0, 1).transformDirection(r.frame)), seed: characters.length * 1.7 };
      group.add(model); characters.push(c);
    }).catch(error => console.warn('[living-room] player model unavailable', r.file, error)))).then(() => { loadState = 'loaded'; });
  }
  const camLocal = new T.Vector3(), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function pose(c, t, greet, reduced) {
    if (c.root) c.root.position.y = c.sit ? -.15 : 0;
    for (const leg of [c.legL, c.legR]) leg?.quaternion.copy(c.sit ? SIT : STAND);
    const g = clamp((greet - c.lag) / .55), base = POSE[c.offer && g > 0 ? 'offer' : c.arms] || POSE.down, breathe = reduced ? 0 : Math.sin(t * 1.7 + c.seed) * .025;
    c.armL?.quaternion.copy(POSE[c.arms][0]).slerp(base[0], g); c.armR?.quaternion.copy(POSE[c.arms][1]).slerp(base[1], g);
    // Before you arrive they play; then torso and head share the turn towards you.
    const play = reduced ? 0 : Math.sin(t * 2.3 + c.seed) * .05 * (1 - g);
    const want = wrap(Math.atan2(camLocal.x - c.model.position.x, camLocal.z - c.model.position.z) - c.yaw), turn = Math.max(-1.9, Math.min(1.9, want)) * g;
    c.torso?.quaternion.setFromEuler(new T.Euler(breathe + (c.offer ? .22 * g : 0), turn * .42 + play, 0));
    c.head?.quaternion.setFromEuler(new T.Euler((c.nod && !reduced ? Math.max(0, Math.sin(t * 6.5)) * .2 * g : 0) - .1 * g, turn * .58, reduced ? 0 : Math.sin(t * .9 + c.seed) * .05 + .12 * g * Math.sin(c.seed)));
    if (c.wave && c.armR) { const w = g * c.wave; if (!reduced) qa.copy(WAVE_A).slerp(WAVE_B, .5 + .5 * Math.sin(t * 8.5 + c.seed)); else qa.copy(WAVE_A); c.armR.quaternion.slerp(qa, w); }
  }

  // Animated screens. The TV splits four ways: three worlds and an open P4 seat.
  const draw = {
    helmet(g, w, h, t) { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0b1d3a'); bg.addColorStop(1, '#174a72'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#cfefff'; for (let i = 0; i < 30; i++) { const x = ((i * 97.3) % w - t * (18 + i % 5 * 14)) % w; g.fillRect(x < 0 ? x + w : x, (i * 53.7) % h, 1.6, 1.6); }
      const y = h * .55 + Math.sin(t * 1.6) * 9, x = w * .32; g.fillStyle = '#f3ead8'; g.fillRect(x - 16, y - 6, 34, 12); g.fillStyle = '#e8553e'; g.fillRect(x - 6, y - 15, 12, 30); g.fillStyle = '#9fe3ff'; g.fillRect(x + 6, y - 4, 8, 6);
      g.fillStyle = '#ffb35e'; g.fillRect(x - 24 - Math.random() * 6, y - 3, 8, 6); g.fillStyle = '#ff7a59'; for (let i = 0; i < 3; i++) g.fillRect(w * .78 + Math.sin(t + i * 2) * 14, h * (.3 + i * .2), 7, 7); },
    robot(g, w, h, t) { g.fillStyle = '#062420'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2fd6b3aa'; g.lineWidth = 1.2;
      for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(w / 2 + i * 5, h * .42); g.lineTo(w / 2 + i * 36, h); g.stroke(); }
      for (let i = 0; i < 6; i++) { const k = ((i + t * .8) % 6) / 6, y = h * .42 + k * k * h * .58; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#f3b13c'; g.fillRect(w / 2 - 18, h * .16, 36, h * .26); g.fillStyle = '#062420'; g.fillRect(w / 2 - 12, h * .21, 9, 6); g.fillRect(w / 2 + 3, h * .21, 9, 6); },
    car(g, w, h, t) { g.fillStyle = '#e9a868'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff1d3'; g.lineWidth = 10; g.beginPath(); g.ellipse(w / 2, h / 2, w * .36, h * .3, 0, 0, 7); g.stroke();
      g.fillStyle = '#8f5a39'; for (const [x, y] of [[.12, .2], [.88, .25], [.5, .5], [.18, .82], [.85, .8]]) { g.beginPath(); g.arc(x * w, y * h, 7, 0, 7); g.fill(); }
      const a = t * 1.3, x = w / 2 + Math.cos(a) * w * .36, y = h / 2 + Math.sin(a) * h * .3; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = '#e54732'; g.fillRect(-6, -9, 12, 18); g.restore(); },
    join(g, w, h, t) { g.fillStyle = '#1b1620'; g.fillRect(0, 0, w, h); const pulse = .55 + .45 * Math.sin(t * 3);
      drawHeyboxMark(g, w / 2, h * .42, h * .4, `rgba(255,107,79,${.55 + .45 * pulse})`);
      g.fillStyle = '#fff3e0'; g.font = `600 ${Math.round(h * .12)}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText('P4 · 按 A 加入', w / 2, h * .82); g.textAlign = 'start'; },
    split(g, w, h, t) { const hw = w / 2, hh = h / 2;
      [['helmet', 0, 0], ['robot', hw, 0], ['car', 0, hh], ['join', hw, hh]].forEach(([k, x, y]) => { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, hw, hh); g.clip(); draw[k](g, hw, hh, t); g.restore(); });
      g.fillStyle = '#0c0c10'; g.fillRect(hw - 2, 0, 4, h); g.fillRect(0, hh - 2, w, 4); },
    deck(g, w, h, t) { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2a0f4f'); bg.addColorStop(.6, '#ff5e8a'); bg.addColorStop(1, '#ffb15e'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(w / 2, h * .62, h * .28, Math.PI, 0); g.fill(); g.fillStyle = '#1a0830'; g.fillRect(0, h * .62, w, h * .38);
      g.strokeStyle = '#ff5ed8'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y = h * .62 + Math.pow(((i + t) % 6) / 6, 2) * h * .38; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } },
    // A community feed: the app header carries the mark.
    feed(g, w, h, t) { g.fillStyle = '#14171d'; g.fillRect(0, 0, w, h); g.fillStyle = '#20242c'; g.fillRect(0, 0, w, h * .16); drawHeyboxMark(g, h * .1, h * .08, h * .11, '#ff6b4f');
      g.fillStyle = '#e9edf2'; g.fillRect(h * .2, h * .06, w * .2, h * .04);
      const off = (t * 16) % 46; for (let i = -1; i < 5; i++) { const y = h * .2 + i * 46 - off; g.fillStyle = '#232833'; g.fillRect(10, y, w - 20, 38); g.fillStyle = ['#e8553e', '#3fb6b0', '#f3c33c'][(i + 3) % 3]; g.beginPath(); g.arc(26, y + 13, 8, 0, 7); g.fill();
        g.fillStyle = '#ffffff55'; g.fillRect(40, y + 9, (w - 70) * (.4 + ((i + 5) % 3) * .15), 5); g.fillStyle = '#ffffff30'; g.fillRect(40, y + 21, (w - 70) * .7, 4); g.fillStyle = '#ff6b4f'; g.fillRect(w - 34, y + 26, 10, 6); } }
  };

  let paintTick = 0, painted = false;
  function update({ progress = 0, time = 0, dt = 0, reduced = false, camera, quality = 'standard' } = {}) {
    const p = progress; if (p > .78) load();
    const visible = p > .885; group.visible = visible;
    const open = smooth(.866, .888, p), inside = smooth(.94, .965, p), greet = smooth(.952, .99, p), seated = smooth(.972, 1, p);
    porchLight.intensity = visible ? 2.2 * (1 - inside * .6) : 0; lampLight.intensity = visible ? 2.6 * Math.max(.25, inside) : 0;
    roomLight.intensity = visible ? 1.3 * Math.max(.3, inside) : 0; warmth.intensity = visible ? .22 * inside : 0;
    keyLight.intensity = visible ? 10 * inside : 0; keyLight.castShadow = visible && inside > 0;
    const size = quality === 'ultra' ? 2048 : 1024; if (keyLight.shadow.mapSize.x !== size) { keyLight.shadow.mapSize.set(size, size); keyLight.shadow.map?.dispose(); keyLight.shadow.map = null; }
    if (!visible) return;
    door.rotation.y = -open * 1.75;
    if (camera) { camLocal.copy(camera.position); group.worldToLocal(camLocal); }
    for (const c of characters) pose(c, time, greet, reduced);
    // The spare pad rises from her hands towards you.
    const offer = clamp((greet - .12) / .55); spareTo.copy(camLocal).sub(spareFrom).multiplyScalar(.22).add(spareFrom); spareTo.y = spareFrom.y + .12 * offer;
    spare.position.lerpVectors(spareFrom, spareTo, offer); spare.quaternion.copy(spareQ); spare.rotateX(-.35 * offer);
    for (const b of bubbles) { const k = clamp((greet - b.lag) / .3), pop = k <= 0 ? 0 : 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * .35;
      b.sprite.scale.setScalar(.5 * pop * k ** .3); b.sprite.position.y = b.base + (reduced ? 0 : Math.sin(time * 2 + b.seed) * .03); }
    tail.rotation.y = reduced ? 0 : Math.sin(time * 1.6) * .6; catBody.scale.y = .62 * (1 + (reduced ? 0 : Math.sin(time * 2.1) * .03)); catHead.rotation.z = .25 * greet;
    if (core?.group) { core.update(.05 * seated, time, { reduced, ultra: quality === 'ultra', opacity: 1 }); boxHolder.rotation.y = reduced ? .12 : .12 + Math.sin(time * .5) * .08; }
    // Repaint screens at ~20 Hz once the door opens; the reduced setting keeps a still frame.
    paintTick += dt; if (open <= 0 || (paintTick < .05 && painted)) return; paintTick = 0;
    for (const s of screens) { if (!s.ctx || (reduced && s.painted)) continue; draw[s.kind](s.ctx, s.canvas.width, s.canvas.height, reduced ? 0 : time); s.texture.needsUpdate = true; s.painted = true; }
    painted = true;
  }
  function dispose(object) {
    if (object) { object.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat()) { m?.map?.dispose?.(); m?.dispose?.(); } }); return; }
    disposed = true; if (core?.group?.parent === boxHolder) boxHolder.remove(core.group);
    group.removeFromParent(); rig.removeFromParent(); owned.forEach(r => r.dispose?.()); owned.clear(); bulbs.dispose?.();
  }
  // The opening the grains stream through, in room units: centre line outside and inside the wall.
  const doorway = { group, outside: [0, 1.0, D + .75], inside: [0, 1.0, D - .7], halfWidth: .34, halfHeight: .5, approach: 1.6 };
  return { group, doorway, update, load, dispose: () => dispose() };
}
