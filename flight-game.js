import { createToyShip, createToyCarrier } from './toy-ship.js?v=journey-32';
/** Original rescue-flight game. Shared models stay owned by the host. */
export function createGame({ THREE: T, scene, camera, model, assets = {}, sound = () => {}, emit = () => {}, reduced = false }) {
  const root = new T.Group(); root.name = 'Nacre-rescue-sector'; scene.add(root);
  const owned = new Set(), own = x => (owned.add(x), x), V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = T.MathUtils.clamp, damp = T.MathUtils.damp;
  const metal = (color, roughness = .43, emissive = 0) => own(new T.MeshStandardMaterial({ color, metalness: .78, roughness, emissive, emissiveIntensity: .8 }));
  const glow = (color, opacity = 1) => own(new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, blending: opacity < 1 ? T.AdditiveBlending : T.NormalBlending }));
  const armor = metal(0x293944), silver = metal(0xa6bdc9, .3), graphite = metal(0x0b141e), ceramic = metal(0xd1dce0, .5);
  const ice = glow(0x8bdfff), white = glow(0xd6f2ff), red = glow(0xff795f), amber = glow(0xe8bc76), ghost = glow(0x669cc3, .22);
  const glass = own(new T.MeshPhysicalMaterial({ color: 0x174354, metalness: .5, roughness: .09, clearcoat: 1, emissive: 0x0c283b, emissiveIntensity: .45 }));
  const cube = own(new T.BoxGeometry(1, 1, 1)), orb = own(new T.IcosahedronGeometry(1, 1));
  const ring = own(new T.TorusGeometry(1, .018, 5, 72)), thickRing = own(new T.TorusGeometry(1, .06, 7, 64));
  const engineGeo = own(new T.CylinderGeometry(.22, .4, 1, 10)); engineGeo.rotateX(Math.PI / 2);
  const beamGeo = own(new T.CylinderGeometry(.5, .5, 1, 8, 1, true)); beamGeo.rotateX(Math.PI / 2);
  const laserCore = glow(0xeaffff), laserGlow = glow(0x35cfff, .38), laserHalo = glow(0x1baaff, .095);
  const impactGlow = glow(0x8aeaff, .64), blastGlow = glow(0xff9c43, .38), smokeGlow = glow(0x687b90, .14);
  const mesh = (geo, material, parent = root) => { const m = new T.Mesh(geo, material); parent.add(m); return m; };
  const part = (geo, material, parent, position, scale) => { const m = mesh(geo, material, parent); m.position.set(...position); m.scale.set(...scale); return m; };
  let seed = 22731;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const audio = (name, options = {}) => { try { sound(name, { world: 'flight', ...options }); } catch {} };
  let disposed = false, paused = false, exploring = false, difficulty = 1, checkpoint = null, failureReason = '';
  let hull = 100, missileAmmo = 3, lockProgress = 0, lockCandidate = null;
  const maxDifficulty = 3, lockSeconds = .8;

  // Purpose-built faceted surfaces give the fallback fighter a real, swept-wing silhouette.
  // A normalized external spacecraft replaces it when assets.flightShip is present.
  function prism(points, thickness, material, parent) {
    const vertices = [], indices = [], n = points.length;
    for (const y of [-thickness / 2, thickness / 2]) for (const [x, z] of points) vertices.push(x, y, z);
    for (let i = 1; i < n - 1; i++) { indices.push(0, i + 1, i); indices.push(n, n + i, n + i + 1); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; indices.push(i, j, n + j, i, n + j, n + i); }
    const g = own(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
    return mesh(g, material, parent);
  }
  function fighter(faction = 'player') {
    const group = new T.Group(), trim = faction === 'enemy' ? red : ice, shell = faction === 'enemy' ? armor : silver;
    prism([[0, -4.7], [.72, -1.8], [1.1, 2.1], [.6, 3.1], [-.6, 3.1], [-1.1, 2.1], [-.72, -1.8]], .68, shell, group);
    const canopy = prism([[0, -2.9], [.56, -.5], [.39, 1], [-.39, 1], [-.56, -.5]], .34, glass, group); canopy.position.y = .53;
    for (const s of [-1, 1]) {
      const wing = prism([[s * .6, -.7], [s * 4.25, 2.1], [s * 4.2, 3], [s * 1.1, 1.8]], .22, shell, group); wing.position.y = -.18;
      const inset = prism([[s * 1.4, .1], [s * 3.75, 2], [s * 2.5, 2], [s * 1.3, 1]], .24, graphite, group); inset.position.y = -.08;
      part(cube, trim, group, [s * 3.4, -.05, 2.15], [.07, .08, 1.12]);
      const nacelle = prism([[s * 1.04, -.25], [s * 1.86, .25], [s * 1.74, 3.4], [s * 1.01, 3.45]], .74, graphite, group); nacelle.position.y = -.17;
      part(cube, ceramic, group, [s * 1.41, .21, 1.5], [.42, .1, 2.9]);
      part(engineGeo, trim, group, [s * 1.4, -.13, 3.55], [1, 1, .24]);
      const fin = prism([[0, -.5], [.68, .65], [.6, 1.4], [0, 1.25]], .15, shell, group); fin.rotation.z = s * .95; fin.position.set(s * 1.3, .25, 1.5);
      part(cube, graphite, group, [s * 2.85, -.28, 1.2], [.14, .14, 2.3]);
    }
    return group;
  }
  const actor = new T.Group(), visual = new T.Group(); root.add(actor); actor.add(visual);
  const sharedShip = assets.flightShip || assets.ship;
  let ship;
  if (sharedShip?.isObject3D) {
    ship = sharedShip.clone(true); const bounds = new T.Box3().setFromObject(ship), size = bounds.getSize(V()), center = bounds.getCenter(V());
    const wrap = new T.Group(); wrap.add(ship); ship.position.sub(center); wrap.scale.setScalar(8.5 / Math.max(size.x, size.y, size.z, .01));
    if (Number.isFinite(assets.flightShipYaw)) wrap.rotation.y = assets.flightShipYaw;
    visual.add(wrap);
  } else { ship = fighter(); visual.add(ship); }
  const engineLayout = Array.isArray(assets.flightEngineLayout)&&assets.flightEngineLayout.length ? assets.flightEngineLayout : sharedShip?.isObject3D ? [[-3.2, .52, 2.4], [-3.2, -.53, 2.4], [3.2, .52, 2.4], [3.2, -.53, 2.4]] : [[-1.3, -.1, 3.8], [1.3, -.1, 3.8]];
  const flameScale = Number.isFinite(assets.flightEngineRadius) ? assets.flightEngineRadius / .4 : .56;
  const engineTrails = engineLayout.map(p => { const m = part(engineGeo, ice, visual, p, [flameScale, flameScale, 1.5]); m.userData.baseZ = p[2]; return m; });
  // Enemies are toys from the same box, in purple and red.
  const enemyToy = createToyShip({ THREE: T, faction: 'enemy', length: 8.5 }), enemyPrototype = enemyToy.root;
  own({ dispose: () => enemyToy.dispose() });
  // The supplied helmet belongs to the portal. Never reparent, rescale, hide, or dispose it here.
  void model;

  const starsGeo = own(new T.BufferGeometry()), starsData = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) { const a = random() * Math.PI * 2, y = random() * 2 - 1, r = 2200 + random() * 400; starsData.set([Math.cos(a) * Math.sqrt(1 - y * y) * r, y * r, Math.sin(a) * Math.sqrt(1 - y * y) * r], i * 3); }
  starsGeo.setAttribute('position', new T.BufferAttribute(starsData, 3)); const starfield = new T.Points(starsGeo, own(new T.PointsMaterial({ color: 0xb9d5e6, size: 1.8, sizeAttenuation: true }))); root.add(starfield);
  const planetGeo = own(new T.SphereGeometry(1, 56, 32));
  const planet = part(planetGeo, metal(0x436880, .86), root, [-790, -570, -950], [560, 560, 560]);
  const atmosphere = mesh(planetGeo, own(new T.MeshBasicMaterial({ color: 0x77b9df, transparent: true, opacity: .045, side: T.BackSide, depthWrite: false, blending: T.AdditiveBlending }))); atmosphere.position.copy(planet.position); atmosphere.scale.setScalar(573);
  const planetRing = mesh(own(new T.RingGeometry(650, 760, 128)), own(new T.MeshBasicMaterial({ color: 0x7794a6, side: T.DoubleSide, transparent: true, opacity: .17, depthWrite: false }))); planetRing.position.copy(planet.position); planetRing.rotation.set(1.09, .12, -.4);
  const dustGeo = own(new T.BufferGeometry()), dust = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) dust.set([(random() - .5) * 1100, (random() - .5) * 360, 180 - random() * 2000], i * 3);
  dustGeo.setAttribute('position', new T.BufferAttribute(dust, 3)); root.add(new T.Points(dustGeo, own(new T.PointsMaterial({ color: 0x75a9c4, size: .45, transparent: true, opacity: .25, depthWrite: false }))));
  const colliders = [], rocks = [], routeGates = [], enemies = [], shots = [], effects = [], pickups = [];
  const collider = (position, radius, type = 'debris') => colliders.push({ position: position.clone(), radius, type });
  collider(planet.position, 560, 'planet');
  const rockGeo = own(new T.IcosahedronGeometry(1, 1));
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = .78 + random() * .35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } rockGeo.computeVertexNormals(); }
  const rockMat = metal(0x303d47, .94);
  const routes = [V(-38, 30, -235), V(64, -13, -365), V(12, 37, -510)];
  const beaconPosition = V(0, 12, -92), transportStart = V(0, 32, -650), warpPosition = V(170, 80, -1810);
  const escortRoute = [V(0, 32, -650), V(90, 70, -880), V(-65, 28, -1170), V(115, 115, -1480), V(170, 80, -1775)];
  const pointSegmentDistance = (p, a, b) => { const d = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(d) / Math.max(.0001, d.lengthSq()), 0, 1); return p.distanceTo(a.clone().addScaledVector(d, t)); };
  const safeRoute = [V(0, 12, 60), beaconPosition, ...routes, ...escortRoute, warpPosition];
  for (let i = 0; i < 125; i++) {
    const z = 80 - random() * 2070, x = (random() - .5) * (i < 65 ? 210 : 750), y = (random() - .5) * 330, radius = 3 + random() ** 2 * (i < 65 ? 16 : 36), p = V(x, y, z);
    if (safeRoute.slice(1).some((b, j) => pointSegmentDistance(p, safeRoute[j], b) < radius + 24)) continue;
    const m = mesh(rockGeo, rockMat); m.position.copy(p); m.scale.set(radius, radius * .82, radius * 1.08); m.rotation.set(random() * 6, random() * 6, random() * 6); rocks.push(m); collider(p, radius * 1.08);
    if (i % 7 === 0) { const seam = mesh(ring, ghost); seam.position.copy(p); seam.scale.setScalar(radius * 1.02); seam.rotation.copy(m.rotation); }
  }
  function structureRing(position, radius, isWarp = false) {
    const g = new T.Group(); root.add(g); g.position.copy(position);
    for (const r of [radius, radius + 2.4]) { const m = mesh(thickRing, armor, g); m.scale.setScalar(r); }
    const luminous = mesh(ring, ice, g); luminous.scale.setScalar(radius - .8);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, p = V(Math.cos(a) * (radius + 1.2), Math.sin(a) * (radius + 1.2), 0);
      const block = part(cube, i % 3 === 0 ? silver : graphite, g, p.toArray(), [3, 5, isWarp ? 8 : 4]); block.rotation.z = a;
      part(cube, ice, g, [p.x * .9, p.y * .9, -2.2], [.5, 2.5, .22]).rotation.z = a;
      collider(position.clone().add(p), 3.2, 'structure');
    }
    return { g, luminous };
  }
  const gateway = structureRing(warpPosition, 38, true);
  const warpVeil = mesh(own(new T.CircleGeometry(35.5, 64)), glow(0x5eabd5, .05), gateway.g); warpVeil.material.side = T.DoubleSide;
  const beacon = new T.Group(); root.add(beacon); beacon.position.copy(beaconPosition);
  const beaconCore = mesh(orb, ice, beacon); beaconCore.scale.set(1.3, 3, 1.3);
  for (const r of [5, 7]) { const m = mesh(ring, silver, beacon); m.scale.setScalar(r); m.rotation.x = Math.PI / 2; }
  for (const s of [-1, 1]) part(cube, armor, beacon, [s * 3, 0, 0], [1.3, 6, 1.3]);
  collider(beaconPosition, 4, 'beacon');
  for (let i = 0; i < routes.length; i++) {
    const g = new T.Group(); root.add(g); g.position.copy(routes[i]); const r = mesh(ring, ghost, g); r.scale.setScalar(16);
    for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2, m = part(cube, ice, g, [Math.cos(a) * 16, Math.sin(a) * 16, 0], [2.8, .28, .35]); m.rotation.z = a; }
    routeGates.push({ g, r, passed: false });
    // Broken structural ribs frame the passage without blocking the flyable aperture.
    for (const s of [-1, 1]) { const p = routes[i].clone().add(V(s * 27, s * 14, -8)); const m = part(cube, armor, root, p.toArray(), [7, 6, 36]); m.rotation.z = s * .45; collider(p, 13, 'wreck'); }
  }
  const wreck = new T.Group(); root.add(wreck); wreck.position.copy(transportStart).add(V(-76, -42, -60)); wreck.rotation.set(.23, -.3, -.36);
  for (let i = 0; i < 9; i++) { const z = (i - 4) * 12, p = V(0, 0, z), g = part(cube, i % 2 ? silver : graphite, wreck, p.toArray(), [19, 12, 8]); part(cube, ice, wreck, [9.7, 2, z], [.16, .28, 6]); }
  wreck.updateMatrixWorld(true); collider(wreck.getWorldPosition(V()), 58, 'wreck');
  const transport = new T.Group(); transport.name = 'Dawn-rescue-transport'; root.add(transport);
  // The rescue mothership is a toy from the same box as the fighters: built here,
  // 24 units long, -Z forward. Mission logic keeps targeting this transport Group.
  const transportEngineTrails = [];
  const carrier = createToyCarrier({ THREE: T, length: 24 });
  own({ dispose: () => carrier.dispose() });
  if (carrier.root) {
    carrier.root.name = 'Dawn-visual'; transport.add(carrier.root);
    const dawnEngines = carrier.engineLayout, dawnRadius = carrier.engineRadius;
    for (const socket of dawnEngines) {
      const plume = part(engineGeo, ice, transport, socket, [dawnRadius / .4, dawnRadius / .4, .35]);
      plume.name = 'Dawn-engine-plume'; plume.userData.baseZ = socket[2]; transportEngineTrails.push(plume);
    }
  } else {
    // Plain fallback hull, only if the toy carrier could not be built.
    prism([[0, -12], [3.8, -7], [4.5, 8], [2.8, 12], [-2.8, 12], [-4.5, 8], [-3.8, -7]], 4.3, silver, transport);
    for (const s of [-1, 1]) { part(cube, graphite, transport, [s * 5.7, -.7, 1.4], [3.2, 5, 15]); for (let j = 0; j < 4; j++) part(cube, ceramic, transport, [s * 5.8, -.8, -4.5 + j * 3.6], [3.3, 3.7, 2.8]); part(engineGeo, ice, transport, [s * 4.5, .1, 10.8], [4, 4, 3]); }
    part(cube, glass, transport, [0, 2.3, -7.5], [4.9, .45, 3.6]);
    for (let i = 0; i < 5; i++) part(cube, ice, transport, [0, 2.3, -3.5 + i * 2.2], [2.8, .12, .3]);
  }
  const destination = new T.Group(); root.add(destination); destination.position.set(480, 90, -1890);
  const stationRing = mesh(thickRing, silver, destination); stationRing.scale.setScalar(70); stationRing.rotation.y = .8;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const m = part(cube, armor, destination, [Math.cos(a) * 68, Math.sin(a) * 68, 0], [13, 24, 18]); m.rotation.z = a; part(cube, ice, destination, [Math.cos(a) * 61, Math.sin(a) * 61, -9.2], [6, .4, .5]).rotation.z = a; collider(destination.position.clone().add(m.position), 13, 'station'); }
  const objectiveRing = mesh(ring, ice); objectiveRing.scale.setScalar(8);
  const targetRing = mesh(ring, red); targetRing.visible = false;
  const reticle = mesh(ring, white); reticle.scale.setScalar(.34); reticle.renderOrder = 5;

  const weapons = [
    { name: '高能激光', cost: 3.8, delay: .12, speed: 0, damage: 26, range: 230, cone: .985, sound: 'laser' },
    { name: '磁轨炮', cost: 18, delay: .82, speed: 0, damage: 80, range: 320, cone: .996, sound: 'rail' },
    { name: '追踪导弹', cost: 30, delay: 1.55, speed: 86, damage: 140, range: 300, cone: .89, sound: 'missile' }
  ];
  const phaseNames = ['定位幸存者', '穿越残骸航道', '清除封锁', '护送曙光号', '抵达救援点', '救援完成'];
  let elapsed = 0, phase = 0, phaseTime = 0, gateIndex = 0, scanProgress = 0, scanning = false, scanCD = 0;
  let score = 0, shield = 100, energy = 100, capacitor = 100, escortHull = 100, weapon = 0, kills = 0;
  let yaw = 0, pitch = 0, yawGoal = 0, pitchGoal = 0, speed = 0, boostTime = 0, boostCooldown = 0, boostHeld = false;
  let fireCooldown = 0, counterCooldown = 0, invulnerable = 0, damageAgo = 50, shieldFlash = 0, hitFlash = 0, recoil = 0, threatFlash = 0;
  let dead = false, completed = false, oldKeys = new Set(), wasLooking = false, lastPX = 0, lastPY = 0, previousTarget = null, activeTarget = null;
  let message = '', messageUntil = 0, escortLeg = 1, escortTravel = 0, ambushOne = false, ambushTwo = false, transportArrived = false, warpTime = 0;
  let totalShots = 0, totalHits = 0, touchUp = 0, touchBoost = 0, secondaryWave = false, recovered = 0, missionTime = 0, engineActive = false, heldFire = false;
  let navigationTarget = null, enemySerial = 0, laserBarrel = 0, lastHitDamage = 0, lastHitWeapon = '', lastHitKilled = false;
  const cruiseSpeed = 24, steeringDeadzone = .1;
  let steerX = 0, steerY = 0, steeringX = 0, steeringY = 0, steeringActive = false, steeringMode = 'keyboard', braking = false, commandedSpeed = cruiseSpeed;
  const blockadeWaves = [5, 3], blockadeTotal = blockadeWaves.reduce((sum, count) => sum + count, 0);
  const velocity = V(), desired = V(), forward = V(0, 0, -1), right = V(1, 0, 0), up = V(0, 1, 0), oldPosition = V();
  const say = (text, duration = 3, announce = false) => { message = text; messageUntil = elapsed + duration; if (announce) emit(text); };
  const controls = '鼠标指向转向 / 触屏拖动 · 自动巡航 · W 提速 · S 刹停 · A/D 侧移 · Space 上升 · Ctrl 下降 · Shift 加速 · 左键射击 · 1–3 武器 · F 反制 · R 目标信息';

  // Short-lived materials are local to each effect; fading one shot never dims
  // another shot, the ship engines, navigation rings, or shared model materials.
  function fxMaterial(source) {
    const material = source.clone(); material.transparent = true; material.depthWrite = false;
    material.blending = T.AdditiveBlending; return material;
  }
  function removeEffect(e) { root.remove(e.m); e.m.material.dispose(); }
  function pushEffect(e) {
    effects.push(e);
    if (effects.length > (reduced ? 110 : 220)) removeEffect(effects.shift());
    return e.m;
  }
  function effect(position, material = ice, size = 5, life = .5, type = 'burst') {
    const m = mesh(type === 'ring' ? ring : orb, fxMaterial(material)); m.position.copy(position); m.scale.setScalar(.12);
    return pushEffect({ m, life, maxLife: life, size, type, opacity: m.material.opacity });
  }
  function beam(a, b, material = ice, width = .08, life = .11) {
    const m = mesh(beamGeo, fxMaterial(material)); m.name = 'weapon-beam';
    m.position.copy(a).add(b).multiplyScalar(.5); m.scale.set(width, width, a.distanceTo(b)); m.lookAt(b);
    return pushEffect({ m, life, maxLife: life, type: 'beam', width, opacity: m.material.opacity });
  }
  function spark(position, direction, material = ice, speed = 20, life = .3, size = .18) {
    const m = mesh(orb, fxMaterial(material)); m.position.copy(position); m.scale.setScalar(size);
    return pushEffect({ m, life, maxLife: life, type: 'spark', v: direction.clone().multiplyScalar(speed), size, opacity: m.material.opacity });
  }
  function weaponImpact(position, direction, missile = false) {
    effect(position, white, missile ? 5 : 1.1, missile ? .17 : .11);
    effect(position, missile ? blastGlow : impactGlow, missile ? 12 : 2.3, missile ? .44 : .19);
    const halo = effect(position, missile ? amber : ice, missile ? 16 : 2.8, missile ? .42 : .22, 'ring'); halo.lookAt(position.clone().sub(direction));
    for (let i = 0, count = reduced ? (missile ? 5 : 2) : missile ? 13 : 5; i < count; i++) {
      const v = V(random() - .5, random() - .5, random() - .5).normalize().addScaledVector(direction, -.6).normalize();
      spark(position, v, missile && i % 2 ? amber : ice, missile ? 23 + random() * 35 : 9 + random() * 15, missile ? .45 + random() * .4 : .16 + random() * .16, missile ? .24 : .11);
    }
  }
  function destruction(position, heavy = false) {
    effect(position, white, heavy ? 8 : 5, .16);
    effect(position, blastGlow, heavy ? 21 : 14, .65);
    effect(position, smokeGlow, heavy ? 25 : 17, 1.1);
    const shockwave = effect(position, ice, heavy ? 28 : 20, .65, 'ring'); shockwave.quaternion.copy(camera.quaternion);
    for (let i = 0, count = reduced ? 7 : 18; i < count; i++) spark(position, V(random() - .5, random() - .5, random() - .5).normalize(), i % 3 ? amber : ice, 12 + random() * 42, .5 + random() * .5, .18 + random() * .18);
  }
  function clearEntities(keepPickups = false) {
    for (const list of (keepPickups ? [enemies, shots] : [enemies, shots, pickups])) { for (const e of list) root.remove(e.m); list.length = 0; }
    for (const e of effects) removeEffect(e); effects.length = 0;
  }
  function transition(next) {
    if (next === phase || completed || dead) return;
    phase = next; phaseTime = 0; scanning = false; audio('mission', { phase: next });
    if (next === 1) say('已抵达信标：曙光号仍有生命信号。沿蓝色航标穿越残骸。', 6, true);
    if (next === 2) { say('曙光号被封锁。击退掠夺者，恢复救援航线。', 6, true); for (let i = 0; i < blockadeWaves[0]; i++) spawnEnemy(i, transportStart, false, 'patrol'); }
    if (next === 3) { say('曙光号引擎恢复。保持 150 米内，护送至远端救援点。', 7, true); energy = 100; shield = Math.min(100, shield + 25); }
    if (next === 4) { say('曙光号已就位。抵达救援点 48 米内，即刻完成救援。', 6, true); }
    if (next === 5) { completed = true; resetInput(); missionTime = elapsed; score += Math.round(1200 + escortHull * 8); transport.visible = true; say('曙光号已安全抵达。救援完成，可选择下一挑战或自由探索。', 9, true); }
    if (next > 0 && next < 5) { missileAmmo = Math.min(5, missileAmmo + 1); checkpoint = snapshot(false); }
  }
  function restart() {
    paused = exploring = false; failureReason = ''; hull = 100; missileAmmo = 3; lockProgress = 0; lockCandidate = null;
    clearEntities(); elapsed = phase = phaseTime = gateIndex = scanProgress = scanCD = score = kills = yaw = pitch = yawGoal = pitchGoal = speed = 0;
    shield = energy = capacitor = escortHull = 100; weapon = 0; boostTime = boostCooldown = fireCooldown = counterCooldown = hitFlash = shieldFlash = recoil = threatFlash = warpTime = 0;
    invulnerable = 2; damageAgo = 50; dead = completed = scanning = boostHeld = wasLooking = ambushOne = ambushTwo = transportArrived = secondaryWave = false;
    previousTarget = activeTarget = navigationTarget = null; heldFire = false; enemySerial = laserBarrel = lastHitDamage = 0; lastHitWeapon = ''; lastHitKilled = false; oldKeys = new Set(); escortLeg = 1; escortTravel = totalShots = totalHits = touchUp = touchBoost = recovered = missionTime = 0;
    steerX = steerY = steeringX = steeringY = 0; steeringActive = braking = false; steeringMode = 'keyboard'; commandedSpeed = cruiseSpeed;
    velocity.set(0, 0, 0); actor.position.set(0, 12, 65); actor.rotation.set(0, 0, 0); visual.rotation.set(0, 0, 0); forward.set(0, 0, -1); right.set(1, 0, 0); up.set(0, 1, 0);
    transport.position.copy(transportStart); transport.rotation.set(0, 0, 0); transport.visible = true;
    routeGates.forEach(g => { g.passed = false; g.g.visible = true; g.r.material = ghost; });
    targetRing.visible = false; objectiveRing.visible = true; reticle.visible = true;
    camera.fov = 62; camera.far = Math.max(camera.far, 4000); camera.updateProjectionMatrix(); camera.position.set(0, 19, 86); camera.lookAt(0, 13, -20);
    checkpoint = snapshot(false);
    say('救援行动 07 · 鼠标指向转向，自动巡航；S 刹停。抵达信标 48 米内，即刻继续任务。', 8);
  }
  function spawnEnemy(index, around, escorts, variant = 'interceptor') {
    const interceptor = variant === 'interceptor', m = enemyPrototype.clone(true); root.add(m);
    m.scale.set(interceptor ? .62 : .78, interceptor ? .56 : .74, interceptor ? .82 : .72);
    const a = index * 2.1 + elapsed * .07, distance = 72 + index * 8, hp = interceptor ? 80 : 105;
    const id = ++enemySerial, label = (interceptor ? '拦截机 I-' : '巡逻机 P-') + String(id).padStart(2, '0');
    m.name = label; m.position.copy(around).add(V(Math.sin(a) * distance, 12 + Math.cos(a * 1.3) * 24, Math.cos(a) * distance));
    // Lighter, fast interceptors complement the broader patrol craft. Staggered attacks
    // keep the larger waves fair; no enemies spawn during the scan/navigation tutorial.
    part(cube, interceptor ? amber : red, m, [0, .9, 1.5], [interceptor ? .2 : 1.4, .14, 1.2]);
    const warning = part(ring, amber, m, [0, 0, 0], [7, 7, 7]); warning.name = 'incoming-fire-warning'; warning.visible = false;
    enemies.push({ m, warning, charging: false, intent: escorts ? 'transport' : 'player', id: 'enemy-' + id, label, variant, hp, maxHp: hp, radius: interceptor ? 2.9 : 3.3, v: V(), fire: 2.3 + index * .55, seed: a, evade: 0, hitReaction: 0, escorts, alive: true, kind: 'enemy' });
  }
  // Analytic ray/sphere tests include debris. Shots and locks cannot pass through cover.
  function sphereRay(origin, direction, center, radius, maximum) {
    const offset = origin.clone().sub(center), b = offset.dot(direction), c = offset.lengthSq() - radius * radius, discriminant = b * b - c;
    if (discriminant < 0) return Infinity;
    const near = -b - Math.sqrt(discriminant), far = -b + Math.sqrt(discriminant), d = near >= 0 ? near : far >= 0 ? 0 : Infinity;
    return d <= maximum ? d : Infinity;
  }
  function obstruction(origin, direction, maximum, ignoreBeacon = false) {
    let distance = maximum;
    for (const c of colliders) { if (ignoreBeacon && c.type === 'beacon') continue; const d = sphereRay(origin, direction, c.position, c.radius, distance); if (d < distance) distance = d; }
    return distance;
  }
  function visibleBetween(a, b) { const d = b.clone().sub(a), distance = d.length(); return obstruction(a, d.normalize(), distance) > distance - .5; }
  function lockTarget() {
    const w = weapons[weapon]; let selected = null, best = w.cone;
    for (const e of enemies) { if (e.hp <= 0) continue; const delta = e.m.position.clone().sub(actor.position), distance = delta.length(), alignment = delta.normalize().dot(forward);
      if (distance < w.range && alignment > best && visibleBetween(actor.position, e.m.position)) { selected = e; best = alignment; }
    }
    return selected;
  }
  function pickup(position, type) { const m = mesh(orb, type === 'shield' ? ice : amber); m.position.copy(position); m.scale.setScalar(1.1); pickups.push({ m, type, life: 50 }); }
  function hitEnemy(e, damage, impact = e.m.position, direction = forward, weaponName = '') {
    if (dead || completed || paused || e.hp <= 0) return;
    const actualDamage = Math.min(e.hp, damage); e.hp = Math.max(0, e.hp - damage); e.evade = 1.15; e.hitReaction = .22;
    totalHits++; hitFlash = .22; lastHitDamage = actualDamage; lastHitWeapon = weaponName; lastHitKilled = e.hp <= 0;
    weaponImpact(impact, direction, weaponName === 'missile');
    // An immediate brief roll and expanding ion flash make damage visible even
    // against a dark hull. Feedback does not alter the collision/HP calculation.
    e.m.rotation.z += (e.id.length % 2 ? 1 : -1) * .13;
    audio('hit', { intensity: weaponName === 'missile' ? .85 : .65, pitch: 1.15, weapon: weaponName });
    audio('hitconfirm', { intensity: .72, kill: lastHitKilled, weapon: weaponName });
    if (e.hp <= 0) {
      e.m.visible = false; e.alive = false; kills++; score += 180;
      destruction(e.m.position, weaponName === 'missile'); pickup(e.m.position, kills % 2 ? 'energy' : 'shield');
      audio('explosion', { intensity: weaponName === 'missile' ? 1.2 : .95, distance: actor.position.distanceTo(e.m.position) * .28, weapon: weaponName });
    }
  }
  function hurt(amount, collision = false) {
    if (dead || completed || paused || invulnerable > 0 || warpTime > 0) return;
    const absorbed = Math.min(shield, amount); shield -= absorbed; hull = Math.max(0, hull - (amount - absorbed)); damageAgo = 0; invulnerable = collision ? .8 : .22; shieldFlash = .6; threatFlash = .9; audio(collision ? 'collision' : 'damage', { intensity: amount / 20 });
    if (hull <= 0) { dead = true; failureReason = '玩家舰体被摧毁'; resetInput(); speed = 0; boostHeld = false; velocity.set(0, 0, 0); actor.visible = false; effect(actor.position, ice, 16, 1.2); say('舰体失效 · 从当前阶段检查点重试救援', 100, true); audio('explosion', { intensity: 1 }); }
  }
  function selectWeapon(index) { index = Number(index); weapon = Number.isFinite(index) ? clamp(Math.floor(index) - 1, 0, 2) : (weapon + 1) % 3; activeTarget = null; say(weapons[weapon].name + (weapon === 1 ? ' · 高伤害直射，适合远距离精确打击' : weapon === 2 ? ' · 锁定后发射，直接命中可击毁敌机' : ' · 瞄准即命中，高射速激光压制'), 3); audio('select'); }
  function projectile(position, direction, options = {}) {
    const { hostile = false, target = null, damage = 12, speed = 200, life = 1.1, missile = false, transportTarget = false } = options;
    let m;
    if (missile) {
      m = new T.Group(); root.add(m); m.name = 'homing-missile';
      part(engineGeo, ceramic, m, [0, 0, 0], [1.3, 1.3, 2.5]);
      part(orb, amber, m, [0, 0, 1.2], [.27, .27, .6]);
      for (const x of [-1, 1]) part(cube, graphite, m, [x * .33, 0, -.6], [.66, .1, .7]);
      part(engineGeo, white, m, [0, 0, -1.8], [.8, .8, 2.2]);
      part(engineGeo, amber, m, [0, 0, -2.25], [1.8, 1.8, 3.1]);
    } else { m = mesh(orb, hostile ? red : ice); m.scale.set(.22, .22, 1.4); }
    m.position.copy(position); m.lookAt(position.clone().add(direction));
    shots.push({ m, v: direction.clone().multiplyScalar(speed), target, damage, speed, hostile, missile, transportTarget, life, trailTime: 0, traveled: 0, maxTravel: missile ? 390 : speed * life });
    if (shots.length > 170) root.remove(shots.shift().m);
  }
  function fire() {
    if (dead || completed || paused || warpTime > 0 || fireCooldown > 0) return;
    const w = weapons[weapon]; if (energy < w.cost) { say('武器电容不足 · 松开射击充能', .8); return; }
    activeTarget = lockTarget(); if (weapon === 2 && (!activeTarget || activeTarget !== lockCandidate || lockProgress < 1)) { say('导弹需要稳定锁定 · 瞄准无遮挡目标 0.8 秒', 1); fireCooldown = .2; return; }
    if (weapon === 2 && missileAmmo <= 0) { say('导弹耗尽 · 使用激光，下一阶段补给', 2); return; }
    if (weapon === 2) missileAmmo--;
    energy -= w.cost; fireCooldown = w.delay; recoil = weapon === 1 ? .26 : weapon === 2 ? .23 : .07; totalShots++;
    let origin = actor.position.clone().addScaledVector(forward, 4.8);const aim = forward.clone();
    if(weapon===0){const barrel=++laserBarrel,layout=assets.flightMuzzleLayout;if(Array.isArray(layout)&&layout.length){const p=layout[(barrel-1)%layout.length];origin=visual.localToWorld(V(...p));}else origin.addScaledVector(right,(barrel%2?1:-1)*1.15).addScaledVector(up,-.13);}
    if (activeTarget && weapon !== 1) aim.copy(activeTarget.m.position).sub(origin).normalize();
    if (weapon !== 2) {
      // Hitscan tests the same physical cover as missiles and hostile shots.
      // The laser gets only the small displayed target-lock cone as aim assist.
      let distance = obstruction(origin, aim, w.range), victim = null;
      for (const e of enemies) if (e.hp > 0) { const d = sphereRay(origin, aim, e.m.position, e.radius + (weapon === 0 ? .25 : .6), distance); if (d < distance) { victim = e; distance = d; } }
      const endpoint = origin.clone().addScaledVector(aim, distance);
      if (weapon === 0) {
        const muzzle = origin;
        beam(muzzle, endpoint, laserHalo, .88, .135); beam(muzzle, endpoint, laserGlow, .29, .12); beam(muzzle, endpoint, laserCore, .085, .105);
        const flash = effect(muzzle, laserCore, .82, .10); flash.name = 'laser-muzzle';
        effect(muzzle, laserGlow, 1.5, .13);
      } else {
        beam(origin, endpoint, white, .17, .18); beam(origin, endpoint, laserGlow, .7, .16); effect(origin, white, 1.8, .13);
      }
      if (victim) hitEnemy(victim, w.damage, endpoint, aim, weapon === 0 ? 'laser' : 'rail');
      else if (distance < w.range) weaponImpact(endpoint, aim);
    } else {
      projectile(origin, aim, { target: activeTarget, damage: w.damage, speed: w.speed, life: 5, missile: true });
      effect(origin, amber, 1.5, .16);
    }
    audio(w.sound, { intensity: weapon === 1 ? .95 : weapon === 2 ? .92 : .82, pitch: weapon === 0 ? .99 + (laserBarrel % 3) * .025 : 1, weapon: weapon === 0 ? 'laser' : weapon === 2 ? 'missile' : 'rail' });
  }
  function countermeasure() {
    if (dead || completed || paused || warpTime > 0) return;
    if (counterCooldown > 0) { say('反制系统冷却 ' + Math.ceil(counterCooldown) + ' 秒', 1.5); return; }
    counterCooldown = 11; invulnerable = 1.3; shieldFlash = .6;
    const pulse = effect(actor.position, ice, 34, .6, 'ring'); pulse.quaternion.copy(camera.quaternion);
    let neutralized = 0;
    for (const p of shots) if (p.hostile && p.m.position.distanceTo(actor.position) < 85) { p.life = 0; neutralized++; }
    for (const e of enemies) if (e.hp > 0 && e.m.position.distanceTo(actor.position) < 75) { e.fire = Math.max(e.fire, 2.2); e.evade = 1.5; }
    say('电磁反制 · 拦截 ' + neutralized + ' 发炮弹 · 短时护盾强化', 2.5); audio('countermeasure', { intensity: .85 });
  }
  // R is informational only; arriving at a waypoint performs its mission action.
  function scanner() {
    if (dead || completed || paused) return;
    say('目标 · ' + objectiveName() + ' · ' + Math.round(objectivePosition().distanceTo(actor.position)) + ' 米', 3);
  }
  function arriveAtObjective(swept = false) {
    if (dead || completed || paused || exploring) return;
    const reached = point => (swept ? pointSegmentDistance(point, oldPosition, actor.position) : actor.position.distanceTo(point)) <= 48;
    if (phase === 0 && reached(beaconPosition)) {
      scanProgress = 1; score += 150; transition(1);
    } else if (phase === 4 && reached(warpPosition)) {
      transition(5);
      for (let i = 0; i < 8; i++) pickup(warpPosition.clone().add(V(Math.sin(i * 2.4) * 120, Math.cos(i * 1.2) * 65, Math.cos(i * 2.4) * 120)), i % 2 ? 'energy' : 'shield');
    }
  }
  function missionTarget() {
    if (phase !== 2) return null;
    if (activeTarget?.hp > 0) navigationTarget = activeTarget;
    if (!navigationTarget || navigationTarget.hp <= 0) navigationTarget = enemies.filter(e => e.hp > 0).sort((a, b) => a.m.position.distanceToSquared(actor.position) - b.m.position.distanceToSquared(actor.position))[0] || null;
    return navigationTarget;
  }
  function objectivePosition() { if (phase === 0) return beaconPosition; if (phase === 1) return gateIndex < routes.length ? routes[gateIndex] : transport.position; if (phase === 2) return missionTarget()?.m.position || transport.position; if (phase === 3) return transport.position; if (phase === 4) return warpPosition; return destination.position; }
  function objectiveName() { return ['求救信标', gateIndex < routes.length ? '残骸航标 ' + (gateIndex + 1) + ' / ' + routes.length : '曙光号', missionTarget()?.label || '曙光号', '曙光号 · 保持 150 米内', '救援点 · 抵达即完成', '极光前哨 · 自由探索'][phase]; }
  function objectiveId() { return phase === 0 ? 'beacon' : phase === 1 && gateIndex < routes.length ? 'gate-' + gateIndex : phase === 2 ? missionTarget()?.id || 'transport' : phase < 4 ? 'transport' : phase === 4 ? 'rescue-point' : 'outpost'; }
  function updatePlayer(dt, input, has) {
    oldPosition.copy(actor.position);
    // Desktop pointer position is a virtual flight stick. The host explicitly
    // validates it, so captured/out-of-canvas/menu coordinates cannot steer.
    // Touch continues to use relative drag, independent of where a finger lands.
    const px = clamp(Number(input.pointerX) || 0, -1, 1), py = clamp(Number(input.pointerY) || 0, -1, 1);
    const touchLooking = !!input.touchLook, mouseSteering = input.pointerActive === true && !touchLooking, previousSteeringMode = steeringMode;
    steeringActive = mouseSteering; steeringMode = touchLooking ? 'touch' : mouseSteering ? 'mouse' : 'keyboard';
    steeringX = mouseSteering ? px : 0; steeringY = mouseSteering ? py : 0;
    if (touchLooking) {
      steerX = steerY = 0;
      const dx = Number.isFinite(input.pointerDeltaX) ? input.pointerDeltaX : wasLooking ? px - lastPX : 0;
      const dy = Number.isFinite(input.pointerDeltaY) ? input.pointerDeltaY : wasLooking ? py - lastPY : 0;
      yawGoal -= clamp(dx, -.4, .4) * 2.05; pitchGoal = clamp(pitchGoal + clamp(dy, -.4, .4) * 1.7, -1.46, 1.46);
    } else if (mouseSteering) {
      const radius = Math.hypot(px, py), amount = Math.pow(clamp((radius - steeringDeadzone) / (1 - steeringDeadzone), 0, 1), 1.35);
      const targetX = radius > 0 ? px / radius * amount : 0, targetY = radius > 0 ? py / radius * amount : 0;
      steerX = damp(steerX, targetX, 10, dt); steerY = damp(steerY, targetY, 10, dt);
      yawGoal -= steerX * 1.3 * dt; pitchGoal = clamp(pitchGoal + steerY * 1.05 * dt, -1.46, 1.46);
    } else {
      // Losing pointer validity stops turn immediately, including a smoothing
      // tail from the previous mouse/touch frame. Keyboard steering still works.
      steerX = steerY = 0;
      if (previousSteeringMode !== 'keyboard') { yawGoal = yaw; pitchGoal = pitch; }
    }
    yawGoal += ((has('KeyJ') ? 1 : 0) - (has('KeyL') ? 1 : 0)) * dt * 1.2;
    pitchGoal = clamp(pitchGoal + ((has('KeyI') ? 1 : 0) - (has('KeyK') ? 1 : 0)) * dt, -1.46, 1.46);
    lastPX = px; lastPY = py; wasLooking = touchLooking;
    yaw = damp(yaw, yawGoal, 20, dt); pitch = damp(pitch, pitchGoal, 20, dt); actor.rotation.set(pitch, yaw, 0, 'YXZ');
    forward.set(0, 0, -1).applyQuaternion(actor.quaternion); right.set(1, 0, 0).applyQuaternion(actor.quaternion); up.set(0, 1, 0).applyQuaternion(actor.quaternion);
    braking = has('KeyS', 'ArrowDown');
    const stationKeeping = false;
    const requestingBoost = !braking && !stationKeeping && (has('ShiftLeft', 'ShiftRight') || touchBoost > 0);
    boostHeld = requestingBoost && capacitor > 2 && boostCooldown <= 0;
    if (boostHeld) { capacitor = Math.max(0, capacitor - dt * 24); boostTime += dt; if (!engineActive) audio('boost', { intensity: .65 }); if (capacitor < 2) boostCooldown = 1.6; }
    else { capacitor = Math.min(100, capacitor + dt * 18); boostTime = 0; }
    engineActive = boostHeld;
    const throttle = stationKeeping || braking ? 0 : has('KeyW', 'ArrowUp') ? 37 : cruiseSpeed;
    commandedSpeed = boostHeld ? 88 : throttle;
    desired.copy(forward).multiplyScalar(commandedSpeed);
    if (!stationKeeping) {
      desired.addScaledVector(right, ((has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0)) * (boostHeld ? 28 : 23));
      desired.y += ((has('Space') || touchUp > 0 ? 1 : 0) - (has('ControlLeft', 'ControlRight') ? 1 : 0)) * 23;
    }
    velocity.lerp(desired, 1 - Math.exp(-dt * (stationKeeping || braking ? 12 : 4.8)));
    if ((stationKeeping || braking) && velocity.lengthSq() < .0001) velocity.set(0, 0, 0);
    actor.position.addScaledVector(velocity, dt); speed = velocity.length();
    for (const c of colliders) {
      const motion = actor.position.clone().sub(oldPosition), travel = motion.length();
      const swept = travel > .0001 && oldPosition.distanceToSquared(c.position) > (c.radius + 2.4) ** 2 ? sphereRay(oldPosition, motion.normalize(), c.position, c.radius + 2.4, travel) : Infinity;
      if (actor.position.distanceToSquared(c.position) > (c.radius + 2.4) ** 2 && !Number.isFinite(swept)) continue;
      if (Number.isFinite(swept)) actor.position.copy(oldPosition).addScaledVector(motion, Math.max(0, swept - .02));
      const n = actor.position.clone().sub(c.position); if (n.lengthSq() < .001) n.copy(forward).negate(); n.normalize();
      actor.position.copy(c.position).addScaledVector(n, c.radius + 2.5); const impact = Math.max(0, -velocity.dot(n)); if (impact > 5) { hurt(clamp(impact * .18, 4, 17), true); say('船体碰撞 · S 刹停，A/D 侧移避让', 1.4); }
      velocity.addScaledVector(n, Math.max(0, -velocity.dot(n)) + 2);
    }
    if (actor.position.distanceTo(transport.position) < 12 && phase >= 2 && phase < 5) { const n = actor.position.clone().sub(transport.position).normalize(); actor.position.copy(transport.position).addScaledVector(n, 12); velocity.multiplyScalar(.6); }
    const sectorCenter = V(0, 0, -870), sectorDelta = actor.position.clone().sub(sectorCenter);
    if (sectorDelta.length() > 2300) { sectorDelta.normalize(); actor.position.copy(sectorCenter).addScaledVector(sectorDelta, 2300); velocity.addScaledVector(sectorDelta, -Math.max(0, velocity.dot(sectorDelta))); say('已到达可航行区边缘 · 返回救援航区', 2); }
    const bank = clamp(-velocity.dot(right) / 80 - (yawGoal - yaw) * .8 + steerX * .24, -.42, .42);
    visual.rotation.z = damp(visual.rotation.z, bank, 6, dt); visual.rotation.x = damp(visual.rotation.x, throttle ? -.025 : .035, 6, dt);
    if (heldFire || input.pointerDown || input.pointerPressed) fire();
  }
  function updateEnemies(dt) {
    let chargingCount = enemies.filter(e => e.hp > 0 && e.charging).length;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const playerDistance = e.m.position.distanceTo(actor.position), targetTransport = e.escorts && phase === 3, targetPos = targetTransport ? transport.position : actor.position;
      const delta = targetPos.clone().sub(e.m.position), distance = delta.length(), toward = delta.normalize(); e.evade = Math.max(0, e.evade - dt);
      const orbit = V(Math.cos(elapsed * .65 + e.seed), Math.sin(elapsed * .9 + e.seed) * .6, Math.sin(elapsed * .65 + e.seed));
      const interceptor = e.variant === 'interceptor';
      e.intent = targetTransport ? 'transport' : 'player';
      const desiredV = toward.multiplyScalar(distance > 75 ? (interceptor ? 30 : 22) : distance < 33 ? -18 : 5).addScaledVector(orbit, e.evade > 0 ? 26 : interceptor ? 15 : 10);
      for (const c of colliders) { const away = e.m.position.clone().sub(c.position), d = away.length(); if (d < c.radius + 18) desiredV.addScaledVector(away.normalize(), (c.radius + 18 - d) * 2.5); }
      desiredV.multiplyScalar(1 + (difficulty - 1) * .1);
      e.v.lerp(desiredV, 1 - Math.exp(-dt * 2.3)); e.m.position.addScaledVector(e.v, dt); e.m.lookAt(e.m.position.clone().sub(e.v.lengthSq() > 2 ? e.v : targetPos.clone().sub(e.m.position)));
      e.hitReaction = Math.max(0, e.hitReaction - dt); if (e.hitReaction > 0) e.m.rotation.z += Math.sin(e.hitReaction * 38) * e.hitReaction * 1.5;
      e.fire -= dt;
      const canShoot = distance < 245 && visibleBetween(e.m.position, targetPos);
      if (e.charging && !canShoot) { e.charging = false; e.warning.visible = false; e.fire = 1; chargingCount--; }
      if (!e.charging && e.fire <= 0 && canShoot && chargingCount < (difficulty === 1 ? 2 : 3)) {
        e.charging = true; e.fire = [1.2, .95, .8][difficulty - 1]; chargingCount++;
        e.warning.visible = true; audio('warning', { intensity: .3 });
      }
      if (e.charging) { e.warning.quaternion.copy(e.m.quaternion).invert().multiply(camera.quaternion); e.warning.scale.setScalar(5 + Math.sin(elapsed * 14) * .8); }
      if (!dead && e.charging && e.fire <= 0 && canShoot) {
        e.charging = false; e.warning.visible = false; chargingCount--;
        const aim = targetPos.clone(); if (!targetTransport) aim.addScaledVector(velocity, Math.min(1.1, distance / 92));
        aim.add(V(Math.sin(e.seed + elapsed) * 2.3, Math.cos(e.seed - elapsed) * 2.3, 0)).sub(e.m.position).normalize();
        projectile(e.m.position.clone().addScaledVector(aim, 4), aim, { hostile: true, speed: 86, damage: targetTransport ? 2.7 : interceptor ? 5 : 6, life: 3, transportTarget: targetTransport }); e.fire = ((interceptor ? 1.9 : 2.15) + random()) / (1 + (difficulty - 1) * .12);
      }
    }
  }
  function updateProjectiles(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      if (dead || completed) break;
      const p = shots[i];
      if (p.life <= 0) { root.remove(p.m); shots.splice(i, 1); continue; }
      p.life -= dt; const before = p.m.position.clone();
      // Homing changes direction smoothly, never teleports a missile or damages
      // its lock remotely. Cover and actual swept collision determine every hit.
      if (p.target?.hp > 0) { const desiredV = p.target.m.position.clone().sub(before).normalize().multiplyScalar(p.speed); p.v.lerp(desiredV, 1 - Math.exp(-dt * 3.8)); }
      p.m.position.addScaledVector(p.v, dt); p.m.lookAt(p.m.position.clone().add(p.v));
      const delta = p.m.position.clone().sub(before), distance = delta.length(), direction = delta.normalize(); p.traveled += distance;
      let nearest = obstruction(before, direction, distance), victim = null;
      if (p.hostile) {
        const playerHit = sphereRay(before, direction, actor.position, 2.3, nearest); if (playerHit < nearest) { nearest = playerHit; victim = 'player'; }
        if (phase === 3) { const escortHit = sphereRay(before, direction, transport.position, 9, nearest); if (escortHit < nearest) { nearest = escortHit; victim = 'transport'; } }
      } else for (const e of enemies) if (e.hp > 0) { const d = sphereRay(before, direction, e.m.position, e.radius + (p.missile ? .5 : .75), nearest); if (d < nearest) { nearest = d; victim = e; } }
      if (nearest < distance || victim) {
        p.life = 0; const point = before.clone().addScaledVector(direction, nearest);
        if (victim === 'player') hurt(p.damage);
        else if (victim === 'transport') { escortHull = Math.max(0, escortHull - p.damage); if (escortHull <= 0) failEscort(); effect(transport.position, red, 6, .2); if (escortHull < 35 && elapsed > messageUntil) say('曙光号护盾危急 · 优先清除靠近运输舰的敌机', 4, true); }
        else if (victim) hitEnemy(victim, p.damage, point, direction, p.missile ? 'missile' : 'pulse');
        else if (p.missile) { weaponImpact(point, direction, true); audio('explosion', { intensity: .7, distance: actor.position.distanceTo(point) * .4, weapon: 'missile' }); }
        else effect(point, p.hostile ? red : ice, 1.6, .18);
      }
      if (p.missile && p.life > 0) {
        p.trailTime -= dt;
        if (p.trailTime <= 0) {
          p.trailTime = reduced ? .075 : .035;
          const tail = p.m.position.clone().addScaledVector(direction, -2.7);
          beam(tail, tail.clone().addScaledVector(direction, -4.5), amber, .25, .17);
          effect(tail, smokeGlow, 1.1, .52);
        }
      }
      if (p.traveled >= p.maxTravel) p.life = 0;
      if (p.life <= 0) { root.remove(p.m); shots.splice(i, 1); }
    }
  }
  function updateMission(dt) {
    if (dead || completed || exploring) return;
    phaseTime += dt;
    arriveAtObjective(true);
    if (phase === 1) {
      if (gateIndex < 3 && pointSegmentDistance(routes[gateIndex], oldPosition, actor.position) < 18) { const g = routeGates[gateIndex]; g.passed = true; g.r.material = ice; gateIndex++; score += 100; audio('checkpoint'); say('航标已通过 · ' + gateIndex + ' / 3', 2); }
      if (gateIndex >= 3 && actor.position.distanceTo(transport.position) < 118) transition(2);
    }
    if (phase === 2) {
      if (!secondaryWave && enemies.every(e => e.hp <= 0)) { secondaryWave = true; for (let i = 0; i < blockadeWaves[1]; i++) spawnEnemy(i + 3, transportStart, false, 'interceptor'); say('敌方增援接近 · 三架轻型拦截机', 4, true); }
      else if (secondaryWave && enemies.every(e => e.hp <= 0)) transition(3);
    }
    if (phase === 3) {
      const escortDistance = actor.position.distanceTo(transport.position), threats = enemies.filter(e => e.hp > 0).length;
      if (escortDistance <= 150 && !transportArrived) {
        const point = escortRoute[escortLeg], delta = point.clone().sub(transport.position), distance = delta.length(), step = Math.min(distance, dt * (threats ? 10 : 14));
        const move = delta.normalize(); transport.position.addScaledVector(move, step); transport.lookAt(transport.position.clone().sub(move)); escortTravel += step;
        if (distance < 5) { if (escortLeg < escortRoute.length - 1) escortLeg++; else transportArrived = true; }
      }
      if (escortDistance > 150 && elapsed > messageUntil) say('曙光号等待护航 · 接近至 150 米内恢复航行', 3);
      if (!ambushOne && escortTravel > 245) { ambushOne = true; for (let i = 0; i < 3; i++) spawnEnemy(i + 1, transport.position.clone().add(V(0, 0, -100)), true); say('左舷出现拦截机 · 曙光号请求支援', 4, true); audio('warning'); }
      if (!ambushTwo && escortTravel > 710) { ambushTwo = true; for (let i = 0; i < 3; i++) spawnEnemy(i + 3, transport.position.clone().add(V(0, 0, -95)), true); say('抵达前最后一波拦截 · 保护运输舰', 4, true); audio('warning'); }
      if (escortHull <= 0 && !dead) failEscort();
      if (!dead && transportArrived && enemies.every(e => e.hp <= 0)) transition(4);
    }
    arriveAtObjective(true);
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; e.life -= dt;
      if (e.life <= 0) { removeEffect(e); effects.splice(i, 1); continue; }
      const fade = e.life / e.maxLife, progress = 1 - fade;
      e.m.material.opacity = e.opacity * (e.type === 'beam' ? Math.sqrt(fade) : fade * fade);
      if (e.type === 'beam') { const width = e.width * (.72 + fade * .28); e.m.scale.x = e.m.scale.y = width; }
      else if (e.type === 'spark') { e.m.position.addScaledVector(e.v, dt); e.v.multiplyScalar(Math.exp(-dt * 2.4)); e.m.scale.setScalar(e.size * (.35 + fade * .65)); }
      else { e.m.scale.setScalar(.1 + progress * e.size); if (e.type === 'burst') e.m.rotation.y += dt * 3; }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.life -= completed ? 0 : dt; p.m.rotation.y += dt; p.m.rotation.z += dt * .4; const d = p.m.position.distanceTo(actor.position);
      if (d < 28) p.m.position.lerp(actor.position, 1 - Math.exp(-dt * 2.4));
      if (d < 4 && !dead) { if (p.type === 'shield') shield = Math.min(100, shield + 24); else energy = Math.min(100, energy + 36); score += 35; recovered++; p.life = 0; say(p.type === 'shield' ? '回收护盾电池 +24' : '回收武器电容 +36', 1.8); audio('pickup', { intensity: .65 }); }
      if (p.life <= 0) { root.remove(p.m); pickups.splice(i, 1); }
    }
  }
  function updateCamera(dt, input) {
    const comfort = reduced || input.reduced, back = boostHeld ? 23 : 19;
    const goal = actor.position.clone().addScaledVector(forward, -back - (comfort ? 0 : recoil * 5)).addScaledVector(up, 6.3);
    // Prevent camera clipping when the player backs into debris.
    const cameraRay = goal.clone().sub(actor.position), length = cameraRay.length(), safe = obstruction(actor.position, cameraRay.normalize(), length);
    if (safe < length) goal.copy(actor.position).addScaledVector(cameraRay, Math.max(4, safe - 1));
    camera.position.lerp(goal, 1 - Math.exp(-dt * 9)); camera.up.lerp(up, 1 - Math.exp(-dt * 6));
    camera.lookAt(actor.position.clone().addScaledVector(forward, 29).addScaledVector(up, 2));
    const wantedFov = comfort ? 62 : boostHeld ? 69 : 62;
    const fov = damp(camera.fov, wantedFov, 5, dt); if (Math.abs(fov - camera.fov) > .005) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(true);
  }
  function update(dt, input = {}) {
    if (disposed || paused || input.paused || dead || completed) return; dt = clamp(Number(dt) || 0, 0, .05); if (!dt) return;
    arriveAtObjective();
    if (completed) { resetInput(); return; }
    const keys = input.keys || new Set(), has = (...names) => names.some(n => keys.has(n)), edge = k => keys.has(k) && !oldKeys.has(k);
    if (!warpTime && !exploring) elapsed += dt; fireCooldown = Math.max(0, fireCooldown - dt); counterCooldown = Math.max(0, counterCooldown - dt); boostCooldown = Math.max(0, boostCooldown - dt); scanCD = Math.max(0, scanCD - dt); invulnerable = Math.max(0, invulnerable - dt); hitFlash = Math.max(0, hitFlash - dt); shieldFlash = Math.max(0, shieldFlash - dt); threatFlash = Math.max(0, threatFlash - dt); recoil = Math.max(0, recoil - dt); touchBoost = Math.max(0, touchBoost - dt); touchUp = Math.max(0, touchUp - dt); damageAgo += dt;
    for (let i = 1; i <= 3; i++) if (edge('Digit' + i)) selectWeapon(i);
    if (edge('KeyR')) scanner(); if (edge('KeyF')) countermeasure();
    if (!dead) {
      energy = Math.min(100, energy + dt * (fireCooldown > 0 ? 8 : 18)); if (damageAgo > 8) shield = Math.min(100, shield + dt * 3.2);
      if (!warpTime) updatePlayer(dt, input, has); else oldPosition.copy(actor.position);
      if (!exploring && !dead) { updateEnemies(dt); updateProjectiles(dt); if (!dead) updateMission(dt); }
    }
    if (dead || completed) { resetInput(); updateCamera(dt, input); return; }
    updateEffects(dt); updateCamera(dt, input);
    beacon.rotation.y += dt * .23; beaconCore.scale.y = 3 + Math.sin(elapsed * 2) * .22;
    for (let i = 0; i < routeGates.length; i++) { const g = routeGates[i]; g.g.visible = phase <= 1; g.r.rotation.z += dt * .15; g.r.material = i === gateIndex && phase === 1 ? ice : ghost; }
    warpVeil.material.opacity = phase >= 4 ? .16 + Math.sin(elapsed * 2) * .045 : .035;
    for (const e of engineTrails) { e.scale.z = boostHeld ? 5.2 + Math.sin(elapsed * 34) * .4 : .8 + Math.min(speed / 22, 1.7); e.position.z = e.userData.baseZ + e.scale.z * .45; }
    for (const e of transportEngineTrails) {
      const underWay = phase === 3 && !transportArrived && actor.position.distanceTo(transport.position) <= 150;
      e.scale.z = underWay ? 1.8 + Math.sin(elapsed * 14) * .13 : .32;
      e.position.z = e.userData.baseZ + e.scale.z * .48;
    }
    starfield.position.copy(actor.position).multiplyScalar(.75);
    activeTarget = dead ? null : lockTarget();
    if (weapon === 2 && activeTarget && activeTarget === lockCandidate) lockProgress = Math.min(1, lockProgress + dt / lockSeconds);
    else { lockProgress = 0; lockCandidate = weapon === 2 ? activeTarget : null; } if (activeTarget && previousTarget !== activeTarget) audio('lock', { intensity: .45 }); previousTarget = activeTarget;
    reticle.visible = !dead; reticle.position.copy(actor.position).addScaledVector(forward, 52).addScaledVector(up, 1.25); reticle.quaternion.copy(camera.quaternion); reticle.scale.setScalar(hitFlash > 0 ? .55 : .3);
    targetRing.visible = !!activeTarget && !dead; if (activeTarget) { targetRing.position.copy(activeTarget.m.position); targetRing.quaternion.copy(camera.quaternion); targetRing.scale.setScalar(weapon === 2 ? 7.5 - lockProgress * 2 : 5.5); targetRing.rotation.z += elapsed * .03; }
    objectiveRing.visible = !dead && !warpTime; objectiveRing.position.copy(objectivePosition()); objectiveRing.quaternion.copy(camera.quaternion); objectiveRing.scale.setScalar(phase === 3 ? 16 : phase === 4 ? 35 : 9 + Math.sin(elapsed * 2) * .5);
    oldKeys = new Set(keys);
  }
  function project(position) {
    camera.updateMatrixWorld(true);
    const local = position.clone().applyMatrix4(camera.matrixWorldInverse), p = position.clone().project(camera), behind = local.z >= 0;
    // Angles stay finite and preserve left/right even behind the camera. Projected
    // NDC coordinates alone flip across the eye plane and are not navigation cues.
    const bearingX = Math.atan2(local.x, -local.z), bearingY = Math.atan2(local.y, Math.hypot(local.x, local.z));
    return { x: Number.isFinite(p.x) ? p.x : 0, y: Number.isFinite(p.y) ? p.y : 0, visible: !behind && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, behind, bearingX, bearingY };
  }
  function getState() {
    const lockedTarget = activeTarget?.hp > 0 ? activeTarget : null;
    const objective = objectivePosition(), distance = actor.position.distanceTo(objective), alive = enemies.filter(e => e.hp > 0), w = weapons[weapon];
    let mission = phaseNames[phase];
    if (phase === 0) mission += ' · ' + Math.round(distance) + ' 米 · 抵达即继续';
    if (phase === 1) mission += ' · 航标 ' + gateIndex + '/3';
    if (phase === 2) mission += ' · 敌机 ' + Math.min(blockadeTotal, kills) + '/' + blockadeTotal;
    if (phase === 3) mission += ' · ' + Math.min(99, Math.round(escortTravel / 1190 * 100)) + '% · 船体 ' + Math.round(escortHull) + '%';
    if (phase === 4) mission += ' · ' + Math.round(distance) + ' 米 · 抵达即完成';
    if (phase === 5) mission += (exploring ? ' · 自由探索' : ' · 等待选择下一步');
    const targetLabel = lockedTarget ? lockedTarget.label + ' · ' + Math.round(lockedTarget.m.position.distanceTo(actor.position)) + ' 米' : alive.length ? '目标需在射程内且无遮挡' : '航区清晰';
    const status = elapsed < messageUntil ? message : phase === 0 ? '鼠标指向信标 · 抵达 48 米内即刻继续 · S 刹停' : phase === 1 ? '鼠标跟随蓝色航标 · 自动巡航 · W 提速 / S 刹停' : phase === 2 ? '保持移动 · 3 导弹锁定 / F 反制敌火' : phase === 3 ? (distance > 150 ? '曙光号等待你靠近' : '保持护航距离 · 优先清除拦截机') : phase === 4 ? '飞向救援点的蓝色圆环 · 抵达 48 米内即刻完成' : '任务完成 · 探索极光前哨与残骸补给';
    return {
      checkpointAvailable: !!checkpoint, difficulty, maxDifficulty, nextDifficultyAvailable: completed && difficulty < maxDifficulty, exploring, missionCompleted: completed || exploring, failureReason,
      hull: Math.round(hull), health: Math.round(hull), maxHealth: 100, maxHull: 100, missileAmmo, lockProgress, lockSeconds,
      difficultyDescription: ['较长预警 · 最多两架同时攻击', '侧绕提速 · 三架协同拦截', '更短预警 · 三架协同拦截'][difficulty - 1],
      reward: completed || exploring ? { badge: '寂光救援', time: Math.round(missionTime), escortHull: Math.round(escortHull) } : null,
      steering: { x: steeringX, y: steeringY, active: steeringActive && !dead && !warpTime, mode: steeringMode, turnX: steerX, turnY: steerY, deadzone: steeringDeadzone },
      cruiseSpeed, commandedSpeed: dead || warpTime ? 0 : commandedSpeed, braking, stationKeeping: scanning || warpTime > 0,
      instruction: controls, controls, statusText: status, score, shield: Math.round(shield), maxShield: 100, energy: Math.round(energy), ammo: weapon === 2 ? missileAmmo + ' 导弹' : Math.round(energy) + ' 电容',
      weapons: weapons.map(x => x.name), weapon: w.name, weaponIndex: weapon + 1, weaponCost: w.cost, weaponDamage: w.damage, weaponRange: w.range, weaponFireInterval: w.delay, weaponAmmo: weapon === 2 ? missileAmmo : Math.floor(energy / w.cost), weaponCooldown: +fireCooldown.toFixed(2), weaponReady: !dead && !completed && !paused && !warpTime && fireCooldown <= 0 && energy >= w.cost && (weapon !== 2 || (!!lockedTarget && lockProgress >= 1 && missileAmmo > 0)),
      weaponFeedback: dead ? '舰体失效' : energy < w.cost ? '电容不足' : fireCooldown > 0 ? '冷却 ' + fireCooldown.toFixed(1) + ' 秒' : weapon === 2 && !lockedTarget ? '等待目标锁定' : weapon === 2 && missileAmmo <= 0 ? '导弹耗尽' : weapon === 2 && lockProgress < 1 ? '稳定锁定 ' + Math.round(lockProgress * 100) + '%' : '就绪',
      mission, missionPhase: phase, missionTitle: '寂光救援 / SILENT DAWN', missionStep: phaseNames[phase], missionSteps: [...phaseNames], missionProgress: phase === 5 ? 1 : (phase + (phase === 0 ? scanProgress : phase === 1 ? gateIndex / 3 : phase === 2 ? Math.min(blockadeTotal, kills) / blockadeTotal : phase === 3 ? Math.min(1, escortTravel / 1190) : 0)) / 5,
      objective: { ...project(objective), id: objectiveId(), name: objectiveName(), label: objectiveName(), moving: phase === 2 || (phase === 3 && !transportArrived && distance <= 150), kind: phase === 2 ? 'enemy' : phase === 3 ? 'escort' : 'waypoint', distance: Math.round(distance), distanceExact: distance, worldX: objective.x, worldY: objective.y, worldZ: objective.z },
      targetLabel, target: lockedTarget ? { ...project(lockedTarget.m.position), hp: Math.max(0, lockedTarget.hp), maxHp: lockedTarget.maxHp, kind: 'enemy', id: lockedTarget.id, name: lockedTarget.label, distance: Math.round(lockedTarget.m.position.distanceTo(actor.position)) } : null,
      enemies: alive.length, enemyTotal: enemySerial, blockadeTotal, threats: alive.map(e => ({ ...project(e.m.position), id: e.id, name: e.label, variant: e.variant, role: e.escorts ? '运输舰拦截者' : e.variant === 'patrol' ? '封锁巡逻机' : '侧翼拦截机', intent: e.intent, telegraph: e.charging, fireIn: Math.max(0, e.fire), distance: Math.round(e.m.position.distanceTo(actor.position)), hp: e.hp, worldX: e.m.position.x, worldY: e.m.position.y, worldZ: e.m.position.z })),
      reticle: project(reticle.position), lead: null,
      hitIndicator: hitFlash > 0, lastHitDamage, lastHitWeapon, lastHitKilled, effects: effects.length, damageIndicator: shieldFlash > 0, threatIndicator: threatFlash > 0, speed: Math.round(speed), boosting: boostHeld, boostEnergy: Math.round(capacitor), throttle: speed / 88, inCombat: alive.length > 0, locked: !!lockedTarget && (weapon !== 2 || lockProgress >= 1),
      skillCooldown: Math.ceil(counterCooldown), countermeasureCooldown: Math.ceil(counterCooldown), dashCooldown: Math.ceil(boostCooldown), scannerCooldown: Math.ceil(scanCD), scanProgress: Math.round(scanProgress * 100), scanning,
      escortHull: Math.round(escortHull), escortDistance: Math.round(actor.position.distanceTo(transport.position)), escortProgress: Math.min(100, Math.round(escortTravel / 1190 * 100)), escortWaiting: phase === 3 && actor.position.distanceTo(transport.position) > 150,
      elapsed: Math.floor(elapsed), missionTime: Math.round(missionTime), warpProgress: 0, wave: phase === 2 ? secondaryWave ? 2 : 1 : ambushTwo ? 4 : ambushOne ? 3 : 1,
      dead, completed, positionX: +actor.position.x.toFixed(2), positionY: +actor.position.y.toFixed(2), positionZ: +actor.position.z.toFixed(2), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4),
      projectiles: shots.length, missilesInFlight: shots.filter(p => p.missile).length, totalShots, totalHits, kills, relaysDestroyed: gateIndex, gatesPassed: gateIndex, recovered, worldTheme: 'flight', audio: { speed: speed / 88, boosting: boostHeld, combat: alive.length > 0, warp: 0 },
      radar: { range: 400, heading: yaw, player: { x: actor.position.x, y: actor.position.y, z: actor.position.z }, objective: { x: objective.x, y: objective.y, z: objective.z }, targets: alive.map(e => ({ x: e.m.position.x, y: e.m.position.y, z: e.m.position.z, type: 'hostile' })) }
    };
  }

  function failEscort() {
    if (dead || completed) return;
    dead = true; failureReason = '曙光号失联'; speed = 0; velocity.set(0, 0, 0); resetInput();
    transport.visible = false; say('曙光号失联 · 从当前阶段检查点重试救援', 100, true);
    effect(transport.position, amber, 24, 1.2); audio('explosion', { intensity: 1 });
  }
  function resetInput() {
    oldKeys = new Set(); heldFire = boostHeld = engineActive = wasLooking = steeringActive = false;
    touchUp = touchBoost = steerX = steerY = steeringX = steeringY = 0;
    yawGoal = yaw; pitchGoal = pitch; activeTarget = previousTarget = lockCandidate = null; lockProgress = 0;
  }
  const copyData = value => JSON.parse(JSON.stringify(value));
  function snapshot(includeCheckpoint = true) {
    return { version: 1, world: 'flight', values: { elapsed, phase, phaseTime, gateIndex, scanProgress, scanning, scanCD, score, shield, hull, energy, capacitor, escortHull, weapon, kills, yaw, pitch, yawGoal, pitchGoal, speed, boostTime, boostCooldown, fireCooldown, counterCooldown, invulnerable, damageAgo, shieldFlash, hitFlash, recoil, threatFlash, dead, completed, escortLeg, escortTravel, ambushOne, ambushTwo, transportArrived, warpTime, totalShots, totalHits, secondaryWave, recovered, missionTime, enemySerial, laserBarrel, lastHitDamage, lastHitWeapon, lastHitKilled, difficulty, exploring, missileAmmo, seed, message, messageUntil }, failureReason,
      actor: actor.position.toArray(), velocity: velocity.toArray(), visualRotation: visual.rotation.toArray(),
      transport: transport.position.toArray(), transportQuaternion: transport.quaternion.toArray(),
      camera: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(), cameraFov: camera.fov,
      enemies: enemies.map(e => ({ id: e.id, label: e.label, variant: e.variant, hp: e.hp, maxHp: e.maxHp, radius: e.radius, fire: e.fire, seed: e.seed, evade: e.evade, hitReaction: e.hitReaction, escorts: e.escorts, alive: e.alive, charging: e.charging, intent: e.intent, position: e.m.position.toArray(), quaternion: e.m.quaternion.toArray(), velocity: e.v.toArray() })),
      shots: shots.map(p => ({ position: p.m.position.toArray(), direction: p.v.clone().normalize().toArray(), velocity: p.v.toArray(), targetId: p.target?.id, damage: p.damage, speed: p.speed, hostile: p.hostile, missile: p.missile, transportTarget: p.transportTarget, life: p.life, traveled: p.traveled, maxTravel: p.maxTravel, trailTime: p.trailTime })),
      pickups: pickups.map(p => ({ position: p.m.position.toArray(), type: p.type, life: p.life })),
      checkpoint: includeCheckpoint && checkpoint ? copyData(checkpoint) : null };
  }
  function restore(data) {
    const finiteVector = (v, length) => Array.isArray(v) && v.length === length && v.every(Number.isFinite);
    const valid = d => d && d.version === 1 && d.world === 'flight' && d.values &&
      Number.isInteger(d.values.phase) && d.values.phase >= 0 && d.values.phase <= 5 &&
      Number.isInteger(d.values.difficulty) && d.values.difficulty >= 1 && d.values.difficulty <= 3 &&
      Object.entries(snapshot(false).values).every(([key, value]) => typeof d.values[key] === typeof value && (typeof value !== 'number' || Number.isFinite(d.values[key]))) &&
      finiteVector(d.actor, 3) && finiteVector(d.velocity, 3) && finiteVector(d.transport, 3) && finiteVector(d.transportQuaternion, 4) && finiteVector(d.camera, 3) && finiteVector(d.cameraQuaternion, 4) && Number.isFinite(d.cameraFov) &&
      Array.isArray(d.enemies) && d.enemies.length <= 14 && d.enemies.every(e => finiteVector(e.position, 3) && finiteVector(e.velocity, 3) && finiteVector(e.quaternion, 4) && ['hp','maxHp','radius','fire','seed','evade','hitReaction'].every(k => Number.isFinite(e[k]))) &&
      Array.isArray(d.shots) && d.shots.length <= 170 && d.shots.every(p => finiteVector(p.position, 3) && finiteVector(p.direction, 3) && finiteVector(p.velocity, 3) && ['damage','speed','life','traveled','maxTravel','trailTime'].every(k => Number.isFinite(p[k]))) &&
      Array.isArray(d.pickups) && d.pickups.length <= 100 && d.pickups.every(p => finiteVector(p.position, 3) && Number.isFinite(p.life));
    if (disposed || !valid(data) || (data.checkpoint && (!valid(data.checkpoint) || data.checkpoint.checkpoint))) return false;
    const d = copyData(data), nextCheckpoint = d.checkpoint || (d.values.dead || d.values.completed ? checkpoint : copyData(d));
    clearEntities();
    ({ elapsed, phase, phaseTime, gateIndex, scanProgress, scanning, scanCD, score, shield, hull, energy, capacitor, escortHull, weapon, kills, yaw, pitch, yawGoal, pitchGoal, speed, boostTime, boostCooldown, fireCooldown, counterCooldown, invulnerable, damageAgo, shieldFlash, hitFlash, recoil, threatFlash, dead, completed, escortLeg, escortTravel, ambushOne, ambushTwo, transportArrived, warpTime, totalShots, totalHits, secondaryWave, recovered, missionTime, enemySerial, laserBarrel, lastHitDamage, lastHitWeapon, lastHitKilled, difficulty, exploring, missileAmmo, seed, message, messageUntil } = d.values);
    // Version-1 saves may contain a pending dwell/warp. Discard that obsolete
    // state without advancing or rewarding here; the next active tick checks arrival.
    const hadPendingArrival = scanning || warpTime > 0;
    scanning = false; scanCD = 0; warpTime = 0; scanProgress = phase === 0 ? 0 : 1;
    if (hadPendingArrival || /扫描|跃迁|解码|同步/.test(message)) { message = ''; messageUntil = 0; }
    failureReason = d.failureReason || ''; paused = false;
    actor.position.fromArray(d.actor); velocity.fromArray(d.velocity); oldPosition.copy(actor.position);
    actor.rotation.set(pitch, yaw, 0, 'YXZ'); visual.rotation.set(0, 0, 0);
    forward.set(0, 0, -1).applyQuaternion(actor.quaternion); right.set(1, 0, 0).applyQuaternion(actor.quaternion); up.set(0, 1, 0).applyQuaternion(actor.quaternion);
    transport.position.fromArray(d.transport); transport.quaternion.fromArray(d.transportQuaternion);
    for (const state of d.enemies) {
      spawnEnemy(0, V(), state.escorts, state.variant); const e = enemies[enemies.length - 1];
      for (const key of ['id','label','variant','hp','maxHp','radius','fire','seed','evade','hitReaction','escorts','alive','charging','intent']) e[key] = state[key];
      e.m.name = e.label; e.m.position.fromArray(state.position); e.m.quaternion.fromArray(state.quaternion); e.v.fromArray(state.velocity); e.m.visible = e.hp > 0; e.warning.visible = e.hp > 0 && e.charging;
    }
    enemySerial = d.values.enemySerial; seed = d.values.seed;
    for (const state of d.shots) {
      projectile(V(...state.position), V(...state.direction), { ...state, target: enemies.find(e => e.id === state.targetId) || null });
      const p = shots[shots.length - 1]; p.v.fromArray(state.velocity); p.traveled = state.traveled; p.maxTravel = state.maxTravel; p.trailTime = state.trailTime;
    }
    for (const state of d.pickups) { pickup(V(...state.position), state.type); pickups[pickups.length - 1].life = state.life; }
    routeGates.forEach((g, i) => { g.passed = i < gateIndex; g.g.visible = phase <= 1; g.r.material = g.passed ? ice : ghost; });
    actor.visible = !dead || hull > 0; transport.visible = escortHull > 0;
    camera.position.fromArray(d.camera); camera.quaternion.fromArray(d.cameraQuaternion); camera.fov = hadPendingArrival ? 62 : d.cameraFov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    navigationTarget = null; resetInput(); checkpoint = nextCheckpoint;
    targetRing.visible = false; objectiveRing.visible = !dead && !completed; reticle.visible = !dead && !completed;
    return true;
  }
  function restoreCheckpoint(data = checkpoint) {
    if (!data || !restore(data)) return false;
    dead = completed = exploring = paused = false; failureReason = ''; invulnerable = Math.max(2, invulnerable); resetInput();
    say('已恢复阶段检查点 · ' + phaseNames[phase], 4); return true;
  }
  function freeExplore() {
    if (!completed) return false;
    completed = false; exploring = true; clearEntities(true); resetInput();
    say('自由探索 · 可返回宣传页或重玩救援', 5); return true;
  }

  restart(); actor.visible = true;
  return {
    update, getState, resize() {}, snapshot, restore, resetInput, getCheckpoint() { return checkpoint ? copyData(checkpoint) : null; }, restoreCheckpoint,
    setPaused(value) { paused = !!value; resetInput(); },
    action(name, payload) {
      if (disposed) return;
      if (name === 'retryCheckpoint') return restoreCheckpoint();
      if (name === 'freeExplore' || name === 'explore') return freeExplore();
      if (name === 'nextDifficulty') { if (!completed) return false; if (difficulty >= maxDifficulty) return freeExplore(); difficulty++; restart(); return true; }
      if (name === 'restart' || name === 'reset') { actor.visible = true; restart(); }
      else if (dead || completed || paused) return false;
      else if (name === 'weapon') selectWeapon(typeof payload === 'object' ? payload?.index : payload);
      else if (name === 'skill' || name === 'countermeasure') countermeasure();
      else if (name === 'scanner' || name === 'scan' || name === 'interact') scanner();
      else if (name === 'jump') touchUp = .65;
      else if (name === 'dash') touchBoost = 1.6;
      else if (name === 'fire') { if (typeof payload === 'boolean') heldFire = payload; if (payload !== false) fire(); }
      else if (name === 'reduced') reduced = !!payload;
    },
    dispose() { if (disposed) return; disposed = true; clearEntities(); scene.remove(root); owned.forEach(resource => resource.dispose?.()); owned.clear(); }
  };
}
