import { createToyShip, createToyCarrier } from './toy-ship.js?v=journey-36';
import { heyboxMarkShapes } from './heybox-mark.js?v=journey-36';

/* DEEP SPACE RESCUE, flat edition. A side-scrolling toy shooter on a cardboard
 * stage: the camera looks straight at the XY play plane, cut-out scenery layers
 * scroll past at different speeds, and a low sun throws real shadows onto the
 * painted backdrop. Every stage, ship and effect resource belongs to this module;
 * the showcase ship passed in as `model` stays with the host. */
export function createGame({ THREE: T, scene, camera, model, emit = () => {}, sound = () => {}, width = 1280, height = 720, reduced = false }) {
  void model;
  const root = new T.Group(); root.name = 'Toy space stage · deep space rescue';
  const prior = { background: scene.background, fog: scene.fog, environment: scene.environment, environmentIntensity: scene.environmentIntensity, lights: [] };
  scene.traverse(o => { if (o.isLight) { prior.lights.push([o, o.visible]); o.visible = false; } });
  scene.add(root); scene.background = new T.Color(0xf5aa58); scene.fog = null; scene.environment = null;
  const owned = new Set(), own = x => (owned.add(x), x);
  const clamp = T.MathUtils.clamp, damp = T.MathUtils.damp, lerp = T.MathUtils.lerp;
  let seed = 7121;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + random() * (b - a);
  const audio = (name, options = {}) => { try { sound(name, { world: 'flight', ...options }); } catch {} };
  const FOV = 30, maxDifficulty = 3, maxHearts = 3, rescueGoal = 5, escortLength = 34;
  const phaseNames = ['救援宇航员', '清除封锁', '护送曙光号', '救援完成'];
  const controls = '方向键 / WASD 移动 · 空格或左键射击 · Shift 冲刺';

  // Lighting matches the toy park: warm sky fill and one shadow-casting sun.
  const hemi = new T.HemisphereLight(0xffedd3, 0xd1834b, 2.1); root.add(hemi);
  const sun = new T.DirectionalLight(0xffe5bd, 2.4); sun.position.set(-14, 26, 72); sun.target.position.set(0, 0, 0); root.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(reduced ? 1024 : 2048, reduced ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 46, bottom: -46, near: 20, far: 130 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 3;

  const toy = (color, extra = {}) => own(new T.MeshStandardMaterial({ color, roughness: .82, metalness: 0, flatShading: true, ...extra }));
  const glow = color => own(new T.MeshBasicMaterial({ color, toneMapped: false }));
  const mat = {
    cream: toy(0xfff0d6), mint: toy(0x9fd9c0), lilac: toy(0xc6b3e6), peach: toy(0xffc58f), coral: toy(0xf28b66), stick: toy(0x8a5a3b),
    hill: toy(0xd98a55), hillDark: toy(0xc4733f), rock: toy(0xa86a45), rockDark: toy(0x8a5236),
    sun: toy(0xffe3a3, { emissive: 0xffbf66, emissiveIntensity: .45 }), white: toy(0xf7f3ea), visor: toy(0x3c7fd0, { roughness: .3, flatShading: false }), orange: toy(0xf08a3c),
    star: toy(0xffd45c, { emissive: 0xffaa33, emissiveIntensity: .3 }), heart: toy(0xe0483a, { emissive: 0xa82418, emissiveIntensity: .3 }),
    station: toy(0xe8dcc4), stripe: toy(0x2a6fc4), ink: toy(0x593724),
    shot: glow(0x2f80ee), enemyShot: glow(0xc4306c), flame: glow(0xffa34a)
  };
  const geo = {
    box: own(new T.BoxGeometry(1, 1, 1)), ball: own(new T.IcosahedronGeometry(1, 1)), rock: own(new T.IcosahedronGeometry(1, 0)),
    disc: own(new T.CylinderGeometry(1, 1, 1, 28).rotateX(Math.PI / 2)), ring: own(new T.TorusGeometry(1, .08, 6, 40)), fatRing: own(new T.TorusGeometry(1, .3, 8, 36)),
    shot: own(new T.CapsuleGeometry(.24, 1.1, 3, 8).rotateZ(Math.PI / 2)), enemyShot: own(new T.IcosahedronGeometry(.62, 1)),
    stick: own(new T.CylinderGeometry(.09, .09, 1, 6).translate(0, .5, 0)), flame: own(new T.ConeGeometry(.42, 1, 8).rotateX(Math.PI / 2).translate(0, 0, .5))
  };
  const extrude = (shape, depth = .45) => own(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .07, bevelThickness: .07, bevelSegments: 1, curveSegments: 6 }).center());
  { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .45 : 1, a = Math.PI / 2 + i * Math.PI / 5; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); geo.star = extrude(s); }
  { const s = new T.Shape(); s.moveTo(0, -.9); s.bezierCurveTo(-.2, -.6, -1, -.2, -1, .3); s.bezierCurveTo(-1, .8, -.4, 1, 0, .55); s.bezierCurveTo(.4, 1, 1, .8, 1, .3); s.bezierCurveTo(1, -.2, .2, -.6, 0, -.9); geo.heart = extrude(s); }
  const mesh = (geometry, material, parent = root, p = [0, 0, 0], s = [1, 1, 1], cast = true) => {
    const m = new T.Mesh(geometry, material); m.position.set(...p); m.scale.set(...s); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };
  function canvasTexture(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = own(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; return t;
  }

  // ---- The cardboard stage ------------------------------------------------
  const view = { halfW: 32, halfH: 18, distance: 67, top: 12, bottom: -13, left: -29, right: 17, centerY: .4 };
  function frame() {
    const aspect = Math.max(.3, camera.aspect || width / height);
    view.halfH = Math.max(18, 20 / aspect); view.halfW = view.halfH * aspect;
    view.distance = view.halfH / Math.tan(T.MathUtils.degToRad(FOV / 2));
    // Portrait screens get a taller sky lane, centred, with the ground under the touch pad.
    const portrait = aspect < 1;
    view.centerY = portrait ? -15.6 + view.halfH * .6 : .4;
    view.top = portrait ? view.centerY + view.halfH * .62 : Math.min(view.halfH - 5, 12.5); view.bottom = -13.4;
    view.left = -view.halfW + 2.6; view.right = view.halfW * .55;
  }
  const halfWAt = z => view.halfW * (view.distance - z) / view.distance;
  const skyMap = canvasTexture(512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#ea8b4f'); grad.addColorStop(.6, '#f5aa58'); grad.addColorStop(1, '#ffd9a4');
    g.fillStyle = grad; g.fillRect(0, 0, w, h); g.fillStyle = '#fff0d6';
    for (let i = 0; i < 70; i++) { g.globalAlpha = .35 + random() * .5; g.beginPath(); g.arc(random() * w, random() * h * .75, .8 + random() * 2.2, 0, Math.PI * 2); g.fill(); }
  });
  skyMap.repeat.set(2, 1);
  const backdrop = mesh(own(new T.PlaneGeometry(420, 220)), own(new T.MeshStandardMaterial({ map: skyMap, color: 0xc9c9c9, roughness: 1 })), root, [0, 12, -12], [1, 1, 1], false);
  const groundMap = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#e6a066'; g.fillRect(0, 0, w, h); g.fillStyle = '#d68a52';
    for (let i = 0; i < 9; i++) { const x = random() * w, y = 10 + random() * 44, r = 4 + random() * 9; g.beginPath(); g.ellipse(x, y, r, r * .55, 0, 0, Math.PI * 2); g.fill(); }
  });
  groundMap.repeat.set(26, 1);
  const groundSide = toy(0xd98a55), groundTop = own(new T.MeshStandardMaterial({ color: 0xf3c08a, roughness: 1 }));
  const groundFront = own(new T.MeshStandardMaterial({ map: groundMap, roughness: 1 }));
  mesh(geo.box, [groundSide, groundSide, groundTop, groundSide, groundFront, groundSide], root, [0, -35.6, -2], [420, 40, 20], false);
  const sunDisc = mesh(geo.disc, mat.sun, root, [16, 10, -11.4], [4.6, 4.6, .4], false);
  // Parallax layers: every prop scrolls at its own fraction of the flight speed
  // and wraps from the left edge back to the right, so the stage never ends.
  const layers = [];
  function layer(z, speed, items) { const l = { z, speed, items }; layers.push(l); return l; }
  function planet(color, r, ringed) {
    const g = new T.Group(); root.add(g);
    mesh(geo.disc, color, g, [0, 0, 0], [r, r, .8]);
    mesh(geo.disc, mat.cream, g, [-r * .35, r * .3, .45], [r * .18, r * .18, .1], false); mesh(geo.disc, mat.cream, g, [r * .3, -r * .25, .45], [r * .12, r * .12, .1], false);
    if (ringed) { const ring = mesh(geo.fatRing, mat.cream, g, [0, 0, .2], [r * 1.65, r * .42, .6]); ring.rotation.z = -.25; }
    return g;
  }
  function cloud(r) {
    const g = new T.Group(); root.add(g);
    for (const [x, y, k] of [[0, 0, 1], [-r * .9, -r * .25, .7], [r * .9, -r * .3, .65], [r * .35, r * .35, .75]]) mesh(geo.disc, mat.cream, g, [x, y, 0], [r * k, r * k, .55]);
    return g;
  }
  function starStick(h, material) {
    const g = new T.Group(); root.add(g);
    mesh(geo.stick, mat.stick, g, [0, -15.5, 0], [1, h, 1]);
    const s = mesh(geo.star, material, g, [0, -15.5 + h + .9, 0], [1.25, 1.25, 1.25]); s.rotation.z = range(-.3, .3);
    return g;
  }
  function hill(r, material) { const g = new T.Group(); root.add(g); mesh(geo.disc, material, g, [0, -15.6, 0], [r, r * .7, 1.4]); return g; }
  const spread = (n, i, w = 70) => -w / 2 + (i + range(.1, .9)) * w / n;
  layer(-11, .07, [[mat.lilac, 4.2, true], [mat.mint, 2.6, false], [mat.coral, 3.2, true]].map(([c, r, ringed], i) => ({ m: planet(c, r, ringed), x: spread(3, i), ny: range(.55, .95), w: r * 1.8 })));
  layer(-8, .2, Array.from({ length: reduced ? 4 : 6 }, (_, i) => { const r = range(1.5, 2.6); return { m: cloud(r), x: spread(reduced ? 4 : 6, i), ny: range(.1, 1), w: r * 2.2 }; }));
  layer(-6, .34, Array.from({ length: 7 }, (_, i) => { const r = range(3.5, 7); return { m: hill(r, i % 2 ? mat.hill : mat.hillDark), x: spread(7, i), y: 0, w: r }; }));
  layer(-4.5, .46, Array.from({ length: 4 }, (_, i) => ({ m: starStick(range(4, 9), i % 2 ? mat.star : mat.peach), x: spread(4, i), y: 0, w: 2 })));
  layer(5, 1.3, Array.from({ length: 3 }, (_, i) => { const g = new T.Group(); root.add(g); const r = range(1.6, 2.4); const m = mesh(geo.rock, i % 2 ? mat.hill : mat.peach, g, [0, -16.4, 0], [r * 1.3, r * .8, r]); m.rotation.set(random() * 3, random() * 3, 0); return { m: g, x: spread(3, i, 90), y: 0, w: r * 1.4 }; }));
  for (const l of layers) for (const item of l.items) item.m.position.set(item.x, item.y ?? 0, l.z);
  function updateScenery(dt, scroll) {
    for (const l of layers) {
      const edge = halfWAt(l.z);
      for (const item of l.items) {
        item.x -= scroll * l.speed * dt;
        if (item.x < -edge - item.w - 2) item.x = edge + item.w + range(2, 18);
        item.m.position.x = item.x; if (item.ny !== undefined) item.m.position.y = lerp(view.bottom + 10, view.top - 1.5, item.ny);
      }
    }
    groundMap.offset.x = (groundMap.offset.x + scroll * dt / 16) % 1;
    skyMap.offset.x = (skyMap.offset.x + scroll * dt * .002) % 1;
    sunDisc.position.x = view.halfW * .42;
  }

  // ---- Toys -----------------------------------------------------------------
  const TILT = .38;
  const playerToy = own(createToyShip({ THREE: T, faction: 'player', length: 6 }));
  const player = new T.Group(), playerBody = new T.Group(); player.name = 'player toy ship'; root.add(player); player.add(playerBody);
  playerToy.root.rotation.y = -Math.PI / 2; playerBody.add(playerToy.root);
  const playerFlames = playerToy.engineLayout.map(p => { const m = mesh(geo.flame, mat.flame, playerToy.root, p, [1, 1, 1], false); m.scale.setScalar(playerToy.engineRadius / .42); return m; });
  const enemyToy = own(createToyShip({ THREE: T, faction: 'enemy', length: 4.4 }));
  const enemyProto = new T.Group(); enemyToy.root.rotation.y = Math.PI / 2; enemyProto.add(enemyToy.root); enemyProto.rotation.x = TILT;
  const carrierToy = own(createToyCarrier({ THREE: T, length: 15 }));
  const carrier = new T.Group(); carrier.name = 'Dawn rescue carrier'; root.add(carrier);
  carrierToy.root.rotation.y = -Math.PI / 2; const carrierBody = new T.Group(); carrierBody.rotation.x = .3; carrierBody.add(carrierToy.root); carrier.add(carrierBody);
  const carrierFlames = carrierToy.engineLayout.map(p => { const m = mesh(geo.flame, mat.flame, carrierToy.root, p, [1, 1, 1], false); m.scale.setScalar(carrierToy.engineRadius / .42); return m; });
  const station = new T.Group(); station.name = 'rescue station'; root.add(station);
  mesh(geo.fatRing, mat.station, station, [0, 0, 0], [5.2, 5.2, 2.2]);
  mesh(geo.disc, mat.stripe, station, [0, 0, -.3], [4.1, 4.1, .6]);
  { const markGeo = own(new T.ExtrudeGeometry(heyboxMarkShapes(T, 4.4), { depth: .3, bevelEnabled: false })); mesh(markGeo, mat.cream, station, [0, 0, .05]); }
  for (const s of [-1, 1]) mesh(geo.box, mat.station, station, [0, s * 6.6, 0], [1.6, 3, 1.6]);
  mesh(geo.star, mat.star, station, [0, 8.9, 0], [1.2, 1.2, 1.2]);
  [player, carrier, station].forEach(g => g.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } }));
  enemyProto.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // Pooled props. Meshes are reused; geometry and materials are shared.
  const pools = new Map();
  function take(kind, make) { const m = pools.get(kind)?.pop() || make(); m.visible = true; m.scale.setScalar(1); root.add(m); return m; }
  function drop(kind, m) { root.remove(m); if (!pools.has(kind)) pools.set(kind, []); pools.get(kind).push(m); }
  const makeAstronaut = () => {
    const g = new T.Group();
    mesh(geo.ball, mat.white, g, [0, .62, 0], [.66, .66, .66]);
    mesh(geo.ball, mat.visor, g, [.12, .64, .38], [.42, .32, .32]);
    mesh(geo.box, mat.white, g, [0, -.25, 0], [.82, .92, .62]);
    mesh(geo.box, mat.orange, g, [-.5, -.12, -.05], [.32, .74, .52]);
    for (const s of [-1, 1]) { mesh(geo.box, mat.white, g, [s * .22, -.95, 0], [.28, .55, .32]); mesh(geo.box, mat.white, g, [s * .56, -.05, 0], [.24, .62, .28]).rotation.z = s * .55; }
    mesh(geo.ring, mat.star, g, [0, .1, 0], [1.7, 1.7, 1.7], false).name = 'halo';
    return g;
  };
  const shots = [], rocks = [], buddies = [], enemies = [], pickups = [];
  function shoot(x, y, vx, vy, hostile) {
    const m = take(hostile ? 'enemyShot' : 'shot', () => mesh(hostile ? geo.enemyShot : geo.shot, hostile ? mat.enemyShot : mat.shot, root, [0, 0, 0], [1, 1, 1], true));
    m.position.set(x, y, .3); m.rotation.z = Math.atan2(vy, vx); shots.push({ m, x, y, vx, vy, hostile, life: hostile ? 6 : 1.3 });
  }
  function addRock(state) {
    const r = state?.r ?? range(1, 2.3), m = take('rock', () => mesh(geo.rock, mat.rock));
    m.material = r > 1.8 ? mat.rockDark : mat.rock; m.scale.set(r * 1.15, r, r); m.rotation.set(random() * 6, random() * 6, 0);
    rocks.push({ m, x: state?.x ?? view.halfW + 5, y: state?.y ?? range(view.bottom + 1, view.top), r, vx: state?.vx ?? range(-2.5, 1), vy: state?.vy ?? range(-.6, .6), hp: state?.hp ?? (r > 1.8 ? 3 : 1), spin: range(-1.2, 1.2), pop: 0 });
  }
  function addBuddy(state) {
    const m = take('buddy', makeAstronaut);
    buddies.push({ m, halo: m.getObjectByName('halo'), x: state?.x ?? view.halfW + 4, y: state?.y ?? range(view.bottom + 2, view.top - 1.5), t: state?.t ?? random() * 6 });
  }
  function addPickup(type, x, y) {
    const m = take(type, () => mesh(type === 'heart' ? geo.heart : geo.star, type === 'heart' ? mat.heart : mat.star));
    pickups.push({ m, type, x, y, t: 0 });
  }
  function addEnemy(kind, state = {}) {
    const m = take('enemy', () => enemyProto.clone(true)), tough = kind === 'hover' || kind === 'raid';
    enemies.push({ m, kind, x: state.x ?? view.halfW + 5, y: state.y ?? 0, baseY: state.baseY ?? state.y ?? 0, t: state.t ?? 0,
      hp: state.hp ?? (tough ? 2 + (difficulty >= 3 ? 1 : 0) : 1 + (difficulty >= 2 ? 1 : 0)), maxHp: tough ? 3 : 2,
      fire: state.fire ?? range(1.2, 2.2) + (tough ? 0 : 1.2), stopX: state.stopX ?? view.halfW * range(.12, .58), escort: !!state.escort, leaving: !!state.leaving, pop: 0, charge: 0 });
  }
  function release(list, i) { const e = list[i]; drop(e.kind && list === enemies ? 'enemy' : list === shots ? (e.hostile ? 'enemyShot' : 'shot') : list === rocks ? 'rock' : list === buddies ? 'buddy' : e.type, e.m); list.splice(i, 1); }
  function clearList(list) { while (list.length) release(list, list.length - 1); }

  // Confetti debris and floating score numbers.
  const debrisCount = reduced ? 70 : 140;
  const debris = new T.InstancedMesh(geo.box, toy(0xffffff), debrisCount); debris.name = 'pooled toy confetti'; debris.frustumCulled = false; debris.castShadow = true;
  debris.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(debris);
  const bits = Array.from({ length: debrisCount }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, s: 0 }));
  const tint = new T.Color(), dummy = new T.Object3D(); let bitIndex = 0;
  for (let i = 0; i < debrisCount; i++) debris.setColorAt(i, tint.setHex(0xffffff));
  function burst(x, y, count, colors, power = 1) {
    for (let i = 0; i < count; i++) {
      bitIndex = (bitIndex + 1) % debrisCount; const b = bits[bitIndex], a = random() * Math.PI * 2, v = (4 + random() * 8) * power;
      Object.assign(b, { life: .6 + random() * .5, x, y, z: range(-.5, 1.5), vx: Math.cos(a) * v, vy: Math.sin(a) * v + 3, vz: range(-2, 4), r: random() * 6, s: (.22 + random() * .3) * Math.sqrt(power) });
      debris.setColorAt(bitIndex, tint.setHex(colors[i % colors.length]));
    }
    debris.instanceColor.needsUpdate = true;
  }
  const popups = Array.from({ length: 6 }, () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 64; const t = own(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(own(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }))); s.scale.set(5, 2, 1); s.visible = false; s.renderOrder = 4; root.add(s);
    return { s, c, t, life: 0 };
  });
  let popupIndex = 0;
  function popup(text, x, y, color = '#593724') {
    const p = popups[popupIndex++ % popups.length], g = p.c.getContext('2d');
    g.clearRect(0, 0, 160, 64); g.font = '800 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = '#fff0d6'; g.strokeText(text, 80, 32); g.fillStyle = color; g.fillText(text, 80, 32);
    p.t.needsUpdate = true; p.s.position.set(x, y + 1.5, 3); p.s.visible = true; p.life = 1;
  }
  function updateEffects(dt, scroll) {
    for (let i = 0; i < debrisCount; i++) {
      const b = bits[i];
      if (b.life > 0) { b.life -= dt; b.vy -= 16 * dt; b.x += (b.vx - scroll * .3) * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.r += dt * 7; }
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(b.r, b.r * .7, 0); dummy.scale.setScalar(b.life > 0 ? b.s * Math.min(1, b.life * 3) : 0);
      dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
    for (const p of popups) if (p.life > 0) { p.life -= dt * .9; p.s.position.y += dt * 2.2; p.s.material.opacity = Math.min(1, p.life * 2.5); p.s.visible = p.life > 0; }
  }

  // ---- Mission state --------------------------------------------------------
  let disposed = false, paused = false, exploring = false, dead = false, completed = false, failureReason = '', difficulty = 1, checkpoint = null;
  let phase = 0, phaseTime = 0, elapsed = 0, missionTime = 0, score = 0, hearts = maxHearts, rescued = 0, kills = 0, totalShots = 0, totalHits = 0;
  let wave = 0, waveQueue = [], waveTimer = 0, waveDelay = 0, waveSlot = 0, escortHull = 100, escortTravel = 0, docking = 0;
  let carrierX = -60, carrierY = -6.5, stationX = 60, invulnerable = 0, dashTime = 0, dashCooldown = 0, fireCooldown = 0, tripleTime = 0, shake = 0;
  let spawnRock = 1, spawnBuddy = 1.5, spawnRaid = 2, spawnBonus = 6, heldFire = false, dashRequest = false, oldKeys = new Set(), message = '', messageUntil = 0;
  const pos = new T.Vector2(), vel = new T.Vector2(), dashDir = new T.Vector2(1, 0);
  const say = (text, duration = 3, announce = false) => { message = text; messageUntil = elapsed + duration; if (announce) emit(text); };
  const wavePlans = [['hover', 'hover', 'hover', 'hover'], ['sine', 'sine', 'sine', 'sine', 'sine'], ['hover', 'swoop', 'swoop', 'hover', 'swoop']];

  function placeCamera() {
    frame();
    const sx = shake > 0 ? (random() - .5) * shake : 0, sy = shake > 0 ? (random() - .5) * shake : 0;
    camera.up.set(0, 1, 0); camera.position.set(sx, sy + view.centerY, view.distance); camera.lookAt(sx * .5, sy * .5 + view.centerY, 0);
    if (camera.fov !== FOV || camera.far < view.distance + 60) { camera.fov = FOV; camera.near = 1; camera.far = view.distance + 90; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(true);
  }
  function startWave(index) {
    wave = index + 1; waveSlot = 0; waveTimer = .4; waveDelay = 1.6;
    waveQueue = [...wavePlans[index], ...Array(difficulty - 1).fill(index === 1 ? 'sine' : 'swoop')];
    say('第 ' + wave + ' / 3 波 · 紫色玩具敌机来袭', 2.6); audio('warning', { intensity: .45 });
  }
  function transition(next) {
    phase = next; phaseTime = 0; audio('mission', { phase: next });
    if (next === 1) { say('宇航员全部获救！击退封锁航道的紫色敌机', 4, true); clearList(buddies); startWave(0); }
    if (next === 2) { say('曙光号来接应了 · 挡住射向它的炮弹', 4, true); carrierX = -view.halfW - 14; escortTravel = docking = 0; escortHull = 100; stationX = view.halfW + 14; spawnRaid = 3; }
    if (next === 3) {
      completed = true; heldFire = false; score += 1000 + Math.round(escortHull * 5) + hearts * 200;
      say('救援完成！可以挑战下一难度或自由探索', 9, true); burst(stationX, carrierY + 3, 30, [0xffd45c, 0x2a6fc4, 0xfff0d6, 0xe0483a], 1.4); audio('success', { intensity: .9 });
    }
    if (next < 3) checkpoint = snapshot(false);
  }
  function fail(reason) {
    if (dead) return;
    dead = true; failureReason = reason; heldFire = false; shake = 1.2;
    if (reason === '曙光号被击毁') { carrier.visible = false; burst(carrierX, carrierY, 40, [0xe8dcc4, 0x2a6fc4, 0xf0a92c], 1.6); }
    else { player.visible = false; burst(pos.x, pos.y, 30, [0x2a6fc4, 0xe8c894, 0xf0a92c], 1.4); }
    say(reason + ' · 可从本段检查点重来', 100, true); audio('explosion', { intensity: 1 });
  }
  function hurt() {
    if (invulnerable > 0 || dead || completed || exploring) return;
    hearts--; invulnerable = 1.4; shake = .8; burst(pos.x, pos.y, 10, [0x2a6fc4, 0xfff0d6, 0xf0a92c]); audio('damage', { intensity: .8 });
    if (hearts <= 0) fail('小飞船被击落'); else say('被击中了！还剩 ' + hearts + ' 颗心', 1.6);
  }
  function fire() {
    if (fireCooldown > 0) return;
    fireCooldown = tripleTime > 0 ? .17 : .2; totalShots++;
    const x = pos.x + 2.7, y = pos.y - .3;
    shoot(x, y, 46, 0, false); if (tripleTime > 0) { shoot(x, y, 44, 10, false); shoot(x, y, 44, -10, false); }
    audio('laser', { intensity: .32, pitch: 1.25 });
  }
  function killEnemy(i) {
    const e = enemies[i]; kills++; score += 100; popup('+100', e.x, e.y);
    burst(e.x, e.y, reduced ? 10 : 16, [0x6d4b93, 0xd8c8ea, 0xe0483a, 0x2a2433]); audio('explosion', { intensity: .7 });
    if (kills % 4 === 0) addPickup('star', e.x, e.y); else if (hearts < maxHearts && random() < .14) addPickup('heart', e.x, e.y);
    release(enemies, i);
  }

  function updatePlayer(dt, input, has, edge) {
    const ix = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0), iy = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    const n = Math.hypot(ix, iy) || 1;
    vel.x = damp(vel.x, ix / n * 18, 12, dt); vel.y = damp(vel.y, iy / n * 18, 12, dt);
    if ((edge('ShiftLeft') || edge('ShiftRight') || dashRequest) && dashCooldown <= 0) {
      dashTime = .34; dashCooldown = 1.4; invulnerable = Math.max(invulnerable, .5); dashDir.set(ix || 1, iy).normalize(); audio('boost', { intensity: .6 });
    }
    dashRequest = false;
    if (dashTime > 0) { dashTime = Math.max(0, dashTime - dt); pos.addScaledVector(dashDir, 30 * dt); }
    if (input.touchLook) { pos.x += clamp(Number(input.pointerDeltaX) || 0, -.4, .4) * view.halfW; pos.y += clamp(Number(input.pointerDeltaY) || 0, -.4, .4) * view.halfH; }
    pos.addScaledVector(vel, dt); pos.x = clamp(pos.x, view.left, view.right); pos.y = clamp(pos.y, view.bottom, view.top);
    player.position.set(pos.x, pos.y, 0);
    playerBody.rotation.z = damp(playerBody.rotation.z, vel.y * .022, 8, dt);
    playerBody.rotation.x = TILT + (dashTime > 0 ? (1 - dashTime / .34) * Math.PI * 2 : 0);
    player.visible = !dead && (invulnerable <= 0 || dashTime > 0 || Math.floor(elapsed * 14) % 2 === 0);
    for (const f of playerFlames) f.scale.z = (dashTime > 0 ? 2.6 : 1 + Math.max(0, ix) * .6) + Math.sin(elapsed * 40 + f.id) * .15;
    if (heldFire || has('Space') || input.pointerDown || input.touchLook) fire();
  }
  function updateSpawns(dt) {
    const calm = phase === 0 || exploring;
    if ((spawnRock -= dt) <= 0) { spawnRock = (calm ? 1.5 : 3) * range(.7, 1.3); addRock(); }
    if (calm && (spawnBuddy -= dt) <= 0 && buddies.length < 2) { spawnBuddy = range(2.4, 3.4); addBuddy(); }
    if (exploring && (spawnBonus -= dt) <= 0) { spawnBonus = range(6, 9); addPickup('star', view.halfW + 4, range(view.bottom + 2, view.top - 2)); }
    if (exploring) return;
    if (phase === 1 && waveQueue.length && (waveTimer -= dt) <= 0) {
      const kind = waveQueue.shift(), slots = wavePlans[wave - 1].length + difficulty - 1, slot = waveSlot++;
      const y = kind === 'hover' ? lerp(view.top - 1.5, view.bottom + 2, (slot + .5) / slots) : kind === 'sine' ? 2 : (slot % 2 ? view.top - 1 : view.bottom + 1.5);
      addEnemy(kind, { y }); waveTimer = kind === 'sine' ? .5 : .8;
    }
    if (phase === 2 && !docking && phaseTime > 2.5 && (spawnRaid -= dt) <= 0) {
      spawnRaid = range(2.6, 3.4) - difficulty * .35;
      addEnemy(random() < .55 ? 'raid' : 'swoop', { y: range(-4, view.top - 1), escort: true, stopX: view.halfW * range(.05, .5) });
    }
  }
  function updateEntities(dt, scroll) {
    const target = (e) => e.escort && random() < .65 && carrier.visible ? [carrierX, carrierY] : [pos.x, pos.y];
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.m.position.set(s.x, s.y, .3);
      if (s.hostile) {
        s.m.scale.setScalar(1 + Math.sin(elapsed * 18) * .15);
        if (!dead && Math.hypot(s.x - pos.x, s.y - pos.y) < 1.4) { hurt(); release(shots, i); continue; }
        if (phase === 2 && carrier.visible && Math.abs(s.x - carrierX) < 7.4 && Math.abs(s.y - carrierY) < 2.2) {
          escortHull = Math.max(0, escortHull - (4 + difficulty * 1.5)); burst(s.x, s.y, 5, [0xe8dcc4, 0xc4306c]); audio('shieldhit', { intensity: .4 }); release(shots, i); continue;
        }
      } else {
        let hit = false;
        for (let j = enemies.length - 1; j >= 0 && !hit; j--) {
          const e = enemies[j]; if (Math.hypot(s.x - e.x, s.y - e.y) > 2.1) continue;
          hit = true; totalHits++; e.hp--; e.pop = .15; burst(s.x, s.y, 3, [0x2f80ee, 0xfff0d6], .6);
          if (e.hp <= 0) killEnemy(j); else audio('hit', { intensity: .4, pitch: 1.3 });
        }
        for (let j = rocks.length - 1; j >= 0 && !hit; j--) {
          const r = rocks[j]; if (Math.hypot(s.x - r.x, s.y - r.y) > r.r + .3) continue;
          hit = true; r.hp--; r.pop = .12;
          if (r.hp <= 0) { score += 20; popup('+20', r.x, r.y, '#8a5236'); burst(r.x, r.y, 8, [0xa86a45, 0x8a5236, 0xe6a066], .8); release(rocks, j); }
          else burst(s.x, s.y, 2, [0xa86a45], .5);
        }
        if (hit) { release(shots, i); continue; }
      }
      if (s.life <= 0 || s.x > view.halfW + 6 || s.x < -view.halfW - 6 || Math.abs(s.y) > view.halfH + 4) release(shots, i);
    }
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i]; r.x += (r.vx - scroll) * dt; r.y += r.vy * dt; r.pop = Math.max(0, r.pop - dt);
      if (r.y > view.top + 2 || r.y < view.bottom - 1) r.vy = -r.vy;
      r.m.position.set(r.x, r.y, 0); r.m.rotation.x += r.spin * dt; r.m.rotation.y += r.spin * .7 * dt; r.m.scale.set(r.r * 1.15, r.r, r.r).multiplyScalar(1 + r.pop);
      if (!dead && Math.hypot(r.x - pos.x, r.y - pos.y) < r.r + 1.2) {
        if (exploring) { r.vx = 6; r.vy = Math.sign(r.y - pos.y || 1) * 4; }
        else if (invulnerable <= 0) { hurt(); burst(r.x, r.y, 8, [0xa86a45, 0x8a5236]); release(rocks, i); continue; }
      }
      if (r.x < -view.halfW - 6) release(rocks, i);
    }
    for (let i = buddies.length - 1; i >= 0; i--) {
      const b = buddies[i]; b.t += dt; b.x -= scroll * .75 * dt; b.y += Math.sin(b.t * 1.6) * .6 * dt;
      b.m.position.set(b.x, b.y + Math.sin(b.t * 2.2) * .3, .2); b.m.rotation.z = Math.sin(b.t * 1.3) * .35; b.halo.scale.setScalar(1.7 + Math.sin(b.t * 5) * .15);
      if (!dead && Math.hypot(b.x - pos.x, b.y - pos.y) < 2.8) {
        rescued++; score += 200; popup(phase === 0 && !exploring ? rescued + ' / ' + rescueGoal : '+200', b.x, b.y, '#2a6fc4');
        burst(b.x, b.y, 12, [0xffd45c, 0xf7f3ea, 0xf08a3c], .9); audio('collect', { intensity: .8 }); release(buddies, i); continue;
      }
      if (b.x < -view.halfW - 4) release(buddies, i);
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t += dt; p.x -= scroll * .5 * dt; p.m.position.set(p.x, p.y + Math.sin(p.t * 3) * .4, .4); p.m.rotation.y = p.t * 2.4;
      if (!dead && Math.hypot(p.x - pos.x, p.y - pos.y) < 2.5) {
        if (p.type === 'heart') { hearts = Math.min(maxHearts, hearts + 1); popup('❤ +1', p.x, p.y, '#e0483a'); }
        else { tripleTime = 8; score += 50; popup('三连发', p.x, p.y, '#c27a12'); }
        burst(p.x, p.y, 10, [0xffd45c, 0xe0483a, 0xfff0d6], .8); audio('pickup', { intensity: .7 }); release(pickups, i); continue;
      }
      if (p.x < -view.halfW - 4) release(pickups, i);
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]; e.t += dt; e.pop = Math.max(0, e.pop - dt);
      if (e.leaving) { e.x += 15 * dt; e.y = damp(e.y, e.baseY, 2, dt); }
      else if (e.kind === 'hover' || e.kind === 'raid') { e.x = damp(e.x, e.stopX, 1.4, dt); e.y = e.baseY + Math.sin(e.t * 1.6) * 1.4; if (e.t > (e.kind === 'raid' ? 13 : 11)) e.leaving = true; }
      else if (e.kind === 'sine') { e.x -= (8 + difficulty) * dt; e.y = e.baseY + Math.sin(e.t * 2.1) * 5; }
      else { e.x -= (11 + difficulty) * dt; if (e.x < view.halfW * .65) e.y = damp(e.y, e.escort && carrier.visible ? carrierY + 1 : pos.y, 1.3, dt); }
      e.m.position.set(e.x, e.y, 0); e.m.rotation.z = (e.kind === 'sine' ? Math.cos(e.t * 2.1) * .35 : 0);
      e.fire -= dt; e.charge = e.fire < .45 && !e.leaving ? 1 : 0;
      e.m.scale.setScalar(1 + e.pop * 1.4 + (e.charge ? Math.sin(elapsed * 30) * .08 : 0));
      if (!e.leaving && e.fire <= 0 && !dead && !docking && e.x < view.halfW - 2 && e.x > pos.x + 3) {
        const [tx, ty] = target(e), dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, speed = 10 + difficulty * 2;
        shoot(e.x - 2.2, e.y, dx / d * speed, dy / d * speed, true); e.fire = range(2.2, 3.1) - difficulty * .3 + (e.kind === 'sine' || e.kind === 'swoop' ? 1.5 : 0);
      } else if (e.fire <= 0) e.fire = .6;
      if (!dead && Math.hypot(e.x - pos.x, e.y - pos.y) < 2.6) { hurt(); killEnemy(i); continue; }
      if (phase === 2 && carrier.visible && e.kind === 'swoop' && Math.abs(e.x - carrierX) < 7.5 && Math.abs(e.y - carrierY) < 2.6) {
        escortHull = Math.max(0, escortHull - 12); shake = .5; burst(e.x, e.y, 14, [0x6d4b93, 0xe8dcc4, 0xe0483a]); audio('explosion', { intensity: .6 }); release(enemies, i); continue;
      }
      if (e.x < -view.halfW - 6 || (e.leaving && e.x > view.halfW + 7)) release(enemies, i);
    }
  }
  function updateMission(dt) {
    carrier.visible = phase === 2 && !(dead && failureReason === '曙光号被击毁') || (completed && phase === 3 && !exploring);
    station.visible = (phase === 2 && docking > 0) || (completed && !exploring);
    if (exploring || dead || completed) return;
    if (phase === 0 && rescued >= rescueGoal) transition(1);
    else if (phase === 1 && !waveQueue.length && !enemies.length) { if ((waveDelay -= dt) <= 0) { if (wave >= 3) transition(2); else startWave(wave); } }
    else if (phase === 2) {
      if (!docking) {
        carrierX = damp(carrierX, -view.halfW * .42, 1.1, dt); if (phaseTime > 2) escortTravel += dt;
        if (escortTravel >= escortLength) { docking = .001; say('救援站就在前方 · 曙光号准备入港', 3, true); for (const e of enemies) e.leaving = true; }
      } else {
        docking += dt; stationX = damp(stationX, view.halfW * .5, 1.5, dt); carrierX = damp(carrierX, stationX - 10.5, .9, dt);
        if (docking > 4.4) transition(3);
      }
      if (escortHull <= 0) fail('曙光号被击毁');
    }
  }
  function updateProps(dt) {
    carrierY = -6.5 + Math.sin(elapsed * .9) * .5;
    carrier.position.set(carrierX, carrierY, -2.6); carrierBody.rotation.z = Math.sin(elapsed * .7) * .03;
    for (const f of carrierFlames) f.scale.z = 1.6 + Math.sin(elapsed * 22 + f.id) * .2;
    station.position.set(stationX, carrierY + .6, -3); station.rotation.z = Math.sin(elapsed * .5) * .05;
  }
  function update(dt, input = {}) {
    if (disposed || paused || input.paused || dead || completed) return;
    dt = clamp(Number(dt) || 0, 0, .05); if (!dt) return;
    const keys = input.keys || new Set(), has = (...names) => names.some(n => keys.has(n)), edge = k => keys.has(k) && !oldKeys.has(k);
    elapsed += dt; phaseTime += dt; if (!exploring) missionTime += dt;
    invulnerable = Math.max(0, invulnerable - dt); dashCooldown = Math.max(0, dashCooldown - dt); fireCooldown = Math.max(0, fireCooldown - dt);
    tripleTime = Math.max(0, tripleTime - dt); shake = Math.max(0, shake - dt * 2.5);
    frame();
    const scroll = docking ? 4 : 7;
    updatePlayer(dt, input, has, edge); updateSpawns(dt); updateEntities(dt, scroll); updateMission(dt); updateProps(dt);
    updateScenery(dt, scroll); updateEffects(dt, scroll); placeCamera();
    oldKeys = new Set(keys);
  }

  function getState() {
    const goal = phase === 0 ? rescued / rescueGoal : phase === 1 ? Math.max(0, wave - 1 + (waveQueue.length || enemies.length ? 0 : 1)) / 3 : phase === 2 ? Math.min(1, escortTravel / escortLength) : 1;
    const escortPct = Math.min(100, Math.round(escortTravel / escortLength * 100));
    const mission = exploring ? '自由探索 · 已救起 ' + rescued + ' 名宇航员' : phase === 0 ? '救援宇航员 ' + Math.min(rescued, rescueGoal) + ' / ' + rescueGoal : phase === 1 ? '清除封锁 · 第 ' + wave + ' / 3 波' : phase === 2 ? '护送曙光号 · ' + escortPct + '%' : '救援完成';
    const hint = exploring ? '自由探索 · 不会受伤，随便飞' : phase === 0 ? '飞近宇航员就能救起 · 小心陨石' : phase === 1 ? '击落紫色敌机 · 星星道具带来三连发' : docking ? '曙光号正在入港…' : '挡在曙光号前面，击落来袭敌机';
    return {
      worldTheme: 'flight', flat: true, difficulty, maxDifficulty, nextDifficultyAvailable: completed && difficulty < maxDifficulty, checkpointAvailable: !!checkpoint,
      exploring, missionCompleted: completed || exploring, freeExploreAvailable: completed, failureReason, dead, completed,
      hearts, maxHearts, health: hearts, maxHealth: maxHearts, hull: Math.round(hearts / maxHearts * 100), score, kills, rescued, rescueGoal,
      mission, missionTitle: '寂光救援 / SILENT DAWN', missionPhase: phase, missionStep: phaseNames[phase], missionSteps: [...phaseNames],
      missionProgress: phase >= 3 ? 1 : (phase + goal) / 3, wave, escorting: phase === 2 && !completed, escortHull: phase >= 2 ? Math.round(escortHull) : undefined, escortProgress: escortPct,
      tripleShot: Math.ceil(tripleTime), dashCooldown: +dashCooldown.toFixed(2), dashReady: dashCooldown <= 0, enemies: enemies.length,
      statusText: elapsed < messageUntil ? message : hint, instruction: controls, controls,
      reward: completed || exploring ? { badge: '寂光救援', time: Math.round(missionTime), escortHull: Math.round(escortHull) } : null,
      elapsed: Math.floor(elapsed), missionTime: Math.round(missionTime), positionX: +pos.x.toFixed(2), positionY: +pos.y.toFixed(2), totalShots, totalHits,
      speed: dashTime > 0 ? 60 : 30, boosting: dashTime > 0, throttle: .4, inCombat: enemies.length > 0,
      audio: { speed: .4, boosting: dashTime > 0, combat: enemies.length > 0, warp: 0 }
    };
  }

  const copy = value => JSON.parse(JSON.stringify(value));
  function snapshot(includeCheckpoint = true) {
    return { version: 2, world: 'flight',
      values: { phase, phaseTime, elapsed, missionTime, score, hearts, rescued, kills, wave, waveSlot, escortHull, escortTravel, docking, tripleTime, difficulty, exploring, dead, completed, seed, carrierX, stationX, totalShots, totalHits },
      failureReason, player: [pos.x, pos.y], waveQueue: [...waveQueue],
      enemies: enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, baseY: e.baseY, t: e.t, hp: e.hp, fire: e.fire, stopX: e.stopX, escort: e.escort, leaving: e.leaving })),
      rocks: rocks.map(r => ({ x: r.x, y: r.y, r: r.r, vx: r.vx, vy: r.vy, hp: r.hp })),
      buddies: buddies.map(b => ({ x: b.x, y: b.y, t: b.t })), pickups: pickups.map(p => ({ type: p.type, x: p.x, y: p.y })),
      checkpoint: includeCheckpoint && checkpoint ? copy(checkpoint) : null };
  }
  function restore(data) {
    const finite = v => Number.isFinite(v), points = (list, keys, max) => Array.isArray(list) && list.length <= max && list.every(o => o && keys.every(k => finite(o[k])));
    const valid = d => d && d.version === 2 && d.world === 'flight' && d.values &&
      Object.entries(snapshot(false).values).every(([k, v]) => typeof d.values[k] === typeof v && (typeof v !== 'number' || finite(d.values[k]))) &&
      Number.isInteger(d.values.phase) && d.values.phase >= 0 && d.values.phase <= 3 && Number.isInteger(d.values.difficulty) && d.values.difficulty >= 1 && d.values.difficulty <= maxDifficulty &&
      Array.isArray(d.player) && d.player.length === 2 && d.player.every(finite) && Array.isArray(d.waveQueue) && d.waveQueue.every(k => ['hover', 'sine', 'swoop'].includes(k)) &&
      points(d.enemies, ['x', 'y', 'baseY', 't', 'hp', 'fire', 'stopX'], 30) && d.enemies.every(e => ['hover', 'sine', 'swoop', 'raid'].includes(e.kind)) &&
      points(d.rocks, ['x', 'y', 'r', 'vx', 'vy', 'hp'], 40) && points(d.buddies, ['x', 'y', 't'], 10) && points(d.pickups, ['x', 'y'], 20) && d.pickups.every(p => p.type === 'star' || p.type === 'heart');
    if (disposed || !valid(data) || (data.checkpoint && (!valid(data.checkpoint) || data.checkpoint.checkpoint))) return false;
    const d = copy(data), nextCheckpoint = d.checkpoint || (d.values.dead || d.values.completed ? checkpoint : copy(d));
    for (const list of [shots, rocks, buddies, enemies, pickups]) clearList(list);
    ({ phase, phaseTime, elapsed, missionTime, score, hearts, rescued, kills, wave, waveSlot, escortHull, escortTravel, docking, tripleTime, difficulty, exploring, dead, completed, seed, carrierX, stationX, totalShots, totalHits } = d.values);
    failureReason = d.failureReason || ''; waveQueue = [...d.waveQueue]; waveTimer = .6; waveDelay = 1.6; message = ''; messageUntil = 0;
    pos.set(...d.player); vel.set(0, 0); invulnerable = 1; dashTime = dashCooldown = fireCooldown = shake = 0;
    d.enemies.forEach(e => addEnemy(e.kind, e)); d.rocks.forEach(addRock); d.buddies.forEach(addBuddy); d.pickups.forEach(p => addPickup(p.type, p.x, p.y));
    checkpoint = nextCheckpoint; resetInput(); frame(); player.position.set(pos.x, pos.y, 0); player.visible = !dead || failureReason !== '小飞船被击落';
    updateMission(0); updateProps(0); updateEntities(0, 0); updateScenery(0, 0); placeCamera();
    return true;
  }
  function restoreCheckpoint(data = checkpoint) {
    if (!data || !restore(data)) return false;
    dead = completed = paused = false; failureReason = ''; hearts = maxHearts; invulnerable = 2; player.visible = true; resetInput();
    say('已回到检查点 · ' + phaseNames[phase], 3); return true;
  }
  function restart() {
    for (const list of [shots, rocks, buddies, enemies, pickups]) clearList(list);
    dead = completed = exploring = false; failureReason = ''; seed = 7121 + difficulty * 977;
    phase = 0; phaseTime = elapsed = missionTime = 0; score = kills = rescued = wave = waveSlot = totalShots = totalHits = 0; waveQueue = [];
    hearts = maxHearts; escortHull = 100; escortTravel = docking = 0; carrierX = -80; stationX = 80;
    invulnerable = 1.5; dashTime = dashCooldown = fireCooldown = tripleTime = shake = 0; spawnRock = 1.8; spawnBuddy = 2.5; spawnBonus = 6;
    frame(); pos.set(-view.halfW * .55, 0); vel.set(0, 0); player.position.set(pos.x, pos.y, 0); player.visible = true;
    addBuddy({ x: view.halfW * .1, y: 4, t: 0 }); addRock({ x: view.halfW * .45, y: -6, r: 1.6, vx: -.5, vy: .2, hp: 1 }); addRock({ x: view.halfW * .8, y: 8, r: 2.1, vx: -1, vy: -.3, hp: 3 });
    resetInput(); checkpoint = snapshot(false);
    say('救起 ' + rescueGoal + ' 名漂流的宇航员 · 方向键移动，空格射击', 6);
    updateMission(0); updateProps(0); updateEntities(0, 0); updateScenery(0, 0); updateEffects(0, 0); placeCamera();
  }
  function freeExplore() {
    if (!completed) return false;
    completed = false; exploring = true; clearList(enemies); clearList(shots); resetInput();
    say('自由探索 · 收集宇航员和星星，不会受伤', 5); return true;
  }
  function resetInput() { oldKeys = new Set(); heldFire = false; dashRequest = false; vel.set(0, 0); }
  function resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); placeCamera(); }

  restart();
  return {
    update, getState, snapshot, restore, resize, resetInput, prepareView: placeCamera, restoreCheckpoint,
    getCheckpoint() { return checkpoint ? copy(checkpoint) : null; },
    setPaused(value) { paused = !!value; resetInput(); },
    action(name, payload) {
      if (disposed) return;
      if (name === 'retryCheckpoint') return restoreCheckpoint();
      if (name === 'freeExplore' || name === 'explore') return freeExplore();
      if (name === 'nextDifficulty') { if (!completed) return false; if (difficulty >= maxDifficulty) return freeExplore(); difficulty++; restart(); return true; }
      if (name === 'restart' || name === 'reset') { restart(); return true; }
      if (dead || completed || paused) return false;
      if (name === 'fire') { if (typeof payload === 'boolean') heldFire = payload; return true; }
      if (name === 'dash' || name === 'skill') { dashRequest = true; return true; }
      if (name === 'reduced') { reduced = !!payload; return true; }
      return false;
    },
    dispose() {
      if (disposed) return; disposed = true;
      scene.remove(root); for (const [light, visible] of prior.lights) light.visible = visible;
      scene.background = prior.background; scene.fog = prior.fog; scene.environment = prior.environment; scene.environmentIntensity = prior.environmentIntensity;
      sun.shadow.map?.dispose(); debris.dispose(); owned.forEach(resource => resource.dispose?.()); owned.clear(); pools.clear();
    }
  };
}
