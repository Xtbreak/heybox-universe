import { createMiniatureLandscape } from './miniature-landscape.js?v=journey-34';
import { createMiniatureCar } from './miniature-car.js?v=journey-34';
import { createPlaygroundProps } from './miniature-playground-props.js?v=journey-34';
import { CAR, clamp, wrap, damp, footprintContact, buildSolidIndex, createDynamics, integrateCar, integrateVertical } from './miniature-driving-physics.js?v=journey-34';

/* TOYBOX. An original orange toy landscape for responsive, unrestricted driving.
 * All world/car/effect resources belong to this provider. The showcase model is never modified.
 */
export function createGame({THREE:T,scene,camera,emit=()=>{},sound=()=>{},width=1280,height=720,reduced=false}) {
  const root=new T.Group();root.name='Toybox · orange world free exploration';
  const prior={background:scene.background,fog:scene.fog,environment:scene.environment,environmentIntensity:scene.environmentIntensity,lights:[]};
  scene.traverse(o=>{if(o.isLight){prior.lights.push([o,o.visible]);o.visible=false;}});
  scene.add(root);scene.background=new T.Color(0xf5aa58);scene.fog=new T.Fog(0xf5aa58,160,340);scene.environment=null;scene.environmentIntensity=.25;
  const hemi=new T.HemisphereLight(0xffedd3,0xd1834b,2.5);root.add(hemi);
  const sun=new T.DirectionalLight(0xffe5bd,3.1);sun.position.set(-65,100,45);sun.castShadow=true;
  sun.shadow.mapSize.set(reduced?1024:2048,reduced?1024:2048);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=75;sun.shadow.camera.bottom=-75;sun.shadow.camera.near=1;sun.shadow.camera.far=240;sun.shadow.normalBias=.055;sun.shadow.bias=-.00015;sun.shadow.radius=3;root.add(sun,sun.target);
  const world=createMiniatureLandscape({THREE:T,scene:root,reduced});
  if(world.root&&!world.root.parent)root.add(world.root);
  const car=createMiniatureCar({THREE:T});
  const actor=new T.Group(),orient=new T.Group();actor.name='player-car-ground-contact';orient.rotation.y=Math.PI;actor.add(orient);orient.add(car.root);root.add(actor);
  const ownedG=[],ownedM=[];
  const geometry=g=>(ownedG.push(g),g),material=m=>(ownedM.push(m),m);
  const dummy=new T.Object3D();
  const skidFlat=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
  const dustCount=reduced?28:64,skidCount=reduced?160:360;
  const dustMat=material(new T.MeshBasicMaterial({color:0xf8c27b,transparent:true,opacity:.3,depthWrite:false}));
  const dust=new T.InstancedMesh(geometry(new T.IcosahedronGeometry(1,0)),dustMat,dustCount);dust.name='pooled trail dust';dust.frustumCulled=false;root.add(dust);
  const skidMat=material(new T.MeshBasicMaterial({color:0xb5653a,transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  const skids=new T.InstancedMesh(geometry(new T.PlaneGeometry(1,1)),skidMat,skidCount);skids.name='pooled tire ribbons';skids.frustumCulled=false;root.add(skids);
  const particles=Array.from({length:dustCount},()=>({life:0,max:1,x:0,y:0,z:0,vx:0,vz:0,size:0}));
  for(const mesh of [dust,skids]){for(let i=0;i<mesh.count;i++){dummy.scale.setScalar(0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);}
  let dustCursor=0,skidCursor=0,dustClock=0,skidClock=0,randomSeed=72431;
  const random=()=>((randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0)/4294967296);
  const roads=world.roads||[];
  const landmarks=(world.landmarks||[]).map(l=>({...l}));
  const bounds=typeof world.bounds==='number'?world.bounds:world.bounds?.maxX||165;
  const roadPoints=road=>road.points||road;
  const mapRoads=roads.map(r=>roadPoints(r).map(p=>({x:p.x,z:p.z})));
  const mapRoadArrays=mapRoads.map(r=>r.map(p=>[p.x,p.z]));
  const spawn=world.spawn||{x:0,z:0,heading:0};
  let vehicle=createDynamics(spawn),y=0,age=0,distance=0,view=0,wheelRotation=0,rpm=.12,gear='N',headlights=false,paused=false,disposed=false;
  let lastSafe={...spawn},safeClock=0,contactFlash=0,hornReady=0,status='开着小红车，沿奶油色道路探索五个玩具区。冲坡、保龄球、积木，随便玩。',previousKeys=new Set(),cameraPrimed=false,cameraHeading=vehicle.heading;
  let resetPadDwell=0,resetPadArmed=true;
  let pitch=0,roll=0,previousSpeed=0,terrainPitch=0,terrainRoll=0,landingCamera=0;
  const cameraTarget=new T.Vector3(),goal=new T.Vector3(),look=new T.Vector3();
  const querySolids=buildSolidIndex(world.colliders||world.solids||[]);
  const sample=(x,z)=>{
    const value=world.sample?.(x,z)||world.sampleSurface?.(x,z)||{};
    return {height:Number.isFinite(value.height)?value.height:0,surface:value.surface||'grass',...value};
  };
  const props=createPlaygroundProps({THREE:T,root,world,sample});
  const signedSpeed=()=>vehicle.vx*Math.sin(vehicle.heading)+vehicle.vz*Math.cos(vehicle.heading);
  const feedback=text=>{status=text;emit(text);};
  const soundEvent=(name,params={})=>{try{sound(name,params);}catch{}};
  const invalidSurface=s=>s.surface==='water'||s.water===true||s.drivable===false||!Number.isFinite(s.height);
  function corners(p,padding=0) {
    const sin=Math.sin(p.heading),cos=Math.cos(p.heading),hw=CAR.halfWidth+padding,hl=CAR.halfLength+padding;
    return [[-hw,-hl],[hw,-hl],[-hw,hl],[hw,hl],[0,0]].map(([a,b])=>({x:p.x+cos*a+sin*b,z:p.z-sin*a+cos*b}));
  }
  function terrainSafe(p,padding=0) {
    if(Math.abs(p.x)>bounds-3||Math.abs(p.z)>bounds-3)return false;
    const points=corners(p,padding),samples=points.map(q=>sample(q.x,q.z));
    return samples.every(s=>!invalidSurface(s))&&Math.max(...samples.map(s=>s.height))-Math.min(...samples.map(s=>s.height))<2.6;
  }
  function collisionAt(p,padding=0) {
    const floor=Number.isFinite(p.y)?p.y:sample(p.x,p.z).height;
    for(const solid of querySolids(p.x,p.z,4+padding)){
      const sy=solid.y??floor;
      if(sy>floor+2.2||sy+(solid.height??20)<floor+.08)continue;
      const contact=footprintContact(p,solid,padding);if(contact)return contact;
    }
    return null;
  }
  function safePose(p,terrainPadding=.15,solidPadding=.2){return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.heading)&&terrainSafe(p,terrainPadding)&&!collisionAt(p,solidPadding);}
  function nearestRoad(x,z){
    if(world.nearestRoad){const n=world.nearestRoad(x,z);if(n&&Number.isFinite(n.x)&&Number.isFinite(n.z))return n;}
    let best=null;
    for(const road of roads){const points=roadPoints(road);for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;if(!len2)continue;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1),px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(px-x,pz-z);
      if(!best||d<best.distance)best={x:px,z:pz,heading:Math.atan2(dx,dz),distance:d,road};
    }}return best||{...spawn,distance:0};
  }
  function findRecovery(){
    const near=nearestRoad(vehicle.x,vehicle.z),heading=Number.isFinite(near.heading)?near.heading:vehicle.heading;
    // Keep the direction closest to the driver's existing orientation.
    const direction=Math.abs(wrap(heading-vehicle.heading))>Math.PI/2?wrap(heading+Math.PI):heading;
    for(const offset of [0,4,-4,8,-8,14,-14]){
      const pose={x:near.x+Math.sin(heading)*offset,z:near.z+Math.cos(heading)*offset,heading:direction};if(safePose(pose))return pose;
    }
    if(safePose(lastSafe))return {...lastSafe};
    for(const road of roads)for(const p of roadPoints(road)){const q={x:p.x,z:p.z,heading};if(safePose(q))return q;}
    return {...spawn};
  }
  function place(p){vehicle=createDynamics(p);y=sample(vehicle.x,vehicle.z).height;vehicle.y=y;pitch=roll=terrainPitch=terrainRoll=landingCamera=0;previousSpeed=0;cameraHeading=vehicle.heading;cameraPrimed=false;resetInput();}
  function recover(){place(findRecovery());lastSafe={x:vehicle.x,z:vehicle.z,heading:vehicle.heading};feedback('回到附近的平地，继续玩。');prepareView();}
  function restart(){resetPadDwell=0;resetPadArmed=true;props.reset();place(spawn);distance=0;age=0;lastSafe={...spawn};wheelRotation=0;status='开着小红车，沿奶油色道路探索五个玩具区。冲坡、保龄球、积木，随便玩。';clearTrails();prepareView();}
  function clearTrails(){for(const p of particles)p.life=0;for(let i=0;i<skidCount;i++){dummy.scale.setScalar(0);dummy.updateMatrix();skids.setMatrixAt(i,dummy.matrix);}skids.instanceMatrix.needsUpdate=true;updateDust(0);}
  function step(dt,controls){
    const before={x:vehicle.x,z:vehicle.z,heading:vehicle.heading},sin=Math.sin(vehicle.heading),cos=Math.cos(vehicle.heading),ground=sample(vehicle.x,vehicle.z);
    ground.grade=(sample(vehicle.x+sin*1.3,vehicle.z+cos*1.3).height-sample(vehicle.x-sin*1.3,vehicle.z-cos*1.3).height)/2.6;
    integrateCar(vehicle,controls,ground,dt);
    const nextSurface=sample(vehicle.x,vehicle.z);
    const oldCorners=corners(before),newCorners=corners(vehicle);
    const blockedRise=(nextSurface.height-ground.height>.18&&nextSurface.height>vehicle.y+.18)||newCorners.some((q,i)=>{
      const h=sample(q.x,q.z).height,old=sample(oldCorners[i].x,oldCorners[i].z).height;
      return h-old>.18&&h>vehicle.y+.18;
    });
    if(!terrainSafe(vehicle)||blockedRise){
      vehicle.x=before.x;vehicle.z=before.z;vehicle.heading=before.heading;vehicle.vx*=.28;vehicle.vz*=.28;vehicle.yaw*=.3;
    } else {
      let struck=false;
      for(let pass=0;pass<4;pass++){
        const hit=collisionAt(vehicle);if(!hit)break;struck=true;
        vehicle.x+=hit.x*(hit.depth+.006);vehicle.z+=hit.z*(hit.depth+.006);
        const into=vehicle.vx*hit.x+vehicle.vz*hit.z;
        if(into<0){vehicle.vx-=hit.x*into*1.08;vehicle.vz-=hit.z*into*1.08;}
        vehicle.vx*=.78;vehicle.vz*=.78;vehicle.yaw*=.35;
      }
      if(struck){if(contactFlash<=0&&Math.hypot(vehicle.vx,vehicle.vz)>1.5)soundEvent('collision',{intensity:.2});contactFlash=.25;}
      if(!terrainSafe(vehicle)||collisionAt(vehicle)){vehicle.x=before.x;vehicle.z=before.z;vehicle.heading=before.heading;vehicle.vx=vehicle.vz=vehicle.yaw=0;}
    }
    const wasGrounded=vehicle.grounded;
    const contactSurface=sample(vehicle.x,vehicle.z);
    if(!contactSurface.normal&&world.groundHeight){
      const e=.25,hx=(world.groundHeight(vehicle.x+e,vehicle.z)-world.groundHeight(vehicle.x-e,vehicle.z))/(2*e),hz=(world.groundHeight(vehicle.x,vehicle.z+e)-world.groundHeight(vehicle.x,vehicle.z-e))/(2*e);
      contactSurface.normal={x:-hx,y:1,z:-hz};
    }
    const landing=integrateVertical(vehicle,ground,contactSurface,dt);
    if(wasGrounded&&!vehicle.grounded&&vehicle.vy>1)soundEvent('jump',{intensity:.16});
    if(landing>2){landingCamera=Math.min(.32,landing*.025);soundEvent('land',{intensity:clamp(landing/16,.12,.65)});}
    const propImpact=props.step(dt,vehicle);
    if(propImpact>1.5&&contactFlash<=0){soundEvent('collision',{intensity:clamp(propImpact/28,.12,.65),pitch:1.1});contactFlash=.12;}
    distance+=Math.hypot(vehicle.x-before.x,vehicle.z-before.z);
  }
  function updateDust(dt){
    for(let i=0;i<dustCount;i++){
      const p=particles[i];p.life=Math.max(0,p.life-dt);
      if(p.life>0){p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=dt*.3;const life=p.life/p.max;dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(i*.71,i*.29,i*.43);dummy.scale.setScalar(p.size*(1+(1-life)*2)*Math.min(1,life*3));}
      else dummy.scale.setScalar(0);
      dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);
    }dust.instanceMatrix.needsUpdate=true;
  }
  function trails(dt,speed,surface){
    const sin=Math.sin(vehicle.heading),cos=Math.cos(vehicle.heading),loose=!['asphalt','tarmac','bridge'].includes(surface);
    if(vehicle.grounded&&speed>2&&(loose||vehicle.skid>.13)){
      dustClock+=dt;const every=reduced?.1:.045;
      if(dustClock>=every){dustClock=0;for(const side of [-1,1]){
        const px=vehicle.x+cos*CAR.track*.5*side-sin*1.35,pz=vehicle.z-sin*CAR.track*.5*side-cos*1.35;
        const p=particles[dustCursor++%dustCount];Object.assign(p,{x:px,y:sample(px,pz).height+.2,z:pz,vx:-vehicle.vx*.07+(random()-.5)*.5,vz:-vehicle.vz*.07+(random()-.5)*.5,life:.65+random()*.35,max:1,size:.17+Math.min(speed,20)*.012});
      }}
    }
    if(vehicle.grounded&&speed>3&&vehicle.skid>.12){skidClock+=dt;if(skidClock>.04){const length=Math.max(.25,speed*skidClock);skidClock=0;for(const side of [-1,1]){
      const px=vehicle.x+cos*CAR.track*.5*side-sin*1.31,pz=vehicle.z-sin*CAR.track*.5*side-cos*1.31;
      const h=sample(px,pz).height;dummy.position.set(px,h+.025,pz);dummy.quaternion.copy(actor.quaternion).multiply(skidFlat);dummy.scale.set(.19,length,1);dummy.updateMatrix();skids.setMatrixAt(skidCursor++%skidCount,dummy.matrix);
    }skids.instanceMatrix.needsUpdate=true;}}
    updateDust(dt);
  }
  function updateCar(dt){
    const sin=Math.sin(vehicle.heading),cos=Math.cos(vehicle.heading),front=sample(vehicle.x+sin*1.31,vehicle.z+cos*1.31).height,rear=sample(vehicle.x-sin*1.31,vehicle.z-cos*1.31).height;
    const left=sample(vehicle.x-cos*.84,vehicle.z+sin*.84).height,right=sample(vehicle.x+cos*.84,vehicle.z-sin*.84).height;
    y=vehicle.y;
    const ground=sample(vehicle.x,vehicle.z),n=ground.normal;
    let targetPitch=0,targetRoll=0;
    if(vehicle.grounded){
      targetPitch=n?-Math.atan2(-(n.x*sin+n.z*cos),n.y):-Math.atan2(clamp(front-rear,-1.5,1.5),2.62);
      targetRoll=n?Math.atan2(-(n.x*cos-n.z*sin),n.y):Math.atan2(clamp(right-left,-.75,.75),1.68);
    }else targetPitch=-Math.atan2(vehicle.vy,Math.max(8,Math.hypot(vehicle.vx,vehicle.vz)));
    terrainPitch=damp(terrainPitch,clamp(targetPitch,-.45,.45),vehicle.grounded?16:2.8,dt||1);
    terrainRoll=damp(terrainRoll,clamp(targetRoll,-.3,.3),vehicle.grounded?14:2,dt||1);
    actor.position.set(vehicle.x,y,vehicle.z);actor.rotation.set(terrainPitch,vehicle.heading,terrainRoll,'YXZ');
    const speed=signedSpeed(),acceleration=dt>0?(speed-previousSpeed)/dt:0;previousSpeed=speed;
    pitch=damp(pitch,reduced?0:clamp(acceleration*.004,-.052,.052),7,dt);roll=damp(roll,reduced?0:clamp(vehicle.yaw*speed*.008,-.12,.12),8,dt);
    if(car.body){car.body.rotation.x=-pitch;car.body.rotation.z=-roll;car.body.position.y=vehicle.suspension;}
    wheelRotation-=speed*dt/(car.wheelRadius||CAR.radius);
    car.update({steering:vehicle.steering*.55/(1+Math.abs(speed)*.032),wheelRotation,headlights,braking:vehicle.braking});
  }
  function updateCamera(dt,snap=false){
    const speed=Math.hypot(vehicle.vx,vehicle.vz);
    // Default lens is anchored to the world: steering never swings the horizon.
    if(view)cameraHeading=wrap(cameraHeading+wrap(vehicle.heading-cameraHeading)*(snap?1:1-Math.exp(-3*dt)));
    const sin=Math.sin(cameraHeading),cos=Math.cos(cameraHeading);
    landingCamera=damp(landingCamera,0,8,dt);
    if(view)goal.set(vehicle.x-sin*13,y+8,vehicle.z-cos*13);
    else goal.set(vehicle.x+27,y+34,vehicle.z+34);
    goal.y=Math.max(goal.y,sample(goal.x,goal.z).height+(view?5:24));
    const ahead=view?4+Math.min(speed,30)*.1:0;
    look.set(vehicle.x+Math.sin(vehicle.heading)*ahead,y+.7,vehicle.z+Math.cos(vehicle.heading)*ahead);
    if(snap||!cameraPrimed){camera.position.copy(goal);cameraTarget.copy(look);cameraPrimed=true;}else{camera.position.lerp(goal,1-Math.exp(-(view?5:4)*dt));cameraTarget.lerp(look,1-Math.exp(-6*dt));}
    camera.lookAt(cameraTarget);camera.fov=damp(camera.fov,view?47:40,snap?1000:5,snap?1:dt);camera.updateProjectionMatrix();
    // Keep the sharp shadow frustum centred on the car without altering the sun direction.
    sun.position.set(vehicle.x-65,100+y,vehicle.z+45);sun.target.position.set(vehicle.x,y,vehicle.z);sun.target.updateMatrixWorld();
  }
  function readControls(input,keys){
    const key=(...names)=>names.some(k=>keys.has(k));
    const forward=key('KeyW','w','W','ArrowUp'),back=key('KeyS','s','S','ArrowDown'),left=key('KeyA','a','A','ArrowLeft'),right=key('KeyD','d','D','ArrowRight');
    let steer=(left?1:0)-(right?1:0),drive=(forward?1:0)-(back?1:0);
    const joystick=input.joystick||input.stick;
    if(joystick){if(!left&&!right)steer=-clamp(Number(joystick.x)||0,-1,1);if(!forward&&!back)drive=-clamp(Number(joystick.y)||0,-1,1);}
    if(!left&&!right&&Number.isFinite(input.steer))steer=clamp(input.steer,-1,1);
    if(!forward&&!back&&Number.isFinite(input.throttle))drive=clamp(input.throttle,-1,1);
    if(!left&&!right&&(input.pointerDragging??input.pointerDown)){const p=clamp(Number(input.pointerDragX??input.pointerX)||0,-1,1);steer=Math.abs(p)<.06?0:-Math.sign(p)*(Math.abs(p)-.06)/.94;}
    return {steer,drive,handbrake:key('Space',' ')||!!input.handbrake};
  }
  function update(dt,input={}){
    if(disposed||paused)return;dt=clamp(Number.isFinite(dt)?dt:0,0,.05);age+=dt;contactFlash=Math.max(0,contactFlash-dt);
    const keys=input.keys instanceof Set?input.keys:new Set(input.keys||[]),edge=(...names)=>names.some(k=>keys.has(k)&&!previousKeys.has(k));
    if(edge('KeyR','r','R'))recover();if(edge('KeyC','c','C'))action('camera');if(edge('KeyH','h','H'))action('horn');if(edge('KeyE','e','E'))action('headlights');
    const controls=readControls(input,keys),steps=Math.max(1,Math.ceil(dt/(1/120)));
    for(let i=0;i<steps;i++)step(dt/steps,controls);
    updateCar(dt);const speed=Math.hypot(vehicle.vx,vehicle.vz),ground=sample(vehicle.x,vehicle.z);
    trails(dt,speed,ground.surface);world.update?.(dt,{x:vehicle.x,z:vehicle.z,age});
    const resetPad=world.playground?.resetPad;
    if(resetPad){
      const inside=Math.hypot(vehicle.x-resetPad.x,vehicle.z-resetPad.z)<(resetPad.radius||2.5)&&vehicle.grounded;
      if(!inside){resetPadDwell=0;resetPadArmed=true;}
      else if(resetPadArmed){resetPadDwell+=dt;if(resetPadDwell>.85){props.reset();resetPadArmed=false;feedback('玩具重新摆好了，再来一次。');soundEvent('horn',{intensity:.12});}}
    }
    safeClock+=dt;if(safeClock>.65){safeClock=0;if(vehicle.grounded&&safePose(vehicle)&&nearestRoad(vehicle.x,vehicle.z).distance<5)lastSafe={x:vehicle.x,z:vehicle.z,heading:vehicle.heading};}
    const longitudinal=signedSpeed();gear=longitudinal<-.15?'R':Math.abs(longitudinal)<.15?'N':String(clamp(1+Math.floor(speed/8),1,5));
    rpm=damp(rpm,gear==='N'?.12:clamp(.18+(speed%8)/13+vehicle.throttle*.13,.12,.92),8,dt);
    updateCamera(dt);previousKeys=new Set(keys);
  }
  function action(name,payload){
    if(disposed)return false;
    if(['recover','retryCheckpoint','retry'].includes(name)){recover();return true;}
    if(name==='restart'){restart();return true;}
    if(name==='camera'){view=payload==='chase'?1:payload==='miniature'?0:1-view;cameraPrimed=false;feedback(view?'近距跟车视角':'玩具世界俯瞰视角');prepareView();return true;}
    if(name==='horn'){if(age>=hornReady){soundEvent('horn');hornReady=age+.65;}return true;}
    if(name==='headlights'){headlights=!headlights;car.update({steering:vehicle.steering*.4,wheelRotation,headlights,braking:vehicle.braking});return true;}
    if(['explore','freeExplore'].includes(name)){feedback('没有路线要求，想去哪儿就去哪儿。');return true;}
    return false;
  }
  function snapshot(){return {version:'toybox-roam-v3',game:'driving',position:{x:vehicle.x,y:vehicle.y,z:vehicle.z},heading:vehicle.heading,distance,view,headlights,lastSafe:{...lastSafe},
    dynamics:{vx:vehicle.vx,vz:vehicle.vz,vy:vehicle.vy,yaw:vehicle.yaw,grounded:vehicle.grounded,suspension:vehicle.suspension,suspensionVelocity:vehicle.suspensionVelocity},props:props.snapshot()};}
  function restore(saved){
    if(!saved||saved.version!=='toybox-roam-v3'||saved.game!=='driving'){restart();return false;}
    const modern=saved.version==='toybox-roam-v3',pose={x:saved.position?.x,z:saved.position?.z,heading:saved.heading};
    const d=saved.dynamics;
    if(modern){
      if(!d||!Number.isFinite(saved.position?.y)||!['vx','vz','vy','yaw','suspension','suspensionVelocity'].every(k=>Number.isFinite(d[k]))||typeof d.grounded!=='boolean'||!Array.isArray(saved.props)) {restart();return false;}
      if(Math.abs(d.vx)>60||Math.abs(d.vz)>60||Math.abs(d.vy)>40||Math.abs(d.yaw)>5||Math.abs(d.suspension)>.3||Math.abs(d.suspensionVelocity)>10||saved.position.y>80||saved.position.y<sample(pose.x,pose.z).height-.3){restart();return false;}
      if(saved.props.some(p=>!p||typeof p.id!=='string'||![p.position,p.velocity,p.quaternion,p.omega].every((a,i)=>Array.isArray(a)&&a.length===(i===2?4:3)&&a.every(Number.isFinite)))){restart();return false;}
      pose.y=saved.position.y;
    }
    if(!safePose(pose,0,0)){restart();return false;}
    place(pose);if(modern){Object.assign(vehicle,d);vehicle.y=saved.position.y;props.restore(saved.props);}else props.reset();
    distance=Number.isFinite(saved.distance)?clamp(saved.distance,0,1e8):0;view=saved.view===1?1:0;headlights=saved.headlights===true;
    lastSafe=safePose(saved.lastSafe)?{...saved.lastSafe}:{x:pose.x,z:pose.z,heading:pose.heading};clearTrails();prepareView();return true;
  }
  function getState(){
    const near=nearestRoad(vehicle.x,vehicle.z),ground=sample(vehicle.x,vehicle.z),closest=landmarks.reduce((a,l)=>!a||Math.hypot(l.x-vehicle.x,l.z-vehicle.z)<Math.hypot(a.x-vehicle.x,a.z-vehicle.z)?l:a,null);
    const location=ground.location||((closest&&Math.hypot(closest.x-vehicle.x,closest.z-vehicle.z)<42)?closest.name:ground.roadName||near.road?.name||'橘色玩具世界');
    return {freeExplore:true,freeExploreAvailable:true,completed:false,dead:false,ended:false,won:false,lost:false,canInteract:false,canRetryCheckpoint:true,
      worldName:'TOYBOX',sceneProfile:'miniature-free-roam',location,statusText:status,prompt:'自由探索 · 随心兜风',interactionPrompt:'',
      instruction:'WASD / 方向键驾驶 · 空格手刹 · R 回路面 · C 切换视角 · H 鸣笛 · E 车灯',
      speed:Math.round(Math.hypot(vehicle.vx,vehicle.vz)*3.6),signedSpeed:signedSpeed(),rpm,throttle:vehicle.throttle,skid:vehicle.skid,braking:vehicle.braking,steering:vehicle.steering,gear,
      distance:Math.floor(distance),surface:ground.surface,roadName:ground.roadName||near.road?.name||'',roadDistance:near.distance||0,
      heading:vehicle.heading,mapHeading:wrap(Math.PI-vehicle.heading),position:{x:vehicle.x,y,z:vehicle.z},velocity:{x:vehicle.vx,y:vehicle.vy,z:vehicle.vz},airborne:!vehicle.grounded,suspension:vehicle.suspension,playground:props.state(),
      cameraMode:view?'chase':'miniature',headlights,navigationMode:'explore',landmarks,
      map:{bounds,player:{x:vehicle.x,z:vehicle.z,heading:vehicle.heading},roads:mapRoads,landmarks,route:[]},mapSize:bounds*2,mapRoads:mapRoadArrays,route:[],
      environmentArt:{version:'toybox-roam-v3',style:'warm-orange-toy-world',...(world.stats||{})}
    };
  }
  function resetInput(){previousKeys.clear();vehicle.steering=0;vehicle.throttle=0;vehicle.braking=false;}
  function prepareView(){updateCar(0);updateCamera(0,true);}
  function resize(w,h){camera.aspect=Math.max(1,w)/Math.max(1,h);camera.updateProjectionMatrix();}
  function setPaused(value){paused=!!value;if(paused)resetInput();}
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();world.dispose?.();props.dispose();car.dispose?.();dust.dispose();skids.dispose();sun.shadow.dispose();ownedG.forEach(g=>g.dispose());ownedM.forEach(m=>m.dispose());scene.background=prior.background;scene.fog=prior.fog;scene.environment=prior.environment;scene.environmentIntensity=prior.environmentIntensity;for(const [light,visible]of prior.lights)light.visible=visible;}
  if(!safePose(spawn)){const p=findRecovery();place(p);lastSafe={...p};}else place(spawn);
  resize(width,height);prepareView();
  return {update,action,getState,snapshot,restore,retryCheckpoint:recover,resetInput,prepareView,resize,setPaused,dispose};
}
