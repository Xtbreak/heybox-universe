import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createCosmicJourney } from './cosmic-journey.js';

// Scroll gallery and three continuous, pointer-playable worlds. Real licensed GLB assets stay in the same renderer.
export async function createWorld(canvas, { onReady, onError, onState } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { onError?.(error); throw error; }
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, canvas.getBoundingClientRect().width<760?1.25:1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030609');
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 1200);
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
  gallery.visible=false;
  const journey=createCosmicJourney({THREE,scene,camera,entries});
  const loader = new GLTFLoader();
  const keys=new Set(); let firing=false;
  const axis=(positive,negative)=>positive.some(k=>keys.has(k))*1-negative.some(k=>keys.has(k))*1;
  const clearInput=()=>{keys.clear();firing=false;down=null;};
  let composer=null,renderPass=null,bloomPass=null;
  try {
    const [{EffectComposer},{RenderPass},{UnrealBloomPass},{OutputPass}]=await Promise.all([import('./vendor/EffectComposer.js'),import('./vendor/RenderPass.js'),import('./vendor/UnrealBloomPass.js'),import('./vendor/OutputPass.js')]);
    composer=new EffectComposer(renderer);renderPass=new RenderPass(scene,camera);bloomPass=new UnrealBloomPass(new THREE.Vector2(1,1),.48,.45,1.05);composer.addPass(renderPass);composer.addPass(bloomPass);composer.addPass(new OutputPass());
  } catch(e) { composer?.dispose?.();composer=null; }
  const renderScene=(target)=>{if(composer){renderPass.scene=target;renderPass.camera=camera;composer.render();}else renderer.render(target,camera);};
  let disposed = false, ready = false, frame = 0, progress = 0, targetProgress = 0, paused = false, reduced = false;
  let width = 1, height = 1, last = performance.now(), time = 0, world = 'helmet', selected = null;
  let pointerX = 0, pointerY = 0, hover = false, down = null, helmetYaw = -.36, helmetPitch = .06;
  let scanUntil = 0, robotIndex = -1, robotReturn = 0, carAngle = -.9, lane = 0, laneTarget = 0, turboUntil = 0, collisionUntil = 0, lap = 0;
  let mode = 'showcase', travelStart = 0, travelReady = false, savedProgress = 0, savedTarget = 0;
  let game = null, modelSnapshot = null, savedSelection = null;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const travelCamera = new THREE.Vector3(), travelFocus = new THREE.Vector3();
  const instructions = { helmet: '点击头盔，进入轨道防线', robot: '点击机器人，进入机械花园', car: '点击跑车，进入银色公路' };
  const gameInstructions = { helmet: 'WASD 移动 · 鼠标瞄准 / 空格开火 · Shift 闪避 · E 脉冲', robot: 'WASD / 点地面探索 · 空格跳跃 · Shift 奔跑 · E 唤醒信标', car: 'A/D 转向 · W 加速 / S 刹车 · 空格 / Shift 涡轮 · 穿越检查点' };
  function emit(statusText) {
    if (disposed) return;
    const entry = entries[world];
    onState?.({ mode, world, instruction: mode === 'game' ? gameInstructions[world] : mode === 'travel' ? '正在穿越 · 随时可以返回' : instructions[world], modelStatus: entry.state,
      statusText: statusText || (mode === 'game' ? game?.status || '' : entry.state === 'error' ? '模型加载未完成 · 点击重试' : entry.state !== 'loaded' ? '正在载入真实 3D 模型' : mode === 'travel' ? '正在进入世界' : '真实模型 · 点击进入它的世界'),
      score: game?.score || 0, shield: game?.shield, speed: game?.speed, distance: game?.distance, complete: !!game?.complete, health:game?.shield, stamina:game?.stamina, skillCooldown: game ? Math.max(0,(game.skillReady||game.boostReady||0)-game.age) : 0, mission:game?.mission, beacons:game?.beacons?.filter(b=>b.active).length, kills:game?.kills, boostCooldown:game?Math.max(0,(game.boostReady||0)-game.age):0, dashCooldown:game?Math.max(0,(game.dashReady||0)-game.age):0, combo:game?.combo||0, wave:game?.wave||1, checkpoints:game?.checkpoints||0 });
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
    clearInput(); canvas.style.touchAction = 'none'; canvas.style.cursor = 'wait';
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
    clearInput(); destroyGame(); journey.setVisible(true); camera.far=1200;camera.updateProjectionMatrix(); mode = 'showcase'; travelReady = false; progress = savedProgress; targetProgress = savedTarget; selected = savedSelection;
    canvas.style.touchAction = 'pan-y'; canvas.style.cursor = originalCursor; down = null;
    if (entries.robot.mixer) playRobot('Idle',false);
    emit('已返回星际旅程');
  }
  function restart() { if (mode !== 'game') return; clearInput();destroyGame();buildGame(); }
  function buildGame() {
    clearInput();journey.setVisible(false);
    const root = new THREE.Group(), gameScene = new THREE.Scene(); gameScene.add(root);
    gameScene.background = new THREE.Color('#02070d'); gameScene.environment = environment.texture;
    gameScene.add(new THREE.HemisphereLight(0xb8def4,0x111526,2.3));
    for (const [color,intensity,x,y,z] of [[0xe4f6ff,4,-7,14,5],[0x69bde8,3,9,5,-9]]) { const light = new THREE.DirectionalLight(color,intensity); light.position.set(x,y,z); gameScene.add(light); }
    game = { scene: gameScene, root, resources:new Set(), score:0, age:0, lastEmit:0, status:'', shield:5, complete:false, effects:[], objects:[], combo:0, stamina:100, skillReady:0, dashReady:0, dashUntil:0 };
    const object = entries[world].object;
    modelSnapshot = {object,parent:object.parent,position:object.position.clone(),rotation:object.rotation.clone(),scale:object.scale.clone()};
    const actor = new THREE.Group(); root.add(actor); actor.add(object); object.position.set(0,0,0); object.rotation.set(0,0,0); game.actor = actor;
    camera.fov = world === 'robot' ? (width/height<.85?48:43) : 52; camera.far = 260; camera.updateProjectionMatrix();
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
    game.player=new THREE.Vector3(0,2,7);game.shield=5;game.wave=1;game.kills=0;game.combo=0;game.bullets=[];game.invulnerable=0;
    camera.position.set(0,2,13);camera.lookAt(0,2,-40);
    game.actor.scale.setScalar(.43); game.actor.position.set(-2.6,-.6,8.7);game.actor.rotation.y=.3;
    const deck=box(14,.3,5,0x152438);deck.position.set(0,-2.4,10);game.deck=deck;
    for(const x of [-5,5]){const strut=box(.13,7,.2,0x517890,deck);strut.position.set(x,3,-1);}
    const planet=gameMesh(new THREE.SphereGeometry(22,48,32),gmat(0x102b43));planet.position.set(38,-30,-100);
    const ring=gameMesh(new THREE.TorusGeometry(29,.09,6,128),gmat(0xa8ddf7,0x225570));ring.position.copy(planet.position);ring.rotation.set(1.1,.4,.2);
    game.crosshair=new THREE.Group();game.root.add(game.crosshair);
    for(const [x,y,w,h] of [[-.18,0,.13,.018],[.18,0,.13,.018],[0,.18,.018,.13],[0,-.18,.018,.13]]){const m=gameMesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:0xc5efff,depthTest:false}),game.crosshair);m.position.set(x,y,0);m.renderOrder=20;}
    game.enemies=[];game.spawn=1;game.shotAt=-1;game.mission='击落 20 架无人机，守住防线';game.status='第 1 波 · 护盾 5 / 5';
    for(let i=0;i<3;i++)spawnDrone(-30-i*12);
  }
  function spawnDrone(z=-65) {
    const drone=new THREE.Group();game.root.add(drone);drone.position.set((Math.random()-.5)*12,(Math.random()-.5)*6+2,z);
    const body=gameMesh(new THREE.OctahedronGeometry(.8),gmat(0x607b9c,0x153345),drone);
    for(const x of [-1.05,1.05]){const wing=box(1.1,.12,.55,0x8fabb9,drone);wing.position.x=x;}
    const eye=gameMesh(new THREE.SphereGeometry(.2,12,8),gmat(0xffb6a9,0xff5533),drone);eye.position.z=.68;
    const target=gameMesh(new THREE.TorusGeometry(1.5,.025,5,32),new THREE.MeshBasicMaterial({color:0x77c9ee,transparent:true,opacity:.7}),drone);target.userData.targetRing=true;
    drone.userData={hit:body,phase:Math.random()*6,baseX:drone.position.x,baseY:drone.position.y,fireAt:game.age+2+Math.random()*2};
    drone.traverse(node=>{node.userData.drone=drone;});game.enemies.push(drone);
  }
  function damageDefense(){if(game.age<game.invulnerable)return;game.shield=Math.max(0,game.shield-1);game.combo=0;game.invulnerable=game.age+1;burst(game.player,0xff7755);if(!game.shield){game.complete=true;game.status='防线失守 · 重新开始挑战';}emit();}
  function killDrone(enemy){burst(enemy.position);game.enemies.splice(game.enemies.indexOf(enemy),1);discardObject(enemy);game.kills++;game.combo++;game.score+=100+Math.min(game.combo,10)*20;game.wave=1+Math.floor(game.kills/7);if(game.kills>=20)game.mission='防线已守住 · 继续挑战无限波次';}
  function enemyShot(enemy){
    const projectile=gameMesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshBasicMaterial({color:0xff6744}));projectile.position.copy(enemy.position);
    projectile.userData.velocity=game.player.clone().sub(projectile.position).normalize().multiplyScalar(14+game.wave*1.2);game.bullets.push(projectile);
  }
  function skill(){if(mode!=='game')return;if(world==='car'){boost();return;}if(world==='robot'){gardenInteract();return;}if(game.complete||game.age<game.skillReady)return;game.skillReady=game.age+8;
    for(const b of game.bullets)discardObject(b);game.bullets=[];for(const e of [...game.enemies])if(e.position.distanceTo(game.player)<58)killDrone(e);
    const pulse=gameMesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0x77ddff,wireframe:true,transparent:true,opacity:.9}));pulse.position.copy(game.player);game.effects.push({object:pulse,life:.8,max:.8,pulse:true});game.status='电磁脉冲 · 弹幕清空';emit();
  }
  function boost(){if(!game||game.age<game.boostReady)return;game.boostUntil=game.age+1.8;game.boostReady=game.age+5;emit('涡轮推进 · 穿越检查点');}
  function jump(){if(mode!=='game')return;if(world==='car'){boost();return;}if(world==='helmet'){shoot();return;}if(game.jumpY<=.001){game.verticalSpeed=6.2;playRobot('Jump');}}
  function dash(){if(world==='car'){boost();return;}if(world!=='helmet'||game.age<game.dashReady)return;game.dashReady=game.age+3;game.dashUntil=game.age+.28;game.invulnerable=game.age+.45;}

  function burst(position,color=0x9ee8ff) {
    const spark=gameMesh(new THREE.IcosahedronGeometry(.6,1),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:1})); spark.position.copy(position);
    game.effects.push({object:spark,life:.5,max:.5});
  }
  function discardObject(object) {
    object.removeFromParent(); object.traverse(node=>{if(node.geometry && game.resources.delete(node.geometry))node.geometry.dispose(); const mats=Array.isArray(node.material)?node.material:[node.material]; for(const m of mats)if(m && game.resources.delete(m))m.dispose();});
  }
  function shoot() {
    if(game.complete||game.age-game.shotAt<.12)return;game.shotAt=game.age;game.scene.updateMatrixWorld(true);updateRay();
    const hits=raycaster.intersectObjects(game.enemies,true).filter(hit=>!hit.object.userData.targetRing);
    const end=hits.length?hits[0].point:raycaster.ray.at(100,new THREE.Vector3());const start=game.player.clone().add(new THREE.Vector3(.65,-.6,-1));
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);const material=new THREE.LineBasicMaterial({color:0xbdefff,transparent:true,opacity:1});game.resources.add(geometry);game.resources.add(material);
    const tracer=new THREE.Line(geometry,material);game.root.add(tracer);game.effects.push({object:tracer,life:.13,max:.13,tracer:true});if(hits.length)killDrone(hits[0].object.userData.drone);
  }

  function buildGarden() {
    game.actor.scale.setScalar(.67);game.actor.position.set(0,0,3);playRobot('Idle',false);
    game.platforms=[];game.walkables=[];game.beacons=[];game.bridges=[];game.target=null;game.pendingBeacon=null;game.groundY=0;game.jumpY=0;game.verticalSpeed=0;game.secrets=[];game.unlocked=false;game.portalGoal=new THREE.Vector3(0,0,0);
    function platform(x,z,w,d,h,color=0x243648){const mesh=box(w,1+h,d,color);mesh.position.set(x,(h-1)/2,z);game.walkables.push(mesh);game.platforms.push({x,z,w,d,h});return mesh;}
    platform(0,0,8,8,0);const sites=[[-10,-7,1.2],[10,-7,2],[10,8,1]];
    sites.forEach(([x,z,h],i)=>{
      platform(x,z,6,6,h); // Broad stepping terraces provide safe traversal in any order.
      const dx=x/5,dz=z/5;
      for(let n=1;n<5;n++){const step=platform(dx*n,dz*n,3.6,3.6,h*n/5,0x324e61);game.bridges.push({mesh:step,baseY:step.position.y,index:i});}
      const beacon=new THREE.Group();beacon.position.set(x,h,z);game.root.add(beacon);
      const base=gameMesh(new THREE.CylinderGeometry(.8,1,.2,32),gmat(0x607785),beacon);base.position.y=.1;
      const column=gameMesh(new THREE.CylinderGeometry(.2,.4,1.5,8),gmat(0x324754),beacon);column.position.y=.85;
      const halo=gameMesh(new THREE.TorusGeometry(.7,.06,8,48),gmat(0x7aafca,0x163342),beacon);halo.position.y=1.8;halo.rotation.x=-Math.PI/2;
      const core=gameMesh(new THREE.IcosahedronGeometry(.35),gmat(0xafddef,0x225477),beacon);core.position.y=1.8;beacon.traverse(node=>node.userData.beacon=i);
      game.beacons.push({group:beacon,halo,core,active:false});label(['潮汐','星光','回声'][i],x,h+3,z,2);
      const crystal=gameMesh(new THREE.OctahedronGeometry(.3),gmat(0xe8bcff,0x8548ad));crystal.position.set(x+1.7,h+.8,z-1.7);game.secrets.push(crystal);
      for(let j=0;j<7;j++){const rock=gameMesh(new THREE.ConeGeometry(.5,2+j%3,5),gmat(0x263b54,0x0b182b));rock.position.set(x+(j%2?4:-4),-2-j*.6,z+(j-3)*1.2);}
    });
    game.bloom=new THREE.Group();game.bloom.position.set(0,.3,0);game.root.add(game.bloom);game.bloom.scale.setScalar(.08);
    for(let i=0;i<7;i++){const ring=gameMesh(new THREE.TorusGeometry(1.2-i*.08,.045,8,64),gmat(0xafe9ff,0x275f83),game.bloom);ring.position.y=i*.4;ring.rotation.x=Math.PI/2;}
    game.mission='任意顺序唤醒三座信标，然后返回中央星门';game.status='悬浮群岛 · 收集水晶，唤醒信标';
    camera.position.copy(gardenCameraOffset());camera.lookAt(0,0,0);
  }
  function gardenCameraOffset(){return width/height<.85?new THREE.Vector3(0,43,50).multiplyScalar(Math.max(1,.46/(width/height))):new THREE.Vector3(13,16,19);}
  function groundHeight(x,z){let value=null;for(const p of game.platforms)if(Math.abs(x-p.x)<=p.w/2-.12&&Math.abs(z-p.z)<=p.d/2-.12)value=value===null?p.h:Math.max(value,p.h);return value;}
  function gardenRoute(target){game.target=target.clone();const p=game.actor.position;const from=game.beacons.findIndex(b=>p.distanceTo(b.group.position)<5);const to=game.beacons.findIndex(b=>target.distanceTo(b.group.position)<5);game.waypoints=[];if(from!==to && (from>=0||to>=0) && Math.hypot(p.x,p.z)>.3){game.waypoints.push(new THREE.Vector3(0,0,0));}game.waypoints.push(target.clone());game.target=game.waypoints.shift();}
  function gardenClick(){game.scene.updateMatrixWorld(true);updateRay();const hits=raycaster.intersectObjects(game.beacons.map(b=>b.group),true);if(hits.length){const i=hits[0].object.userData.beacon;gardenRoute(game.beacons[i].group.position);game.pendingBeacon=i;return;}const terrain=raycaster.intersectObjects(game.walkables,false);if(terrain.length){gardenRoute(terrain[0].point);game.pendingBeacon=null;}}
  function gardenInteract(){const index=game.beacons.findIndex(b=>b.group.position.distanceTo(game.actor.position)<2.5);if(index>=0)activateBeacon(index);else game.status='靠近信标再按 E · 或直接点击信标';emit();}
  function activateBeacon(index){const b=game.beacons[index];if(b.active)return;b.active=true;b.core.material.emissive.setHex(0x69cafa);b.halo.material.emissive.setHex(0x3ea7ce);game.score+=250;game.unlocked=game.beacons.every(b=>b.active);playRobot('Dance');game.celebrateUntil=game.age+1.5;
    const arch=gameMesh(new THREE.TorusGeometry(2,.09,8,48,Math.PI),gmat(0x96dcff,0x287ba8));arch.position.copy(b.group.position);arch.position.y+=.1;arch.rotation.y=index*.6;
    game.status=game.unlocked?'三座信标已唤醒 · 返回中央星门完成探索':`岛屿重新连接 · 已唤醒 ${game.beacons.filter(b=>b.active).length} / 3`;emit();}

  function buildRoad() {
    camera.position.set(0,width/height<.85?7:5.5,width/height<.85?18:11);camera.lookAt(0,1,-16);
    game.actor.scale.setScalar(1.22);game.actor.position.set(0,.16,2); game.actor.rotation.y=0;
    const road=box(13,.25,200,0x111a23);road.position.set(0,-.14,-80);
    for(const x of [-6.5,6.5]) { const rail=gameMesh(new THREE.BoxGeometry(.12,.14,200),gmat(0xa6d6e9,0x215576));rail.position.set(x,.12,-80); }
    game.stripes=[];for(let i=0;i<35;i++)for(const x of [-2.16,2.16]){const dash=gameMesh(new THREE.BoxGeometry(.055,.025,2.4),gmat(0x8ba6b5,0x182b39));dash.position.set(x,.012,10-i*5);game.stripes.push(dash);}
    game.towers=[];for(let i=0;i<28;i++){const side=i%2?1:-1;const tower=box(1.3,3+(i%5)*2,1.4,0x162937);tower.position.set(side*(9+(i%4)*2),tower.geometry.parameters.height/2,10-Math.floor(i/2)*12);game.towers.push(tower);const trim=gameMesh(new THREE.BoxGeometry(.05,tower.geometry.parameters.height,.03),gmat(0x96d8ff,0x22516d),tower);trim.position.z=.72;}
    for(let i=0;i<5;i++){const gate=gameMesh(new THREE.TorusGeometry(12,.09,6,64,Math.PI),gmat(0x718b9f,0x102e48));gate.position.set(0,0,-i*38);game.towers.push(gate);}
    game.gates=[];game.gateSpawn=2;game.checkpoints=0;game.nearMisses=0;game.keyboardSteering=false;game.mission='穿越检查点 · 行驶 1000 米';game.obstacles=[];game.distance=0;game.speed=26;game.boostUntil=0;game.boostReady=0;game.recoverUntil=0;game.spawn=1;game.status='银色公路 · 移动转向，轻触加速';
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
    if(world==='car')boost();
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
      const dx=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']),dy=axis(['KeyW','ArrowUp'],['KeyS','ArrowDown']);
      const speed=game.age<game.dashUntil?26:7;game.player.x=clamp(game.player.x+dx*dt*speed,-7,7);game.player.y=clamp(game.player.y+dy*dt*speed,-1.5,6.5);
      camera.position.set(game.player.x,game.player.y,13);camera.lookAt(game.player.x,game.player.y,-40);game.actor.position.set(game.player.x-(width/height<.85?1:2.6),game.player.y-2.6,8.7);game.deck.position.x=game.player.x;game.deck.position.y=game.player.y-4.4;
      updateRay();raycaster.ray.at(7,game.crosshair.position);game.crosshair.quaternion.copy(camera.quaternion);
      if(!game.complete){if(firing||keys.has('Space'))shoot();game.spawn-=dt;if(game.spawn<=0){spawnDrone();game.spawn=Math.max(.65,2.4-game.wave*.24);}
        for(const enemy of [...game.enemies]){enemy.position.z+=dt*(4+game.wave*.55);enemy.position.x=enemy.userData.baseX+Math.sin(game.age+enemy.userData.phase)*1.5;enemy.rotation.z=Math.sin(game.age*2+enemy.userData.phase)*.15;
          // Fire only when the attacker is visibly in front of the pilot.
          const ndc=enemy.position.clone().project(camera);if(enemy.position.z<-6&&Math.abs(ndc.x)<.88&&Math.abs(ndc.y)<.82&&game.age>enemy.userData.fireAt){enemyShot(enemy);enemy.userData.fireAt=game.age+Math.max(1.4,3-game.wave*.12);}
          if(enemy.position.z>8){const collision=Math.hypot(enemy.position.x-game.player.x,enemy.position.y-game.player.y)<1.7;discardObject(enemy);game.enemies.splice(game.enemies.indexOf(enemy),1);if(collision)damageDefense();}
        }
        for(const bullet of [...game.bullets]){bullet.position.addScaledVector(bullet.userData.velocity,dt);if(bullet.position.distanceTo(game.player)<.85){damageDefense();discardObject(bullet);game.bullets.splice(game.bullets.indexOf(bullet),1);}else if(bullet.position.z>16){discardObject(bullet);game.bullets.splice(game.bullets.indexOf(bullet),1);}}
        game.status=`第 ${game.wave} 波 · 护盾 ${game.shield}/5 · 连击 ${game.combo} · 击落 ${game.kills}`;
      }
    }
    if(world==='robot'){
      const actor=game.actor,dx=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']),dz=axis(['KeyS','ArrowDown'],['KeyW','ArrowUp']);let movement=new THREE.Vector3(dx,0,dz),moving=movement.lengthSq()>0;
      if(moving){game.target=null;game.waypoints=[];game.pendingBeacon=null;}else if(game.target){movement.copy(game.target).sub(actor.position).setY(0);if(movement.length()<.17){game.target=game.waypoints?.shift()||null;if(!game.target&&game.pendingBeacon!=null){activateBeacon(game.pendingBeacon);game.pendingBeacon=null;}movement.set(0,0,0);}moving=movement.lengthSq()>.001;}
      const sprint=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&game.stamina>1;game.stamina=clamp(game.stamina+(moving&&sprint?-22:15)*dt,0,100);
      if(moving){const remaining=movement.length();movement.normalize();const next=actor.position.clone().addScaledVector(movement,Math.min(remaining,(sprint?6:3.4)*dt));const h=groundHeight(next.x,next.z);if(h!==null){actor.position.x=next.x;actor.position.z=next.z;}actor.rotation.y=Math.atan2(movement.x,movement.z);if(game.jumpY<=.001)playRobot(sprint?'Running':'Walking',false);}
      else if(game.jumpY<=.001&&game.age>(game.celebrateUntil||0))playRobot(game.complete?'Dance':'Idle',false);
      game.verticalSpeed-=15*dt;game.jumpY=Math.max(0,game.jumpY+game.verticalSpeed*dt);if(game.jumpY===0)game.verticalSpeed=0;const h=groundHeight(actor.position.x,actor.position.z)??0;game.groundY=THREE.MathUtils.damp(game.groundY,h,16,dt);actor.position.y=game.groundY+game.jumpY;
      entries.robot.mixer?.update(dt);game.beacons.forEach(b=>{b.halo.rotation.z+=dt*.6;b.core.rotation.y+=dt;});
      game.bridges.forEach(b=>{const active=game.beacons[b.index].active;b.mesh.material.emissive.setHex(active?0x194b66:0);b.mesh.scale.x=THREE.MathUtils.damp(b.mesh.scale.x,active?1.1:1,3,dt);});
      game.bloom.scale.setScalar(THREE.MathUtils.damp(game.bloom.scale.x,game.unlocked?1:.08,3,dt));game.bloom.rotation.y+=dt*.25;
      for(const crystal of [...game.secrets]){crystal.rotation.y+=dt;if(crystal.position.distanceTo(actor.position)<1.3){game.score+=100;burst(crystal.position,0xe8bcff);discardObject(crystal);game.secrets.splice(game.secrets.indexOf(crystal),1);emit('发现星光水晶 · +100');}}
      if(game.unlocked&&!game.complete&&Math.hypot(actor.position.x,actor.position.z)<1.3){game.complete=true;game.score+=500;game.status='星门已开启 · 探索完成！继续漫游寻找水晶';playRobot('Dance');emit();}
      const offset=gardenCameraOffset();const focus=new THREE.Vector3(actor.position.x*.5,0,actor.position.z*.5);camera.position.lerp(focus.clone().add(offset),1-Math.exp(-dt*3));camera.lookAt(focus);
    }
    if(world==='car'){
      const boostActive=game.age<game.boostUntil,recover=game.age<game.recoverUntil,steer=axis(['KeyD','ArrowRight'],['KeyA','ArrowLeft']),accel=axis(['KeyW','ArrowUp'],['KeyS','ArrowDown']);
      game.speed=THREE.MathUtils.damp(game.speed,recover?13:boostActive?52:accel<0?14:accel>0?36:27,3,dt);game.distance+=game.speed*dt;
      const oldX=game.actor.position.x,target=game.keyboardSteering?clamp(oldX+steer*dt*8,-5.2,5.2):pointerX*5.2;game.actor.position.x=game.keyboardSteering?target:THREE.MathUtils.damp(oldX,target,6,dt);game.actor.rotation.y=THREE.MathUtils.damp(game.actor.rotation.y,-(game.actor.position.x-oldX)/dt*.025,5,dt);game.actor.rotation.z=reduced?0:THREE.MathUtils.damp(game.actor.rotation.z,-(game.actor.position.x-oldX)/dt*.008,5,dt);game.actor.position.y=.16;game.actor.visible=!recover||reduced||Math.floor(game.age*12)%3!==0;
      for(const stripe of game.stripes){stripe.position.z+=game.speed*dt;if(stripe.position.z>13)stripe.position.z-=175;}for(const tower of game.towers){tower.position.z+=game.speed*dt;if(tower.position.z>20)tower.position.z-=180;}
      game.spawn-=dt;if(game.spawn<=0){roadObstacle();game.spawn=Math.max(.9,1.9-game.distance/6000);}
      game.gateSpawn-=dt;if(game.gateSpawn<=0){const gate=new THREE.Group();game.root.add(gate);gate.position.set([-3.3,0,3.3][Math.floor(Math.random()*3)],0,-120);for(const x of [-1.7,1.7]){const pole=gameMesh(new THREE.BoxGeometry(.12,4,.14),gmat(0x8ee8ff,0x287aa1),gate);pole.position.set(x,2,0);}const bar=gameMesh(new THREE.BoxGeometry(3.5,.13,.14),gmat(0xb5edff,0x479ac2),gate);bar.position.y=4;game.gates.push(gate);game.gateSpawn=5;}
      for(const gate of [...game.gates]){gate.position.z+=game.speed*dt;if(!gate.userData.passed&&gate.position.z>=2){gate.userData.passed=true;if(Math.abs(game.actor.position.x-gate.position.x)<1.65){game.checkpoints++;game.combo++;game.score+=200+game.combo*50;game.shield=Math.min(5,game.shield+1);burst(new THREE.Vector3(game.actor.position.x,1,0));emit('检查点通过 · 护盾补充');}else{game.combo=0;emit('错过检查点 · 下一个继续');}}if(gate.position.z>18){discardObject(gate);game.gates.splice(game.gates.indexOf(gate),1);}}
      for(const obstacle of [...game.obstacles]){obstacle.position.z+=game.speed*dt;const dx=Math.abs(obstacle.position.x-game.actor.position.x);
        if(!recover&&Math.abs(obstacle.position.z-2)<1.7&&dx<1.3){game.recoverUntil=game.age+1.8;game.boostUntil=0;game.combo=0;game.shield=Math.max(0,game.shield-1);if(!game.shield){game.shield=3;game.score=Math.max(0,game.score-300);}burst(obstacle.position,0xffbd9a);discardObject(obstacle);game.obstacles.splice(game.obstacles.indexOf(obstacle),1);emit('碰撞 · 维修护盾，继续前进');}
        else if(!obstacle.userData.passed&&obstacle.position.z>4){obstacle.userData.passed=true;if(dx>=1.3&&dx<2.3){game.nearMisses++;game.score+=75;emit('擦身而过 · +75');}}
        if(obstacle.parent&&obstacle.position.z>15){discardObject(obstacle);game.obstacles.splice(game.obstacles.indexOf(obstacle),1);}
      }
      if(!game.complete&&game.distance>=1000){game.complete=true;game.score+=1000;game.mission='1000 米挑战完成 · 继续无限公路';emit('千米挑战完成！继续冲刺');}
      game.status=`${Math.round(game.speed*3.6)} km/h · ${Math.floor(game.distance)} / 1000 m · 检查点 ${game.checkpoints} · ${recover?'维修中':boostActive?'涡轮推进':'护盾 '+game.shield+'/5'}`;
    }
    for(const effect of [...game.effects]){effect.life-=dt;effect.object.material.opacity=Math.max(0,effect.life/effect.max);if(!effect.tracer)effect.object.scale.setScalar(1+(effect.max-effect.life)*(effect.pulse?70:7));if(effect.life<=0){discardObject(effect.object);game.effects.splice(game.effects.indexOf(effect),1);}}
    if(game.age-game.lastEmit>.3){game.lastEmit=game.age;emit();}
    renderScene(game.scene);
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
    if(mode==='game'){canvas.setPointerCapture?.(event.pointerId);if(world==='helmet'){firing=true;shoot();}}
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
    firing=false;down=null;if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(clicked)canvasClick();
  });
  listen(canvas, 'pointercancel', clearInput);
  listen(globalThis,'blur',clearInput);
  listen(document,'visibilitychange',()=>{if(document.hidden)clearInput();});
  function control(key,pressed){if(mode!=='game')return;const was=keys.has(key);if(pressed)keys.add(key);else keys.delete(key);if(world==='car'&&['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(key)&&pressed)game.keyboardSteering=true;if(pressed&&!was){if(key==='KeyE')skill();if(key==='Space'&&world!=='helmet')jump();if(key==='ShiftLeft'||key==='ShiftRight')dash();}}
  const accepted=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE']);
  const editable=e=>e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName);
  listen(globalThis,'keydown',event=>{if(mode!=='game'||editable(event)||!accepted.has(event.code)||event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();control(event.code,true);});
  listen(globalThis,'keyup',event=>{if(!accepted.has(event.code))return;if(mode==='game'&&!editable(event))event.preventDefault();control(event.code,false);});
  const resize = () => { const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); const ratio=Math.min(globalThis.devicePixelRatio||1,width<760?1.25:1.5);renderer.setPixelRatio(ratio);renderer.setSize(width, height, false); if(composer){composer.setPixelRatio?.(ratio);composer.setSize(width,height);} camera.aspect = width / height; camera.updateProjectionMatrix(); };
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
        if(!travelReady){travelReady=true;travelStart=time;entry.group.updateWorldMatrix(true,true);new THREE.Box3().setFromObject(entry.group).getCenter(travelFocus);emit('正在穿越入口');}
        const p=clamp((time-travelStart)/(reduced?.12:.8),0,1),t=ease(p);
        const end=travelFocus.clone().add(travelCamera.clone().sub(travelFocus).normalize().multiplyScalar(1.1));
        if(!reduced){camera.position.lerpVectors(travelCamera,end,t);camera.lookAt(travelFocus);camera.fov=37+t*22;camera.updateProjectionMatrix();portalAccent.rotation.z+=dt*3;portal.scale.setScalar(1+t*.6);}
        if(entries[world].mixer)entries[world].mixer.update(dt);
        renderScene(scene);if(p>=1)buildGame();
      }else{renderScene(scene);}
      return;
    }
    progress = reduced ? targetProgress : damp(progress, targetProgress, 9, dt);
    if(progress>.2)load('robot');if(progress>.42)load('car');
    const active=journey.update(progress,reduced?0:time,dt,{width,height,pointerX,pointerY,reducedMotion:reduced,reduced,mobile:width/height<.85,selected});
    const next=names.includes(active)?active:journey.getWorld?.();if(names.includes(next)&&next!==world){world=next;emit();}
    if(entries.robot.mixer&&entries.robot.group.visible&&!reduced)entries.robot.mixer.update(dt);
    renderScene(scene);if(!ready&&entries.helmet.state==='loaded'){ready=true;onReady?.();emit();}
  }
  listen(canvas, 'webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); onError?.(new Error('WebGL context lost')); });
  load('helmet'); frame = requestAnimationFrame(safeTick); emit();
  return {
    setProgress(value) { if(mode!=='showcase')return; const next = clamp(Number(value) || 0, 0, 1); if (Math.abs(next - targetProgress) > .004) selected = null; targetProgress = next; },
    setPointer(x, y) { pointerX = clamp(Number(x) || 0, -1, 1); pointerY = clamp(Number(y) || 0, -1, 1); },
    setReducedMotion(value) { reduced = !!value; },
    setPaused(value) { paused = !!value; if(paused)clearInput(); last = performance.now(); },
    action(name, payload) {
      const id=typeof payload==='string'?payload:payload?.world;
      if(name==='enter')enter(names.includes(id)?id:world);
      if(name==='exit')exitGame();
      if(name==='restart')restart();
      if(name==='interact')interact();
      if(name==='control')control(payload?.key,!!payload?.pressed);
      if(name==='skill')skill();
      if(name==='jump')jump();
      if(name==='dash'&&mode==='game')dash();
      if(name==='retry')load(world,true);
      if(name==='select' && names.includes(id) && mode==='showcase'){selected=id;world=id;targetProgress=progress={helmet:.395,robot:.60,car:.84}[id];load(world,true);emit();}
    },
    dispose() { if(disposed)return; disposed = true;clearInput();destroyGame();journey.dispose();composer?.passes?.forEach(pass=>pass.dispose?.());composer?.dispose?.(); cancelAnimationFrame(frame); observer.disconnect(); listeners.forEach(remove => remove()); for (const entry of Object.values(entries)) { entry.mixer?.stopAllAction(); if (entry.asset) { entry.mixer?.uncacheRoot(entry.asset); disposeModel(entry.asset); } } resources.forEach(resource => resource.dispose()); environment.dispose(); renderer.dispose(); canvas.style.touchAction = originalTouchAction; canvas.style.cursor = originalCursor; }
  };
}
