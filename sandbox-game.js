// Original first-person facility raid. No DOM listeners; all input comes from the host.
// Assets supplied by the host are borrowed and are never disposed here.
export function createGame({ THREE, scene, camera, model, playAnimation = () => {}, emit = () => {}, width = 960, height = 600, reduced = false, sound = () => {}, assets = {}, difficulty = 1 }) {
  const root = new THREE.Group(); root.name = 'facility-raid'; scene.add(root);
  const prior = { background: scene.background, fog: scene.fog, environmentIntensity: scene.environmentIntensity, lights: [] };
  scene.children.forEach(object => { if (object.isLight) { prior.lights.push([object, object.visible]); object.visible = false; } });
  // Bounded neutral fill preserves the GLB finish; local fixture lights shape the rooms.
  scene.environmentIntensity = .3;
  root.add(new THREE.HemisphereLight(0xc6d7e0, 0x20292f, .82));
  const keyLight = new THREE.DirectionalLight(0xe0e8e9, 1.25); keyLight.position.set(-7, 14, 5); root.add(keyLight);
  const resources = new Set(), own = value => (resources.add(value), value);
  const clamp = THREE.MathUtils.clamp, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  difficulty = clamp(Math.floor(Number(difficulty) || 1), 1, 3);
  const tiers = [
    { name: '标准', initial: 9, reinforcements: 2, hp: 100, damage: 1.08, speed: 1, reaction: .30, windup: .26, cadence: 1.14, variance: .60, sight: 26 },
    { name: '强化', initial: 12, reinforcements: 4, hp: 112, damage: 1.23, speed: 1.17, reaction: .20, windup: .21, cadence: .98, variance: .48, sight: 29 },
    { name: '精英', initial: 15, reinforcements: 6, hp: 124, damage: 1.40, speed: 1.34, reaction: .10, windup: .17, cadence: .82, variance: .38, sight: 32 },
  ];
  const tier = tiers[difficulty - 1], enemyTotal = tier.initial + tier.reinforcements;
  // Player and ordinary guards share one base-HP budget at every tier.
  // Shield is a small, separately reported resource: only H-01 and supplies restore it.
  const maxHealth = tier.hp, maxShield = 25, shieldAbsorption = 1, guidePatch = 30, guidePatchCooldown = 12;
  let randomSeed = 73129;
  const rng = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) | 0; return (randomSeed >>> 0) / 4294967296; };
  const material = (color, roughness = .65, metalness = .15, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
  const mat = {
    concrete: material(0x747d81, .97, .03), wall: material(0x64727a, .8, .12), floor: material(0x344049, .92, .05),
    dark: material(0x131c22, .6, .65), steel: material(0x526570, .42, .82), edge: material(0x93a0a4, .37, .85),
    armor: material(0x344854, .52, .72), black: material(0x0d1114, .83, .2), glove: material(0x20292d, .94, .04),
    orange: material(0xdbaa53, .52, .55), red: material(0xba5646, .48, .55), green: material(0x547769, .72, .24),
    blue: material(0x61adbd, .36, .65, { emissive: 0x31778d, emissiveIntensity: .6 }),
    mint: material(0x7bd6b0, .35, .3, { emissive: 0x2b9275, emissiveIntensity: .65 }),
    enemyEye: material(0xf48463, .3, .35, { emissive: 0xfc4021, emissiveIntensity: .9 }),
    lamp: material(0xecf4e5, .3, .1, { emissive: 0xd2e9e0, emissiveIntensity: .95 }),
    spark: own(new THREE.MeshBasicMaterial({ color: 0xffdc8b })), dust: material(0x909590, 1, 0),
    allyTracer: own(new THREE.MeshBasicMaterial({ color: 0x80f6cc })),
    tracer: own(new THREE.MeshBasicMaterial({ color: 0xffe6b3 })), enemyTracer: own(new THREE.MeshBasicMaterial({ color: 0xfb7b57 })),
    hole: own(new THREE.MeshBasicMaterial({ color: 0x121515, transparent: true, opacity: .78, depthWrite: false })),
  };
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1)), sphereGeo = own(new THREE.SphereGeometry(1, 10, 7));
  const cylinderGeo = own(new THREE.CylinderGeometry(1, 1, 1, 10));
  function box(x, y, z, sx, sy, sz, m = mat.steel, parent = root) {
    const mesh = new THREE.Mesh(boxGeo, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function sphere(x, y, z, sx, sy, sz, m = mat.steel, parent = root) {
    const mesh = new THREE.Mesh(sphereGeo, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function cylinder(x, y, z, radius, length, m = mat.steel, parent = root, axis = 'y') {
    const mesh = new THREE.Mesh(cylinderGeo, m); mesh.position.set(x, y, z); mesh.scale.set(radius, length, radius);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2; if (axis === 'x') mesh.rotation.z = Math.PI / 2; parent.add(mesh); return mesh;
  }
  function textLabel(text, x, y, z, size = 5, color = '#c0d3d5', parent = root) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.fillStyle = color; ctx.font = '600 44px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 384, 80);
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const material = own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const plane = new THREE.Mesh(own(new THREE.PlaneGeometry(size, size / 6)), material); plane.position.set(x, y, z); parent.add(plane);
    plane.userData.setText = value => { if (plane.userData.text === value) return; plane.userData.text = value; ctx.clearRect(0, 0, 768, 128); ctx.fillText(value, 384, 80); texture.needsUpdate = true; };
    plane.userData.text = text; return plane;
  }
  const walls = [], objects = [], enemies = [], retiredEnemies = [], allies = [], particles = [], tracers = [], impacts = [], pickups = [], borrowed = [], coverPoints = [];
  let time = 0, disposed = false, health = maxHealth, shield = maxShield, score = 0, weapon = 0, ammo = [30, 8], reserve = [180, 48];
  let yaw = 0, pitch = 0, vertical = 0, grounded = true, dead = false, completed = false, terminalOn = false;
  let reloadTime = 0, reloadDuration = 0, shotCooldown = 0, recoil = 0, recoilKick = 0, aimBlend = 0, aiming = false, sprinting = false;
  let heldFire = false, heldAim = false, carrying = null, prevKeys = new Set(), hitUntil = 0, killUntil = 0, hurtAt = -100, hurtDirection = 0, flashTime = 0;
  let noiseAt = -100, noisePosition = V(), feedback = `难度 ${difficulty} · ${tier.name}：双方基础生命均为 ${maxHealth}。护盾不会自动恢复，黄色 H-01 是医疗 / 护盾 / 侦察伙伴。`, feedbackUntil = 8;
  let footsteps = 0, movedDistance = 0, bob = 0, shotCount = 0, reloadCount = 0, viewWidth = width, viewHeight = height;
  let reinforcementsAt = Infinity, reinforcementsSpawned = false;
  let stage = 0, checkpoint = null, checkpointStage = 0, missionRecoveries = 0, totalDamageTaken = 0, retryGraceUntil = -100;
  const stageNames = ['整备与进入', '取得信号核心', '搬运与安装', '摧毁干扰装置', '撤离'];
  const stageTexts = ['安全区：右键 / Z 瞄准，Space 试跳桌台；沿中间入口进入设施', '进入左侧 A 设备间 · 清除核心附近守卫 · E 取得信号核心', '携带信号核心穿过设施 · 到控制中心终端按 E 安装', '核心已安装 · 射击红色干扰装置以解除封锁', '信号恢复 · 沿任一侧路返回庭院 · E 撤离'];
  const support = { shots: 0, damage: 0, kills: 0, shieldRestored: 0, healthRestored: 0, scans: 0 };
  const playerRadius = .36, playerHeight = 1.82, gravity = 19, jumpSpeed = 7.6, collisionEpsilon = .0001;
  const player = new THREE.Group(); player.name = 'facility-player'; player.position.set(0, 0, 24); root.add(player);
  const direction = V(0, 0, -1), eye = V(), temp = V(), baseCamera = new THREE.Euler(0, 0, 0, 'YXZ');
  const hasWeaponAsset = !!(assets.weapon?.model || assets.weapon?.scene || assets.weapon)?.isObject3D;
  const weapons = [
    { name: 'P-15 制式手枪', maxAmmo: 15, damage: 25, interval: .23, reload: 1.45, spread: .012, pellets: 1, range: 66, kick: .037, sound: 'pistol' },
    { name: 'SG-8 战术霰弹枪', maxAmmo: 8, damage: 10, interval: .76, reload: 2.1, spread: .058, pellets: 8, range: 37, kick: .077, sound: 'shotgun' },
  ];
  ammo[0] = 15; reserve[0] = 135;
  const audio = (name, params = {}) => { try { sound(name, params); } catch (_) { /* Audio may be unavailable until a gesture. */ } };
  function say(message, life = 3) { feedback = message; feedbackUntil = time + life; emit(message); }
  function addCollider(x, y, z, sx, sy, sz, type = 'stone', mesh = null) {
    const entry = { min: V(x - sx / 2, y - sy / 2, z - sz / 2), max: V(x + sx / 2, y + sy / 2, z + sz / 2), type, mesh };
    walls.push(entry); return entry;
  }
  function solid(x, y, z, sx, sy, sz, m = mat.wall, type = 'stone') {
    const mesh = box(x, y, z, sx, sy, sz, m); addCollider(x, y, z, sx, sy, sz, type, mesh); return mesh;
  }
  function wall(x, z, sx, sz, height = 4.5) {
    solid(x, height / 2, z, sx, height, sz, mat.wall);
    box(x, .2, z, sx + .035, .36, sz + .035, mat.dark); box(x, height - .17, z, sx + .035, .15, sz + .035, mat.edge);
  }
  function doorway(x, z, width = 6.8, orientation = 'x', title = '') {
    const g = new THREE.Group(); g.position.set(x, 0, z); if (orientation === 'z') g.rotation.y = Math.PI / 2; root.add(g);
    for (const side of [-1, 1]) { box(side * width / 2, 1.8, 0, .28, 3.6, .7, mat.dark, g); box(side * (width / 2 - .18), 1.6, .38, .07, 2.6, .04, mat.blue, g); }
    box(0, 3.65, 0, width + .3, .5, .8, mat.dark, g); if (title) textLabel(title, 0, 3.66, .43, width * .85, '#c9e5e5', g);
  }
  function floorStrip(x, z, sx, sz, color = mat.orange) { box(x, .016, z, sx, .018, sz, color); }
  // Readable architectural layout: courtyard -> central spine -> command room,
  // with two connected equipment-room routes for flanking and retreat.
  box(0, -.3, -5, 60, .6, 82, mat.concrete).name = 'facility-ground';
  box(0, -.035, -15, 36, .08, 46, mat.floor);
  for (let z = -36; z <= 26; z += 4) { floorStrip(-3.05, z, .075, 1.7, mat.edge); floorStrip(3.05, z, .075, 1.7, mat.edge); }
  for (let x = -26; x <= 26; x += 4) for (let z = 12; z <= 28; z += 4) { box(x, .005, z, .025, .015, 3.9, mat.floor); box(x, .006, z, 3.9, .015, .025, mat.floor); }
  wall(-18, -15, .65, 46); wall(18, -15, .65, 46); wall(0, -38, 36.5, .65);
  wall(-10.7, 8, 14.6, .7); wall(10.7, 8, 14.6, .7); doorway(0, 8, 6.8, 'x', 'SECTOR 07  /  进入设施');
  // Corridor door gaps left: z -8..-3 and -22..-17; right: z 0..5 and -17..-12.
  for (const [x, z, len] of [[-3.8, 2.5, 11], [-3.8, -12.5, 9], [-3.8, -22.5, 1], [3.8, 6.5, 3], [3.8, -6, 12], [3.8, -20, 6]]) wall(x, z, .5, len);
  doorway(-3.8, -5.5, 5, 'z'); doorway(-3.8, -19.5, 5, 'z'); doorway(3.8, 2.5, 5, 'z'); doorway(3.8, -14.5, 5, 'z');
  // Cross-wall to command room with three traversable openings.
  for (const [x, w] of [[-16, 4], [-7, 6], [7, 6], [16, 4]]) wall(x, -23, w, .5);
  doorway(0, -23, 7.4, 'x', 'CONTROL  /  控制中心'); doorway(-12, -23, 4, 'x'); doorway(12, -23, 4, 'x');
  for (const [x, w] of [[-16.5, 3], [-7.4, 6.7]]) wall(x, -12, w, .45, 3.5);
  for (const [x, w] of [[6.7, 5.8], [16, 4]]) wall(x, -9, w, .45, 3.5);
  // Perimeter remains a contained game space, not invisible collision.
  for (const x of [-28, 28]) { wall(x, -5, .65, 74, 2.8); for (let z = -39; z < 30; z += 6) box(x, 3, z, .95, .25, .55, mat.orange); }
  wall(0, 30, 56, .65, 2.8); wall(0, -42, 56, .65, 2.8);
  // The visible ceiling is also solid, including when jumping from raised cover.
  solid(0, 4.65, -15.1, 36.6, .22, 46.5, mat.dark, 'metal');
  for (let z = 4; z > -36; z -= 6) { box(0, 4.4, z, 7.5, .18, .22, mat.edge); box(0, 4.35, z, 2.6, .055, .45, mat.lamp); }
  for (const x of [-11, 11]) for (let z = 3; z >= -33; z -= 12) { box(x, 4.39, z, 3.5, .11, .55, mat.lamp); }
  for (const x of [-17.4, 17.4]) { cylinder(x, 3.85, -14, .12, 44, mat.edge, root, 'z'); cylinder(x, 3.5, -14, .07, 44, mat.orange, root, 'z'); }
  // Exterior silhouettes, vents, doorway markers, floor markings, and cover.
  for (const x of [-23, 23]) for (const z of [-32, -18, 1, 20]) { solid(x, 1.2, z, 3.1, 2.4, 2.4, mat.dark, 'metal'); for (let y = .4; y < 2.1; y += .3) box(x, y, z + 1.22, 2.4, .08, .06, mat.edge); }
  for (const [x, z, sx, sz] of [[-8, 15, 4.5, 1.2], [9, 19, 4, 1.1], [-10, -17, 3.8, 1.1], [10, -18, 3.5, 1.1], [0, -29, 4.2, 1.1]]) {
    solid(x, .57, z, sx, 1.14, sz, mat.concrete); solid(x, 1.18, z, sx + .06, .13, sz + .08, mat.edge, 'metal');
    for (const dz of [-1.4, 1.4]) coverPoints.push(V(x, 0, z + dz));
  }
  // Computer racks supply visual detail and meaningful metal cover.
  for (const [x, z] of [[-16, -17], [-16, -20], [16, -12], [16, -16], [-15, -35], [-11, -35], [15, -35]]) {
    solid(x, 1.35, z, 1.55, 2.7, 1, mat.dark, 'metal'); box(x, 1.32, z + .51, 1.24, 2.32, .03, mat.steel);
    for (let y = .48; y < 2.5; y += .34) { box(x - .22, y, z + .54, .55, .065, .03, mat.black); box(x + .35, y, z + .56, .09, .065, .03, mat.blue); }
  }
  for (const x of [-15, -11, 10, 14]) for (const z of [3, -5]) { solid(x, .44, z, 1.6, .88, 2.1, mat.dark, 'metal'); solid(x, .92, z, 1.58, .12, 2.06, mat.green, 'metal'); }
  // Alternating low vaultable cover and full-height sight blockers leave the
  // central doors, rescue approaches and extraction pad open. All visible slabs
  // share the same bounds for movement, landing, gunfire and AI line of sight.
  function barricade(name, x, z, sx, height, sz = 1.05) {
    const mesh = solid(x, height / 2, z, sx, height, sz, mat.dark, 'metal'); mesh.name = name;
    box(x, height - .07, z, sx, .14, sz, mat.edge);
    for (const side of [-1, 1]) {
      box(x, height * .52, z + side * (sz / 2 + .006), sx - .16, height - .34, .018, mat.green);
      box(x, height - .27, z + side * (sz / 2 + .018), sx - .3, .08, .022, mat.orange);
      coverPoints.push(V(x, 0, z + side * (sz / 2 + .85)));
    }
    return mesh;
  }
  function worktable(name, x, z) {
    const top = solid(x, 1.08, z, 3.2, .2, 1.5, mat.edge, 'metal'); top.name = name;
    box(x, 1.17, z, 3.08, .02, 1.38, mat.green);
    for (const dx of [-1.38, 1.38]) for (const dz of [-.55, .55]) solid(x + dx, .49, z + dz, .16, .98, .16, mat.dark, 'metal');
    return top;
  }
  barricade('courtyard-west-shield', -10, 22, 3.2, 1.95);
  barricade('courtyard-east-shield', 9, 23, 3.2, 1.95);
  barricade('courtyard-vault', 4.6, 16, 2.2, 1.16);
  barricade('corridor-vault', -1.7, -9.5, 1.4, 1.16, 1.15);
  barricade('corridor-shield', 1.6, -18.5, 1.5, 1.95, 1.15);
  barricade('command-shield', -2.8, -31.5, 2.7, 1.95);
  barricade('command-vault', 9.5, -26.5, 2.6, 1.16);
  worktable('training-worktable', -5, 25);
  textLabel('练习桌台 1.18m · Space 跳跃', -5, 2.2, 25, 4);
  worktable('equipment-worktable', -11, -.8);
  worktable('service-worktable', 12, -13.5);
  for (let i = 0; i < 10; i++) { floorStrip(-3 + i * .66, 9.4, .34, .5); floorStrip(-3 + i * .66, -24, .34, .5); }
  textLabel('07  /  RELAY FACILITY', 0, 5.45, 8.05, 12, '#dde4de');
  textLabel('A  ·  EQUIPMENT', -11, 2.8, -11.74, 6); textLabel('B  ·  SERVICE', 11, 2.8, -8.73, 6);
  const exteriorLight = new THREE.PointLight(0xb8d5e2, 11, 30, 2); exteriorLight.position.set(0, 7, 16); root.add(exteriorLight);
  for (const [x, z, color] of [[0, -10, 0xa5d7e0], [-11, -5, 0xaad7cc], [11, -15, 0xd1bd8d], [0, -31, 0xbacfe8]]) { const light = new THREE.PointLight(color, 6, 19, 2); light.position.set(x, 3.75, z); root.add(light); }
  scene.background = new THREE.Color(0x19262f); scene.fog = new THREE.FogExp2(0x22303a, .010);

  function addObject(kind, x, z) {
    const mesh = new THREE.Group(); mesh.position.set(x, 0, z); root.add(mesh);
    const isBarrel = kind === 'barrel', entity = { kind, mesh, hp: isBarrel ? 50 : 66, maxHP: isBarrel ? 50 : 66, alive: true, flying: false, falling: false, v: V(), radius: isBarrel ? .49 : .6, halfWidth: isBarrel ? .49 : .585, halfDepth: isBarrel ? .49 : .55, height: isBarrel ? 1.06 : 1.1 };
    if (isBarrel) { cylinder(0, .53, 0, .48, 1.06, mat.red, mesh); for (const y of [.15, .87]) cylinder(0, y, 0, .49, .075, mat.dark, mesh); box(0, .55, .48, .33, .31, .025, mat.orange, mesh); }
    else { box(0, .5, 0, 1.12, 1, 1.04, kind === 'cell' ? mat.green : mat.steel, mesh); for (const x of [-.45, .45]) box(x, .52, 0, .06, 1.06, 1.08, mat.dark, mesh); box(0, 1.04, 0, 1.17, .12, 1.1, mat.edge, mesh); box(0, .55, .535, .65, .12, .02, kind === 'cell' ? mat.mint : mat.orange, mesh); }
    objects.push(entity); return entity;
  }
  for (const [i, p] of [[-2, 20], [7, 13], [-13, 16], [13, 13], [-8, -2], [8, 0], [-7, -15], [7, -19], [-6, -28], [7, -33]].entries()) addObject(i % 3 === 1 ? 'barrel' : i % 4 === 0 ? 'cell' : 'crate', ...p);

  // Movable steps make the higher courtyard shields reachable in two jumps.
  addObject('crate', -10, 23.65); addObject('crate', 9, 24.65);

  function applyBorrowedAsset(asset, parent, targetSize = 1, clone = true) {
    const source = asset?.model || asset?.scene || asset;
    if (!source?.isObject3D) return null;
    const wrapper = new THREE.Group(), object = clone ? source.clone(true) : source; wrapper.add(object); borrowed.push({ object, parent: wrapper, clone });
    object.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(V()), center = bounds.getCenter(V());
    const scale = typeof asset?.scale === 'number' ? asset.scale : targetSize / (Math.max(size.x, size.y, size.z) || 1); wrapper.scale.setScalar(scale);
    object.position.sub(center); parent.add(wrapper); if (Array.isArray(asset?.rotation)) wrapper.rotation.fromArray(asset.rotation); if (Array.isArray(asset?.position)) wrapper.position.fromArray(asset.position);
    return wrapper;
  }
  function actor(x, z, hostile, index) {
    const mesh = new THREE.Group(); mesh.position.copy(nearestClear(V(x, 0, z))); root.add(mesh);
    const body = new THREE.Group(); mesh.add(body); const limbs = [], color = hostile ? mat.armor : mat.green;
    const asset = hostile ? assets.enemy : assets.ally;
    const external = applyBorrowedAsset(asset, body, 1.9);
    if (external) external.position.y += .97;
    if (!external) {
      // Articulated original mechanical trooper: beveled silhouette, shoulder plates,
      // knee pads, backpack, optic and a properly proportioned patrol weapon.
      box(0, 1.12, 0, .62, .57, .35, color, body); box(0, 1.18, .2, .49, .32, .075, mat.steel, body);
      box(0, .75, 0, .39, .2, .29, mat.dark, body); sphere(0, 1.62, .015, .265, .255, .235, color, body);
      box(0, 1.64, -.195, .41, .115, .08, hostile ? mat.enemyEye : mat.mint, body); box(0, 1.45, -.15, .24, .09, .16, mat.dark, body);
      box(0, 1.15, .27, .39, .46, .21, mat.dark, body); cylinder(.18, 1.55, .3, .026, .48, mat.edge, body);
      for (const s of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(s * .19, .79, 0); body.add(leg); limbs.push({ mesh: leg, side: s, type: 'leg' });
        cylinder(0, -.17, 0, .11, .38, mat.dark, leg); box(0, -.19, -.045, .21, .3, .23, color, leg); sphere(0, -.39, -.02, .125, .12, .13, mat.edge, leg);
        box(0, -.55, -.025, .17, .3, .2, color, leg); box(0, -.72, -.09, .24, .12, .4, mat.dark, leg);
        const arm = new THREE.Group(); arm.position.set(s * .39, 1.32, 0); body.add(arm); limbs.push({ mesh: arm, side: s, type: 'arm' });
        sphere(0, 0, 0, .18, .17, .17, color, arm); cylinder(0, -.21, -.015, .095, .37, mat.dark, arm);
        box(0, -.21, -.06, .17, .25, .2, color, arm); sphere(0, -.41, -.07, .12, .13, .13, mat.glove, arm);
      }
      box(.36, 1.27, -.35, .14, .15, .57, mat.dark, body); cylinder(.36, 1.31, -.72, .043, .31, mat.edge, body, 'z');
      box(.36, 1.13, -.23, .09, .19, .13, mat.black, body);
    }
    const charge = sphere(.36, 1.31, -.91, .06, .06, .04, hostile ? mat.enemyEye : mat.allyTracer, body); charge.visible = false;
    const e = { charge, kind: hostile ? 'enemy' : 'ally', mesh, body, limbs, alive: true, hp: hostile ? tier.hp : 100, maxHP: hostile ? tier.hp : 100, rescued: false,
      id: hostile ? `enemy-${index}` : `soldier-${index + 1}`, name: hostile ? '警戒守卫' : ['A-01 突击队员', 'A-02 掩护队员'][index] || 'H-01 支援机器人',
      stats: { shots: 0, damage: 0, kills: 0, shieldRestored: 0 }, burstLeft: 0,
      state: hostile ? 'patrol' : 'waiting', home: mesh.position.clone(), lastKnown: V(x, 0, z), phase: index * 1.93, patrolAngle: rng() * Math.PI * 2,
      cooldown: hostile ? .8 + rng() * .8 : 1.1 + rng(), visible: false, alertUntil: 0, staggerUntil: 0, coverUntil: 0, coverCooldown: 0, windup: 0, path: [], repathAt: 0, nextThink: index * .13, deathAt: -100, index };
    if (!hostile) {
      e.label = textLabel(e.name, 0, 2.35, 0, 3.7, '#adf0d8', mesh);
      e.statusLabel = textLabel('待救援 · E 连接', 0, 2.05, 0, 2.8, '#adf0d8', mesh);
      // Visible squad optic and muzzle flash remain independent of borrowed GLB materials.
      if (external) { box(.36, 1.27, -.35, .14, .15, .57, mat.dark, body); cylinder(.36, 1.31, -.72, .043, .31, mat.edge, body, 'z'); }
    } else {
      e.spotMarker = textLabel('▼ H-01 已标记', 0, 2.25, 0, 2.2, '#ffbd81', mesh);
      if (e.spotMarker) e.spotMarker.visible = false;
    }
    mesh.name = e.id; mesh.rotation.y = Math.PI * (rng() * .6 - .3); (hostile ? enemies : allies).push(e); return e;
  }
  const enemySpawns = [[7, 5], [-9, 3], [13, 0], [0, -12], [-12, -18], [12, -16], [-8, -29], [8, -29], [0, -35],
    [-13, -2], [11, -12], [2, -32], [-12, -27], [13, -33], [0, -19]];
  enemySpawns.slice(0, tier.initial).forEach((p, i) => actor(...p, true, i));
  actor(-12, -7.7, false, 0); actor(12, -31, false, 1);
  // H-01 is a support specialist: shield repair and spotting, not an unarmed gunner.
  const familiar = actor(-2, 24, false, 2);
  familiar.rescued = true; familiar.isGuide = true; familiar.id = 'guide-h01'; familiar.mesh.name = familiar.id;
  familiar.state = 'follow'; familiar.patchAt = 0; familiar.scanAt = 1.5;
  familiar.name = 'H-01 黄色医疗 / 侦察'; familiar.label?.userData.setText(familiar.name);
  familiar.statusLabel?.userData.setText('安全时治疗 30 · 冷却 12s');
  if (model?.isObject3D) {
    familiar.body.visible = false;
    const holder = new THREE.Group();
    const restore = { position: model.position.clone(), quaternion: model.quaternion.clone(), scale: model.scale.clone(), visible: model.visible };
    holder.add(model); borrowed.push({ object: model, parent: holder, clone: false, restore });
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.setScalar(1); model.visible = true; model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(V()), center = bounds.getCenter(V());
    holder.scale.setScalar(1.8 / (size.y || 1.8)); model.position.set(-center.x, -bounds.min.y, -center.z); familiar.mesh.add(holder); playAnimation('Idle');
  }
  const guidePulse = new THREE.Mesh(own(new THREE.TorusGeometry(.72, .035, 6, 32)), mat.allyTracer);
  guidePulse.rotation.x = -Math.PI / 2; guidePulse.position.y = .08; guidePulse.visible = false; familiar.mesh.add(guidePulse);
  const terminal = new THREE.Group(); terminal.position.set(-7, 0, -33); root.add(terminal);
  box(0, .63, 0, 1.9, 1.26, .86, mat.dark, terminal); const terminalScreen = box(0, 1.2, -.14, 1.64, .74, .1, mat.blue, terminal); terminalScreen.rotation.x = -.15;
  box(0, .9, .36, 1.64, .08, .65, mat.edge, terminal); textLabel('核心安装槽 · E 安装', 0, 2.15, .1, 4.3, '#92d3df', terminal);
  const missionCell = addObject('core', -11, -5.5); missionCell.mesh.name = 'mission-signal-core';
  missionCell.safe = missionCell.mesh.position.clone(); missionCell.critical = true;
  const coreLabel = textLabel('任务物 · 信号核心 · E 搬运', 0, 1.9, 0, 4, '#9fffe0', missionCell.mesh);
  for (const x of [-.61, .61]) box(x, .55, 0, .06, 1.16, 1.2, mat.mint, missionCell.mesh);
  const jammer = addObject('jammer', 6, -33); jammer.mesh.name = 'mission-jammer'; jammer.hp = jammer.maxHP = 120;
  box(0, 1.35, 0, .65, .6, .65, mat.red, jammer.mesh); jammer.height = 1.7;
  const jammerLabel = textLabel('干扰装置 · 安装核心后射击', 0, 2.2, 0, 4.5, '#ffb195', jammer.mesh);
  const entryGoal = new THREE.Group(); entryGoal.position.set(0, 0, 9);
  const extractionWarning = textLabel('庭院增援入口 · 警报后进入', 0, 3.3, 27, 7, '#ffb195');
  const extract = new THREE.Group(); extract.position.set(0, .04, 25); root.add(extract);
  for (const z of [-2.5, 2.5]) box(0, 0, z, 5.5, .035, .1, mat.mint, extract);
  for (const x of [-2.7, 2.7]) box(x, 0, 0, .1, .035, 5, mat.mint, extract);
  textLabel('EXTRACTION  /  撤离点', 0, 2.9, 28.8, 7, '#99d0b7');
  const contextHalo = new THREE.Mesh(own(new THREE.TorusGeometry(.75, .025, 5, 32)), mat.mint); contextHalo.rotation.x = -Math.PI / 2; root.add(contextHalo); contextHalo.visible = false;

  // Weapon and hands live in their own camera-aligned group. They do not alter
  // camera parenting and are cleaned up without touching any supplied geometry.
  const view = new THREE.Group(); view.name = 'first-person-weapon'; scene.add(view);
  const rig = new THREE.Group(); rig.name = 'ads-weapon-rig'; view.add(rig); const weaponModels = [];
  // Sight coordinates are measured in the normalized GLB/weapon frame. At full
  // ADS both top-center sight anchors lie on camera -Z, not merely near a HUD dot.
  const sightProfiles = [
    { hip: V(.205, -.205, -.24), height: .139, frontZ: -.465, rearZ: -.166, adsZ: -.14, fov: 51, muzzle: V(0, .0855, -.482) },
    { hip: V(.235, -.245, -.50), height: .135, frontZ: -.73, rearZ: -.065, adsZ: -.51, fov: 59, muzzle: V(0, .015, -.91) },
  ];
  const sightGlow = own(new THREE.MeshBasicMaterial({ color: 0xc7ffb9, toneMapped: false }));
  let muzzleBlocked = false;
  function installSights(g, index) {
    const p = sightProfiles[index], sights = new THREE.Group(); sights.name = index ? 'shotgun-iron-sights' : 'pistol-iron-sights'; g.add(sights);
    const postWidth = index ? .014 : .0055, postHeight = index ? .034 : .020, rearWidth = index ? .010 : .006;
    box(0, p.height - postHeight / 2, p.frontZ, postWidth, postHeight, .016, mat.black, sights).name = 'front-sight-post';
    // Two protected rear posts frame an open notch; the luminous bead stays
    // below the exact point of aim, leaving the target itself unobscured.
    const rearX = index ? .016 : .0085;
    const rearBeadDrop = .0035 * (-p.adsZ - p.rearZ) / (-p.adsZ - p.frontZ);
    for (const side of [-1, 1]) {
      box(side * rearX, p.height - .010, p.rearZ, rearWidth, .020, .020, mat.black, sights);
      sphere(side * rearX, p.height - rearBeadDrop, p.rearZ + .011, index ? .0016 : .00115, index ? .0016 : .00115, .0008, sightGlow, sights);
    }
    box(0, p.height - .023, p.rearZ, rearX * 2 + rearWidth, .006, .018, mat.dark, sights);
    sphere(0, p.height - .0035, p.frontZ + .009, index ? .003 : .0019, index ? .003 : .0019, .001, sightGlow, sights).name = 'front-sight-bead';
    const front = new THREE.Object3D(), rear = new THREE.Object3D(); front.name = 'front-sight-axis'; rear.name = 'rear-sight-axis';
    front.position.set(0, p.height, p.frontZ); rear.position.set(0, p.height, p.rearZ); g.add(front, rear); g.userData.sights = { front, rear };
  }
  for (let index = 0; index < 2; index++) {
    const g = new THREE.Group(); rig.add(g); weaponModels.push(g);
    const external = index === 0 ? applyBorrowedAsset(assets.weapon, g, .38) : null;
    if (external) { external.position.add(V(0, .012, -.29)); external.traverse(node => { if (/slide/i.test(node.name)) { g.userData.slide = node; g.userData.slideBase = node.position.clone(); } if (/magazine/i.test(node.name)) { g.userData.externalMagazine = node; g.userData.magazineBase = node.position.clone(); } }); }
    else if (!index) {
      // Compact procedural pistol fallback keeps the same measured sight axes.
      box(0, .078, -.29, .075, .088, .36, mat.steel, g);
      box(0, .024, -.27, .07, .045, .32, mat.dark, g);
      box(0, -.063, -.185, .069, .16, .085, mat.black, g).rotation.x = -.17;
      cylinder(0, .0855, -.472, .023, .024, mat.black, g, 'z');
      box(0, -.023, -.252, .064, .009, .062, mat.edge, g);
      box(0, .123, -.32, .054, .012, .21, mat.dark, g);
    }
    else {
      box(0, 0, -.23, index ? .125 : .12, .135, .48, mat.dark, g); box(0, .08, -.19, .11, .03, .35, mat.edge, g);
      box(0, index ? -.06 : .01, .095, index ? .073 : .095, index ? .08 : .12, .25, mat.dark, g); box(0, index ? -.112 : .015, .23, index ? .08 : .13, index ? .11 : .17, .075, mat.black, g);
      box(0, -.12, -.095, .075, .18, .115, mat.black, g).rotation.x = -.18;
      if (!index) { const magazine = box(0, -.155, -.28, .075, .2, .14, mat.steel, g); magazine.rotation.x = .17; g.userData.magazine = magazine;
        box(0, .105, -.11, .085, .085, .13, mat.black, g); box(0, .147, -.115, .052, .055, .026, mat.blue, g);
        for (let z = -.48; z <= -.27; z += .045) box(0, .032, z, .135, .034, .014, mat.edge, g);
      } else { cylinder(0, -.055, -.57, .035, .47, mat.steel, g, 'z'); box(0, -.012, -.48, .14, .1, .26, mat.black, g); }
      cylinder(0, .015, -.63, index ? .047 : .027, index ? .36 : .32, mat.steel, g, 'z');
      cylinder(0, .015, -.83, index ? .055 : .04, .12, mat.black, g, 'z');
      box(0, .066, -.73, .021, .07, .029, mat.edge, g); box(0, .016, -.897, .04, .045, .008, mat.black, g);
      cylinder(.064, .007, -.16, .018, .06, mat.edge, g, 'x');
    }
    installSights(g, index);
    // Gloves, armored wrists and forearms are articulated separately from the gun.
    const rightArm = new THREE.Group(); rightArm.position.set(external ? .015 : .075, -.15, external ? -.17 : .015); g.add(rightArm);
    sphere(0, .016, -.025, .072, .093, .095, mat.glove, rightArm); cylinder(.03, -.105, .045, .065, .23, mat.green, rightArm); rightArm.rotation.z = -.22;
    box(.008, .051, -.022, .12, .04, .12, mat.dark, rightArm); for (let i = 0; i < 4; i++) cylinder(-.038 + i * .024, .014, -.104, .015, .06, mat.glove, rightArm, 'x');
    const leftArm = new THREE.Group(); leftArm.position.set(-.07, -.09, external ? -.3 : -.46); g.add(leftArm); leftArm.rotation.z = -.62; leftArm.rotation.x = -.6;
    sphere(0, 0, 0, .071, .087, .09, mat.glove, leftArm); cylinder(0, -.17, .02, .07, .33, mat.green, leftArm); box(0, -.085, .024, .14, .067, .14, mat.dark, leftArm);
    g.userData.leftArm = leftArm; g.userData.leftArmZ = external ? -.3 : -.46;
    g.traverse(node => { if (node.isMesh) { node.frustumCulled = false; node.renderOrder = 10; } });
  }
  const muzzleFlash = new THREE.Group(); rig.add(muzzleFlash); muzzleFlash.position.set(0, .015, -.91);
  const flashMaterial = own(new THREE.MeshBasicMaterial({ color: 0xffce75, transparent: true, opacity: .9, depthWrite: false }));
  for (let i = 0; i < 3; i++) { const spike = box(0, 0, -.035, .065, .16, .035, flashMaterial, muzzleFlash); spike.rotation.z = i * Math.PI / 3; }
  const muzzleGlow = new THREE.PointLight(0xffba64, 0, 3.5, 2); rig.add(muzzleGlow); muzzleGlow.position.copy(muzzleFlash.position); muzzleFlash.visible = false;

  function objectBox(o) { const p = o.mesh.position; return { min: V(p.x - o.halfWidth, p.y, p.z - o.halfDepth), max: V(p.x + o.halfWidth, p.y + o.height, p.z + o.halfDepth), type: 'metal', entity: o }; }
  function actorBox(e) { const p = e.mesh.position; return { min: V(p.x - .4, p.y + .08, p.z - .34), max: V(p.x + .4, p.y + 1.89, p.z + .34), type: 'metal', entity: e }; }
  function rayBox(origin, direction, bounds, maxDistance) {
    let near = 0, far = maxDistance, axis = 'z', sign = 1;
    for (const key of ['x', 'y', 'z']) {
      if (Math.abs(direction[key]) < 1e-8) { if (origin[key] < bounds.min[key] || origin[key] > bounds.max[key]) return null; continue; }
      let a = (bounds.min[key] - origin[key]) / direction[key], b = (bounds.max[key] - origin[key]) / direction[key], n = -1;
      if (a > b) { [a, b] = [b, a]; n = 1; }
      if (a > near) { near = a; axis = key; sign = n; } far = Math.min(far, b); if (far < near) return null;
    }
    if (near > maxDistance || far < .001) return null;
    const normal = V(); normal[axis] = sign; return { distance: Math.max(.001, near), normal };
  }
  function raycast(origin, dir, maxDistance, { actors = true, ignore = null, includePlayer = false } = {}) {
    let best = null, length = maxDistance;
    const test = b => { const result = rayBox(origin, dir, b, length); if (result && result.distance < length) { length = result.distance; best = { ...result, type: b.type, entity: b.entity || null, point: origin.clone().addScaledVector(dir, result.distance) }; } };
    for (const b of walls) test(b);
    for (const o of objects) if (o.alive && (o !== carrying || includePlayer) && o !== ignore) test(objectBox(o));
    if (actors) for (const e of [...enemies, ...allies]) if (e.alive && e !== ignore) test(actorBox(e));
    if (includePlayer) test({ ...actorBox({ mesh: player }), entity: player, type: 'friendly' });
    if (dir.y < -.0001) { const d = -origin.y / dir.y; if (d > .005 && d < length) { length = d; best = { distance: d, type: 'stone', entity: null, point: origin.clone().addScaledVector(dir, d), normal: V(0, 1, 0) }; } }
    return best;
  }
  function visible(from, to, ignore = null) { const d = to.clone().sub(from), length = d.length(); if (length < .02) return true; const hit = raycast(from, d.divideScalar(length), length - .025, { actors: false, ignore }); return !hit; }
  function bodyBlocked(x, z, y = 0, radius = .36, ignore = null) {
    if (x < -27.5 || x > 27.5 || z < -41.5 || z > 29.5) return true;
    const overlaps = b => y + collisionEpsilon < b.max.y && y + playerHeight > b.min.y + collisionEpsilon && x + radius > b.min.x && x - radius < b.max.x && z + radius > b.min.z && z - radius < b.max.z;
    if (walls.some(overlaps)) return true;
    return objects.some(o => o.alive && !o.flying && o !== carrying && o !== ignore && overlaps(objectBox(o)));
  }
  function nearestClear(point) {
    const origin = point.clone().setY(0);
    if (!bodyBlocked(origin.x, origin.z, 0, .42)) return origin;
    // Navigation destinations may be on a bed/crate when the player jumps. Project
    // to nearby floor, never teleport an actor or route straight through a wall.
    for (let radius = .5; radius <= 4; radius += .5) for (let i = 0; i < 24; i++) {
      const candidate = origin.clone().add(V(Math.sin(i * Math.PI / 12) * radius, 0, Math.cos(i * Math.PI / 12) * radius));
      if (!bodyBlocked(candidate.x, candidate.z, 0, .42)) return candidate;
    }
    return origin;
  }
  function moveBody(mesh, dx, dz, dt, speed, radius = .36) {
    const oldX = mesh.position.x, oldZ = mesh.position.z, steps = Math.max(1, Math.ceil(speed * dt / .18));
    for (let i = 0; i < steps; i++) { const x = dx * speed * dt / steps, z = dz * speed * dt / steps;
      if (!bodyBlocked(mesh.position.x + x, mesh.position.z, mesh.position.y, radius)) mesh.position.x += x;
      if (!bodyBlocked(mesh.position.x, mesh.position.z + z, mesh.position.y, radius)) mesh.position.z += z;
    }
    return Math.hypot(mesh.position.x - oldX, mesh.position.z - oldZ);
  }
  function bodySolids(ignore = null) {
    return [...walls, ...objects.filter(o => o.alive && !o.flying && !o.falling && o !== carrying && o !== ignore).map(objectBox)];
  }
  function footprintOverlaps(p, b, radius = playerRadius) {
    return p.x + radius > b.min.x + collisionEpsilon && p.x - radius < b.max.x - collisionEpsilon &&
      p.z + radius > b.min.z + collisionEpsilon && p.z - radius < b.max.z - collisionEpsilon;
  }
  function playerHasSupport(solids = bodySolids()) {
    const p = player.position;
    return Math.abs(p.y) < collisionEpsilon || solids.some(b => Math.abs(p.y - b.max.y) < collisionEpsilon && footprintOverlaps(p, b));
  }
  function movePlayer(dx, dz, dt, speed) {
    const p = player.position, oldX = p.x, oldZ = p.z, solids = bodySolids();
    if (dt <= 0) { if (grounded && !playerHasSupport(solids)) grounded = false; return 0; }
    // Coupled small steps let feet clear a ledge before horizontal movement and
    // sweep every descending top/ascending underside, even on a slow frame.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)), Math.ceil(speed * dt / .08)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (grounded && !playerHasSupport(solids)) grounded = false;
      const oldY = p.y, oldHead = oldY + playerHeight;
      let nextY = oldY + vertical * step - gravity * step * step / 2;
      vertical -= gravity * step;
      if (nextY > oldY) {
        let ceiling = Infinity;
        for (const b of solids) if (footprintOverlaps(p, b) && oldHead <= b.min.y + collisionEpsilon && nextY + playerHeight >= b.min.y) ceiling = Math.min(ceiling, b.min.y);
        if (ceiling < Infinity) { nextY = ceiling - playerHeight; vertical = 0; }
        grounded = false;
      } else {
        let floor = 0;
        for (const b of solids) if (footprintOverlaps(p, b) && oldY >= b.max.y - collisionEpsilon && nextY <= b.max.y) floor = Math.max(floor, b.max.y);
        if (nextY <= floor) {
          if (!grounded && vertical < -4.5) audio('land');
          nextY = floor; vertical = 0; grounded = true;
        } else grounded = false;
      }
      p.y = nextY;
      moveBody(player, dx, dz, step, speed, playerRadius);
      if (grounded && !playerHasSupport(solids)) grounded = false;
    }
    return Math.hypot(p.x - oldX, p.z - oldZ);
  }
  function clearSegment(from, to) {
    const steps = Math.max(1, Math.ceil(Math.hypot(from.x - to.x, from.z - to.z) / .55));
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (bodyBlocked(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, 0, .4)) return false; } return true;
  }
  function pathTo(start, goal) {
    goal = nearestClear(goal);
    if (bodyBlocked(goal.x, goal.z, 0, .4)) return [];
    if (clearSegment(start, goal)) return [goal.clone()];
    const spacing = 1.4, key = (x, z) => `${x},${z}`, nodes = new Map(), closed = new Set(), open = [];
    let sx = Math.round(start.x / spacing), sz = Math.round(start.z / spacing), gx = Math.round(goal.x / spacing), gz = Math.round(goal.z / spacing);
    if (bodyBlocked(sx * spacing, sz * spacing, 0, .4)) { let best = null; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const p = V((sx + a) * spacing, 0, (sz + b) * spacing); if (!bodyBlocked(p.x, p.z, 0, .4) && clearSegment(start, p) && (!best || p.distanceTo(start) < best.p.distanceTo(start))) best = { x: sx + a, z: sz + b, p }; } if (!best) return []; sx = best.x; sz = best.z; }
    const first = { x: sx, z: sz, cost: 0, f: Math.hypot(gx - sx, gz - sz), parent: null }; open.push(first); nodes.set(key(sx, sz), first); let end = null;
    for (let count = 0; open.length && count < 1700; count++) {
      let best = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
      const node = open.splice(best, 1)[0], nk = key(node.x, node.z); if (closed.has(nk)) continue; closed.add(nk);
      const p = V(node.x * spacing, 0, node.z * spacing);
      if (p.distanceTo(goal) < 2 && clearSegment(p, goal)) { end = node; break; }
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const x = node.x + a, z = node.z + b, k = key(x, z); if (closed.has(k) || x < -19 || x > 19 || z < -29 || z > 20) continue;
        const next = V(x * spacing, 0, z * spacing); if (!clearSegment(p, next)) continue;
        const cost = node.cost + Math.hypot(a, b), old = nodes.get(k); if (old && old.cost <= cost) continue;
        const n = { x, z, cost, f: cost + Math.hypot(gx - x, gz - z), parent: node }; nodes.set(k, n); open.push(n);
      }
    }
    if (!end) return [];
    const route = [goal.clone()]; for (let n = end; n; n = n.parent) route.unshift(V(n.x * spacing, 0, n.z * spacing));
    const smooth = []; let from = start;
    while (route.length) { let far = -1; for (let i = route.length - 1; i >= 0; i--) if (clearSegment(from, route[i])) { far = i; break; } if (far < 0) return []; from = route[far]; smooth.push(from); route.splice(0, far + 1); }
    return smooth;
  }
  function follow(e, goal, dt, speed) {
    if (time >= e.repathAt || !e.pathGoal || e.pathGoal.distanceTo(goal) > 2.3) { e.path = pathTo(e.mesh.position, goal); e.pathGoal = goal.clone(); e.repathAt = time + 1.15 + e.index * .04; }
    while (e.path.length && e.mesh.position.distanceTo(e.path[0]) < .3) e.path.shift(); const next = e.path[0]; if (!next) return 0;
    const dx = next.x - e.mesh.position.x, dz = next.z - e.mesh.position.z, length = Math.hypot(dx, dz); if (length < .01) return 0;
    const moved = moveBody(e.mesh, dx / length, dz / length, dt, Math.min(speed, length / Math.max(dt, .001)), .4);
    if (moved < .001) { e.stuckFor = (e.stuckFor || 0) + dt; if (e.stuckFor > .35) { e.repathAt = time; e.path = []; e.stuckFor = 0; } } else e.stuckFor = 0; return moved;
  }
  function addTracer(from, to, hostile = false, friendly = false) {
    const length = from.distanceTo(to); if (length < .01) return;
    const mesh = new THREE.Mesh(cylinderGeo, hostile ? mat.enemyTracer : friendly ? mat.allyTracer : mat.tracer); mesh.scale.set(.013, length, .013);
    mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), to.clone().sub(from).normalize()); root.add(mesh);
    mesh.name = friendly ? 'squad-tracer' : hostile ? 'hostile-tracer' : 'player-tracer';
    tracers.push({ mesh, life: friendly ? .085 : .055 }); if (tracers.length > 30) root.remove(tracers.shift().mesh);
  }
  function burst(point, type = 'metal', count = 7, explosive = false) {
    for (let i = 0; i < (reduced ? Math.min(count, 3) : count); i++) {
      if (particles.length >= 92) root.remove(particles.shift().mesh);
      const mesh = new THREE.Mesh(boxGeo, type === 'metal' ? mat.spark : mat.dust), size = type === 'metal' ? .03 : .065;
      mesh.position.copy(point); mesh.scale.set(size, size * (type === 'metal' ? 2.9 : 1), size);
      const v = V((rng() - .5) * 5, .5 + rng() * 4, (rng() - .5) * 5).multiplyScalar(explosive ? 2.1 : 1); root.add(mesh);
      particles.push({ mesh, v, life: explosive ? .9 : .27 + rng() * .3 });
    }
  }
  function impact(hit) {
    burst(hit.point, hit.type, hit.type === 'metal' ? 7 : 5); audio('impact', { surface: hit.type, distance: eye.distanceTo(hit.point), intensity: hit.type === 'metal' ? .6 : .45 });
    if (!hit.entity) { const mesh = new THREE.Mesh(own(new THREE.CircleGeometry(hit.type === 'metal' ? .044 : .065, 8)), mat.hole); mesh.position.copy(hit.point).addScaledVector(hit.normal, .008); mesh.quaternion.setFromUnitVectors(V(0, 0, 1), hit.normal); root.add(mesh); impacts.push({ mesh, life: 30 }); if (impacts.length > 36) { const old = impacts.shift(); root.remove(old.mesh); old.mesh.geometry.dispose(); resources.delete(old.mesh.geometry); } }
  }
  function pickupAt(position, kind = 'ammo') {
    const mesh = new THREE.Group(); mesh.position.copy(position); mesh.position.y = .22; root.add(mesh);
    box(0, 0, 0, .48, .22, .3, kind === 'health' ? mat.green : mat.orange, mesh); box(0, .13, 0, .27, .03, .19, kind === 'health' ? mat.mint : mat.edge, mesh);
    pickups.push({ mesh, kind, alive: true, phase: rng() * 6 });
  }
  function hurt(amount, origin) {
    if (dead || completed || time < retryGraceUntil) return; const taken = Math.min(shield, amount * shieldAbsorption); shield -= taken; health = Math.max(0, health - amount + taken); totalDamageTaken += amount; hurtAt = time;
    if (taken > 0) audio(shield === 0 ? 'shieldBreak' : 'shieldHit', { intensity: shield === 0 ? .9 : .35 });
    hurtDirection = origin ? Math.atan2(origin.x - player.position.x, -(origin.z - player.position.z)) + yaw : 0;
    hurtDirection = Math.atan2(Math.sin(hurtDirection), Math.cos(hurtDirection)); audio('hit', { amount, intensity: Math.min(1, amount / 20) });
    if (health <= 0) { dead = true; reloadTime = 0; aiming = false; if (carrying) drop(false, true); say('行动失败 · 可从当前阶段检查点重试。', 999); audio('defeat'); }
  }
  function damage(entity, amount, fromPlayer = true, hit = null) {
    if (!entity?.alive || entity.kind === 'ally' || entity.critical || entity === jammer && (!terminalOn || !fromPlayer)) return;
    entity.hp -= amount;
    if (entity.kind === 'enemy') { entity.staggerUntil = time + .16; entity.alertUntil = time + 12; entity.lastKnown.copy(player.position); entity.state = 'stagger'; }
    if (fromPlayer) { hitUntil = time + .13; audio('hitConfirm', { kill: entity.hp <= 0, headshot: hit?.headshot || false }); }
    if (entity.hp > 0) return;
    entity.alive = false; entity.hp = 0; if (carrying === entity) carrying = null;
    if (grounded && !playerHasSupport()) grounded = false;
    if (entity.kind === 'enemy') { entity.state = 'dead'; entity.charge.visible = false; entity.deathAt = time; score += fromPlayer ? 100 : 60; killUntil = time + .22; pickupAt(entity.mesh.position); }
    else { entity.mesh.visible = false; score += 20; burst(entity.mesh.position.clone().add(V(0, .6, 0)), 'metal', 15, entity.kind === 'barrel');
      if (entity.kind === 'barrel') { audio('explosion', { distance: player.position.distanceTo(entity.mesh.position) }); const center = entity.mesh.position.clone().add(V(0, .65, 0));
        for (const e of enemies) if (e.alive && e.mesh.position.distanceTo(entity.mesh.position) < 4.4 && visible(center, e.mesh.position.clone().add(V(0, 1, 0)), entity)) damage(e, 115, fromPlayer);
        for (const other of objects) if (other !== entity && other.alive && other !== carrying && other.mesh.position.distanceTo(entity.mesh.position) < 3 && visible(center, other.mesh.position.clone().add(V(0, .7, 0)), other)) damage(other, 85, fromPlayer);
        if (player.position.distanceTo(entity.mesh.position) < 3.5 && visible(center, eye, entity)) hurt(24, entity.mesh.position);
      } else if (entity === jammer) { advanceStage(4); say('干扰装置已摧毁 · 返回庭院撤离，不必清空整座设施。', 6); } else pickupAt(entity.mesh.position, entity.kind === 'cell' ? 'health' : 'ammo');
    }
  }
  function fire() {
    if (dead || completed || reloadTime > 0 || carrying || shotCooldown > .0001 || sprinting) return false;
    const w = weapons[weapon]; if (ammo[weapon] <= 0) { startReload(); return false; }
    updateAim(); ammo[weapon]--; shotCount++; shotCooldown = w.interval; recoil = Math.min(.19, recoil + w.kick * (1 - aimBlend * .42)); recoilKick += w.kick * .32 * (1 - aimBlend * .36); flashTime = .048;
    noiseAt = time; noisePosition.copy(player.position); audio('shot', { weapon: w.sound, aiming });
    muzzleFlash.visible = true; muzzleGlow.intensity = reduced ? 0 : 2.8; root.updateMatrixWorld(true); view.updateMatrixWorld(true); const muzzle = muzzleFlash.getWorldPosition(V());
    // A view-model may extend into/beyond a thin wall. Check the whole eye-to-
    // muzzle segment first, so moving a muzzle beyond cover cannot bypass it.
    const barrelSegment = muzzle.clone().sub(eye), barrelLength = barrelSegment.length();
    const barrelHit = raycast(eye, barrelSegment.divideScalar(barrelLength || 1), barrelLength, { actors: false });
    let anyHit = false;
    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const spread = w.spread * (1 - aimBlend * (weapon === 1 ? .52 : .86)) * (grounded ? 1 : 1.9) * (movedDistance > .01 ? 1.45 : 1);
      const dir = direction.clone().add(V((rng() - .5) * spread, (rng() - .5) * spread, (rng() - .5) * spread)).normalize();
      let hit = raycast(eye, dir, w.range); let destination = hit?.point || eye.clone().addScaledVector(dir, w.range);
      // A muzzle blocked by nearby cover cannot send rounds through that cover.
      const muzzleDirection = destination.clone().sub(muzzle), muzzleDistance = muzzleDirection.length();
      const muzzleHit = raycast(muzzle, muzzleDirection.divideScalar(muzzleDistance || 1), muzzleDistance, { actors: false });
      if (barrelHit || muzzleHit && muzzleHit.distance < muzzleDistance - .025) { hit = barrelHit || muzzleHit; destination = hit.point; }
      if (pellet === 0 || weapon === 1 && pellet % 3 === 0) addTracer(barrelHit ? eye : muzzle, destination);
      if (hit) { impact(hit); if (hit.entity && hit.entity.kind !== 'ally') { const headshot = hit.entity.kind === 'enemy' && hit.point.y - hit.entity.mesh.position.y > 1.43; hit.headshot = headshot;
          const falloff = weapon === 1 ? clamp(1 - hit.distance / 52, .35, 1) : 1; damage(hit.entity, w.damage * (headshot ? (weapon === 0 ? 1.5 : 1.2) : 1) * falloff, true, hit); anyHit = true; } }
    }
    if (ammo[weapon] === 0 && reserve[weapon] === 0) say('弹药耗尽 · 切换武器或收集橙色弹药箱。');
    return true;
  }
  function startReload() {
    if (dead || completed || carrying || reloadTime > 0 || ammo[weapon] >= weapons[weapon].maxAmmo || reserve[weapon] <= 0) return false;
    reloadDuration = weapons[weapon].reload; reloadTime = reloadDuration; reloadCount++; aiming = false; audio('reload', { weapon: weapons[weapon].sound }); return true;
  }
  function switchWeapon(index) { if (dead || completed || carrying) return; weapon = index === undefined ? 1 - weapon : clamp(index, 0, 1); reloadTime = 0; recoil = .035; shotCooldown = .22; audio('equip'); }
  function updateAim() { eye.copy(player.position).add(V(0, dead ? .48 : 1.68, 0)); baseCamera.set(pitch + recoilKick, yaw, 0, 'YXZ'); direction.set(0, 0, -1).applyEuler(baseCamera).normalize(); }
  function distance(entity) { return player.position.distanceTo(entity.mesh.position); }
  function context() {
    if (dead || completed) return null;
    if (carrying === missionCell && player.position.distanceTo(terminal.position) < 3.2 && visible(eye, terminal.position.clone().add(V(0, 1.4, 0)), missionCell)) return { type: 'install', entity: { mesh: terminal }, prompt: 'E 安装信号核心 · 随后摧毁红色干扰装置' };
    if (carrying) return { type: 'drop', entity: carrying, prompt: carrying === missionCell ? 'E 安全放下核心 · 送往控制中心终端' : 'E 放下物件  ·  Q 向准星投掷' };
    if (Math.max(reserve[0], reserve[1]) < 12 && (player.position.distanceTo(terminal.position) < 3.2 || player.position.distanceTo(extract.position) < 3.2)) return { type: 'resupply', entity: { mesh: player.position.z > 8 ? extract : terminal }, prompt: 'E 领取路线弹药补给' };
    let best = null, bestDistance = 2.9;
    const consider = (type, entity, prompt, range = 2.9) => { const d = distance(entity); if (d >= Math.min(bestDistance, range) || !visible(eye, entity.mesh.position.clone().add(V(0, 1, 0)), entity)) return; bestDistance = d; best = { type, entity, prompt }; };
    for (const a of allies) if (!a.rescued) consider('rescue', a, `E 救援 ${a.name} · 获得火力支援`, 3.2);

    if (terminalOn && !jammer.alive) consider('extract', { mesh: extract }, 'E 撤离 · 完成行动', 3.2);
    for (const o of objects) if (o.alive && !o.flying && !o.falling && o !== jammer) {
      if (o === missionCell && enemies.some(e => e.alive && e.mesh.position.distanceTo(missionCell.safe) < 6)) continue;
      consider('pickup', o, o === missionCell ? 'E 取得信号核心 · 搬运至控制中心' : `E 拾起${o.kind === 'barrel' ? '爆破桶' : o.kind === 'cell' ? '医疗箱' : '补给箱'}  ·  Q 投掷`, 2.5);
    }
    return best;
  }
  function drop(thrown = false, force = false) {
    if (!carrying || dead && !force) return false;
    const o = carrying; if (o.critical) thrown = false; updateAim(); const forward = V(direction.x, 0, direction.z).normalize(); let placement = null;
    for (const angle of [0, .5, -.5, 1, -1, Math.PI]) { const f = forward.clone().applyAxisAngle(V(0, 1, 0), angle); const p = player.position.clone().addScaledVector(f, 1.35);
      if (!bodyBlocked(p.x, p.z, player.position.y, o.radius, o) && visible(eye, p.clone().add(V(0, .65, 0)), o)) { placement = p; break; } }
    if (!placement && !force) { say('这里没有放置空间 · 移到空地再试。'); return false; }
    carrying = null; o.mesh.position.copy(placement || player.position); o.mesh.rotation.set(0, 0, 0); o.flying = thrown; o.falling = false; o.v.set(0, 0, 0);
    if (thrown) { o.mesh.position.y = player.position.y + 1.15; o.v.copy(direction).multiplyScalar(13.2); o.v.y += 2.9; audio('throw'); }
    else {
      let floor = 0;
      for (const b of bodySolids(o)) if (footprintOverlaps(o.mesh.position, b, o.radius) && b.max.y <= o.mesh.position.y + collisionEpsilon) floor = Math.max(floor, b.max.y);
      if (o.mesh.position.y <= floor + collisionEpsilon) o.mesh.position.y = floor; else o.falling = true;
    }
    return true;
  }
  function interact() {
    const target = context(); if (!target) return false;
    if (target.type === 'resupply') { reserve[0] = Math.max(reserve[0], 45); reserve[1] = Math.max(reserve[1], 12); say('已补充手枪与霰弹枪弹药 · R 换弹'); audio('pickup'); return true; }
    if (target.type === 'drop') return drop(false);
    if (target.type === 'pickup') { carrying = target.entity; if (!playerHasSupport()) grounded = false; reloadTime = 0; audio('pickup'); if (carrying === missionCell) { advanceStage(2); say('核心已取得 · 搬运时无法开火；可安全放下再交战。', 5); } return true; }
    if (target.type === 'rescue') { target.entity.rescued = true; target.entity.state = 'follow'; score += 150; target.entity.cooldown = .2; say(`${target.entity.name} 已加入 · 自动跟随并以三连发掩护。`); audio('mission'); }
    if (target.type === 'install') {
      carrying = null; missionCell.alive = false; missionCell.mesh.visible = false; terminalOn = true;
      reinforcementsAt = time + 9; terminalScreen.material = mat.mint; score += 300;
      reserve[0] = Math.max(reserve[0], 45); reserve[1] = Math.max(reserve[1], 12);
      health = Math.min(maxHealth, health + 20); advanceStage(3);
      say(`核心安装完成！庭院 ${tier.reinforcements} 名增援将在 9 秒后抵达 · 射击红色干扰装置，随后撤离。`, 8); audio('warning');
    }
    if (target.type === 'extract') { completed = true; score += 1000; heldFire = heldAim = false; say(`难度 ${difficulty} · ${tier.name} 完成！${difficulty < 3 ? '可在菜单挑战下一难度。' : '最高难度已通关。'}`, 999); audio('victory'); }
    return true;
  }
  function jump() { if (grounded && playerHasSupport() && !dead && !completed) { vertical = jumpSpeed; grounded = false; audio('jump'); } }
  function animateActor(e, moving, dt) {
    const t = time * (e.state === 'chase' ? 9 : 6) + e.phase;
    for (const limb of e.limbs) limb.mesh.rotation.x = moving > .002 ? Math.sin(t + (limb.side < 0 ? Math.PI : 0)) * (limb.type === 'leg' ? .58 : .2) : THREE.MathUtils.damp(limb.mesh.rotation.x, 0, 9, dt);
    e.body.position.y = moving > .002 ? Math.abs(Math.sin(t)) * .035 : 0;
    if (time < e.staggerUntil) { e.body.rotation.z = Math.sin((e.staggerUntil - time) * 40) * .11; e.body.position.z = .07; } else { e.body.rotation.z = 0; e.body.position.z = 0; }
  }
  function updateEnemies(dt) {
    // A rotating, bounded firing budget prevents an entire room firing at once.
    const candidates = enemies.filter(e => e.alive && e.mesh.position.distanceTo(player.position) < tier.sight && visible(e.mesh.position.clone().add(V(0, 1.5, 0)), eye));
    const offset = candidates.length ? Math.floor(time / 2.8) % candidates.length : 0;
    const firingSlots = new Set(Array.from({ length: Math.min(difficulty === 1 ? 2 : 3, candidates.length) }, (_, i) => candidates[(offset + i) % candidates.length]));
    for (const e of enemies) {
      if (!e.alive) { const t = clamp((time - e.deathAt) / .55, 0, 1); e.mesh.rotation.z = t * 1.38; e.mesh.position.y = -.12 * t; continue; }
      e.cooldown -= dt; const toPlayer = player.position.clone().sub(e.mesh.position), d = Math.max(.001, toPlayer.length()), from = e.mesh.position.clone().add(V(0, 1.5, 0));
      const facing = V(-Math.sin(e.mesh.rotation.y), 0, -Math.cos(e.mesh.rotation.y)), facingDot = facing.dot(toPlayer.clone().setY(0).normalize());
      const sees = stage > 0 && time >= retryGraceUntil && !dead && !completed && d < tier.sight && (e.alertUntil > time || d < 8 || facingDot > .18 - (difficulty - 1) * .1) && visible(from, eye);
      if (sees && !e.visible) e.attackReadyAt = time + tier.reaction;
      e.visible = sees;
      if (sees) { e.lastKnown.copy(player.position); e.alertUntil = time + 9; }
      if (stage > 0 && !dead && time - noiseAt < .15 && e.mesh.position.distanceTo(noisePosition) < 28) { e.alertUntil = time + 7; e.lastKnown.copy(noisePosition); }
      let moving = 0;
      if (dead || completed) { e.state = 'patrol'; e.windup = 0; }
      else if (time < e.staggerUntil) { e.state = 'stagger'; e.windup = 0; }
      else if (sees && d < tier.sight - 2) {
        e.mesh.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);
        if (e.hp < e.maxHP * .53 && time > e.coverCooldown && e.coverUntil < time) {
          const candidate = coverPoints.filter(p => p.distanceTo(e.mesh.position) < 8 && !bodyBlocked(p.x, p.z, 0, .4) && !visible(p.clone().add(V(0, .8, 0)), eye)).sort((a, b) => a.distanceTo(e.mesh.position) - b.distanceTo(e.mesh.position))[0];
          if (candidate) { e.coverGoal = candidate.clone(); e.coverUntil = time + 2.5; e.coverCooldown = time + 7; }
        }
        if (e.coverUntil > time && e.coverGoal && e.mesh.position.distanceTo(e.coverGoal) > .65) { e.state = 'cover'; moving = follow(e, e.coverGoal, dt, 2.8 * tier.speed); e.windup = 0; }
        else {
          if (!firingSlots.has(e)) e.windup = 0;
          e.state = !firingSlots.has(e) ? 'flank' : e.cooldown < .45 ? 'attack' : 'strafe';
          const strafe = Math.sin(time * .6 + e.phase) >= 0 ? 1 : -1;
          if (!firingSlots.has(e) && d > 8) {
            const side = e.index % 2 ? 1 : -1; const flank = e.lastKnown.clone().add(V(toPlayer.z / d * side * 6 - toPlayer.x / d * 7, 0, -toPlayer.x / d * side * 6 - toPlayer.z / d * 7));
            moving = follow(e, nearestClear(flank), dt, 1.6 * tier.speed);
          } else if (d > 5 && d < 17) moving = moveBody(e.mesh, toPlayer.z / d * strafe, -toPlayer.x / d * strafe, dt, .7 * tier.speed, .4);
          else if (d < 4.5) moving = moveBody(e.mesh, -toPlayer.x / d, -toPlayer.z / d, dt, 1.25 * tier.speed, .4);
          if (firingSlots.has(e) && e.cooldown <= 0 && time >= (e.attackReadyAt || 0)) {
            // Visible charge-up precedes each attack, making incoming fire readable.
            e.windup += dt;
            if (e.windup >= tier.windup) {
              const gunFrom = V(.36, 1.31, -.87).applyAxisAngle(V(0, 1, 0), e.mesh.rotation.y).add(e.mesh.position);
              const target = eye.clone(), accurate = rng() > clamp(d / 42, .13, .5);
              if (!accurate) target.add(V((rng() < .5 ? -1 : 1) * (1.2 + rng()), rng() * .7, 0));
              const bullet = target.clone().sub(gunFrom), length = bullet.length(); bullet.normalize(); const shoulder = e.mesh.position.clone().add(V(0, 1.31, 0)), barrel = gunFrom.clone().sub(shoulder);
              const blockedBarrel = raycast(shoulder, barrel.clone().normalize(), barrel.length(), { ignore: e });
              const hit = blockedBarrel || raycast(gunFrom, bullet, length, { ignore: e });
              addTracer(gunFrom, hit?.point || target, true); e.shotFlashUntil = time + .065; audio('enemyFire', { distance: d });
              if (!hit && accurate && !dead) hurt((d < 7 ? 10 : 7) * tier.damage, e.mesh.position);
              e.cooldown = tier.cadence + rng() * tier.variance; e.windup = 0;
            }
          }
        }
      } else if (e.alertUntil > time) { e.state = 'chase'; e.windup = 0; moving = follow(e, e.lastKnown, dt, 2.5 * tier.speed); const goal = e.path[0] || e.lastKnown; e.mesh.rotation.y = Math.atan2(e.mesh.position.x - goal.x, e.mesh.position.z - goal.z); }
      else {
        e.state = 'patrol'; e.windup = 0;
        if (!e.patrolGoal || e.mesh.position.distanceTo(e.patrolGoal) < .7 || time > (e.patrolAt || 0)) { e.patrolAngle += 1.6; const goal = e.home.clone().add(V(Math.sin(e.patrolAngle) * 2.7, 0, Math.cos(e.patrolAngle) * 2.7)); e.patrolGoal = bodyBlocked(goal.x, goal.z, 0, .4) ? e.home.clone() : goal; e.patrolAt = time + 6; }
        moving = follow(e, e.patrolGoal, dt, .95 * tier.speed); if (moving > .001) { const goal = e.path[0] || e.patrolGoal; e.mesh.rotation.y = Math.atan2(e.mesh.position.x - goal.x, e.mesh.position.z - goal.z); }
      }
      e.charge.visible = e.windup > 0 || time < (e.shotFlashUntil || 0); const chargeSize = .035 + e.windup * .25; e.charge.scale.set(chargeSize, chargeSize, .035);
      animateActor(e, moving, dt);
    }
  }
  function allyState(a) { return !a.rescued ? '待救援' : a.state === 'patch' ? '医疗修复' : a.state === 'combat' ? '交火' : '跟随'; }
  function allyShot(a, target) {
    const from = V(.36, 1.31, -.91).applyAxisAngle(V(0, 1, 0), a.mesh.rotation.y).add(a.mesh.position);
    const shoulder = a.mesh.position.clone().add(V(0, 1.31, 0));
    // Check both the barrel emerging from cover and the full shot path. A squad
    // mate or the player's body blocks fire, including when carrying a crate.
    const barrel = from.clone().sub(shoulder), barrelLength = barrel.length();
    if (raycast(shoulder, barrel.divideScalar(barrelLength || 1), barrelLength, { ignore: a, includePlayer: true })) return null;
    const to = target.mesh.position.clone().add(V(0, 1.13, 0)), delta = to.clone().sub(from), length = delta.length();
    const hit = raycast(from, delta.divideScalar(length || 1), length + .1, { ignore: a, includePlayer: true });
    return hit?.entity === target ? { from, hit } : null;
  }
  function updateAllies(dt) {
    for (const a of allies) {
      let moving = 0;
      if (a.rescued && !dead && !completed) {
        a.cooldown -= dt;
        const d = distance(a), offset = a.isGuide ? V(1.4, 0, 3.4) : V(a.index === 0 ? -2.2 : 2.2, 0, 1.8 + a.index * .5);
        const formation = nearestClear(player.position.clone().add(offset.applyAxisAngle(V(0, 1, 0), yaw)));
        const followPosition = clearSegment(player.position, formation) ? formation : nearestClear(player.position);
        a.state = 'follow';
        if (d > 4.1 || a.mesh.position.distanceTo(followPosition) > 1.15) moving = follow(a, followPosition, dt, d > 12 ? 7.8 : d > 6 ? 5.6 : 3.7);
        const from = a.mesh.position.clone().add(V(0, 1.48, 0));
        if (a.isGuide) {
          if ((health < maxHealth || shield < maxShield) && time - hurtAt > 3 && !enemies.some(e => e.alive && e.mesh.position.distanceTo(player.position) < 12 && visible(e.mesh.position.clone().add(V(0, 1.5, 0)), eye)) && d < 6.2 && time >= a.patchAt && visible(from, eye)) {
            const healed = Math.min(guidePatch, maxHealth - health); health += healed; support.healthRestored += healed;
            const restored = Math.min(12, maxShield - shield); shield += restored; a.stats.shieldRestored += restored; support.shieldRestored += restored;
            a.patchAt = time + guidePatchCooldown; a.patchUntil = time + 1.3; guidePulse.visible = true;
            addTracer(from, eye.clone().add(V(0, -.3, 0)), false, true); audio('shield', { intensity: .55, distance: d });
            say(`H-01 已治疗 ${Math.round(healed)} 生命 / ${Math.round(restored)} 护盾 · ${guidePatchCooldown} 秒冷却`, 2);
          }
          if (time >= a.scanAt) {
            const spotted = enemies.filter(e => e.alive && e.mesh.position.distanceTo(a.mesh.position) < 23 && visible(from, e.mesh.position.clone().add(V(0, 1.25, 0))));
            spotted.forEach(e => { e.spottedUntil = time + 6; }); a.scanAt = time + 6.5;
            if (spotted.length) { support.scans++; a.scanUntil = time + 1.2; audio('scan', { intensity: .32, distance: d }); }
          }
          if (time < (a.patchUntil || 0)) a.state = 'patch';
          guidePulse.visible = time < (a.patchUntil || 0) || time < (a.scanUntil || 0);
          guidePulse.scale.setScalar(1 + Math.sin(time * 7) * .2);
          const animation = moving > .001 ? 'Walking' : 'Idle'; if (a.animation !== animation) { a.animation = animation; playAnimation(animation); }
        } else {
          const targets = enemies.filter(e => e.alive && e.mesh.position.distanceTo(a.mesh.position) < 25 && e.mesh.position.distanceTo(player.position) < 28 && visible(from, e.mesh.position.clone().add(V(0, 1.13, 0))));
          targets.sort((left, right) => left.mesh.position.distanceTo(from) - right.mesh.position.distanceTo(from));
          let shot = null, target = null;
          for (const candidate of targets) {
            a.mesh.rotation.y = Math.atan2(a.mesh.position.x - candidate.mesh.position.x, a.mesh.position.z - candidate.mesh.position.z);
            const candidateShot = allyShot(a, candidate); if (candidateShot) { target = candidate; shot = candidateShot; break; }
          }
          if (target) {
            a.state = 'combat';
            if (a.cooldown <= 0) {
              const dealt = Math.min(target.hp, 14); if (!a.burstLeft) a.burstLeft = 3;
              addTracer(shot.from, shot.hit.point, false, true); burst(shot.hit.point, 'metal', 3);
              a.shotFlashUntil = time + .095; audio('shot', { weapon: 'rifle', source: 'ally', distance: d, intensity: .45, pitch: 1.15, pan: clamp((a.mesh.position.x - player.position.x) / 8, -.65, .65) });
              damage(target, 14, false); a.stats.shots++; a.stats.damage += dealt; support.shots++; support.damage += dealt;
              if (!target.alive) { a.stats.kills++; support.kills++; }
              a.burstLeft--; a.cooldown = a.burstLeft ? .16 : 1.95 + a.index * .17;
            }
          } else { a.burstLeft = 0; if (targets.length) a.cooldown = Math.max(a.cooldown, .12); }
        }
        if (a.state !== 'combat' && moving > .001) { const next = a.path[0] || followPosition; a.mesh.rotation.y = Math.atan2(a.mesh.position.x - next.x, a.mesh.position.z - next.z); }
      }
      a.charge.visible = !a.isGuide && !dead && !completed && time < (a.shotFlashUntil || 0); a.charge.scale.set(.13, .13, .12);
      animateActor(a, moving, dt);
      const near = distance(a) < 19;
      if (a.label) { a.label.visible = near; a.label.lookAt(camera.position); }
      if (a.statusLabel) { a.statusLabel.visible = near; a.statusLabel.lookAt(camera.position); a.statusLabel.userData.setText(!a.rescued ? '待救援 · E 连接' : a.isGuide ? `${allyState(a)} · ${time < (a.scanUntil || 0) ? '发现敌人' : time < a.patchAt ? `补盾 ${Math.ceil(a.patchAt - time)}s` : '医疗 / 护盾 / 侦察'}` : `${allyState(a)} · ${a.stats.kills} 击倒`); }
    }
    for (const e of enemies) if (e.spotMarker) { e.spotMarker.visible = e.alive && time < (e.spottedUntil || 0); e.spotMarker.lookAt(camera.position); }
  }
  function updateReinforcements() {
    if (!terminalOn || reinforcementsSpawned || time < reinforcementsAt || dead || completed) return;
    const entries = [[-6, 27], [6, 27], [-13, 27], [13, 27], [-4, 27], [4, 27], [-20, 26], [20, 26], [-24, 14], [24, 14]];
    const safeEntries = entries.filter(([x, z]) => Math.hypot(x - player.position.x, z - player.position.z) > 10);
    if (safeEntries.length < tier.reinforcements) { reinforcementsAt = time + 1; return; }
    safeEntries.slice(0, tier.reinforcements).forEach(p => {
      let e;
      if (retiredEnemies.length) {
        e = retiredEnemies.pop(); root.add(e.mesh); enemies.push(e); e.mesh.visible = true; e.mesh.position.copy(nearestClear(V(...[p[0], 0, p[1]]))); e.mesh.rotation.set(0, 0, 0); e.body.rotation.set(0, 0, 0); e.body.position.set(0, 0, 0);
        e.alive = true; e.hp = e.maxHP; e.home.copy(e.mesh.position); e.path = []; e.pathGoal = null; e.coverGoal = null; e.repathAt = e.coverUntil = e.coverCooldown = e.staggerUntil = e.windup = 0; e.spottedUntil = e.shotFlashUntil = 0; e.visible = false;
      } else e = actor(...p, true, enemies.length);
      e.reinforcement = true; e.alertUntil = time + 120; e.lastKnown.copy(terminal.position); e.state = 'chase'; e.cooldown = 1.5;
    });
    reinforcementsSpawned = true; say(`庭院增援已抵达 · 利用侧路与掩体返回撤离点。`, 4); audio('warning');
  }
  function updateObjects(dt) {
    if (carrying) { carrying.mesh.position.copy(eye).addScaledVector(direction, 1.45); carrying.mesh.position.y -= .45; carrying.mesh.rotation.y = yaw; }
    // A gently dropped object falls onto the actual surface below it. It does
    // not teleport to the floor or turn into an explosive thrown projectile.
    for (const o of objects) if (o.alive && o.falling && o !== carrying) {
      const oldY = o.mesh.position.y; o.v.y -= gravity * dt; let nextY = oldY + o.v.y * dt, floor = 0;
      for (const b of bodySolids(o)) if (footprintOverlaps(o.mesh.position, b, o.radius) && oldY >= b.max.y - collisionEpsilon && nextY <= b.max.y) floor = Math.max(floor, b.max.y);
      if (nextY <= floor) { nextY = floor; o.v.y = 0; o.falling = false; audio('impact'); }
      o.mesh.position.y = nextY;
    }
    for (const o of objects) if (o.alive && o.flying) {
      const old = o.mesh.position.clone().add(V(0, .4, 0)); o.v.y -= 18 * dt; const next = old.clone().addScaledVector(o.v, dt), move = next.clone().sub(old), len = move.length();
      const hit = raycast(old, move.clone().normalize(), len + o.radius, { ignore: o }); o.mesh.position.addScaledVector(o.v, dt); o.mesh.rotation.x += dt * 5;
      if (hit || o.mesh.position.y <= 0) { if (hit) o.mesh.position.copy(hit.point).addScaledVector(hit.normal, .1); o.mesh.position.y = Math.max(0, o.mesh.position.y); o.flying = false;
        const center = o.mesh.position.clone().add(V(0, .6, 0));
        for (const e of enemies) if (e.alive && e.mesh.position.distanceTo(o.mesh.position) < 3.3 && visible(center, e.mesh.position.clone().add(V(0, 1, 0)), o)) damage(e, 90);
        damage(o, 999); audio('impact');
      }
    }
    for (const p of pickups) if (p.alive) {
      p.mesh.position.y = .3 + Math.sin(time * 2 + p.phase) * .07; p.mesh.rotation.y += dt * .5;
      if (!dead && p.mesh.position.distanceTo(player.position) < 1.3 && visible(eye, p.mesh.position.clone().add(V(0, .15, 0)))) { p.alive = false; p.mesh.visible = false; if (p.kind === 'health') { health = Math.min(maxHealth, health + 28); shield = Math.min(maxShield, shield + 10); } else { reserve[0] = Math.min(300, reserve[0] + 24); reserve[1] = Math.min(64, reserve[1] + 5); } score += 10; audio('pickup'); }
    }
  }
  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.v.y -= 12 * dt; p.mesh.position.addScaledVector(p.v, dt); p.mesh.rotation.x += dt * 8;
      if (p.mesh.position.y < .03) { p.mesh.position.y = .03; p.v.y = Math.abs(p.v.y) * .25; p.v.x *= .8; p.v.z *= .8; } if (p.life <= 0) { root.remove(p.mesh); particles.splice(i, 1); } }
    for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; if (t.life <= 0) { root.remove(t.mesh); tracers.splice(i, 1); } }
    for (let i = impacts.length - 1; i >= 0; i--) { const t = impacts[i]; t.life -= dt; if (t.life <= 0) { root.remove(t.mesh); t.mesh.geometry.dispose(); resources.delete(t.mesh.geometry); impacts.splice(i, 1); } }
  }
  function updateCamera(dt, input) {
    const silent = reduced || input.reduced, profile = sightProfiles[weapon];
    muzzleFlash.position.copy(profile.muzzle); muzzleGlow.position.copy(muzzleFlash.position);
    aimBlend = THREE.MathUtils.damp(aimBlend, aiming ? 1 : 0, aiming ? 16 : 19, dt);
    if (Math.abs(aimBlend - (aiming ? 1 : 0)) < .0001) aimBlend = aiming ? 1 : 0;
    const freeMotion = (1 - aimBlend) * (1 - aimBlend);
    camera.position.copy(eye); if (!silent && grounded && !dead) camera.position.y += Math.sin(bob * 2) * .023 * Math.min(1, movedDistance * 50) * freeMotion;
    camera.rotation.set(pitch + recoilKick, yaw, dead ? -.22 : !silent && time - hurtAt < .16 ? Math.sin((time - hurtAt) * 60) * .009 : 0, 'YXZ');
    const nextFov = THREE.MathUtils.damp(camera.fov, dead ? 76 : 76 + aimBlend * (profile.fov - 76) + (sprinting ? 5 : 0), 12, Math.max(dt, .016));
    if (Math.abs(nextFov - camera.fov) > .005) { camera.fov = nextFov; camera.updateProjectionMatrix(); }
    view.position.copy(camera.position); view.quaternion.copy(camera.quaternion); view.visible = !dead && !completed && !carrying;
    const reloadProgress = reloadTime > 0 ? 1 - reloadTime / reloadDuration : 0, reloadDip = reloadTime > 0 ? Math.sin(Math.PI * reloadProgress) : 0;
    const motion = silent ? 0 : Math.min(1, movedDistance * 40) * freeMotion, swayX = Math.sin(bob) * .012 * motion, swayY = Math.cos(bob * 2) * .008 * motion;
    rig.position.copy(profile.hip).lerp(V(0, -profile.height, profile.adsZ), aimBlend);
    rig.position.x += swayX; rig.position.y += swayY - reloadDip * .17; rig.position.z += recoil * .38;
    rig.rotation.set(recoil * 1.4 * (1 - aimBlend) + reloadDip * .65, reloadDip * -.24, reloadDip * -.46 + (sprinting ? -.17 : 0));
    for (let i = 0; i < weaponModels.length; i++) { const g = weaponModels[i]; g.visible = i === weapon; const arm = g.userData.leftArm; if (arm) { arm.position.y = -.09 - reloadDip * .19; arm.position.z = g.userData.leftArmZ + reloadDip * .28; } const magazine = g.userData.magazine; if (magazine) magazine.position.y = -.155 - reloadDip * .18; const slide = g.userData.slide; if (slide) { slide.position.copy(g.userData.slideBase); slide.position.z += Math.min(.016, recoil * .45); } const externalMagazine = g.userData.externalMagazine; if (externalMagazine) { externalMagazine.position.copy(g.userData.magazineBase); externalMagazine.position.y -= reloadDip * .055; } }
    muzzleFlash.visible = flashTime > 0; muzzleFlash.rotation.z = shotCount * 1.71; muzzleGlow.intensity = flashTime > 0 && !silent ? 2.8 : 0;
    view.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const muzzle = muzzleFlash.getWorldPosition(V()), segment = muzzle.clone().sub(eye), length = segment.length();
    muzzleBlocked = !!raycast(eye, segment.divideScalar(length || 1), length, { actors: false });
  }
  function update(dt, input = {}) {
    if (disposed || dead || completed) return; dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05); time += dt;
    const keys = input.keys || new Set(), has = (...names) => names.some(k => keys.has(k)), edge = (...names) => names.some(k => keys.has(k) && !prevKeys.has(k));
    shotCooldown = Math.max(0, shotCooldown - dt); recoil = Math.max(0, recoil - dt * .42); recoilKick = THREE.MathUtils.damp(recoilKick, 0, 12, dt); flashTime = Math.max(0, flashTime - dt);
    if (reloadTime > 0) { reloadTime = Math.max(0, reloadTime - dt); if (reloadTime === 0) { const amount = Math.min(weapons[weapon].maxAmmo - ammo[weapon], reserve[weapon]); ammo[weapon] += amount; reserve[weapon] -= amount; audio('reloadEnd'); } }
    movedDistance = 0;
    if (!dead) {
      // Deltas are normalized viewport deltas from the host. Positive Y is up.
      aiming = !!(heldAim || input.pointerRightDown && !input.touchLook || has('KeyZ', 'z')) && !reloadTime && !carrying && !completed;
      const canLook = input.pointerLocked || input.lookActive || input.pointerDragging || input.touchLook || input.pointerDown || input.pointerRightDown;
      if (canLook) { const sensitivity = 2.15 * (1 - aimBlend * .48); yaw -= clamp(Number(input.pointerDeltaX) || 0, -.5, .5) * sensitivity; pitch = clamp(pitch + clamp(Number(input.pointerDeltaY) || 0, -.5, .5) * sensitivity, -1.35, 1.35); }
      if (edge('Space', ' ')) jump(); if (edge('KeyR', 'r', 'R')) startReload(); if (edge('KeyE', 'e', 'E', 'KeyF', 'f', 'F')) interact(); if (edge('KeyQ', 'q', 'Q')) drop(true);
      if (edge('Digit1', '1')) switchWeapon(0); if (edge('Digit2', '2')) switchWeapon(1);
      const forward = (has('KeyW', 'w', 'ArrowUp') ? 1 : 0) - (has('KeyS', 's', 'ArrowDown') ? 1 : 0), strafe = (has('KeyD', 'd', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'a', 'ArrowLeft') ? 1 : 0);
      sprinting = has('ShiftLeft', 'ShiftRight', 'Shift') && forward > 0 && !aiming && !reloadTime && !carrying && !input.pointerDown && !heldFire;
      let dx = -Math.sin(yaw) * forward + Math.cos(yaw) * strafe, dz = -Math.cos(yaw) * forward - Math.sin(yaw) * strafe; const length = Math.hypot(dx, dz); if (length) { dx /= length; dz /= length; }
      movedDistance = movePlayer(dx, dz, dt, carrying ? 3 : aiming ? 2.8 : sprinting ? 7.2 : 4.5);
      footsteps += movedDistance; bob += movedDistance * 2.3; if (grounded && footsteps > (sprinting ? 2.05 : 1.7)) { footsteps = 0; audio('footstep', { indoor: player.position.z < 8 }); }
      updateAim(); updateCamera(dt, input);
      if (input.pointerDown && !input.touchLook || heldFire || has('KeyI', 'i')) fire();
      // No passive shield regeneration; H-01 repair has a visible cooldown.
    } else { aiming = false; sprinting = false; updateAim(); updateCamera(dt, input); }
    prevKeys = new Set(keys); updateMission(); updateObjects(dt); updateReinforcements(); updateEnemies(dt); updateAllies(dt); updateEffects(dt);
    const ctx = context(); contextHalo.visible = !!ctx && ctx.type !== 'drop'; if (contextHalo.visible) { contextHalo.position.copy(ctx.entity.mesh.position); contextHalo.position.y = .045; }
  }
  function action(name, payload) {
    if (disposed) return;
    switch (name) {
      case 'fire': if (typeof payload === 'boolean') { heldFire = payload; if (!payload) return; } return fire();
      case 'attack': case 'skill': return fire();
      case 'click': return false; // Host pointerDown owns firing; pointer-up must never fire a second round.
      case 'reload': return startReload();
      case 'jump': return jump();
      case 'pickup': case 'interact': case 'grab': case 'carry': case 'repair': return interact();
      case 'drop': return drop(false); case 'throw': return drop(true);
      case 'weapon': case 'switchWeapon': return switchWeapon(typeof payload === 'number' ? payload - 1 : undefined);
      case 'weapon1': return switchWeapon(0); case 'weapon2': return switchWeapon(1);
      case 'aim': heldAim = !!payload && !dead && !completed; aiming = heldAim && !reloadTime && !carrying; return;
      case 'reduced': reduced = !!payload; return;
      case 'clearInput': case 'cancel': case 'stop': heldFire = false; heldAim = false; aiming = false; sprinting = false; prevKeys.clear(); return;
      case 'retryCheckpoint': return retryCheckpoint();
      // Restart is performed by the host by disposing/recreating this provider.
      // A partial player-only reset would preserve defeated enemies and corrupt mission state.
      case 'reset': case 'restart': return { restartRequired: true };
    }
  }
  function getState() {
    const rescued = allies.filter(a => a.rescued && !a.isGuide).length, allRescued = rescued >= 2, ctx = context();
    const aliveEnemies = enemies.filter(e => e.alive), wavePending = terminalOn && !reinforcementsSpawned;
    const nextEnemy = [...aliveEnemies].sort((a, b) => distance(a) - distance(b))[0];
    const goal = completed ? null : stage === 0 ? entryGoal : stage === 1 || stage === 2 && carrying !== missionCell ? missionCell.mesh : stage === 2 ? terminal : stage === 3 ? jammer.mesh : extract;
    const objective = completed ? `难度 ${difficulty} · ${tier.name} 已完成` : stageTexts[stage] + (wavePending ? ` · 庭院增援 ${Math.max(0, Math.ceil(reinforcementsAt - time))}s` : '');
    const crosshair = raycast(eye, direction, weapons[weapon].range); const target = crosshair?.entity;
    return {
      retryGrace: Math.max(0, retryGraceUntil - time), freeExploreAvailable: false, stage, stageName: stageNames[stage], objectiveText: objective, checkpointAvailable: !!checkpoint, checkpointStage, checkpointVersion: 1, missionRecoveries, elapsed: time, damageTaken: Math.round(totalDamageTaken),
      supportHealthRestored: support.healthRestored, missionCoreInstalled: terminalOn, jammerDestroyed: !jammer.alive,
      difficulty, difficultyName: tier.name, maxDifficulty: 3, nextDifficultyAvailable: completed && difficulty < 3, enemyTotal,
      reinforcementsPending: wavePending, reinforcementsRemaining: reinforcementsSpawned ? 0 : tier.reinforcements,
      reinforcementsIn: wavePending ? Math.max(0, Math.ceil(reinforcementsAt - time)) : null,
      supportShots: support.shots, supportDamage: support.damage, supportKills: support.kills, supportShieldRestored: Math.round(support.shieldRestored), supportScans: support.scans,
      allies: allies.map(a => ({ id: a.id, name: a.name, role: a.isGuide ? '医疗 / 护盾 / 侦察' : '火力支援', rescued: a.rescued, state: allyState(a), shots: a.stats.shots, damage: a.stats.damage, kills: a.stats.kills, shieldRestored: Math.round(a.stats.shieldRestored), cooldown: a.isGuide ? Math.max(0, Math.ceil(a.patchAt - time)) : Math.max(0, a.cooldown) })),
      world: 'robot', instruction: completed ? '行动完成 · 在结果菜单选择重玩、下一难度或返回页面' : '鼠标瞄准 · WASD 移动 · Shift 奔跑 · Space 跳上桌台 / 掩体 · 左键射击 · 按住右键 / Z 举枪瞄准，松开收枪 · R 换弹 · E 互动 · Q 投掷 · 1/2 换枪',
      statusText: dead || completed || time < feedbackUntil ? feedback : ctx?.prompt || objective, contextPrompt: ctx?.prompt || '',
      score, health: Math.ceil(health), maxHealth, enemyMaxHealth: tier.hp, shield: Math.ceil(shield), maxShield, shieldBroken: shield === 0 && time - hurtAt < .9, energy: Math.ceil(shield / maxShield * 100),
      weaponIndex: weapon + 1, weapon: weapons[weapon].name, weapons: weapons.map(w => w.name), ammo: ammo[weapon], maxAmmo: weapons[weapon].maxAmmo,
      reserve: reserve[weapon], reserveAmmo: reserve[weapon], reloading: reloadTime > 0, reloadProgress: reloadTime > 0 ? 1 - reloadTime / reloadDuration : 0,
      aiming, aimBlend, aimReady: aiming && aimBlend > .96, aimMagnification: Math.tan(THREE.MathUtils.degToRad(76 / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), aimLabel: aiming ? (muzzleBlocked ? '枪口受阻 · 离开掩体边缘' : aimBlend > .96 ? '机械瞄具 · 松开右键 / Z 收枪' : '正在举枪瞄准') : '按住右键 / Z 举枪瞄准', muzzleBlocked, sprinting, dead, completed, mission: objective, objective: goal ? { x: goal.position.x, z: goal.position.z, distance: Math.round(player.position.distanceTo(goal.position)) } : null,
      objectiveDistance: goal ? Math.round(player.position.distanceTo(goal.position)) : 0, rescued, relays: terminalOn ? 1 : 0, terminalOn,
      friendlies: allies.filter(a => a.rescued).length, enemies: enemies.filter(e => e.alive).length, objects: objects.filter(o => o.alive).length,
      carrying: carrying === missionCell ? '信号核心' : carrying?.kind || null, grounded, verticalSpeed: vertical, position: { x: player.position.x, y: player.position.y, z: player.position.z }, yaw, pitch,
      reticle: dead || completed || carrying ? 'hidden' : reloadTime > 0 ? 'reload' : aiming ? 'ads' : 'crosshair',
      reticleSpread: aiming ? 2 : 8 + recoil * 110 + Math.min(7, movedDistance * 160), hitIndicator: time < killUntil ? 'kill' : time < hitUntil ? 'hit' : null,
      hit: time < hitUntil, kill: time < killUntil, hurt: time - hurtAt < .36, damageDirection: time - hurtAt < .9 ? hurtDirection : null,
      targetName: target === jammer ? '干扰装置' : target === missionCell ? '信号核心' : target?.name || null,
      targetHealth: target?.alive && (target.kind === 'enemy' || target === jammer) ? Math.ceil(target.hp) : null, targetMaxHealth: target?.alive && (target.kind === 'enemy' || target === jammer) ? target.maxHP : null, targetHostile: target?.kind === 'enemy' && target.alive,
      controls: ['fire', 'aim', 'reload', 'jump', 'interact', 'throw', 'weapon'], shotCount, reloadCount, enemyStates: enemies.map(e => e.state),
    };
  }
  function captureState() {
    const entityState = entity => {
      const data = { position: entity.mesh.position.toArray(), rotation: entity.mesh.rotation.toArray(), meshVisible: entity.mesh.visible, values: {}, vectors: {} };
      for (const [key, value] of Object.entries(entity)) {
        if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' || typeof value === 'string') data.values[key] = value;
        else if (value?.isVector3) data.vectors[key] = value.toArray();
      }
      if (entity.stats) data.stats = { ...entity.stats };
      return data;
    };
    return { version: 1, world: 'robot', difficulty, randomSeed, time, stage, health, shield, score, weapon,
      ammo: [...ammo], reserve: [...reserve], yaw, pitch, vertical, grounded, dead, completed, terminalOn,
      reinforcementsAt: Number.isFinite(reinforcementsAt) ? reinforcementsAt : null, reinforcementsSpawned,
      shotCount, reloadCount, missionRecoveries, totalDamageTaken, support: { ...support },
      player: player.position.toArray(), carryingIndex: objects.indexOf(carrying),
      objects: objects.map(entityState), enemies: enemies.map(entityState), allies: allies.map(entityState),
      pickups: pickups.map(p => ({ position: p.mesh.position.toArray(), kind: p.kind, alive: p.alive, phase: p.phase })) };
  }
  function snapshot() { return { ...captureState(), checkpoint: checkpoint ? JSON.parse(JSON.stringify(checkpoint)) : null, checkpointStage }; }
  function saveCheckpoint() { if (!dead && !completed) { checkpointStage = stage; checkpoint = captureState(); } }
  function advanceStage(next) {
    if (next <= stage) return;
    stage = next; saveCheckpoint(); audio('mission');
  }
  function updateMission() {
    if (stage === 0 && player.position.z < 10) { advanceStage(1); say(stageTexts[1], 6); }
    if (missionCell.alive && missionCell !== carrying) {
      const p = missionCell.mesh.position;
      if (![p.x, p.y, p.z].every(Number.isFinite) || p.y < -.2 || p.y > 3.2 || bodyBlocked(p.x, p.z, p.y, missionCell.radius, missionCell)) {
        missionCell.mesh.position.copy(missionCell.safe); missionCell.mesh.rotation.set(0, 0, 0); missionCell.v.set(0, 0, 0); missionCell.flying = missionCell.falling = false;
        missionRecoveries++; say('信号核心已回收到设备间安全标记处。', 4);
      }
    }
    if (coreLabel) { coreLabel.visible = !terminalOn; coreLabel.lookAt(camera.position); }
    if (jammerLabel) { jammerLabel.visible = jammer.alive; jammerLabel.lookAt(camera.position); jammerLabel.userData.setText(terminalOn ? '射击此装置 · 解除封锁' : '干扰装置 · 先安装信号核心'); }
    if (extractionWarning) extractionWarning.visible = terminalOn && !reinforcementsSpawned;
  }
  function restore(saved) {
    // Reject malformed or mismatched versions before touching a live session.
    const finiteVector = p => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite);
    if (!saved || saved.version !== 1 || saved.world !== 'robot' || saved.difficulty !== difficulty || !Number.isInteger(saved.stage) || saved.stage < 0 || saved.stage > 4 || !finiteVector(saved.player) || !Number.isFinite(saved.time) || !['health', 'shield', 'score', 'yaw', 'pitch', 'vertical', 'randomSeed', 'shotCount', 'reloadCount', 'missionRecoveries', 'totalDamageTaken'].every(k => Number.isFinite(saved[k])) || !Array.isArray(saved.objects) || saved.objects.length !== objects.length || !Array.isArray(saved.enemies) || saved.enemies.length < tier.initial || saved.enemies.length > enemyTotal || !Array.isArray(saved.allies) || saved.allies.length !== allies.length || !Array.isArray(saved.pickups) || saved.pickups.length > 100 || !saved.pickups.every(p => p && finiteVector(p.position) && ['ammo', 'health'].includes(p.kind) && Number.isFinite(p.phase)) || ![saved.ammo, saved.reserve].every(a => Array.isArray(a) && a.length === 2 && a.every(n => Number.isFinite(n) && n >= 0)) || ![...saved.objects, ...saved.enemies, ...saved.allies].every(e => e && finiteVector(e.position) && Array.isArray(e.rotation) && e.rotation.length === 4 && e.rotation.slice(0, 3).every(Number.isFinite) && e.rotation[3] === 'XYZ' && e.values && e.vectors && Object.values(e.vectors).every(finiteVector) && Object.values(e.values).every(v => typeof v !== 'number' || Number.isFinite(v)))) return false;
    const applyEntity = (entity, data) => {
      // Clear optional tactical transients that did not exist at this checkpoint.
      for (const key of ['spottedUntil', 'shotFlashUntil', 'patchUntil', 'scanUntil', 'attackReadyAt', 'patrolAt', 'stuckFor']) if (!(key in data.values)) entity[key] = 0;
      // Restore only pre-existing scalar/vector fields, never object references.
      for (const [key, value] of Object.entries(data.values)) if (Object.hasOwn(entity, key) && ['number', 'boolean', 'string'].includes(typeof entity[key]) && typeof value === typeof entity[key]) entity[key] = value;
      for (const [key, value] of Object.entries(data.vectors)) if (entity[key]?.isVector3) entity[key].fromArray(value); else if (['coverGoal', 'patrolGoal', 'pathGoal'].includes(key)) entity[key] = V().fromArray(value);
      entity.mesh.position.fromArray(data.position); entity.mesh.rotation.fromArray(data.rotation); entity.mesh.visible = data.meshVisible;
      if (entity.stats && data.stats) Object.assign(entity.stats, data.stats);
      if (entity.path) { entity.path = []; entity.pathGoal = null; entity.repathAt = 0; }
      if (entity.charge) entity.charge.visible = false;
    };
    while (enemies.length < saved.enemies.length) { if (retiredEnemies.length) { const e = retiredEnemies.pop(); root.add(e.mesh); enemies.push(e); } else actor(0, 12, true, enemies.length); }
    while (enemies.length > saved.enemies.length) { const e = enemies.pop(); root.remove(e.mesh); retiredEnemies.push(e); }
    objects.forEach((e, i) => applyEntity(e, saved.objects[i])); enemies.forEach((e, i) => applyEntity(e, saved.enemies[i])); allies.forEach((e, i) => applyEntity(e, saved.allies[i]));
    for (const list of [particles, tracers, impacts, pickups]) { for (const item of list) { root.remove(item.mesh); if (list === impacts) { item.mesh.geometry.dispose(); resources.delete(item.mesh.geometry); } } list.length = 0; }
    saved.pickups.forEach(p => { pickupAt(V().fromArray(p.position), p.kind); const item = pickups[pickups.length - 1]; item.alive = p.alive; item.phase = p.phase; item.mesh.visible = p.alive; });
    time = saved.time; stage = saved.stage; health = clamp(saved.health, 0, maxHealth); shield = clamp(saved.shield, 0, maxShield); score = saved.score; weapon = saved.weapon === 1 ? 1 : 0;
    ammo = [...saved.ammo]; reserve = [...saved.reserve]; yaw = saved.yaw; pitch = saved.pitch; vertical = saved.vertical; grounded = saved.grounded;
    dead = saved.dead; completed = saved.completed; terminalOn = saved.terminalOn; reinforcementsAt = saved.reinforcementsAt ?? Infinity; reinforcementsSpawned = saved.reinforcementsSpawned;
    shotCount = saved.shotCount; reloadCount = saved.reloadCount; missionRecoveries = saved.missionRecoveries; totalDamageTaken = saved.totalDamageTaken; Object.assign(support, saved.support);
    player.position.fromArray(saved.player); carrying = objects[saved.carryingIndex] || null; randomSeed = saved.randomSeed;
    terminalScreen.material = terminalOn ? mat.mint : mat.blue;
    reloadTime = reloadDuration = shotCooldown = recoil = recoilKick = aimBlend = flashTime = 0; hurtAt = noiseAt = -100; hitUntil = killUntil = 0;
    action('clearInput'); guidePulse.visible = false; retryGraceUntil = -100;
    if (saved.checkpoint && saved.checkpoint.version === 1 && saved.checkpoint.difficulty === difficulty) { checkpoint = JSON.parse(JSON.stringify(saved.checkpoint)); checkpointStage = saved.checkpointStage; }
    updateAim(); updateCamera(.016, {}); root.updateMatrixWorld(true);
    feedback = completed ? '行动完成 · 可重玩或挑战下一难度' : dead ? '行动失败 · 可重试检查点' : `已恢复：${stageNames[stage]}`; feedbackUntil = time + 3;
    return true;
  }
  function retryCheckpoint() {
    if (!checkpoint || disposed) return false;
    const saved = JSON.parse(JSON.stringify(checkpoint));
    if (!restore(saved)) return false;
    retryGraceUntil = time + 1.25;
    say(`从「${stageNames[stage]}」检查点继续 · 短暂安全接管。`, 4); return true;
  }

  function resize(w, h) { viewWidth = Math.max(1, w); viewHeight = Math.max(1, h); camera.aspect = viewWidth / viewHeight; camera.updateProjectionMatrix(); }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const item of borrowed) {
      item.parent.remove(item.object);
      if (item.restore) { item.object.position.copy(item.restore.position); item.object.quaternion.copy(item.restore.quaternion); item.object.scale.copy(item.restore.scale); item.object.visible = item.restore.visible; }
    }
    root.removeFromParent(); view.removeFromParent(); resources.forEach(resource => resource.dispose?.()); resources.clear();
    scene.background = prior.background; scene.fog = prior.fog; scene.environmentIntensity = prior.environmentIntensity;
    for (const [light, visible] of prior.lights) light.visible = visible;
    walls.length = objects.length = enemies.length = retiredEnemies.length = allies.length = particles.length = tracers.length = impacts.length = pickups.length = 0;
  }
  camera.near = .045; camera.far = 135; camera.fov = 76; camera.rotation.order = 'YXZ'; camera.updateProjectionMatrix();
  resize(width, height); updateAim(); updateCamera(.016, {}); root.updateMatrixWorld(true);
  saveCheckpoint();
  return { update, action, getState, resize, dispose, snapshot, restore, retryCheckpoint, resetInput: () => action('clearInput') };
}
