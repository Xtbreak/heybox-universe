import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// Scroll gallery and three continuous, pointer-playable worlds. Real licensed GLB assets stay in the same renderer.
export async function createWorld(canvas, { onReady, onError, onState } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { onError?.(error); throw error; }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030609');
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 80);
  const resources = new Set(), keep = value => (resources.add(value), value);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .035);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xcbdbe6, 0x101721, 1.7));
  for (const [color, intensity, position] of [[0xf3f7ff, 4.8, [-4, 7, 5]], [0x98bfd6, 3.6, [5, 3, -4]], [0xffffff, 1.1, [1, -1, 6]]]) {
    const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
  }
  const gallery = new THREE.Group(); scene.add(gallery);
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0x111a22, metalness: .88, roughness: .27 }));
  const rim = keep(new THREE.MeshStandardMaterial({ color: 0x738693, metalness: .91, roughness: .24 }));
  const luminous = keep(new THREE.MeshBasicMaterial({ color: 0x9acfe7, transparent: true, opacity: .62, depthWrite: false }));
  const dim = keep(new THREE.MeshBasicMaterial({ color: 0x537184, transparent: true, opacity: .28, depthWrite: false }));
  const addMesh = (geometry, material, parent = gallery) => { const m = new THREE.Mesh(keep(geometry), material); parent.add(m); return m; };
  const platform = addMesh(new THREE.CylinderGeometry(2.64, 2.68, .16, 112), metal); platform.position.y = -1.7;
  const platformEdge = addMesh(new THREE.TorusGeometry(2.65, .011, 6, 160), rim); platformEdge.rotation.x = Math.PI / 2; platformEdge.position.y = -1.615;
  const orbit = addMesh(new THREE.TorusGeometry(2.97, .008, 5, 160), dim); orbit.rotation.x = Math.PI / 2; orbit.position.y = -1.69;
  const ticks = new THREE.Group(); gallery.add(ticks);
  const tickGeometry = keep(new THREE.BoxGeometry(.009, .007, .075));
  for (let i = 0; i < 96; i++) {
    const angle = i / 96 * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeometry, i % 8 === 0 ? luminous : dim);
    tick.position.set(Math.sin(angle) * 2.83, -1.68, Math.cos(angle) * 2.83); tick.rotation.y = angle;
    if (i % 8 === 0) tick.scale.z = 2; ticks.add(tick);
  }
  const glowPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4, a = Math.pow(Math.max(0, 1 - Math.hypot(x - 31.5, y - 31.5) / 32), 3);
    glowPixels.set([134, 191, 222, Math.round(a * 255)], i);
  }
  const glowMap = keep(new THREE.DataTexture(glowPixels, 64, 64)); glowMap.needsUpdate = true;
  const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowMap, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false })));
  glow.scale.set(8, 5, 1); glow.position.set(0, .2, -2); gallery.add(glow);
  function makeLabel(text, width = 3.4) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    const context = c.getContext('2d'); context.fillStyle = '#96b0c2'; context.font = '500 30px ui-monospace, monospace'; context.textAlign = 'center'; context.fillText(text, 512, 72);
    const map = keep(new THREE.CanvasTexture(c)); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false })));
    sprite.scale.set(width, width / 8, 1); return sprite;
  }
  const pending = makeLabel('正在载入模型', 2.5); pending.position.set(0, .15, 0); gallery.add(pending);
  const scan = new THREE.Group(); gallery.add(scan); scan.visible = false;
  const scanRing = addMesh(new THREE.TorusGeometry(1.85, .009, 5, 100), luminous, scan); scanRing.rotation.x = Math.PI / 2;
  const scanWire = addMesh(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.9, 3.3, 2.55)), dim, scan);
  // EdgesGeometry needs LineSegments, not a mesh.
  scan.remove(scanWire); const scanBox = new THREE.LineSegments(scanWire.geometry, keep(new THREE.LineBasicMaterial({ color: 0x8dbdd4, transparent: true, opacity: .18 }))); scan.add(scanBox);
  const scanText = makeLabel('表面扫描  /  材质档案', 3.8); scanText.position.set(0, 2.08, 0); scan.add(scanText);
  const track = new THREE.Group(); gallery.add(track); track.position.y = -1.605;
  const road = addMesh(new THREE.RingGeometry(1.53, 2.20, 128), keep(new THREE.MeshStandardMaterial({ color: 0x202c35, roughness: .66, metalness: .38, side: THREE.DoubleSide })), track);
  road.rotation.x = -Math.PI / 2; road.scale.y = .64;
  for (const radius of [1.53, 2.20]) { const rail = addMesh(new THREE.TorusGeometry(radius, .012, 5, 128), luminous, track); rail.rotation.x = Math.PI / 2; rail.scale.y = .64; }
  const dashGeometry = keep(new THREE.BoxGeometry(.08, .006, .011));
  for (let i = 0; i < 56; i++) { const a = i / 56 * Math.PI * 2; const dash = new THREE.Mesh(dashGeometry, dim); dash.position.set(Math.cos(a) * 1.865, .008, Math.sin(a) * 1.865 * .64); dash.rotation.y = -Math.atan2(.64 * Math.cos(a), -Math.sin(a)); track.add(dash); }
  const portal = new THREE.Group(); gallery.add(portal); portal.position.set(0, .15, -1.75);
  const portalBand = addMesh(new THREE.TorusGeometry(2.32, .037, 10, 144), rim, portal);
  addMesh(new THREE.TorusGeometry(2.39, .008, 5, 144), dim, portal);
  const portalAccent = addMesh(new THREE.TorusGeometry(2.32, .012, 6, 72, Math.PI * .46), luminous, portal); portalAccent.position.z = .039;
  const names = ['helmet', 'robot', 'car'];
  const files = { helmet: 'DamagedHelmet.glb', robot: 'RobotExpressive.glb', car: 'ToyCar.glb' };
  const entries = {};
  for (const name of names) { const group = new THREE.Group(); gallery.add(group); entries[name] = { group, object: null, state: 'idle', clips: [], mixer: null, action: null }; }
  const loader = new GLTFLoader();
  let disposed = false, ready = false, frame = 0, progress = 0, targetProgress = 0, paused = false, reduced = false;
  let width = 1, height = 1, last = performance.now(), time = 0, world = 'helmet', selected = null;
  let pointerX = 0, pointerY = 0, hover = false, down = null, helmetYaw = -.36, helmetPitch = .06;
  let scanUntil = 0, robotIndex = -1, robotReturn = 0, carAngle = -.9, lane = 0, laneTarget = 0, turboUntil = 0, collisionUntil = 0, lap = 0;
  let mode = 'showcase', travelStart = 0, travelReady = false, savedProgress = 0, savedTarget = 0;
  let game = null, modelSnapshot = null, savedSelection = null;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const travelCamera = new THREE.Vector3(), travelFocus = new THREE.Vector3();
  const instructions = { helmet: '点击头盔，进入轨道防线', robot: '点击机器人，进入机械花园', car: '点击跑车，进入银色公路' };
  const gameInstructions = { helmet: '移动瞄准 · 点击 / 轻触发射 · 守住轨道防线', robot: '点击地面，自由行走 · 点亮三处花园信标', car: '左右移动转向 · 点击 / 轻触加速 · 避开障碍' };
  function emit(statusText) {
    if (disposed) return;
    const entry = entries[world];
    onState?.({ mode, world, instruction: mode === 'game' ? gameInstructions[world] : mode === 'travel' ? '正在穿越 · 随时可以返回' : instructions[world], modelStatus: entry.state,
      statusText: statusText || (mode === 'game' ? game?.status || '' : entry.state === 'error' ? '模型加载未完成 · 点击重试' : entry.state !== 'loaded' ? '正在载入真实 3D 模型' : mode === 'travel' ? '正在进入世界' : '真实模型 · 点击进入它的世界'),
      score: game?.score || 0, shield: game?.shield, speed: game?.speed, distance: game?.distance, complete: !!game?.complete });
  }
  function disposeModel(object) {
    const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
    object.traverse(node=>{
      if(node.geometry)geometries.add(node.geometry);
      if(node.skeleton)skeletons.add(node.skeleton);
      for(const material of (Array.isArray(node.material)?node.material:node.material?[node.material]:[])) {
        materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      }
    });
    skeletons.forEach(skeleton=>skeleton.dispose());
    geometries.forEach(geometry=>geometry.dispose());
    textures.forEach(texture=>{texture.dispose();texture.source?.data?.close?.();});
    materials.forEach(material=>material.dispose());
  }
  async function load(name, retry = false) {
    const entry = entries[name]; if (disposed || entry.state === 'loading' || entry.state === 'loaded' || (entry.state === 'error' && !retry)) return;
    entry.state = 'loading'; if (world === name) emit();
    try {
      const gltf = await loader.loadAsync(new URL(`./models/${files[name]}`, import.meta.url).href);
      if (disposed) { disposeModel(gltf.scene); return; }
      const object = gltf.scene;
      if (name === 'car') { const fabric = object.getObjectByName('Fabric'); if (fabric) { fabric.removeFromParent(); disposeModel(fabric); } }
      object.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const targetSize = name === 'helmet' ? 3.25 : name === 'robot' ? 3.45 : 3.25;
      const factor = targetSize / (name === 'car' ? Math.max(size.x, size.z, size.y) : size.y);
      // Preserve imported transforms inside a normalized wrapper, including animation tracks.
      const normalized = new THREE.Group(); normalized.scale.setScalar(factor);
      const offset = new THREE.Group(); offset.position.set(-center.x, -bounds.min.y, -center.z); offset.add(object); normalized.add(offset); entry.group.add(normalized);
      normalized.position.y = name === 'helmet' ? -1.43 : -1.605;
      object.traverse(node => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; for (const material of Array.isArray(node.material) ? node.material : [node.material]) { if (!material) continue; material.envMapIntensity = name === 'helmet' ? 1.6 : 1.2; } } });
      entry.object = normalized; entry.asset = object; entry.state = 'loaded'; entry.clips = gltf.animations;
      if (name === 'robot') {
        entry.mixer = new THREE.AnimationMixer(object); entry.head = object.getObjectByName('Head');
        playRobot('Idle', false);
      }
      if (name === 'car') normalized.rotation.y = Math.PI; // glTF sample car points toward -Z.
      if (world === name) emit();
    } catch (error) {
      if (disposed) return; entry.state = 'error'; entry.error = error;
      if (world === name) emit('模型加载未完成 · 点击重试');
      console.warn(`[model-gallery] ${name} failed to load`, error);
    }
  }
  function playRobot(name, once = true) {
    const entry = entries.robot, clip = entry.clips.find(clip => clip.name === name);
    if (!entry.mixer || !clip) return;
    const action = entry.mixer.clipAction(clip); if (entry.action === action && action.isRunning()) return;
    entry.action?.fadeOut(.25); action.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); action.clampWhenFinished = once; action.fadeIn(.25).play(); entry.action = action;
    robotReturn = once ? time + clip.duration + .15 : 0;
  }
  // Game resources are scoped to a visit. Model geometry belongs to the gallery.
  function gameMesh(geometry, material, parent = game.root) {
    game.resources.add(geometry); game.resources.add(material);
    const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
  }
  function gmat(color, glow = 0, roughness = .35) { return new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: glow ? 1.4 : 0, metalness: .72, roughness }); }
  function box(x,y,z,color,parent) { return gameMesh(new THREE.BoxGeometry(x,y,z),gmat(color),parent); }
  function label(text,x,y,z,size=2) {
    const sprite = makeLabel(text,size); sprite.position.set(x,y,z); game.root.add(sprite);
    // makeLabel uses the long-lived resource registry; transfer ownership to visit.
    for (const r of [sprite.material.map,sprite.material]) { resources.delete(r); game.resources.add(r); }
    return sprite;
  }
  function updateRay() { pointer.set(pointerX,pointerY); camera.updateMatrixWorld(true); raycaster.setFromCamera(pointer,camera); }
  function enter(id = world) {
    if (!names.includes(id) || disposed) return;
    if (mode !== 'showcase') exitGame();
    savedProgress = progress; savedTarget = targetProgress; savedSelection = selected;
    world = id; selected = id; mode = 'travel'; travelReady = false;
    down = null; canvas.style.touchAction = 'none'; canvas.style.cursor = 'wait';
    camera.updateMatrixWorld(true); entries[id].group.updateWorldMatrix(true,true);
    travelCamera.copy(camera.position); entries[id].group.getWorldPosition(travelFocus); travelFocus.y += .35;
    load(id, true); emit(entries[id].state === 'loaded' ? '正在进入世界' : '正在载入入口模型');
  }
  function restoreModel() {
    if (!modelSnapshot) return;
    const { object,parent,position,rotation,scale } = modelSnapshot;
    parent.add(object); object.position.copy(position); object.rotation.copy(rotation); object.scale.copy(scale); modelSnapshot = null;
  }
  function destroyGame() {
    restoreModel();
    if (!game) return;
    game.resources.forEach(r => r.dispose?.()); game.scene.clear(); game = null;
  }
  function exitGame() {
    if (mode === 'showcase') return;
    destroyGame(); mode = 'showcase'; travelReady = false; progress = savedProgress; targetProgress = savedTarget; selected = savedSelection;
    canvas.style.touchAction = 'pan-y'; canvas.style.cursor = originalCursor; down = null;
    entries.robot.group.rotation.y = 0; if (entries.robot.mixer) playRobot('Idle',false);
    emit('已返回展厅');
  }
  function restart() { if (mode !== 'game') return; destroyGame(); buildGame(); }
  function buildGame() {
    const root = new THREE.Group(), gameScene = new THREE.Scene(); gameScene.add(root);
    gameScene.background = new THREE.Color('#02070d'); gameScene.environment = environment.texture;
    gameScene.add(new THREE.HemisphereLight(0xb8def4,0x111526,2.3));
    for (const [color,intensity,x,y,z] of [[0xe4f6ff,4,-7,14,5],[0x69bde8,3,9,5,-9]]) { const light = new THREE.DirectionalLight(color,intensity); light.position.set(x,y,z); gameScene.add(light); }
    game = { scene: gameScene, root, resources:new Set(), score:0, age:0, lastEmit:0, status:'', shield:5, complete:false, effects:[], objects:[] };
    const object = entries[world].object;
    modelSnapshot = {object,parent:object.parent,position:object.position.clone(),rotation:object.rotation.clone(),scale:object.scale.clone()};
    const actor = new THREE.Group(); root.add(actor); actor.add(object); object.position.set(0,0,0); object.rotation.set(0,0,0); game.actor = actor;
    camera.fov = world === 'robot' ? 43 : 52; camera.far = 260; camera.updateProjectionMatrix();
    const starPositions = new Float32Array(450*3);
    for (let i=0;i<450;i++) { starPositions[i*3]=(Math.random()-.5)*170; starPositions[i*3+1]=Math.random()*70+9; starPositions[i*3+2]=-Math.random()*180; }
    const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
    const starsMaterial = new THREE.PointsMaterial({color:0xa8cee7,size:.11,sizeAttenuation:true}); game.resources.add(starsGeometry); game.resources.add(starsMaterial); root.add(new THREE.Points(starsGeometry,starsMaterial));
    if (world === 'helmet') buildDefense();
    if (world === 'robot') buildGarden();
    if (world === 'car') buildRoad();
    if (!ready) { ready = true; onReady?.(); }
    mode = 'game'; canvas.style.cursor = world === 'helmet' ? 'crosshair' : 'pointer'; canvas.style.touchAction = 'none'; emit();
  }
  function buildDefense() {
    camera.position.set(0,2,12); camera.lookAt(0,2,-35);
    const narrow = width/height < .85;
    game.actor.scale.setScalar(narrow ? .34 : .62); game.actor.position.set(narrow ? -.5 : -4.5,narrow ? -.65 : -1.8,5.4); game.actor.rotation.y=.3;
    const deck=box(16,.35,8,0x16202d); deck.position.set(0,-2.2,8);
    for(const x of [-6,6]) { const strut=box(.2,9,.3,0x6b8090); strut.position.set(x,1,5); strut.rotation.z=x>0?-.22:.22; }
    const planet=gameMesh(new THREE.SphereGeometry(22,48,32),gmat(0x102b43)); planet.position.set(38,-30,-100);
    const ring=gameMesh(new THREE.TorusGeometry(29,.06,6,128),gmat(0xa8ddf7,0x225570)); ring.position.copy(planet.position); ring.rotation.set(1.1,.4,.2);
    game.crosshair=new THREE.Group(); game.root.add(game.crosshair);
    for(const [x,y,w,h] of [[-.18,0,.13,.018],[.18,0,.13,.018],[0,.18,.018,.13],[0,-.18,.018,.13]]) { const m=gameMesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0xc5efff,depthTest:false}),game.crosshair); m.position.set(x,y,0); m.renderOrder=20; }
    game.enemies=[]; game.spawn=0; game.shotAt=-1; game.status='护盾 5 / 5 · 击落 0';
    for(let i=0;i<3;i++) spawnDrone(-30-i*15);
  }
  function spawnDrone(z=-78) {
    const drone=new THREE.Group(); game.root.add(drone); drone.position.set((Math.random()-.5)*21,(Math.random()-.5)*9+3,z);
    const body=gameMesh(new THREE.OctahedronGeometry(.72),gmat(0x6b91a9,0x142c40),drone);
    for(const x of [-1.05,1.05]) { const wing=box(1.1,.12,.55,0x8fabb9,drone); wing.position.x=x; }
    const eye=gameMesh(new THREE.SphereGeometry(.17,12,8),gmat(0xc0f5ff,0x67caff),drone); eye.position.z=.68;
    const target=gameMesh(new THREE.TorusGeometry(1.55,.022,5,32),new THREE.MeshBasicMaterial({color:0x77c9ee,transparent:true,opacity:.8}),drone); target.position.z=.1; target.userData.targetRing=true;
    drone.userData={hit:body,phase:Math.random()*6,baseX:drone.position.x,baseY:drone.position.y};
    drone.traverse(node=>{node.userData.drone=drone;}); game.enemies.push(drone);
  }
  function burst(position,color=0x9ee8ff) {
    const spark=gameMesh(new THREE.IcosahedronGeometry(.6,1),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:1})); spark.position.copy(position);
    game.effects.push({object:spark,life:.5,max:.5});
  }
  function discardObject(object) {
    object.removeFromParent(); object.traverse(node=>{if(node.geometry && game.resources.delete(node.geometry))node.geometry.dispose(); const mats=Array.isArray(node.material)?node.material:[node.material]; for(const m of mats)if(m && game.resources.delete(m))m.dispose();});
  }
  function shoot() {
    if(game.complete || game.age-game.shotAt<.14)return; game.shotAt=game.age; game.scene.updateMatrixWorld(true); updateRay();
    const hits=raycaster.intersectObjects(game.enemies,true).filter(hit=>!hit.object.userData.targetRing);
    const end=hits.length?hits[0].point:raycaster.ray.at(100,new THREE.Vector3());
    const start=new THREE.Vector3(.8,-1,6); const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const material=new THREE.LineBasicMaterial({color:0xbdefff,transparent:true,opacity:1}); game.resources.add(geometry); game.resources.add(material);
    const tracer=new THREE.Line(geometry,material); game.root.add(tracer); game.effects.push({object:tracer,life:.15,max:.15,tracer:true});
    if(hits.length) {const enemy=hits[0].object.userData.drone; burst(enemy.position); game.enemies.splice(game.enemies.indexOf(enemy),1); discardObject(enemy); game.score++;}
    game.status=`护盾 ${game.shield} / 5 · 击落 ${game.score}`; emit();
  }
  function buildGarden() {
    camera.position.set(12,15,18).multiplyScalar(width/height<.85?1.6:1); camera.lookAt(0,.3,0);
    game.actor.scale.setScalar(.64); game.actor.position.set(0,.13,3.3); playRobot('Idle',false);
    const floor=box(18,.65,15,0x1d2934); floor.position.y=-.32; game.ground=floor;
    const underside=box(17,.9,14,0x080e17); underside.position.y=-1.05;
    for(const x of [-8.4,8.4]) { const line=gameMesh(new THREE.BoxGeometry(.035,.03,14),gmat(0x92d9f1,0x23566f));line.position.set(x,.04,0); }
    for(let i=0;i<24;i++) { const x=(Math.random()-.5)*15,z=(Math.random()-.5)*12; if(Math.abs(x)<2.5)continue; const stem=gameMesh(new THREE.CylinderGeometry(.015,.025,.45,5),gmat(0x77a4b0));stem.position.set(x,.22,z); const leaf=gameMesh(new THREE.OctahedronGeometry(.18),gmat(0x92c9ce,0x16383b)); leaf.position.set(x,.53,z); }
    game.beacons=[]; game.target=null; game.bridges=[]; game.lastWalk=false;
    const positions=[[-5,0,-3.5],[4.8,0,-3],[3.7,0,4.6]];
    const words=['潮汐','星光','回声'];
    positions.forEach((p,i)=>{
      const beacon=new THREE.Group();beacon.position.set(...p);game.root.add(beacon); beacon.userData.beacon=i;
      const base=gameMesh(new THREE.CylinderGeometry(.85,1,.17,32),gmat(0x607785),beacon);base.position.y=.09;
      const column=gameMesh(new THREE.CylinderGeometry(.22,.4,1.5,8),gmat(0x324754),beacon);column.position.y=.86;
      const halo=gameMesh(new THREE.TorusGeometry(.65,.07,8,48),gmat(0x7aafca,0x163342),beacon);halo.position.y=1.65;halo.rotation.x=-Math.PI/2;
      const core=gameMesh(new THREE.SphereGeometry(.27,20,16),gmat(0xafddef,0x225477),beacon);core.position.y=1.8;
      beacon.traverse(node=>node.userData.beacon=i);
      game.beacons.push({group:beacon,halo,core,active:false});label(words[i],p[0],2.6,p[2],1.6);
      const bridge=box(2.7,.18,.9,0x6e909e);bridge.position.set(p[0]*.53,.1,p[2]*.53);bridge.rotation.y=-Math.atan2(p[2],p[0]);bridge.scale.x=.13;game.bridges.push(bridge);
    });
    const center=gameMesh(new THREE.CylinderGeometry(1.5,1.8,.3,48),gmat(0x354956));center.position.y=.13;
    game.bloom=new THREE.Group(); game.root.add(game.bloom);game.bloom.position.y=.3;game.bloom.scale.setScalar(.05);
    for(let i=0;i<7;i++){const ring=gameMesh(new THREE.TorusGeometry(.35+i*.17,.035,6,64),gmat(0xafe9ff,0x275f83),game.bloom);ring.position.y=i*.37;ring.rotation.x=Math.PI/2+i*.15;}
    label('机械花园',-4.6,.7,6.4,3);game.status='自由探索 · 已唤醒 0 / 3 座信标';
  }
  function gardenClick() {
    game.scene.updateMatrixWorld(true);updateRay();
    const hits=raycaster.intersectObjects(game.beacons.map(b=>b.group),true);
    if(hits.length){const index=hits[0].object.userData.beacon;const beacon=game.beacons[index];game.target=beacon.group.position.clone();const away=game.actor.position.clone().sub(game.target).setY(0).normalize();game.target.addScaledVector(away,1.15);game.target.y=.13;game.pendingBeacon=index;game.status=`正在前往${['潮汐','星光','回声'][index]}信标 · ${beacon.active?'再次触碰可休眠':'触碰后唤醒'}`;emit();return;}
    const terrain=raycaster.intersectObject(game.ground,false);
    if(terrain.length){game.target=terrain[0].point.clone();game.target.x=THREE.MathUtils.clamp(game.target.x,-8.1,8.1);game.target.z=THREE.MathUtils.clamp(game.target.z,-6.5,6.5);game.target.y=.13;game.pendingBeacon=null;}
  }
  function activateBeacon(index) {
    const b=game.beacons[index];b.active=!b.active;b.core.material.emissive.setHex(b.active?0x69cafa:0x225477);b.halo.material.emissive.setHex(b.active?0x3ea7ce:0x163342);
    game.score=game.beacons.filter(b=>b.active).length;game.complete=game.score===3;
    playRobot(game.complete?'Dance':'Jump');game.status=game.complete?'花园苏醒了 · 继续漫游，或点击信标改变花园':`自由探索 · 已唤醒 ${game.score} / 3 座信标`;emit();
  }
  function buildRoad() {
    camera.position.set(0,width/height<.85?7:5.5,width/height<.85?18:11);camera.lookAt(0,1,-16);
    game.actor.scale.setScalar(1.22);game.actor.position.set(0,.16,2); game.actor.rotation.y=0;
    const road=box(13,.25,200,0x111a23);road.position.set(0,-.14,-80);
    for(const x of [-6.5,6.5]) { const rail=gameMesh(new THREE.BoxGeometry(.12,.14,200),gmat(0xa6d6e9,0x215576));rail.position.set(x,.12,-80); }
    game.stripes=[];for(let i=0;i<35;i++)for(const x of [-2.16,2.16]){const dash=gameMesh(new THREE.BoxGeometry(.055,.025,2.4),gmat(0x8ba6b5,0x182b39));dash.position.set(x,.012,10-i*5);game.stripes.push(dash);}
    game.towers=[];for(let i=0;i<28;i++){const side=i%2?1:-1;const tower=box(1.3,3+(i%5)*2,1.4,0x162937);tower.position.set(side*(9+(i%4)*2),tower.geometry.parameters.height/2,10-Math.floor(i/2)*12);game.towers.push(tower);const trim=gameMesh(new THREE.BoxGeometry(.05,tower.geometry.parameters.height,.03),gmat(0x96d8ff,0x22516d),tower);trim.position.z=.72;}
    for(let i=0;i<5;i++){const gate=gameMesh(new THREE.TorusGeometry(12,.09,6,64,Math.PI),gmat(0x718b9f,0x102e48));gate.position.set(0,0,-i*38);game.towers.push(gate);}
    game.obstacles=[];game.distance=0;game.speed=26;game.boostUntil=0;game.boostReady=0;game.recoverUntil=0;game.spawn=1;game.status='银色公路 · 移动转向，轻触加速';
  }
  function roadObstacle() {
    const obstacle=new THREE.Group();game.root.add(obstacle);obstacle.position.set((Math.random()-.5)*9.7,.55,-145);
    const hull=box(1.4,1.1,1.5,0x668291,obstacle);const light=gameMesh(new THREE.BoxGeometry(1.2,.08,.04),gmat(0xb1edff,0x51a9db),obstacle);light.position.set(0,.2,.78);game.obstacles.push(obstacle);
  }
  function interact() {
    if(mode==='showcase'){enter(world);return;}
    if(mode==='travel'){if(entries[world].state==='error')load(world,true);return;}
    if(world==='helmet')shoot();
    if(world==='robot')gardenClick();
    if(world==='car' && game.age>=game.boostReady){game.boostUntil=game.age+1.8;game.boostReady=game.age+3.4;emit('涡轮推进 · 保持路线');}
  }
  function canvasClick() {
    if(mode!=='showcase'){interact();return;}
    scene.updateMatrixWorld(true); updateRay();
    const visible=names.filter(name=>entries[name].group.visible && entries[name].state==='loaded');
    const hits=raycaster.intersectObjects(visible.map(name=>entries[name].group),true);
    if(!hits.length)return;
    let object=hits[0].object;
    while(object && !visible.some(name=>entries[name].group===object))object=object.parent;
    const id=visible.find(name=>entries[name].group===object);if(id)enter(id);
  }
  function tickGame(dt) {
    game.age+=dt;
    if(world==='helmet'){
      updateRay();raycaster.ray.at(7,game.crosshair.position);game.crosshair.quaternion.copy(camera.quaternion);
      if(!game.complete){
        game.spawn-=dt;if(game.spawn<=0){spawnDrone();game.spawn=Math.max(.75,2.5-game.score*.045);}
        for(const enemy of [...game.enemies]){enemy.position.z+=dt*(7+Math.min(game.score*.28,9));const approach=THREE.MathUtils.clamp((7-enemy.position.z)/60,.08,1);enemy.position.x=(enemy.userData.baseX+Math.sin(game.age+enemy.userData.phase)*1.1)*approach;enemy.position.y=2+(enemy.userData.baseY-2)*approach;enemy.rotation.z=Math.sin(game.age*2+enemy.userData.phase)*.13;
          if(enemy.position.z>7){burst(enemy.position,0xffb799);discardObject(enemy);game.enemies.splice(game.enemies.indexOf(enemy),1);game.shield--;if(game.shield<=0){game.shield=0;game.complete=true;game.status=`防线暂歇 · 击落 ${game.score} · 点击重新开始再试一次`; }else game.status=`护盾 ${game.shield} / 5 · 击落 ${game.score}`;emit();}
        }
      }
    }
    if(world==='robot'){
      const actor=game.actor;
      if(game.target){const delta=game.target.clone().sub(actor.position);delta.y=0;const distance=delta.length();if(distance>.08){delta.normalize();actor.position.addScaledVector(delta,Math.min(distance,dt*3.4));actor.rotation.y=Math.atan2(delta.x,delta.z);playRobot('Walking',false);}else{game.target=null;playRobot('Idle',false);if(game.pendingBeacon!=null){activateBeacon(game.pendingBeacon);game.pendingBeacon=null;}}}
      entries.robot.mixer?.update(dt);if(robotReturn && time>=robotReturn && !game.target)playRobot('Idle',false);
      game.beacons.forEach((b,i)=>{b.halo.rotation.z+=dt*.6;b.core.position.y=1.8+Math.sin(game.age*2+i)*.08;game.bridges[i].scale.x=THREE.MathUtils.damp(game.bridges[i].scale.x,b.active?1:.13,4,dt);game.bridges[i].position.y=THREE.MathUtils.damp(game.bridges[i].position.y,b.active?.32:.1,4,dt);});
      game.bloom.scale.setScalar(THREE.MathUtils.damp(game.bloom.scale.x,game.complete?1:.05+game.score*.18,3,dt));game.bloom.rotation.y+=dt*.18;
    }
    if(world==='car'){
      const boost=game.age<game.boostUntil,recover=game.age<game.recoverUntil;
      game.speed=THREE.MathUtils.damp(game.speed,recover?13:boost?47:27,3,dt);game.distance+=game.speed*dt;game.score=Math.floor(game.distance);
      const oldX=game.actor.position.x;game.actor.position.x=THREE.MathUtils.damp(oldX,pointerX*5.2,recover?3:6,dt);game.actor.rotation.y=THREE.MathUtils.damp(game.actor.rotation.y,-(game.actor.position.x-oldX)/dt*.025,5,dt);game.actor.rotation.z=THREE.MathUtils.damp(game.actor.rotation.z,-(game.actor.position.x-oldX)/dt*.008,5,dt);
      game.actor.position.y=.16+Math.sin(game.age*23)*.009;game.actor.visible=!recover || Math.floor(game.age*12)%3!==0;
      for(const stripe of game.stripes){stripe.position.z+=game.speed*dt;if(stripe.position.z>13)stripe.position.z-=175;}
      for(const tower of game.towers){tower.position.z+=game.speed*dt;if(tower.position.z>20)tower.position.z-=180;}
      game.spawn-=dt;if(game.spawn<=0){roadObstacle();game.spawn=Math.max(.8,1.7-game.distance/6000);}
      for(const obstacle of [...game.obstacles]){obstacle.position.z+=game.speed*dt;
        if(game.age>=game.recoverUntil && Math.abs(obstacle.position.z-game.actor.position.z)<1.7 && Math.abs(obstacle.position.x-game.actor.position.x)<1.2){game.recoverUntil=game.age+1.5;game.boostUntil=0;burst(obstacle.position,0xffbd9a);discardObject(obstacle);game.obstacles.splice(game.obstacles.indexOf(obstacle),1);emit('轻触障碍 · 自动恢复，继续前进');}
        else if(obstacle.position.z>15){discardObject(obstacle);game.obstacles.splice(game.obstacles.indexOf(obstacle),1);}
      }
      game.status=`${Math.round(game.speed*3.6)} km/h · ${Math.floor(game.distance)} m · ${recover?'恢复中':boost?'涡轮推进':game.age>=game.boostReady?'轻触加速':'涡轮充能'}`;
    }
    for(const effect of [...game.effects]){effect.life-=dt;effect.object.material.opacity=Math.max(0,effect.life/effect.max);if(!effect.tracer)effect.object.scale.setScalar(1+(effect.max-effect.life)*7);if(effect.life<=0){discardObject(effect.object);game.effects.splice(game.effects.indexOf(effect),1);}}
    if(game.age-game.lastEmit>.3){game.lastEmit=game.age;emit();}
    renderer.render(game.scene,camera);
  }
  const listeners = [], originalTouchAction = canvas.style.touchAction, originalCursor = canvas.style.cursor;
  const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); listeners.push(() => target.removeEventListener(name, handler, options)); };
  // pan-y deliberately preserves page scrolling, including while touching a model.
  canvas.style.touchAction = 'pan-y';
  function readPointer(event) { const rect = canvas.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width * 2 - 1; pointerY = 1 - (event.clientY - rect.top) / rect.height * 2; }
  listen(canvas, 'pointerenter', () => { hover = true; });
  listen(canvas, 'pointerleave', () => { hover = false; if(mode==='showcase')laneTarget=0; });
  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    readPointer(event); hover = true; down = { x:event.clientX,y:event.clientY,lx:event.clientX,ly:event.clientY,moved:0,id:event.pointerId };
    if(mode==='game')canvas.setPointerCapture?.(event.pointerId);
  });
  listen(canvas, 'pointermove', event => {
    readPointer(event); hover = true;
    if(down && event.pointerId===down.id){
      down.moved=Math.max(down.moved,Math.hypot(event.clientX-down.x,event.clientY-down.y));
      if(mode==='showcase' && world==='helmet' && event.pointerType==='mouse'){helmetYaw+=(event.clientX-down.lx)*.009;helmetPitch=THREE.MathUtils.clamp(helmetPitch+(event.clientY-down.ly)*.006,-.45,.45);}
      down.lx=event.clientX;down.ly=event.clientY;
    }
    if(mode==='showcase')canvas.style.cursor='pointer';
  });
  listen(canvas, 'pointerup', event => {
    if(!down || event.pointerId!==down.id)return;
    readPointer(event); const clicked=Math.max(down.moved,Math.hypot(event.clientX-down.x,event.clientY-down.y))<7;
    down=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(clicked)canvasClick();
  });
  listen(canvas, 'pointercancel', () => { down=null; });
  const resize = () => { const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;
  const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const preview = new THREE.Vector3();
  function safeTick(now) {
    try { tick(now); }
    catch (error) { cancelAnimationFrame(frame); onError?.(error); }
  }
  function tick(now) {
    if (disposed) return; frame = requestAnimationFrame(safeTick);
    const dt = Math.min(Math.max((now - last) / 1000, .001), .05); last = now;
    if (paused || document.hidden) return;
    time += dt;
    if(mode==='game'){tickGame(dt);return;}
    if(mode==='travel'){
      const entry=entries[world];
      for(const name of names)entries[name].group.visible=name===world && entry.state==='loaded';
      pending.visible=entry.state!=='loaded';
      if(entry.state==='loaded'){
        if(!travelReady){travelReady=true;travelStart=time;entry.group.position.set(0,0,0);entry.group.scale.setScalar(1);entry.group.updateWorldMatrix(true,true);new THREE.Box3().setFromObject(entry.group).getCenter(travelFocus);emit('正在穿越入口');}
        const p=clamp((time-travelStart)/(reduced?.12:.8),0,1),t=ease(p);
        const end=travelFocus.clone().add(travelCamera.clone().sub(travelFocus).normalize().multiplyScalar(1.1));
        if(!reduced){camera.position.lerpVectors(travelCamera,end,t);camera.lookAt(travelFocus);camera.fov=37+t*22;camera.updateProjectionMatrix();portalAccent.rotation.z+=dt*3;portal.scale.setScalar(1+t*.6);}
        if(entries[world].mixer)entries[world].mixer.update(dt);
        renderer.render(scene,camera);if(p>=1)buildGame();
      }else{renderer.render(scene,camera);}
      return;
    }
    progress = reduced ? targetProgress : damp(progress, targetProgress, 9, dt);
    const chapter = progress < .25 ? 'helmet' : progress < .5 ? 'robot' : progress < .75 ? 'car' : 'all';
    const next = selected || (chapter === 'all' ? world : chapter);
    if (next !== world) { world = next; emit(); }
    if (progress > .12) load('robot'); if (progress > .37) load('car');
    if (chapter === 'all') names.forEach(name => load(name)); else load(world);
    const mobile = width / height < .85, showcaseAll = chapter === 'all' && !selected;
    gallery.position.set(mobile ? 0 : 1.9, mobile ? -.8 : -.04, 0);
    gallery.scale.setScalar(mobile ? .81 : 1);
    camera.position.set(0, mobile ? 2.25 : 2.8, mobile ? 12.8 : 11.6);
    camera.lookAt(0, mobile ? -.25 : -.05, 0);
    if (mobile) { camera.fov = 43; } else { camera.fov = 37; } camera.updateProjectionMatrix();
    const weights = { helmet: 0, robot: 0, car: 0 };
    if (showcaseAll) { weights.helmet = weights.robot = weights.car = 1; }
    else if (selected) weights[selected] = 1;
    else { weights.helmet = 1 - ease((progress - .225) / .05); weights.robot = ease((progress - .225) / .05) * (1 - ease((progress - .475) / .05)); weights.car = ease((progress - .475) / .05); }
    for (const name of names) {
      const entry = entries[name], g = entry.group, weight = weights[name];
      g.visible = weight > .002 && entry.state === 'loaded';
      const finalScale = showcaseAll ? name === 'helmet' ? .56 : name === 'robot' ? .73 : .62 : 1;
      const targetX = showcaseAll ? name === 'helmet' ? -1.65 : name === 'robot' ? .25 : 1.68 : (1 - weight) * (name === 'helmet' ? -1 : 1) * 2;
      g.position.x = damp(g.position.x, targetX, reduced ? 60 : 8, dt);
      g.scale.setScalar(damp(g.scale.x, Math.max(.001, weight * finalScale), reduced ? 60 : 8, dt));
      g.position.y = damp(g.position.y, showcaseAll ? name === 'helmet' ? -.32 : name === 'robot' ? -.43 : .15 : 0, 8, dt);
    }
    const helmet = entries.helmet;
    if (helmet.object) { helmet.object.rotation.y = helmetYaw + (reduced || down ? 0 : Math.sin(time * .19) * .10); helmet.object.rotation.x = helmetPitch; helmet.object.position.y = -1.43 + (reduced ? 0 : Math.sin(time * .7) * .045); }
    const robot = entries.robot;
    if (robot.mixer && (weights.robot > .001)) {
      if (robot.head) { robot.head.rotation.y -= robot.headOffsetY || 0; robot.head.rotation.x -= robot.headOffsetX || 0; robot.headOffsetY = robot.headOffsetX = 0; }
      if (!reduced || robotReturn) robot.mixer.update(dt);
      if (robotReturn && time >= robotReturn) { playRobot('Idle', false); emit(); }
      robot.group.rotation.y = damp(robot.group.rotation.y, hover ? pointerX * .28 : -.17, 4, dt);
      if (robot.head && robot.action?._clip?.name === 'Idle') { robot.headOffsetY = pointerX * .14; robot.headOffsetX = -pointerY * .08; robot.head.rotation.y += robot.headOffsetY; robot.head.rotation.x += robot.headOffsetX; }
    }
    track.visible = false;
    track.scale.setScalar(Math.max(.001, weights.car));
    const car = entries.car;
    if (car.object) {
      car.object.position.set(0, -1.59, 0);
      car.object.rotation.set(0, -.62 + (reduced ? 0 : Math.sin(time * .17) * .055), 0);
    }
    scan.visible = world === 'helmet' && time < scanUntil && helmet.state === 'loaded' && !showcaseAll;
    if (scan.visible) { scanRing.position.y = reduced ? .1 : -1.4 + ((time * .75) % 1) * 3.3; scan.rotation.y = helmetYaw; }
    if (!reduced) portalAccent.rotation.z = time * .09;
    portal.scale.setScalar(showcaseAll ? 1.12 : 1);
    const current = entries[world]; pending.visible = current.state !== 'loaded' && !showcaseAll;
    if (pending.visible && pending.userData.state !== current.state) {
      pending.userData.state = current.state;
      const replacement = makeLabel(current.state === 'error' ? '载入失败  /  点击重试' : '正在载入模型', current.state === 'error' ? 3.5 : 2.5);
      pending.material.map = replacement.material.map; pending.scale.copy(replacement.scale);
    }
    try { renderer.render(scene, camera); if (!ready && entries.helmet.state === 'loaded') { ready = true; onReady?.(); emit(); } }
    catch (error) { cancelAnimationFrame(frame); onError?.(error); }
  }
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); onError?.(new Error('WebGL context lost')); });
  load('helmet'); frame = requestAnimationFrame(safeTick); emit();
  return {
    setProgress(value) { if(mode!=='showcase')return; const next = clamp(Number(value) || 0, 0, 1); if (Math.abs(next - targetProgress) > .004) selected = null; targetProgress = next; },
    setPointer(x, y) { pointerX = clamp(Number(x) || 0, -1, 1); pointerY = clamp(Number(y) || 0, -1, 1); },
    setReducedMotion(value) { reduced = !!value; },
    setPaused(value) { paused = !!value; last = performance.now(); },
    action(name, payload) {
      const id=typeof payload==='string'?payload:payload?.world;
      if(name==='enter')enter(names.includes(id)?id:world);
      if(name==='exit')exitGame();
      if(name==='restart')restart();
      if(name==='interact')interact();
      if(name==='retry')load(world,true);
      if(name==='select' && names.includes(id) && mode==='showcase'){selected=id;world=id;load(world,true);emit();}
    },
    dispose() { if(disposed)return; disposed = true; destroyGame(); cancelAnimationFrame(frame); observer.disconnect(); listeners.forEach(remove => remove()); for (const entry of Object.values(entries)) { entry.mixer?.stopAllAction(); if (entry.asset) { entry.mixer?.uncacheRoot(entry.asset); disposeModel(entry.asset); } } resources.forEach(resource => resource.dispose()); environment.dispose(); renderer.dispose(); canvas.style.touchAction = originalTouchAction; canvas.style.cursor = originalCursor; }
  };
}
