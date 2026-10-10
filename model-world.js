import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

// A single, scrollable gallery. All featured objects are licensed GLB assets.
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
  const instructions = { helmet: '拖动，换一个角度 · 点击，扫描细节', robot: '移近，打个招呼 · 点击，看它回应', car: '左右移动，轻轻转向 · 点击，加速一圈' };
  function emit(statusText) {
    if (disposed) return;
    const entry = entries[world];
    onState?.({ mode: 'showcase', world, instruction: instructions[world], modelStatus: entry.state, statusText: statusText || (entry.state === 'error' ? '模型加载未完成 · 点击重试' : entry.state !== 'loaded' ? '正在载入真实 3D 模型' : world === 'car' ? '微型试车场 · 自动前进' : '真实模型 · 即时互动') });
  }
  function disposeModel(object) {
    object.traverse(node => { node.geometry?.dispose(); for (const m of (Array.isArray(node.material) ? node.material : node.material ? [node.material] : [])) { for (const value of Object.values(m)) if (value?.isTexture) { value.dispose(); value.source?.data?.close?.(); } m.dispose(); } });
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
      const targetSize = name === 'helmet' ? 3.25 : name === 'robot' ? 3.45 : 1.18;
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
  function interact() {
    const entry = entries[world]; if (entry.state === 'error' || entry.state === 'idle') { load(world, true); return; }
    if (entry.state !== 'loaded') return;
    if (world === 'helmet') { scanUntil = time + 4.5; emit('扫描中 · 探索材质与表面细节'); }
    if (world === 'robot') { const clips = ['Wave', 'Dance', 'Jump', 'ThumbsUp']; robotIndex = (robotIndex + 1) % clips.length; playRobot(clips[robotIndex]); emit(['你好，陌生人。', '跟上这段节奏。', '一点点，反重力。', '它喜欢你的选择。'][robotIndex]); }
    if (world === 'car') { turboUntil = time + 2; emit('加速中 · 保持在光轨之间'); }
  }
  const listeners = [], originalTouchAction = canvas.style.touchAction, originalCursor = canvas.style.cursor;
  const listen = (target, name, handler, options) => { target.addEventListener(name, handler, options); listeners.push(() => target.removeEventListener(name, handler, options)); };
  // pan-y deliberately preserves page scrolling, including while touching a model.
  canvas.style.touchAction = 'pan-y';
  function readPointer(event) { const rect = canvas.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width * 2 - 1; pointerY = 1 - (event.clientY - rect.top) / rect.height * 2; }
  listen(canvas, 'pointerenter', () => { hover = true; });
  listen(canvas, 'pointerleave', () => { hover = false; laneTarget = 0; if (!down) canvas.style.cursor = originalCursor; });
  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    readPointer(event); hover = true; down = { x: event.clientX, y: event.clientY, lx: event.clientX, ly: event.clientY, moved: 0, id: event.pointerId };
    if (world === 'helmet') { canvas.style.cursor = 'grabbing'; if (event.pointerType === 'mouse') canvas.setPointerCapture?.(event.pointerId); }
  });
  listen(canvas, 'pointermove', event => {
    readPointer(event); hover = true;
    if (down && event.pointerId === down.id) {
      down.moved = Math.max(down.moved, Math.hypot(event.clientX - down.x, event.clientY - down.y));
      if (world === 'helmet') { helmetYaw += (event.clientX - down.lx) * .009; helmetPitch = THREE.MathUtils.clamp(helmetPitch + (event.clientY - down.ly) * .006, -.45, .45); }
      down.lx = event.clientX; down.ly = event.clientY;
    }
    canvas.style.cursor = world === 'helmet' ? down ? 'grabbing' : 'grab' : 'pointer';
  });
  listen(canvas, 'pointerup', event => { if (!down || event.pointerId !== down.id) return; const clicked = down.moved < 7; down = null; if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); canvas.style.cursor = world === 'helmet' ? 'grab' : 'pointer'; if (clicked) interact(); });
  listen(canvas, 'pointercancel', () => { down = null; });
  const resize = () => { const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const damp = THREE.MathUtils.damp, clamp = THREE.MathUtils.clamp;
  const ease = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const preview = new THREE.Vector3();
  function tick(now) {
    if (disposed) return; frame = requestAnimationFrame(tick);
    const dt = Math.min(Math.max((now - last) / 1000, .001), .05); last = now;
    if (paused || document.hidden) return;
    time += dt; progress = reduced ? targetProgress : damp(progress, targetProgress, 9, dt);
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
      const finalScale = showcaseAll ? name === 'helmet' ? .56 : name === 'robot' ? .73 : 1.35 : 1;
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
    track.visible = !showcaseAll && weights.car > .02;
    track.scale.setScalar(Math.max(.001, weights.car));
    const car = entries.car;
    if (car.object) {
      if (!showcaseAll && weights.car > .1) {
        preview.copy(gallery.position).project(camera);
        const steer = clamp((pointerX - preview.x) * (mobile ? 1.5 : 2), -1, 1);
        laneTarget = hover ? steer * .51 : 0;
        lane = damp(lane, collisionUntil > time ? 0 : laneTarget, 5.5, dt);
        if (Math.abs(lane) > .29 && time > collisionUntil && !reduced) { collisionUntil = time + .7; lane = Math.sign(lane) * .28; turboUntil = 0; emit('轻触护栏 · 已自动回正'); }
        const speed = time < collisionUntil ? .18 : time < turboUntil ? 1.3 : .47;
        if (!reduced) carAngle += dt * speed;
        const radius = 1.865 + lane, x = Math.cos(carAngle) * radius, z = Math.sin(carAngle) * radius * .64;
        car.object.position.set(x, -1.59, z);
        car.object.rotation.y = Math.atan2(-Math.sin(carAngle), Math.cos(carAngle) * .64) + Math.PI;
        car.object.rotation.z = damp(car.object.rotation.z, (laneTarget - lane) * -.12, 7, dt);
        if (Math.floor((carAngle + .9) / (Math.PI * 2)) > lap) { lap++; emit(`第 ${lap} 圈 · 继续你的节奏`); }
      } else { car.object.position.set(0, -1.4, 0); car.object.rotation.set(0, -.62, 0); }
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
  load('helmet'); frame = requestAnimationFrame(tick); emit();
  return {
    setProgress(value) { const next = clamp(Number(value) || 0, 0, 1); if (Math.abs(next - targetProgress) > .004) selected = null; targetProgress = next; },
    setPointer(x, y) { pointerX = clamp(Number(x) || 0, -1, 1); pointerY = clamp(Number(y) || 0, -1, 1); },
    setReducedMotion(value) { reduced = !!value; },
    setPaused(value) { paused = !!value; last = performance.now(); },
    action(name, payload) { if (name === 'interact') interact(); if (name === 'retry') load(world, true); if (name === 'select' && names.includes(typeof payload === 'string' ? payload : payload?.world)) { selected = typeof payload === 'string' ? payload : payload.world; world = selected; load(world); emit(); } },
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); listeners.forEach(remove => remove()); for (const entry of Object.values(entries)) { entry.mixer?.stopAllAction(); if (entry.asset) { entry.mixer?.uncacheRoot(entry.asset); disposeModel(entry.asset); } } resources.forEach(resource => resource.dispose()); environment.dispose(); renderer.dispose(); canvas.style.touchAction = originalTouchAction; canvas.style.cursor = originalCursor; }
  };
}
