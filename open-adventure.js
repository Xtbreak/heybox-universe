import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { createCinematicPass } from './cinematic-pass.js?v=journey-35';
import { normalizeQuality } from './journey-quality.js?v=journey-35';
import { OutputPass } from './vendor/OutputPass.js';
import { createSpatialRefraction } from './spatial-refraction.js?v=journey-35';
import {createMiniatureCar} from './miniature-car.js?v=journey-35';
import {createToyShip} from './toy-ship.js?v=journey-35';
import {createTexturePrewarm} from './texture-prewarm.js?v=journey-35';
import {createDestinationArrival} from './destination-arrival.js?v=journey-35';
import {createPortalEntry} from './portal-entry.js?v=journey-35';
import {createModelHoverEntry,projectModelHoverHull,isInsideModelHoverHull} from './model-hover-entry.js?v=journey-35';
import * as THREE from './vendor/three.module.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createCosmicJourney } from './cosmic-journey.js?v=journey-35';

// One renderer, three independently owned worlds, and the original cinematic journey.
export async function createWorld(canvas, { onReady, onError, onState, audio = null, onFrame, onContextLost, recoverySnapshot = null, signal } = {}) {
  if(signal?.aborted)throw new Error('World creation cancelled');
  const names=['helmet','robot','car'];
  // Game code and game-only models load when an entry starts and are released on exit; only gallery models stay resident.
  const gameModules={helmet:'./flight-game.js?v=journey-35',robot:'./sandbox-game.js?v=journey-35',car:'./driving-game.js?v=journey-35'};
  const gameExtras={robot:['weapon','./models/fps-pistol.glb']};
  const files={robot:'RobotExpressive.glb'};
  const instructions={helmet:'悬停星舰 1 秒，进入深空救援',robot:'悬停作战装置 1 秒，突入空间设施',car:'悬停遥控车 1 秒，驶入玩具公园'};
  const gameInstructions={helmet:'方向键 / WASD 移动 · 空格或左键射击 · Shift 冲刺',robot:'WASD 移动 · 鼠标瞄准 · 左键开火 / 右键或 Z 举枪瞄准 · R 换弹 · E 互动 · Q 投掷 · Space 跳跃 · 1/2 武器',car:'WASD / 方向键自由驾驶 · Space 手刹 · R 脱困 · C 镜头 · H 鸣笛'};
  const clamp=THREE.MathUtils.clamp;
  let renderer;
  try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch(error){onError?.(error);throw error;}
  if(renderer.shadowMap){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;}
  try {
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030609');
  const camera=new THREE.PerspectiveCamera(52,1,.1,1200);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.035);room.dispose();pmrem.dispose();scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight(0xcbdbe6,0x101721,1.2));
  for(const [color,intensity,x,y,z] of [[0xf3f7ff,3,-4,7,5],[0x98bfd6,2.1,5,3,-4],[0xffffff,.75,1,-1,6]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);scene.add(light);}
  const showcaseLights=scene.children.filter(node=>node.isLight).map(light=>({light,intensity:light.intensity}));
  const entries={};for(const name of names){const group=new THREE.Group();scene.add(group);entries[name]={group,object:null,asset:null,state:'idle',clips:[],mixer:null,animation:null,gameState:'idle',gameToken:0,create:null};}
  const journey=createCosmicJourney({THREE,scene,camera,entries});
  let journeyReady=!journey.ready;journey.ready?.then(()=>{journeyReady=true;},()=>{journeyReady=true;});
  const portalEntry=createPortalEntry({THREE,scene,camera});
  const destinationArrival=createDestinationArrival({THREE,renderer,camera});
  const portalProxy=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));portalProxy.name='owned-loading-portal-anchor';portalProxy.visible=false;portalProxy.raycast=()=>{};scene.add(portalProxy);
  let composer=null,renderPass=null,bloomPass=null,opticsPass=null,cinematicPass=null;
  try {composer=new EffectComposer(renderer);renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);opticsPass=createSpatialRefraction();composer.addPass(opticsPass);bloomPass=new UnrealBloomPass(new THREE.Vector2(1,1),.22,.35,1.2);composer.addPass(bloomPass);cinematicPass=createCinematicPass();composer.addPass(cinematicPass);composer.addPass(new OutputPass());}
  catch(error){composer?.passes?.forEach(pass=>pass.dispose?.());composer?.dispose?.();composer=null;}
  const renderScene = target => {
    const playing = mode === 'game' && target === gameScene, homepage = target === scene;
    const ultra = homepage && quality === 'ultra';
    // Keep reflective surfaces below the glow threshold; HDR light sources stay bright.
    // Inside the friends' room the space glow steps back: lamps, not bloom, light it.
    const indoor = homepage ? journey.getIndoor?.() || 0 : 0;
    if(homepage){for(const item of showcaseLights)item.light.intensity=item.intensity*(ultra?.38:1)*(1-.85*indoor);scene.environmentIntensity=(ultra?.58:1)*(1-.8*indoor);}
    opticsPass?.updateOptics(journey.getOptics?.(), camera, width, height, homepage && !reduced);
    cinematicPass?.configure(ultra, width, height);
    renderer.toneMappingExposure = homepage ? .95 : 1;
    if (bloomPass) {
      bloomPass.strength = homepage ? (ultra ? .96 - .62 * indoor : .22 - .06 * indoor) : .48;
      bloomPass.radius = homepage ? (ultra ? .65 - .25 * indoor : .35) : .45;
      bloomPass.threshold = homepage ? (ultra ? .8 + .9 * indoor : 1.2 + .4 * indoor) : 1.05;
    }
    const bloomAllowed = !playing;
    if (composer && bloomAllowed) {
      try { renderPass.scene=target; renderPass.camera=camera; composer.render(); return; }
      catch (error) {
        console.warn('[open-adventure] bloom unavailable; using direct render', error);
        composer.passes?.forEach(pass=>pass.dispose?.()); composer.dispose?.(); composer=null;
      }
    }
    renderer.render(target,camera);
  };
  let disposed=false,ready=false,frame=0,mode='showcase',world='helmet',selected=null,progress=0,targetProgress=0,paused=false,gamePaused=false,pauseReason=null,controlMode='keyboard-mouse',reduced=false;
  let lifecycle='browse',sessionId=0,awaitingControl=false,controlRequested=false,restoreProgress=null,entryStarted=0,travelSession=0,entryFocus=null,returnPhase=null,returnElapsed=0,returnWorld=null,quality='standard';
  let previousRiftProgress=0;
  const impactCenter=new THREE.Vector3();
  const checkpoints=new Map(recoverySnapshot?.checkpoints||[]);let resumeVisit=false;
  let resolveRecovery,rejectRecovery;const recoveryReady=new Promise((resolve,reject)=>{resolveRecovery=resolve;rejectRecovery=reject;});recoveryReady.catch(()=>{});
  let scrollState={stable:true,scrolling:false,snapping:false,velocity:0},pointerIntent=false,intentAnchor=null,hoverFootprint=null;
  const lifecycleState=()=>({lifecycle,sessionId,quality,awaitingControl,arriving:destinationArrival.active,returning:lifecycle==='return',hoverEligible:!!hoverState.eligible,restoreProgress,checkpointAvailable:!!(game?.getState?.().checkpointAvailable||game?.getState?.().canRetryCheckpoint)||checkpoints.has(world)});
  let width=1,height=1,time=0,last=performance.now(),lastEmit=0,pointerX=0,pointerY=0,pointerDown=false,pointerRightDown=false,pointerActive=false,down=null;
  let pointerDeltaX=0,pointerDeltaY=0,pointerPressed=false,pointerReleased=false,pointerDragging=false,pointerDragX=0,pointerDownX=0,pointerDownY=0;
  const captured=new Set(),pointerPositions=new Map();
  const hoverEntry=createModelHoverEntry();let hoverState={target:null,progress:0},showcasePointer=false,pointerClientX=0,pointerClientY=0;
  const resetHover=(cooldown=0)=>{portalEntry.clearCharge({immediate:paused||contextLost||document.hidden});hoverEntry.reset(performance.now(),cooldown);hoverState={target:null,progress:0};pointerIntent=false;intentAnchor=null;hoverFootprint=null;if(mode==='showcase')lifecycle='browse';};
  const assets={};
  let contextLost=false,preparingCar=false;
  const texturePrewarm=createTexturePrewarm({renderer,isActive:()=>!disposed&&!paused&&!gamePaused&&!document.hidden&&!contextLost&&mode!=='game',onError:error=>console.warn('[open-adventure] texture prewarm skipped',error)});
  let pointerLockFailed=false,lockPending=false,pendingAimPress=false,aimPressHeld=false;
  let mouseButtons=0,suppressPrimaryUntilRelease=false,pendingLook=null,ignoreUnlockPause=false,lastMouseEvent=null;
  const pointerLocked=()=>document.pointerLockElement===canvas;
  const releaseLock=()=>{if(pointerLocked())document.exitPointerLock?.();};
  const lookAllowed=()=>!disposed&&world==='robot'&&mode==='game'&&!destinationArrival.active&&!gamePaused&&!paused&&!document.hidden;
  function releaseUnwantedLock(){if(pointerLocked()){ignoreUnlockPause=true;releaseLock();}}
  function failLook(){controlRequested=false;if(disposed||pendingLook?.cancelled){lockPending=false;return;}pointerLockFailed=true;lockPending=false;pendingAimPress=false;aimPressHeld=false;pointerRightDown=false;if(world==='robot')game?.action?.('aim',false);emit('视角捕获不可用 · 再次点击启用拖动视角，或返回');}
  function requestLook(){
    if(!lookAllowed()||pointerLockFailed||!canvas.requestPointerLock||pointerLocked()||lockPending||pendingLook)return false;
    lockPending=true;const request={cancelled:false,done:false};pendingLook=request;let timeout;request.cleanup=()=>finish();
    // A request can complete after normal listeners have been disposed. This
    // request-scoped guard survives until its success/error, including legacy
    // browsers whose requestPointerLock() returns no Promise.
    const finish=()=>{if(request.done)return;request.done=true;clearTimeout(timeout);document.removeEventListener('pointerlockchange',settled);document.removeEventListener('pointerlockerror',failed);if(pendingLook===request){pendingLook=null;lockPending=false;}};
    const settled=()=>{if(request.done){if(request.cancelled&&pointerLocked())releaseUnwantedLock();return;}if(!pointerLocked())return;const reject=request.cancelled||!lookAllowed();finish();if(reject)releaseUnwantedLock();};
    const failed=()=>{if(request.done)return;const report=!request.cancelled&&lookAllowed();finish();if(report)failLook();};
    timeout=setTimeout(failed,1800);document.addEventListener('pointerlockchange',settled);document.addEventListener('pointerlockerror',failed);
    try{const promise=canvas.requestPointerLock();promise?.then?.(settled,failed);return true;}catch{failed();return false;}
  }
  let completionHandled=false,robotDifficulty=1;
  let game=null,gameScene=null,visitSnapshot=null,journeySnapshot=null,travelStart=null;
  const keys=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),travelFocus=new THREE.Vector3();
  const listeners=[],originalTouchAction=canvas.style.touchAction,originalCursor=canvas.style.cursor;
  const listen=(target,name,handler,options)=>{target.addEventListener(name,handler,options);listeners.push(()=>target.removeEventListener(name,handler,options));};
  const clearInput=(preserveLook=false)=>{if(preserveLook!==true&&pendingLook){pendingLook.cancelled=true;lockPending=false;}if(preserveLook!==true){suppressPrimaryUntilRelease=!!(mouseButtons&1);mouseButtons=0;lastMouseEvent=null;}if(world==='robot'||world==='helmet')game?.action?.('fire',false);if(world==='robot')game?.action?.('aim',false);game?.resetInput?.();resetHover();showcasePointer=false;pendingAimPress=false;aimPressHeld=false;keys.clear();pointerActive=false;pointerX=0;pointerY=0;pointerDown=false;pointerRightDown=false;pointerDeltaX=0;pointerDeltaY=0;pointerPressed=false;pointerReleased=false;pointerDragging=false;pointerDragX=0;down=null;pointerPositions.clear();for(const id of [...captured]){captured.delete(id);try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}}};
  function pauseGame(reason='manual'){if(disposed||mode!=='game')return;destinationArrival.cancel();gamePaused=true;awaitingControl=false;controlRequested=false;lifecycle=['dead','completed'].includes(reason)?'results':'paused';game?.setPaused?.(true);texturePrewarm.sync();pauseReason=typeof reason==='string'?reason:reason?.reason||'manual';clearInput();releaseLock();audio?.setPaused(true);emit();}
  function activateControl(){if(disposed||destinationArrival.active||mode!=='game'||gamePaused||paused||document.hidden)return false;awaitingControl=false;controlRequested=false;lifecycle='active';game?.setPaused?.(false);last=performance.now();audio?.setPaused(false);emit();return true;}
  function takeControl(event){
    if(disposed||destinationArrival.active||mode!=='game'||paused||document.hidden||gamePaused)return false;
    // Browser activation is required for HUD calls; native canvas events pass
    // their trusted flag. Programmatic hover, timers and scene creation cannot lock.
    const trusted=event?.isTrusted===true||globalThis.navigator?.userActivation?.isActive===true;
    if(!trusted)return false;if(lockPending||pendingLook&&!pendingLook.cancelled)return true;
    clearInput();suppressPrimaryUntilRelease=true;controlRequested=true;
    if(world==='robot'&&event?.pointerType!=='touch'&&!pointerLocked()&&!pointerLockFailed&&canvas.requestPointerLock){requestLook();emit();return true;}
    return activateControl();
  }
  function resumeGame(event){if(disposed||mode!=='game'||document.hidden)return;clearInput();gamePaused=false;awaitingControl=true;lifecycle='await-control';texturePrewarm.sync();pauseReason=null;last=performance.now();audio?.setPaused(true);takeControl(event);emit();}
  function emit(statusText){if(disposed)return;const entry=entries[world],state=game?.getState?.()||{};const loaded=names.filter(id=>entries[id].state==='loaded').length;onState?.({...state,...lifecycleState(),mode,world,paused:gamePaused,pauseReason,controlMode,pointerLocked:pointerLocked(),pointerLockAvailable:!pointerLockFailed&&!!canvas.requestPointerLock,instruction:destinationArrival.active?'正在抵达 · 场景稳定后接管':awaitingControl?(world==='robot'?'点击画面接管 · 首次点击不会开火':world==='car'?'移动鼠标、按方向键或轻触画面开始漫游':'按方向键、空格或轻触画面开始 · 接管前计时暂停'):state.instruction||(mode==='game'?gameInstructions[world]:mode==='travel'?'正在穿越 · 随时可以返回':instructions[world]),modelStatus:entry.state,loadedModels:loaded,totalModels:3,assetProgress:loaded/3,statusText:statusText??state.statusText??state.status??(entry.state==='error'?'模型加载未完成 · 点击重试':entry.state!=='loaded'?'正在载入真实 3D 模型':mode==='travel'?'正在进入世界':'悬停模型 1 秒进入 · 移开取消')});}
  function disposeModel(object){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});materials.forEach(m=>m.dispose());}
  function playAnimation(name,once=false){const entry=entries.robot,clip=entry.clips.find(c=>c.name===name);if(!entry.mixer||!clip)return;const action=entry.mixer.clipAction(clip);if(entry.animation===action&&action.isRunning())return;entry.animation?.fadeOut(.18);action.reset().setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.fadeIn(.18).play();entry.animation=action;}
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  function loadCarResources(){const car=createMiniatureCar({THREE});return {scene:car.root,animations:[]};}
  // World 01 is a toy too: the same chunky, flat-shaded build as the jeep and the robot.
  let toyShip=null;function loadShipResources(){toyShip=createToyShip({THREE});return {scene:toyShip.root,animations:[]};}
  async function load(name,retry=false){const entry=entries[name];if(disposed||entry.state==='loading'||entry.state==='loaded'||(entry.state==='error'&&!retry))return;entry.state='loading';if(mode==='travel'&&world===name)lifecycle='travel';emit();try{const gltf=name==='car'?await loadCarResources():name==='helmet'?await loadShipResources():await loader.loadAsync(new URL(`./models/${files[name]}`,import.meta.url).href);if(disposed){if(gltf?.scene)disposeModel(gltf.scene);return;}const object=gltf.scene;
    if(name==='car')texturePrewarm.model(object);
    object.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),targetSize=name==='robot'?3.45:3.25,factor=targetSize/(name==='robot'?size.y:Math.max(size.x,size.y,size.z));
    const normalized=new THREE.Group(),offset=new THREE.Group();normalized.name=`normalized-${name}`;normalized.scale.setScalar(factor);offset.position.set(-center.x,-bounds.min.y,-center.z);offset.add(object);normalized.add(offset);entry.group.add(normalized);normalized.position.y=name==='helmet'?-size.y*factor*.5:-1.605;
    object.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)material.envMapIntensity=name==='helmet'?.9:1.2;}});
    entry.object=normalized;entry.asset=object;if(name==='helmet'){assets.flightShip=object;assets.flightEngineLayout=toyShip.engineLayout;assets.flightEngineRadius=toyShip.engineRadius;assets.flightMuzzleLayout=toyShip.muzzleLayout;entry.portalEngineLayout=toyShip.engineLayout;entry.portalEngineRadius=toyShip.engineRadius;}entry.state='loaded';entry.clips=gltf.animations;if(name==='robot'){entry.mixer=new THREE.AnimationMixer(object);playAnimation('Idle');}emit();
  }catch(error){if(disposed)return;entry.state='error';entry.error=error;if(mode==='travel'&&world===name)lifecycle='error';emit('模型加载未完成 · 点击重试');console.warn(`[open-adventure] ${name} load failed`,error);}}
  async function loadGame(name,retry=false){const entry=entries[name];if(disposed||entry.gameState==='loading'||entry.gameState==='ready'||(entry.gameState==='error'&&!retry))return;const token=++entry.gameToken,extra=gameExtras[name];entry.gameState='loading';if(mode==='travel'&&world===name&&entry.state!=='error')lifecycle='travel';
    try{const [module,gltf]=await Promise.all([import(gameModules[name]),extra&&!assets[extra[0]]?loader.loadAsync(new URL(extra[1],import.meta.url).href):null]);if(disposed||token!==entry.gameToken){if(gltf)disposeModel(gltf.scene);return;}if(gltf)assets[extra[0]]=gltf.scene;entry.create=module.createGame;entry.gameState='ready';emit();}
    catch(error){if(disposed||token!==entry.gameToken)return;entry.gameState='error';if(mode==='travel'&&world===name)lifecycle='error';emit('模型加载未完成 · 点击重试');console.warn(`[open-adventure] ${name} game load failed`,error);}}
  function releaseGames(){for(const name of names){const entry=entries[name];entry.gameToken++;entry.gameState='idle';entry.create=null;const extra=gameExtras[name];if(extra&&assets[extra[0]]){disposeModel(assets[extra[0]]);delete assets[extra[0]];}}}
  function prepare(name,retry=false){load(name,retry);loadGame(name,retry);}
  function takeTransforms(root){const nodes=[];root.traverse(object=>nodes.push({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),visible:object.visible}));return nodes;}
  function restoreTransforms(nodes){for(const {object,position,quaternion,scale,visible} of nodes){object.position.copy(position);object.quaternion.copy(quaternion);object.scale.copy(scale);object.visible=visible;object.updateMatrix();}}
  function snapshotCamera(){return {position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,near:camera.near,far:camera.far,zoom:camera.zoom};}
  function restoreCamera(saved){camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.up.copy(saved.up);camera.fov=saved.fov;camera.near=saved.near;camera.far=saved.far;camera.zoom=saved.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function restoreModel(){if(!visitSnapshot)return;const {object,parent,nodes}=visitSnapshot;parent.add(object);restoreTransforms(nodes);visitSnapshot=null;}
  function destroyGame(){destinationArrival.cancel();const old=game;game=null;try{old?.dispose?.();}catch(error){console.warn('[open-adventure] game cleanup failed',error);}finally{if(world==='robot'){entries.robot.mixer?.stopAllAction();entries.robot.animation=null;}restoreModel();gameScene?.clear();gameScene=null;}}
  function commitEnter(id=world,options={}){if(!names.includes(id)||disposed)return;if(mode!=='showcase')exitGame({immediate:true});sessionId++;travelSession=sessionId;entryStarted=performance.now();entryFocus=document.activeElement;restoreProgress=null;if(quality==='ultra'&&!reduced){entries[id].group.getWorldPosition(impactCenter);cinematicPass?.burst(impactCenter,camera);}resumeVisit=options.fresh!==true&&checkpoints.has(id);lifecycle='travel';awaitingControl=false;controlRequested=false;journeySnapshot={progress,targetProgress,selected,world,time,camera:snapshotCamera(),groups:names.map(n=>({group:entries[n].group,nodes:takeTransforms(entries[n].group)}))};world=id;if(id==='robot'){const tier=resumeVisit?checkpoints.get(id)?.difficulty:1;robotDifficulty=Number.isInteger(tier)&&tier>=1&&tier<=3?tier:1;}selected=id;mode='travel';preparingCar=false;texturePrewarm.sync();audio?.setScene('travel');audio?.play('warp');gamePaused=false;pauseReason=null;travelStart=null;clearInput();canvas.style.touchAction='none';canvas.style.cursor='wait';prepare(id,true);emit();}
  function enter(id=world){
    if(disposed||contextLost||mode!=='showcase'||paused||document.hidden||!names.includes(id))return;
    portalEntry.clearCharge();const active=hoverEntry.activate(performance.now(),id);
    hoverState={target:active?id:null,progress:0,explicit:active};lifecycle=active?'anticipate':'browse';pointerIntent=false;intentAnchor=null;
    if(active)prepare(id,true);emit(active?'入口正在准备 · 再次激活或 Esc 取消':'已取消进入');
  }
  let returnSnapshot=null;
  function exitGame({immediate=false}={}){if(mode==='showcase'||disposed)return;immediate=immediate||contextLost||paused;if(lifecycle==='return'&&!immediate)return;destinationArrival.cancel();sessionId++;controlRequested=false;game?.setPaused?.(true);try{const saved=game?.snapshot?.();if(saved)checkpoints.set(world,saved);}catch(error){console.warn('[open-adventure] checkpoint unavailable',error);}returnWorld=world;releaseLock();clearInput();awaitingControl=false;gamePaused=false;audio?.setPaused(true);lifecycle='return';if(immediate||!gameScene){restoreShowcase(false);return;}mode='travel';returnPhase='fade';returnElapsed=0;onFrame?.({...lifecycleState(),mode,world,travel:{veil:0,phase:'return',done:false}});emit('正在返回原章节');}
  function restoreShowcase(animate){portalEntry.cancel();portalProxy.visible=false;releaseLock();clearInput();audio?.setPaused(false);audio?.setScene('showcase');destroyGame();releaseGames();journey.setVisible(true);mode='showcase';lifecycle='browse';awaitingControl=false;gamePaused=false;pauseReason=null;travelStart=null;preparingCar=false;texturePrewarm.sync();if(journeySnapshot){const s=journeySnapshot;returnSnapshot=s;progress=s.progress;targetProgress=s.targetProgress;selected=s.selected;world=s.world;time=s.time;s.groups.forEach(({nodes})=>restoreTransforms(nodes));restoreCamera(s.camera);restoreProgress=s.targetProgress;journeySnapshot=null;}resetHover(500);try{entryFocus?.focus?.({preventScroll:true});}catch{}entryFocus=null;canvas.style.touchAction='pan-y';canvas.style.cursor=originalCursor;playAnimation('Idle');if(animate&&entries[returnWorld]?.state==='loaded'){world=returnWorld;mode='travel';lifecycle='return';audio?.setPaused(true);returnPhase='portal';portalEntry.startReturn({entry:entries[returnWorld],world:returnWorld,reduced});onFrame?.({...lifecycleState(),mode,world,travel:{veil:1,phase:'return',done:false}});emit('正在返回原章节');}else{returnSnapshot=null;returnPhase=null;if(!contextLost&&!paused)renderScene(scene);emit('已返回星际旅程');}}
  function buildGame(expectedSession=travelSession,{arrival=false}={}){if(disposed||contextLost||mode!=='travel'||expectedSession!==sessionId)return false;clearInput();completionHandled=false;gamePaused=false;pauseReason=null;journey.setVisible(false);gameScene=new THREE.Scene();gameScene.background=new THREE.Color('#02070d');gameScene.environment=world==='car'?null:environment.texture;gameScene.environmentIntensity=world==='robot'?.3:world==='car'?.5:.4;if(world!=='car'){gameScene.add(new THREE.HemisphereLight(0xb8def4,0x111526,world==='robot'?.85:1.5));for(const [color,intensity,x,y,z] of [[0xe4f6ff,world==='robot'?1.5:2.8,-7,14,5],[0x69bde8,world==='robot'?.5:2,9,5,-9]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);gameScene.add(light);}}const object=entries[world].object;visitSnapshot={object,parent:object.parent,nodes:takeTransforms(object)};camera.fov=52;camera.near=.1;camera.far=1600;camera.up.set(0,1,0);camera.updateProjectionMatrix();try{if(!entries[world].create)throw new Error(`${world} game is not loaded`);game=entries[world].create({THREE,scene:gameScene,camera,model:object,playAnimation,emit:text=>emit(text),width,height,reduced,assets,difficulty:world==='robot'?robotDifficulty:1,sound:(name,params)=>audio?.play(name,params)});if(resumeVisit&&checkpoints.has(world)){const restored=game.restore?.(checkpoints.get(world));if(restored===false){if(recoverySnapshot)throw new Error('Recovery checkpoint rejected');checkpoints.delete(world);console.warn('[open-adventure] saved progress rejected; starting a fresh safe session');}if(world==='robot')robotDifficulty=game.getState?.().difficulty||robotDifficulty;}resumeVisit=false;mode='game';lifecycle='await-control';awaitingControl=true;controlRequested=false;game?.setPaused?.(true);texturePrewarm.sync();audio?.setScene(world);audio?.setPaused(true);lastEmit=time;game.resize?.(width,height);canvas.style.cursor=world==='robot'?'crosshair':'default';if(arrival){destinationArrival.begin({world,reduced});lifecycle='arrival';canvas.style.cursor='wait';}const state=game.getState?.()||{};if(state.dead||state.lost)pauseGame('dead');else if(state.completed||state.won){completionHandled=true;pauseGame('completed');}emit();resolveRecovery();}catch(error){rejectRecovery(error);destroyGame();exitGame({immediate:true});onError?.(error);}}
  function restart(){if(mode!=='game'||disposed)return;releaseLock();clearInput();checkpoints.delete(world);resumeVisit=false;destroyGame();mode='travel';travelSession=++sessionId;buildGame();}
  function nextDifficulty(){if(mode!=='game'||disposed)return;const state=game?.getState?.();if(!state?.completed||!state.nextDifficultyAvailable)return;releaseLock();clearInput();completionHandled=false;checkpoints.delete(world);if(world==='robot'){robotDifficulty++;destroyGame();mode='travel';travelSession=++sessionId;buildGame();}else{game?.action?.(world==='car'?'nextChallenge':'nextDifficulty');gamePaused=false;awaitingControl=true;lifecycle='await-control';pauseReason=null;game?.setPaused?.(true);}emit('已进入更高难度 · 点击接管后开始');}
  function canvasClick(payload={}){if(mode==='travel'){if(entries[world].state==='error'||entries[world].gameState==='error')prepare(world,true);return;}if(mode==='game'){if(gamePaused||paused||awaitingControl||suppressPrimaryUntilRelease)return;game.action?.('click',{x:pointerX,y:pointerY,...payload});emit();return;}scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);pointer.set(pointerX,pointerY);raycaster.setFromCamera(pointer,camera);const visible=progress>.9?[]:names.filter(id=>entries[id].group.visible&&entries[id].state==='loaded'),hits=raycaster.intersectObjects(visible.map(id=>entries[id].group),true);if(!hits.length)return;let object=hits[0].object;while(object&&!visible.some(id=>entries[id].group===object))object=object.parent;const id=visible.find(id=>entries[id].group===object);if(id&&!(hoverState.target===id&&hoverState.progress>0))enter(id);}
  const readPointer=event=>{const rect=canvas.getBoundingClientRect();pointerClientX=event.clientX;pointerClientY=event.clientY;pointerX=clamp((event.clientX-rect.left)/Math.max(1,rect.width)*2-1,-1,1);pointerY=clamp(1-(event.clientY-rect.top)/Math.max(1,rect.height)*2,-1,1);const within=event.clientX>=rect.left&&event.clientX<=rect.left+rect.width&&event.clientY>=rect.top&&event.clientY<=rect.top+rect.height;const hit=document.elementFromPoint?.(event.clientX,event.clientY);showcasePointer=within&&(!hit||hit===canvas)&&event.pointerType!=='touch';pointerActive=within&&(!hit||hit===canvas)&&mode==='game'&&!gamePaused&&!paused;return rect;};
  const capture=id=>{try{canvas.setPointerCapture?.(id);captured.add(id);}catch{}};
  const startDown=event=>{down={pointerType:event.pointerType,x:event.clientX,y:event.clientY,moved:0,id:event.pointerId,time:performance.now(),wasHeld:false,touchLook:mode==='game'&&(world==='helmet'||world==='robot')&&event.pointerType==='touch'};pointerDownX=pointerX;pointerDownY=pointerY;pointerDragging=false;pointerDragX=0;if(mode==='game'){pointerDown=!down.touchLook;pointerPressed=pointerDown;if(down.touchLook)pointerRightDown=true;capture(event.pointerId);}};
  canvas.style.touchAction='pan-y';
  listen(canvas,'pointerenter',event=>{if(event.pointerType!=='touch'){readPointer(event);intentAnchor={x:event.clientX,y:event.clientY};}});
  listen(canvas,'pointerleave',()=>{pointerActive=false;showcasePointer=false;if(!hoverEntry.isExplicit)resetHover();});
  listen(globalThis,'scroll',()=>{if(mode==='showcase')resetHover(200);},{passive:true});
  listen(globalThis,'wheel',()=>{if(mode==='showcase')resetHover(250);},{passive:true});
  // Pointer Events report chorded presses/releases as pointermove with a new
  // buttons mask. Reconcile it BEFORE the locked-look early return.
  const syncMouseButtons=event=>{
    if(event.pointerType!=='mouse'||typeof event.buttons!=='number')return;
    lastMouseEvent=event;mouseButtons=event.buttons;const left=!!(mouseButtons&1),right=!!(mouseButtons&2);
    if(!left)suppressPrimaryUntilRelease=false;
    if(mode!=='game'||gamePaused||paused||awaitingControl||!(pointerLocked()||lockPending||captured.has(event.pointerId)))return;
    if(world==='robot'){
      const changed=right!==aimPressHeld;aimPressHeld=right;pendingAimPress=lockPending&&right;pointerRightDown=right;
      if(changed)game?.action?.('aim',right);
    }else pointerRightDown=right;
    if(left&&!pointerDown&&!suppressPrimaryUntilRelease&&!lockPending)startDown(event);
    else if(!left&&pointerDown){pointerDown=false;pointerReleased=true;down=null;pointerDragging=false;pointerDragX=0;}
  };
  listen(canvas,'pointermove',event=>{if(mode==='game'&&awaitingControl&&world!=='robot'&&!gamePaused)takeControl(event);syncMouseButtons(event);if(pointerLocked()&&mode==='game'&&!gamePaused&&!paused){pointerDeltaX+=(event.movementX||0)*2/Math.max(1,width);pointerDeltaY-=(event.movementY||0)*2/Math.max(1,height);return;}const rect=readPointer(event),previous=pointerPositions.get(event.pointerId);pointerPositions.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(mode==='game'&&!gamePaused&&!paused){
      if(previous&&(pointerDown||pointerRightDown)){pointerDeltaX+=(event.clientX-previous.x)*2/Math.max(1,rect.width);pointerDeltaY-=(event.clientY-previous.y)*2/Math.max(1,rect.height);}
    }
    if(down&&event.pointerId===down.id){down.moved=Math.max(down.moved,Math.hypot(event.clientX-down.x,event.clientY-down.y));pointerDragging=down.moved>7;pointerDragX=pointerDragging?clamp((event.clientX-down.x)*2/Math.max(1,rect.width),-1,1):0;}
    if(mode==='showcase'){const point={x:event.clientX,y:event.clientY};if(Math.hypot(event.movementX||0,event.movementY||0)>=1||(intentAnchor&&Math.hypot(point.x-intentAnchor.x,point.y-intentAnchor.y)>=1)){pointerIntent=event.pointerType==='mouse'&&event.isTrusted===true&&!scrollState.scrolling&&!scrollState.snapping&&Math.abs(scrollState.velocity)<5;intentAnchor=point;}else if(!intentAnchor)intentAnchor=point;canvas.style.cursor='pointer';}});
  listen(canvas,'pointerdown',event=>{if(mode==='game'&&(gamePaused||paused))return;if(lifecycle==='return')return;if(mode==='game'&&awaitingControl){event.preventDefault();takeControl(event);return;}if(event.pointerType==='mouse'&&event.button!==0&&event.button!==2)return;if(event.pointerType==='mouse'){lastMouseEvent=event;mouseButtons=typeof event.buttons==='number'?event.buttons:event.button===2?2:1;}if(mode==='game'&&world==='robot'&&event.pointerType==='mouse'&&!pointerLocked()){if(event.button===2){pendingAimPress=true;aimPressHeld=true;}if(event.button===0)suppressPrimaryUntilRelease=true;if(lockPending||requestLook()){event.preventDefault();return;}pendingAimPress=false;if(event.button===0)suppressPrimaryUntilRelease=false;}readPointer(event);pointerPositions.set(event.pointerId,{x:event.clientX,y:event.clientY});controlMode=event.pointerType==='touch'?'touch':'keyboard-mouse';if(event.button===2){if(mode==='game'){aimPressHeld=world==='robot';pointerRightDown=true;capture(event.pointerId);event.preventDefault();}return;}if(event.pointerType==='mouse')suppressPrimaryUntilRelease=false;startDown(event);if(mode==='game')event.preventDefault();});
  listen(globalThis,'pointerup',event=>{if(event.pointerType==='mouse'){mouseButtons=typeof event.buttons==='number'?event.buttons:0;if(!(mouseButtons&1))suppressPrimaryUntilRelease=false;}if(event.pointerType==='touch')pointerActive=false;if(event.button===2){pendingAimPress=false;aimPressHeld=false;pointerRightDown=false;if(world==='robot')game?.action?.('aim',false);if(pointerDown)return;}else if(down&&event.pointerId===down.id){readPointer(event);const saved=down,clicked=Math.max(saved.moved,Math.hypot(event.clientX-saved.x,event.clientY-saved.y))<7;pointerDown=false;pointerReleased=true;if(saved.touchLook){pointerRightDown=false;pointerActive=false;}down=null;pointerDragging=false;pointerDragX=0;if(clicked&&!saved.touchLook)canvasClick({pointerType:saved.pointerType,wasHeld:saved.wasHeld,duration:(performance.now()-saved.time)/1000,downX:pointerDownX,downY:pointerDownY});}
    if(!pointerDown&&!pointerRightDown){captured.delete(event.pointerId);pointerPositions.delete(event.pointerId);try{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}}});
  listen(document,'pointerlockchange',()=>{
    const locked=pointerLocked();
    if(locked&&(!lookAllowed()||pendingLook?.cancelled)){clearInput();if(!pendingLook)releaseUnwantedLock();return;}
    if(locked&&awaitingControl&&controlRequested)activateControl();
    const restoreAim=locked&&pendingAimPress&&aimPressHeld,restoreFire=locked&&!!(mouseButtons&1)&&!suppressPrimaryUntilRelease,skipPause=!locked&&ignoreUnlockPause;ignoreUnlockPause=false;
    lockPending=false;clearInput(true);if(restoreAim){aimPressHeld=true;pointerRightDown=true;game?.action?.('aim',true);}if(restoreFire&&lastMouseEvent)startDown(lastMouseEvent);
    if(!locked&&mode==='game'&&!gamePaused&&!skipPause)pauseGame('pointer');else emit();
  });listen(document,'pointerlockerror',()=>{if(!pendingLook)failLook();});
  listen(canvas,'pointercancel',clearInput);listen(canvas,'lostpointercapture',event=>{if(captured.has(event.pointerId))clearInput();});listen(canvas,'contextmenu',event=>{if(mode==='game'&&!gamePaused&&!awaitingControl)event.preventDefault();});listen(globalThis,'blur',()=>{clearInput();portalEntry.clearCharge({immediate:true});pauseGame('blur');});listen(document,'visibilitychange',()=>{if(document.hidden){clearInput();pauseGame('hidden');}texturePrewarm.sync();});
  const accepted=new Set(['KeyI','KeyJ','KeyK','KeyL','KeyZ','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyE','KeyF','KeyR','KeyQ','KeyC','KeyH','Digit1','Digit2','Digit3','Digit4','Digit5']);
  const editable=event=>event.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName);
  function control(key,pressed){if(pressed&&awaitingControl&&world!=='robot'&&!gamePaused)takeControl();if(!pressed){keys.delete(key);return;}if(mode==='game'&&!gamePaused&&!paused&&!awaitingControl&&accepted.has(key))keys.add(key);}
  listen(globalThis,'keydown',event=>{if(event.code==='Escape'&&!event.defaultPrevented&&!editable(event)){if(mode==='showcase'&&lifecycle==='anticipate'){resetHover(250);emit('已取消进入');event.preventDefault();return;}if(mode==='travel'){exitGame();event.preventDefault();return;}if(mode==='game'&&!gamePaused){pauseGame('manual');event.preventDefault();return;}}if(mode==='game'&&awaitingControl&&world!=='robot'&&!gamePaused&&accepted.has(event.code)&&!editable(event))takeControl(event);if(mode!=='game'||gamePaused||paused||awaitingControl||editable(event)||(event.ctrlKey&&world!=='helmet')||event.metaKey||event.altKey)return;if(!accepted.has(event.code))return;event.preventDefault();controlMode='keyboard-mouse';control(event.code,true);});
  listen(globalThis,'keyup',event=>{if(!accepted.has(event.code))return;if(mode==='game'&&!gamePaused&&!paused&&!editable(event))event.preventDefault();control(event.code,false);});
  function resize(){if(!hoverEntry.isExplicit)resetHover();const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);const ratio=Math.min(globalThis.devicePixelRatio||1,width<760?1.25:1.5);renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);if(composer){composer.setPixelRatio?.(ratio);composer.setSize(width,height);}camera.aspect=width/height;camera.updateProjectionMatrix();game?.resize?.(width,height);}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function updateModelHover(now){
    // Gallery models stop being entries once they start flying into the living room.
    const visible=progress>.9?[]:names.filter(id=>entries[id].group.visible&&entries[id].state==='loaded');
    const surface=document.elementFromPoint?.(pointerClientX,pointerClientY);
    const scrolling=scrollState.scrolling||scrollState.snapping||Math.abs(scrollState.velocity)>=5;
    const settled=Math.abs(progress-targetProgress)<.0008&&scrollState.stable&&!scrolling;
    // Keep pointer eligibility separate from camera settling, so a real move
    // during the quiet tail survives until stable. Scroll itself never arms it.
    const eligible=showcasePointer&&(!surface||surface===canvas)&&!scrolling&&!down&&!paused&&!document.hidden;
    let hit=null;if(!settled)hoverFootprint=null;
    if(eligible){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      if(hoverFootprint&&visible.includes(hoverFootprint.id)&&isInsideModelHoverHull(hoverFootprint.hull,pointerX,pointerY))hit=hoverFootprint.id;
      else {
        hoverFootprint=null;
        const candidates=visible.map(id=>({id,hull:projectModelHoverHull(THREE,entries[id].object,camera)}));
        // Prefer the current chapter if finale models overlap in projection.
        candidates.sort((a,b)=>(b.id===world)-(a.id===world));
        const candidate=candidates.find(c=>isInsideModelHoverHull(c.hull,pointerX,pointerY));
        if(candidate){hit=candidate.id;if(settled)hoverFootprint=candidate;}
      }
    }else hoverFootprint=null;
    // A click or tap starts an explicit entry; the press itself reads as "scrolling"
    // for a moment, so only real page motion cancels it.
    const moving=scrollState.snapping||Math.abs(scrollState.velocity)>=5||Math.abs(progress-targetProgress)>=.0008;
    hoverState=hoverEntry.update(now,hit,hoverEntry.isExplicit?(!paused&&!document.hidden):eligible,{intent:pointerIntent,stable:hoverEntry.isExplicit?!moving:settled,settling:!scrolling});pointerIntent=false;lifecycle=hoverState.target?'anticipate':'browse';
    if(hoverState.target){loadGame(hoverState.target);portalEntry.charge({entry:entries[hoverState.target],world:hoverState.target,progress:hoverState.progress,time,reduced});}else portalEntry.clearCharge();
    canvas.style.cursor=hit?'pointer':'default';
    // A hover beacon sits on the current chapter's model while the camera rests there.
    let beacon=null;const pose={helmet:.395,robot:.6,car:.835}[world];
    if(!hoverState.target&&progress<=.9&&Math.abs(progress-pose)<.05&&entries[world]?.group.visible&&entries[world].state==='loaded'){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const hull=projectModelHoverHull(THREE,entries[world].object,camera);
      if(hull.length>2){let x=0,y=0,top=-Infinity;for(const q of hull){x+=q.x;y+=q.y;top=Math.max(top,q.y);}beacon={id:world,x:x/hull.length,y:y/hull.length,top};}
    }
    onFrame?.({...lifecycleState(),mode:'showcase',world,beacon,hover: {...hoverState,x:pointerX,y:pointerY}});
    if(hoverState.enter)commitEnter(hoverState.enter);
  }
  function tick(now){if(disposed||contextLost)return;frame=requestAnimationFrame(safeTick);const elapsed=(now-last)/1000,dt=clamp(elapsed,.001,.05);last=now;
    if(paused||gamePaused||document.hidden)return;time+=dt;
    if(mode==='showcase'&&quality==='ultra'&&!reduced&&previousRiftProgress>journey.riftEnd-.025&&previousRiftProgress<journey.riftEnd&&progress>=journey.riftEnd)cinematicPass?.flash();
    previousRiftProgress=progress;
    cinematicPass?.advance(dt,{velocity:mode==='showcase'?scrollState.velocity:0,rift:mode==='showcase'?journey.getRift(progress):0,charge:mode==='showcase'?hoverState.progress:0,reduced,pointerX,pointerY,field:mode==='showcase'&&showcasePointer&&!matchMedia('(pointer: coarse)').matches});
    if(lifecycle==='return'){returnElapsed+=dt;if(returnPhase==='fade'){const veil=Math.min(1,returnElapsed/.12);onFrame?.({...lifecycleState(),mode,world,travel:{veil,phase:'return',done:false}});renderScene(gameScene);if(veil>=1)restoreShowcase(true);}else{const tx=portalEntry.update(dt,{time,reduced});onFrame?.({...lifecycleState(),mode,world,travel:tx});renderScene(scene);if(tx.done||!tx.active){portalEntry.cancel();if(returnSnapshot){world=returnSnapshot.world;restoreCamera(returnSnapshot.camera);}returnSnapshot=null;returnPhase=null;mode='showcase';lifecycle='browse';resetHover(500);audio?.setPaused(false);audio?.setScene('showcase');texturePrewarm.sync();emit('已返回星际旅程');}}return;}
    if(mode==='game'&&destinationArrival.active){const arrival=destinationArrival.update(dt);renderScene(gameScene);destinationArrival.render();onFrame?.({...game.getState?.(),...lifecycleState(),mode,world,paused:false,travel:{veil:0,phase:'arrival',progress:arrival.progress,done:arrival.done}});if(arrival.done){clearInput();lifecycle='await-control';canvas.style.cursor=world==='robot'?'crosshair':'default';emit();}return;}
    if(mode==='game'&&awaitingControl){renderScene(gameScene);onFrame?.({...game.getState?.(),...lifecycleState(),mode,world,paused:false});return;}
    if(mode==='game'){game.update(dt,{keys,pointerX,pointerY,pointerActive,pointerDown,pointerRightDown,pointerDeltaX,pointerDeltaY,pointerPressed,pointerReleased,pointerDownX,pointerDownY,pointerDragging,pointerDragX,touchLook:!!down?.touchLook,pointerLocked:pointerLocked(),lookActive:pointerRightDown||pointerLocked(),reduced});if(down&&pointerDown)down.wasHeld=true;pointerDeltaX=0;pointerDeltaY=0;pointerPressed=false;pointerReleased=false;if(world==='robot')entries.robot.mixer?.update(dt);const gs={...(game.getState?.()||{}),world,mode,paused:false,pointerLocked:pointerLocked()};if(gs.dead||gs.lost)pauseGame('dead');else if((gs.completed||gs.won)&&!completionHandled){completionHandled=true;pauseGame('completed');}audio?.update({...gs,paused:gamePaused},dt);onFrame?.({...gs,...lifecycleState(),paused:gamePaused});renderScene(gameScene);if(time-lastEmit>.12){lastEmit=time;emit();}return;}
    if(mode==='travel'){
      audio?.update({mode,world},dt);const entry=entries[world];
      if(travelStart===null){
        let anchor=entry;
        if(entry.state==='loaded')entry.group.visible=true;
        else {camera.getWorldDirection(travelFocus);portalProxy.position.copy(camera.position).addScaledVector(travelFocus,8);portalProxy.visible=true;anchor=portalProxy;}
        if(!portalEntry.start({entry:anchor,world,reduced,duration:checkpoints.has(world)&&entry.state==='loaded'?.8:1.85})){exitGame({immediate:true});emit('入口暂时不可用，已返回旅程');return;}
        travelStart=time;emit('穿越通道已打开');
      }
      const tx=portalEntry.update(dt,{time,reduced});
      const readyToArrive=tx.progress>=(reduced?1:.76);
      const failed=entry.state==='error'||entry.gameState==='error',preparing=readyToArrive&&(entry.state!=='loaded'||entry.gameState!=='ready'||(world==='car'&&texturePrewarm.pending>0));
      if(preparing&&!preparingCar){preparingCar=true;emit(failed?'资源未完成 · 可重试或返回':'正在准备世界资源 · 随时可以返回');}
      const travel=preparing?{...tx,done:false,phase:failed?'error':'preparing',veil:0}:{...tx,veil:0};
      onFrame?.({...lifecycleState(),mode:'travel',world,preparing,travel});renderScene(scene);
      if(readyToArrive&&!preparing){preparingCar=false;destinationArrival.capture();portalProxy.visible=false;portalEntry.finish();buildGame(travelSession,{arrival:true});}return;
    }
    audio?.update({mode:'showcase',progress},dt);progress=reduced?targetProgress:THREE.MathUtils.damp(progress,targetProgress,9,dt);if(entries.robot.group.visible&&!reduced&&hoverState.target!=='robot')entries.robot.mixer?.update(dt);const active=journey.update(progress,reduced?0:time,dt,{width,height,quality,pointerX,pointerY,reducedMotion:reduced,reduced,mobile:width/height<.85,selected,hoverTarget:Math.abs(progress-targetProgress)<.0008?hoverState.target:null,hoverProgress:hoverState.progress});const next=names.includes(active)?active:journey.getWorld?.();if(names.includes(next)&&next!==world){world=next;emit();}
    if(!ready&&journeyReady){ready=true;onReady?.();if(!recoverySnapshot?.resumeWorld)resolveRecovery();emit();}updateModelHover(now);portalEntry.updateCharge(dt);if(mode==='showcase')renderScene(scene);
  }
  function safeTick(now){try{tick(now);texturePrewarm.update();}catch(error){paused=true;texturePrewarm.sync();cancelAnimationFrame(frame);clearInput();onError?.(error);}}
  function captureRecovery(){
    destinationArrival.cancel();
    try{const saved=game?.snapshot?.();if(saved)checkpoints.set(world,JSON.parse(JSON.stringify(saved)));}catch(error){console.warn('[open-adventure] recovery checkpoint unavailable',error);}
    const base=journeySnapshot||returnSnapshot;
    return {captureError:game&&!checkpoints.has(world)?'No safe checkpoint available':null,checkpoints:[...checkpoints],resumeWorld:lifecycle!=='return'&&['game','travel'].includes(mode)?world:null,progress:base?.progress??progress,targetProgress:base?.targetProgress??targetProgress,world:base?.world??world,selected:base?.selected??selected,sessionId,quality,reduced};
  }
  function handleContextLoss(event){event?.preventDefault?.();if(disposed||contextLost)return;const saved=captureRecovery();contextLost=true;paused=true;game?.setPaused?.(true);audio?.setPaused(true);texturePrewarm.sync();cancelAnimationFrame(frame);clearInput();releaseLock();controlRequested=false;awaitingControl=false;lifecycle='recovering';emit('图形连接中断 · 正在等待恢复，或返回章节');if(onContextLost)onContextLost(saved,api);else onError?.(new Error('WebGL context lost'));}
  listen(canvas,'webglcontextlost',handleContextLoss);
  ['helmet','robot'].forEach(id=>load(id));frame=requestAnimationFrame(safeTick);emit();
  const api={
    getDiagnostics(){return {quality,reduced,mode,progress,fov:camera.fov,postprocessing:!!composer,cinematic:!!cinematicPass?.enabled,bloom:bloomPass?{strength:bloomPass.strength,radius:bloomPass.radius,threshold:bloomPass.threshold}:null,motion:cinematicPass?{speed:cinematicPass.uniforms.uSpeed.value,impact:cinematicPass.uniforms.uImpact.value,flash:cinematicPass.uniforms.uFlash.value,motion:cinematicPass.uniforms.uMotion.value}:null,particleCount:journey.getParticleCount(),drawCalls:renderer.info.render.calls,gpu:{...renderer.info.memory}};},
    recoveryReady,isContextAvailable:()=>!disposed&&!renderer.getContext().isContextLost(),enter,exit:exitGame,restart,retry(){prepare(world,true);},control(payload,pressed){if(typeof payload==='string')control(payload,!!pressed);else control(payload?.key,!!payload?.pressed);},
    setScrollState(value={}){scrollState={...scrollState,...value};if(scrollState.scrolling||scrollState.snapping||Math.abs(scrollState.velocity)>=5)resetHover(250);},
    setProgress(value){if(mode!=='showcase')return;const next=clamp(Number(value)||0,0,1);if(next>=.66)load('car');if(next>=.78)journey.loadPlaza?.();if(Math.abs(next-targetProgress)>.0008)resetHover(250);if(Math.abs(next-targetProgress)>.004)selected=null;targetProgress=next;},
    setPointer(x,y){pointerX=clamp(Number(x)||0,-1,1);pointerY=clamp(Number(y)||0,-1,1);},
    setQuality(value){quality=normalizeQuality(value);journey.setQuality(quality);cinematicPass?.resetMotion();resize();emit();},
    setReducedMotion(value){reduced=!!value;if(reduced)cinematicPass?.resetMotion();game?.action?.('reduced',reduced);if(reduced&&destinationArrival.active){destinationArrival.cancel();lifecycle='await-control';clearInput();canvas.style.cursor=world==='robot'?'crosshair':'default';emit();}},
    setPaused(value){paused=contextLost||!!value;texturePrewarm.sync();audio?.setPaused(paused||gamePaused||awaitingControl);if(paused){clearInput();if(mode==='game')pauseGame('hidden');}last=performance.now();},
    action(name,payload){if(disposed)return;if(contextLost){if(name==='exit')exitGame({immediate:true});return;}const id=typeof payload==='string'?payload:payload?.world;if(name==='pause')pauseGame(payload);else if(name==='resume')resumeGame(payload);else if(name==='takeControl')takeControl(payload);else if(name==='continue'&&mode==='showcase')enter(names.includes(id)?id:world);else if(name==='retryCheckpoint'&&mode==='game'){clearInput();game?.action?.('retryCheckpoint');completionHandled=false;resumeGame();}else if(['freeExplore','explore'].includes(name)&&mode==='game'){if(game?.getState?.().freeExploreAvailable===false)return;clearInput();game?.action?.(world==='car'?'explore':'freeExplore');completionHandled=false;resumeGame();}else if(name==='enter')enter(names.includes(id)?id:world);else if(name==='exit')exitGame();else if(name==='restart')restart();else if(name==='nextDifficulty')nextDifficulty();else if(name==='retry')prepare(world,true);else if(name==='control')control(payload?.key,!!payload?.pressed);else if(name==='select'&&names.includes(id)&&mode==='showcase'){resetHover(250);selected=id;world=id;progress=targetProgress={helmet:.395,robot:.60,car:.84}[id];load(id,true);emit();}else if(name==='interact'&&mode==='showcase')enter(world);else if(mode==='game'&&!gamePaused&&!paused&&!awaitingControl){game.action?.(name,payload??{x:pointerX,y:pointerY});emit();}},
    getState(){return {...(game?.getState?.()||{}),...lifecycleState(),mode,world,paused:gamePaused,pauseReason,controlMode,pointerLocked:pointerLocked(),pointerLockAvailable:!pointerLockFailed&&!!canvas.requestPointerLock,progress,targetProgress,hover:{...hoverState,x:pointerX,y:pointerY},modelStatus:entries[world].state,loadedModels:names.filter(id=>entries[id].state==='loaded').length,totalModels:3};},
    dispose(){if(disposed)return;sessionId++;if(pendingLook){pendingLook.cancelled=true;pendingLook.cleanup?.();}texturePrewarm.dispose();releaseLock();clearInput();audio?.setPaused(true);destroyGame();disposed=true;rejectRecovery(new Error('World disposed'));cancelAnimationFrame(frame);observer.disconnect();listeners.forEach(remove=>remove());destinationArrival.dispose();portalEntry.dispose();portalProxy.removeFromParent();portalProxy.geometry.dispose();portalProxy.material.dispose();journey.dispose();composer?.passes?.forEach(pass=>pass.dispose?.());composer?.dispose?.();for(const entry of Object.values(entries)){entry.mixer?.stopAllAction();if(entry.asset){entry.mixer?.uncacheRoot(entry.asset);disposeModel(entry.asset);}}if(assets.weapon)disposeModel(assets.weapon);if(assets.dawnShip)disposeModel(assets.dawnShip);environment.dispose();renderer.dispose();canvas.style.touchAction=originalTouchAction;canvas.style.cursor=originalCursor;}
  };
  if(signal?.aborted){api.dispose();throw new Error('World creation cancelled');}
  if(signal){const abort=()=>api.dispose();signal.addEventListener('abort',abort,{once:true});listeners.push(()=>signal.removeEventListener('abort',abort));}
  if(recoverySnapshot){
    sessionId=(Number(recoverySnapshot.sessionId)||0)+1;progress=recoverySnapshot.progress||0;targetProgress=recoverySnapshot.targetProgress||0;selected=recoverySnapshot.selected;world=names.includes(recoverySnapshot.world)?recoverySnapshot.world:'helmet';reduced=!!recoverySnapshot.reduced;api.setQuality(recoverySnapshot.quality);
    journey.update(progress,0,0,{width,height,reducedMotion:reduced,reduced,mobile:width/height<.85,selected});
    resetHover(1000);
    if(names.includes(recoverySnapshot.resumeWorld))commitEnter(recoverySnapshot.resumeWorld);
  }
  if(renderer.getContext?.().isContextLost?.())handleContextLoss();
  return api;
  } catch(error){renderer.dispose();throw error;}
}
