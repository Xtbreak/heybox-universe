import { createGame } from './flight-game.js?v=journey-33';
import { createGameAudio } from './game-audio.js?v=journey-33';

/** Standalone adapter: the host owns renderer, camera and source GLTF resources.
 * The existing rescue provider clones the ship; this adapter never disposes it.
 * Host renders the shared scene after update(), and hides its study only while active.
 */
export function createMaterialFlight({ THREE: T, canvas, renderer, scene, camera, ship, shipSource, onExit = () => {}, onStateChange = () => {}, onStatus = () => {}, reduced = false }) {
  ship ||= shipSource;
  if (!ship?.isObject3D) throw new Error('The flight study requires the loaded flight-ship-v8.glb source.');
  const audio = createGameAudio({muted:true}), keys = new Set(), listeners = [], captures = new Set();
  const original = { cursor: canvas.style.cursor, touchAction: canvas.style.touchAction };
  let soundEnabled=false;
  const playSound=(name,options)=>{if(soundEnabled)audio.play(name,options);};
  let game = null, root = null, lights = null, disposed = false, phase = 'showcase', elapsed = 0, lastHUD = 0;
  let savedCamera = null, nativeCamera = null, savedBackground = null, entryFocus = null, pauseFrom = 'playing';
  let pointerX = 0, pointerY = 0, pointerActive = false, pointerDown = false, pointerPressed = false;
  let pointerDeltaX = 0, pointerDeltaY = 0, touchId = null, lastTouch = null;
  const startPosition = new T.Vector3(), startQuaternion = new T.Quaternion(), startScale = new T.Vector3(1,1,1);
  const materials = [], materialCopies = new Map(), shipBlend = [], entryLights = [];
  const sourceGeometries = new Set();ship.traverse(node=>{if(node.geometry)sourceGeometries.add(node.geometry);});
  const scalarProperties = ['emissiveIntensity','envMapIntensity','roughness','metalness','opacity','clearcoat','clearcoatRoughness'];
  const colorProperties = ['color','emissive'];
  const accepted = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyR','KeyF','Digit1','Digit2','Digit3']);
  const smooth = t => t*t*(3-2*t), active = () => phase !== 'showcase' && !disposed;
  const listen = (target, name, fn, options) => { target.addEventListener(name, fn, options); listeners.push(() => target.removeEventListener(name, fn, options)); };
  const snapshotCamera = () => ({position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,near:camera.near,far:camera.far});
  const restoreCamera = s => { camera.position.copy(s.position);camera.quaternion.copy(s.quaternion);camera.up.copy(s.up);camera.fov=s.fov;camera.near=s.near;camera.far=s.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true); };
  const editable = event => event.target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName);
  const state = () => ({active:active(), phase, paused:phase==='paused', state:game?.getState?.() || null});
  const emit = () => { onStateChange(state()); };
  const clearInput = () => {
    keys.clear(); pointerActive=false;pointerDown=false;pointerPressed=false;pointerX=pointerY=pointerDeltaX=pointerDeltaY=0;touchId=null;lastTouch=null;
    game?.action('fire',false);game?.resetInput?.();
    for(const id of [...captures]) { captures.delete(id);try { if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id); } catch {} }
  };
  // This HUD is specific to the sample. No global IDs or existing game UI are modified.
  const hud = document.createElement('section');hud.className='material-flight-hud';hud.hidden=true;hud.setAttribute('aria-label','飞行任务');
  hud.style.cssText='position:fixed;inset:0;z-index:30;pointer-events:none;color:#dcecf4;font:12px/1.6 system-ui,sans-serif';
  hud.innerHTML='<div style="position:absolute;top:24px;left:28px;max-width:60vw"><div data-flight-mission style="font-size:14px;letter-spacing:.12em"></div><div data-flight-status style="opacity:.65"></div></div><div style="position:absolute;right:24px;top:24px;display:flex;gap:8px;pointer-events:auto"><button type="button" data-flight-pause>暂停</button><button type="button" data-flight-exit>返回模型</button></div><div data-flight-stats style="position:absolute;left:28px;bottom:28px"></div><div data-flight-help style="position:absolute;right:28px;bottom:28px;max-width:45vw;opacity:.6;text-align:right">鼠标转向 · WASD 飞行 · Space 上升 / Ctrl 下降<br>左键开火 · Shift 加速 · 1–3 武器 · R 目标信息 · F 诱饵</div><div data-flight-overlay hidden style="position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:16px;background:#02070dab;pointer-events:auto"><strong data-flight-title style="font-size:28px;font-weight:400"></strong><p data-flight-message></p><div style="display:flex;gap:12px"><button type="button" data-flight-resume>继续飞行</button><button type="button" data-flight-restart>重新出发</button><button type="button" data-flight-back>返回模型</button></div></div><div data-flight-touch style="position:absolute;bottom:95px;right:24px;gap:8px;pointer-events:auto;display:none"><button type="button" data-key="Space">上升</button><button type="button" data-key="ControlLeft">下降</button><button type="button" data-key="KeyW">加速</button><button type="button" data-key="KeyS">刹停</button><button type="button" data-fire>开火</button></div>';
  document.body.append(hud);
  const find = s => hud.querySelector(s), overlay=find('[data-flight-overlay]');
  // hidden must beat the explicit grid declaration, without relying on host CSS.
  const showOverlay = visible => { overlay.hidden=!visible;overlay.style.display=visible?'grid':'none'; };
  showOverlay(false);
  for(const button of hud.querySelectorAll('button'))button.style.cssText='font:inherit;color:inherit;background:#08131bd9;border:1px solid #8bb6ce44;border-radius:4px;padding:8px 14px;cursor:pointer;touch-action:none';
  const unlock = event => { if(soundEnabled&&event?.isTrusted)void audio.unlock(); };
  function refreshHUD() {
    if(!game)return;const s=game.getState();
    find('[data-flight-mission]').textContent=s.missionTitle+' · '+s.mission;
    find('[data-flight-status]').textContent=s.statusText;
    find('[data-flight-stats]').textContent=`舰体 ${s.hull}%   护盾 ${s.shield}%   ${s.speed} m/s   ${s.weapon} · ${s.ammo}`;
    const terminal=s.dead||s.completed;find('[data-flight-title]').textContent=s.dead?'舰体失效':s.completed?'救援完成':'飞行已暂停';
    find('[data-flight-message]').textContent=s.dead?s.failureReason:s.completed?'曙光号已安全抵达。':'继续后重新接管飞行。';
    find('[data-flight-resume]').hidden=!!terminal;
  }
  function prepare() {
    if(disposed)throw new Error('Flight adapter disposed');if(game)return true;
    const before=snapshotCamera(), children=new Set(scene.children);
    try {
      game=createGame({THREE:T,scene,camera,model:null,assets:{flightShip:ship,flightEngineLayout:[[-1.047945,0,4.104452],[1.047945,0,4.104452]],flightEngineRadius:.36,flightMuzzleLayout:[[-.480308,0,-4.25],[.480308,0,-4.25]]},reduced,sound:playSound,emit:onStatus});
      root=scene.children.find(child=>!children.has(child)&&child.name==='Nacre-rescue-sector');
      if(!root)throw new Error('Flight provider did not create its world root');
      root.visible=false;nativeCamera=snapshotCamera();game.setPaused(true);
      // Reveal only the environment. Player meshes retain the same GLTF materials.
      const actor=root.children[0], playerNodes=new Set();actor?.traverse(node=>playerNodes.add(node));
      root.traverse(node=>{if(!node.material||playerNodes.has(node))return;const originals=Array.isArray(node.material)?node.material:[node.material];
        const copies=originals.map(material=>{let copy=materialCopies.get(material);if(!copy){copy=material.clone();materialCopies.set(material,copy);materials.push({material:copy,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});}return copy;});
        node.userData.materialStudyOriginalMaterial=node.material;node.material=Array.isArray(node.material)?copies:copies[0];
      });
      lights=new T.Group();const fill=new T.HemisphereLight(0xb8def4,0x111526,1.3);lights.add(fill);
      for(const [color,intensity,x,y,z] of [[0xe4f6ff,2,-7,14,5],[0x69bde8,1.5,9,5,-9]]){const light=new T.DirectionalLight(color,intensity);light.position.set(x,y,z);lights.add(light);}lights.children.forEach(light=>{light.userData.materialStudyIntensity=light.intensity;});lights.visible=false;scene.add(lights);
      return true;
    } catch(error) { game?.dispose?.();game=null;root=null;onStateChange({...state(),error});throw error; }
    finally {restoreCamera(before);}
  }
  function reveal(t) {
    const v=T.MathUtils.clamp(t,0,1);
    for(const record of materials){record.material.opacity=record.opacity*v;record.material.transparent=v<1||record.transparent;record.material.depthWrite=v>=1&&record.depthWrite;}
  }
  function blendAppearance(t) {
    for(const record of shipBlend){
      for(const key of scalarProperties)if(Number.isFinite(record.from[key])&&Number.isFinite(record.to[key]))record.material[key]=T.MathUtils.lerp(record.from[key],record.to[key],t);
      for(const key of colorProperties)if(record.from[key]?.isColor&&record.to[key]?.isColor)record.material[key].copy(record.from[key]).lerp(record.to[key],t);
    }
    for(const light of lights?.children||[])light.intensity=light.userData.materialStudyIntensity*t;
    for(const light of entryLights)light.intensity=light.userData.materialStudyIntensity*(1-t);
  }
  function copyEntryAppearance(object) {
    if(!object)return;
    const displayByGeometry=new Map();object.traverse(node=>{if(sourceGeometries.has(node.geometry))displayByGeometry.set(node.geometry,node);});
    root.children[0]?.traverse(node=>{if(!sourceGeometries.has(node.geometry)||!node.material)return;const displayed=displayByGeometry.get(node.geometry);if(!displayed)return;
      const original=node.material,targets=Array.isArray(original)?original:[original],from=Array.isArray(displayed.material)?displayed.material:[displayed.material];
      const copies=targets.map((material,i)=>{const copy=material.clone();shipBlend.push({material:copy,from:from[i]||from[0],to:material});return copy;});
      node.userData.materialStudyOriginalMaterial=original;node.material=Array.isArray(original)?copies:copies[0];
    });
    let studyRoot=object;while(studyRoot.parent&&studyRoot.parent!==scene)studyRoot=studyRoot.parent;
    studyRoot.traverse(light=>{if(!light.isLight)return;const clone=light.clone();clone.position.copy(light.getWorldPosition(new T.Vector3()));clone.quaternion.copy(light.getWorldQuaternion(new T.Quaternion()));clone.scale.setScalar(1);clone.userData.materialStudyIntensity=light.intensity;
      if(light.target){clone.target=light.target.clone();clone.target.position.copy(light.target.getWorldPosition(new T.Vector3()));scene.add(clone.target);}
      scene.add(clone);entryLights.push(clone);
    });
  }
  function enter(options={}) {
    if(disposed||active()||document.hidden)return false;
    prepare();savedCamera=snapshotCamera();savedBackground=scene.background;entryFocus=document.activeElement;clearInput();
    elapsed=0;phase='entering';root.visible=true;lights.visible=true;root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);
    const object=options.entryObject;
    if(object?.isObject3D){
      object.updateWorldMatrix(true,true);
      // Measure in the wrapper's local frame. A world-axis box would grow as the
      // study rotates, causing the shared ship to jump in size on handoff.
      const inverse=object.matrixWorld.clone().invert(),bounds=new T.Box3().makeEmpty();
      object.traverse(node=>{if(!sourceGeometries.has(node.geometry))return;node.geometry.computeBoundingBox();const matrix=inverse.clone().multiply(node.matrixWorld);bounds.union(node.geometry.boundingBox.clone().applyMatrix4(matrix));});
      const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()).applyMatrix4(object.matrixWorld);
      const worldScale=object.getWorldScale(new T.Vector3());
      object.getWorldQuaternion(startQuaternion);startScale.copy(worldScale).multiplyScalar(Math.max(size.x,size.y,size.z,.01)/8.5);
      startPosition.copy(new T.Vector3(0,12,65).multiply(startScale).applyQuaternion(startQuaternion)).negate().add(center);
    }else{startQuaternion.identity();startScale.setScalar(.4);startPosition.set(0,-4.8,-26);}
    root.position.copy(startPosition);root.quaternion.copy(startQuaternion);root.scale.copy(startScale);reveal(0);copyEntryAppearance(object);blendAppearance(0);
    hud.hidden=false;canvas.style.cursor='crosshair';canvas.style.touchAction='none';showOverlay(false);audio.setScene('helmet');audio.setPaused(false);playSound('warp');refreshHUD();emit();return true;
  }
  function pause(reason='manual') {
    if(!active()||phase==='paused')return;pauseFrom=phase;phase='paused';clearInput();game.setPaused(true);audio.setPaused(true);showOverlay(true);refreshHUD();emit();
  }
  function resume(event) {
    if(disposed||phase!=='paused'||document.hidden)return false;const s=game.getState();if(s.dead||s.completed)return false;
    unlock(event);clearInput();phase=pauseFrom;game.setPaused(phase!=='playing');audio.setPaused(false);showOverlay(false);emit();return true;
  }
  function destroyGame() {
    for(const record of shipBlend)record.material.dispose();shipBlend.length=0;for(const light of entryLights){light.removeFromParent();light.target?.removeFromParent();}entryLights.length=0;
    if(root)root.traverse(node=>{if(node.userData.materialStudyOriginalMaterial){node.material=node.userData.materialStudyOriginalMaterial;delete node.userData.materialStudyOriginalMaterial;}});
    game?.dispose();game=null;root=null;lights?.removeFromParent();lights=null;for(const copy of materialCopies.values())copy.dispose();materialCopies.clear();materials.length=0;
  }
  function exit() {
    if(!active())return false;clearInput();phase='showcase';destroyGame();hud.hidden=true;showOverlay(false);scene.background=savedBackground;
    if(savedCamera)restoreCamera(savedCamera);savedCamera=null;audio.setPaused(true);audio.setScene('showcase');canvas.style.cursor=original.cursor;canvas.style.touchAction=original.touchAction;
    try{entryFocus?.focus?.({preventScroll:true});}catch{}entryFocus=null;emit();onExit({requireFreshHover:true});return true;
  }
  function update(dt,time=0) {
    if(!active())return false;dt=T.MathUtils.clamp(Number(dt)||0,0,.05);
    if(phase==='entering') {
      elapsed+=dt;const duration=reduced?.45:1.4,t=T.MathUtils.clamp(elapsed/duration,0,1),ease=smooth(t);
      root.position.copy(startPosition).multiplyScalar(1-ease);root.quaternion.copy(startQuaternion).slerp(new T.Quaternion(),ease);root.scale.copy(startScale).lerp(new T.Vector3(1,1,1),ease);root.updateMatrixWorld(true);
      const target=nativeCamera.position.clone().applyMatrix4(root.matrixWorld);
      camera.position.copy(savedCamera.position).lerp(target,ease);camera.quaternion.copy(savedCamera.quaternion).slerp(nativeCamera.quaternion,ease);camera.up.copy(savedCamera.up).lerp(nativeCamera.up,ease);
      camera.fov=T.MathUtils.lerp(savedCamera.fov,nativeCamera.fov,ease);camera.far=nativeCamera.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      reveal(smooth(T.MathUtils.clamp(t*1.5,0,1)));blendAppearance(ease);
      if(savedBackground?.isColor)scene.background=savedBackground.clone().lerp(new T.Color('#02070d'),ease);
      if(t>=1){phase='playing';restoreCamera(nativeCamera);clearInput();game.setPaused(false);emit();}
    }else if(phase==='playing') {
      game.update(dt,{keys,pointerX,pointerY,pointerActive,pointerDown,pointerPressed,pointerDeltaX,pointerDeltaY,touchLook:touchId!==null,pointerRightDown:touchId!==null,reduced});
      pointerDeltaX=pointerDeltaY=0;pointerPressed=false;const s=game.getState();if(soundEnabled)audio.update({...s,world:'helmet',paused:false},dt);if(s.dead||s.completed)pause(s.dead?'dead':'completed');
    }
    lastHUD+=dt;if(lastHUD>.12){lastHUD=0;refreshHUD();}return true;
  }
  const readPointer=event=>{const rect=canvas.getBoundingClientRect();pointerX=T.MathUtils.clamp((event.clientX-rect.left)/Math.max(1,rect.width)*2-1,-1,1);pointerY=T.MathUtils.clamp(1-(event.clientY-rect.top)/Math.max(1,rect.height)*2,-1,1);pointerActive=true;};
  listen(canvas,'pointermove',event=>{if(phase!=='playing')return;readPointer(event);if(touchId===event.pointerId&&lastTouch){pointerDeltaX+=(event.clientX-lastTouch.x)*2/Math.max(1,canvas.clientWidth);pointerDeltaY-=(event.clientY-lastTouch.y)*2/Math.max(1,canvas.clientHeight);lastTouch={x:event.clientX,y:event.clientY};}if(event.pointerType==='mouse'&&pointerDown&&!(event.buttons&1)){pointerDown=false;game.action('fire',false);}});
  listen(canvas,'pointerdown',event=>{if(phase!=='playing')return;unlock(event);readPointer(event);if(event.pointerType==='touch'){touchId=event.pointerId;lastTouch={x:event.clientX,y:event.clientY};find('[data-flight-touch]').style.display='flex';}else if(event.button===0){pointerDown=true;pointerPressed=true;}else return;event.preventDefault();try{canvas.setPointerCapture(event.pointerId);captures.add(event.pointerId);}catch{}});
  listen(globalThis,'pointerup',event=>{if(!active())return;if(event.pointerId===touchId){touchId=null;lastTouch=null;pointerActive=false;}if(event.button===0){pointerDown=false;game?.action('fire',false);}captures.delete(event.pointerId);try{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}});
  listen(canvas,'pointerleave',()=>{pointerActive=false;if(touchId===null){pointerDown=false;game?.action('fire',false);}});
  listen(canvas,'pointercancel',clearInput);listen(canvas,'lostpointercapture',event=>{if(captures.has(event.pointerId))clearInput();});
  listen(canvas,'contextmenu',event=>{if(active())event.preventDefault();});
  listen(globalThis,'keydown',event=>{if(!active()||editable(event)||event.metaKey||event.altKey)return;if(event.code==='Escape'){event.preventDefault();phase==='paused'?resume(event):pause();return;}if(phase!=='playing'||!accepted.has(event.code))return;event.preventDefault();unlock(event);keys.add(event.code);});
  listen(globalThis,'keyup',event=>{keys.delete(event.code);if(active()&&accepted.has(event.code)&&!editable(event))event.preventDefault();});
  listen(globalThis,'blur',()=>pause('blur'));listen(document,'visibilitychange',()=>{if(document.hidden)pause('hidden');});
  listen(find('[data-flight-pause]'),'click',()=>pause());listen(find('[data-flight-exit]'),'click',exit);listen(find('[data-flight-back]'),'click',exit);listen(find('[data-flight-resume]'),'click',resume);
  listen(find('[data-flight-restart]'),'click',event=>{if(!game)return;unlock(event);clearInput();root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);reveal(1);blendAppearance(1);game.action('restart');game.setPaused(false);phase='playing';audio.setPaused(false);showOverlay(false);refreshHUD();emit();});
  for(const button of hud.querySelectorAll('[data-key],[data-fire]')){
    const release=()=>{if(button.dataset.key)keys.delete(button.dataset.key);else{pointerDown=false;game?.action('fire',false);}};
    listen(button,'pointerdown',event=>{if(phase!=='playing')return;event.preventDefault();unlock(event);if(button.dataset.key)keys.add(button.dataset.key);else pointerDown=true;try{button.setPointerCapture(event.pointerId);}catch{}});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(button,name,release);
  }
  function setSoundEnabled(enabled,event){soundEnabled=!!enabled;audio.setMuted(!soundEnabled);if(soundEnabled&&(event?.isTrusted||globalThis.navigator?.userActivation?.isActive))void audio.unlock();return soundEnabled;}
  function dispose(){if(disposed)return;if(active())exit();else destroyGame();disposed=true;clearInput();listeners.splice(0).forEach(remove=>remove());hud.remove();void audio.dispose();}
  return {prepare,enter,start:enter,exit,update,pause,resume,setSoundEnabled,setReveal:reveal,resize(){game?.resize?.(canvas.clientWidth,canvas.clientHeight);},dispose,getState:state,get active(){return active();},get phase(){return phase;}};
}
