/** Model-specific, owned scene-space entry sets. Caller owns the cancellable 2s dwell. */
export function createPortalEntry({THREE:T,scene,camera,reduced=false,duration=1.85,onTravel}={}) {
  if(!T||!scene||!camera)throw new Error('Portal entry requires THREE, scene and camera.');
  const owned=new Set(),own=x=>(owned.add(x),x),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const sat=x=>Math.max(0,Math.min(1,Number(x)||0)),smooth=x=>(x=sat(x),x*x*(3-2*x)),range=(a,b,x)=>smooth((x-a)/(b-a)),lerp=(a,b,t)=>a+(b-a)*t;
  const root=new T.Group();root.name='owned-model-portal';root.visible=false;scene.add(root);
  const accents=new T.Group();accents.name='owned-model-socket-effects';accents.visible=false;scene.add(accents);
  const overlays=new T.Group();overlays.name='owned-model-scan';overlays.visible=false;scene.add(overlays);
  const cube=own(new T.BoxGeometry(1,1,1));
  const mat=(color,opacity=1,extra={})=>own(new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,...extra}));
  const mesh=(geo,material,parent,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.raycast=()=>{};parent.add(m);return m;};
  const box=(g,x,y,z,sx,sy,sz,m)=>{const o=mesh(cube,m,g,x,y,z);o.scale.set(sx,sy,sz);return o;};
  const groups={};for(const k of ['helmet','robot','car']){const g=new T.Group();g.name='portal-arrival-'+k;root.add(g);groups[k]=g;}
  const steel=mat(0x263c47),dark=mat(0x101f29),edge=mat(0xa3c6c5),mint=mat(0x89edd2),amber=mat(0xf8c47a),glass=mat(0x7099a0);
  const glow=mat(0x8fdaff,.65,{depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const sphere=own(new T.SphereGeometry(1,24,16));
  let seed=71238;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  // SPACE: open starfield, a cockpit canopy and dashboard, not a common tunnel.
  const space=groups.helmet;
  const spaceSky=mesh(sphere,mat(0x030a18,1,{side:T.BackSide}),space,0,0,-20);spaceSky.scale.setScalar(95);
  const planet=mesh(own(new T.IcosahedronGeometry(1,3)),mat(0x5b7b99),space,-11,5,-46);planet.scale.setScalar(7);
  const moon=mesh(sphere,mat(0xadc1ce),space,13,7,-58);moon.scale.setScalar(2.2);
  const starArray=new Float32Array(240*3);for(let i=0;i<240;i++){starArray[i*3]=(random()-.5)*100;starArray[i*3+1]=(random()-.5)*70;starArray[i*3+2]=-13-random()*65;}
  const starGeo=own(new T.BufferGeometry());starGeo.setAttribute('position',new T.BufferAttribute(starArray,3));
  const stars=new T.Points(starGeo,own(new T.PointsMaterial({color:0xc9e6ff,size:.065})));stars.raycast=()=>{};space.add(stars);
  const cockpit=new T.Group();cockpit.name='flight-cockpit';cockpit.position.set(0,0,-2.3);space.add(cockpit);
  box(cockpit,0,-.73,0,2.55,.28,.75,dark);box(cockpit,0,-.56,-.18,1.1,.06,.38,steel);
  for(const x of [-1.17,1.17]){box(cockpit,x,.05,-.45,.1,1.65,.12,steel);const strut=box(cockpit,x*.6,.88,-.45,1.3,.08,.1,steel);strut.rotation.z=x>0?-.35:.35;}
  for(let i=0;i<5;i++)box(cockpit,-.39+i*.19,-.516,-.2,.11,.008,.16,i===2?amber:glow);
  const streakCount=70,streakArray=new Float32Array(streakCount*6),streakSeeds=[];
  for(let i=0;i<streakCount;i++)streakSeeds.push({a:random()*Math.PI*2,r:1.8+random()*9,z:random()*44,v:.6+random()*.8});
  const streakGeo=own(new T.BufferGeometry());streakGeo.setAttribute('position',new T.BufferAttribute(streakArray,3));
  const streakMat=own(new T.LineBasicMaterial({color:0xb1ddff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
  const streaks=new T.LineSegments(streakGeo,streakMat);streaks.frustumCulled=false;streaks.raycast=()=>{};space.add(streaks);
  // FACILITY: heavy split doors lead directly into a rectangular industrial hall.
  const facility=groups.robot;
  box(facility,0,-1.19,-12,8,.2,30,dark);box(facility,0,2,-12,8,.2,30,steel);
  for(const x of [-3.25,3.25])box(facility,x,.4,-12,.25,3.4,30,dark);
  const doorway=new T.Group();doorway.name='facility-airlock';doorway.position.z=-1.8;facility.add(doorway);
  for(const x of [-1.75,1.75]){box(doorway,x,.35,0,.4,3.1,.55,steel);box(doorway,x-Math.sign(x)*.23,.3,.3,.035,2.7,.035,mint);}
  box(doorway,0,1.92,0,3.9,.35,.55,steel);box(doorway,0,1.71,.29,2.3,.035,.03,amber);
  const doors=[];for(const side of [-1,1]){const g=new T.Group();g.position.x=side*.77;doorway.add(g);box(g,0,.35,0,1.5,2.72,.22,steel);box(g,-side*.67,.35,.13,.03,2.2,.03,mint);for(let j=0;j<3;j++)box(g,0,-.45+j*.15,.14,.45,.045,.02,amber);doors.push({g,side});}
  for(let i=0;i<8;i++){const z=-4-i*3;for(const x of [-2.8,2.8]){box(facility,x,.4,z,.28,3,.35,steel);box(facility,x*.96,.65,z+.2,.025,1.7,.025,mint);}box(facility,0,1.8,z,5.7,.22,.3,steel);box(facility,0,1.66,z,1.4,.025,.25,edge);}
  for(const x of [-2.1,2.1])box(facility,x,-1.075,-13,.045,.015,27,mint);
  for(let i=0;i<5;i++){const x=i%2?-2.1:2.1,z=-7-i*4;box(facility,x,-.65,z,.75,.85,.8,steel);box(facility,x,-.18,z,.78,.08,.83,amber);}
  box(facility,0,.4,-27,6.5,3.3,.2,dark);
  // TOY PLAZA: warm orange play tiles, cream path pieces and a chunky RC jeep.
  // Every piece belongs to this transition; no provider assets are borrowed.
  const plaza=groups.car;
  const sky=mesh(sphere,mat(0xf5883c,1,{side:T.BackSide}),plaza,0,0,-25);sky.scale.setScalar(85);
  const orange=mat(0xff9043),orangeLight=mat(0xf5aa58),orangeDark=mat(0xe47732),roadMat=mat(0xfccf92),cream=mat(0xffebc7),red=mat(0xd83d32),rubber=mat(0x333137),toyGlass=mat(0x343e47),hubMat=mat(0xeac9a3),brickMat=mat(0xd96a3a);
  box(plaza,0,-1.48,-25,110,.55,110,orange);
  const roadX=z=>Math.sin((-z-2)*.095)*1.35;
  for(let i=0;i<54;i++){
    const z=2-i*1.05,x=roadX(z),yaw=Math.atan2(roadX(z-1.05)-x,1.05);
    const road=box(plaza,x,-1.115,z,3.4,.12,1.09,roadMat);road.rotation.y=-yaw;
    for(const side of [-1,1]){const tile=box(plaza,x+side*3.7,-1.21,z,3.85,.24,1.02,(i+Number(side>0))%3?orange:orangeLight);tile.rotation.y=-yaw;}
  }
  const hillGeo=own(new T.IcosahedronGeometry(1,2)),toyConeGeo=own(new T.ConeGeometry(.22,.7,12)),studGeo=own(new T.CylinderGeometry(.12,.12,.08,12));
  function brick(parent,x,y,z,scale=1){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);box(g,0,.22,0,.95,.44,.52,brickMat);for(const a of [-.29,0,.29])for(const b of [-.14,.14])mesh(studGeo,orangeLight,g,a,.48,b);return g;}
  function toyCone(parent,x,y,z,scale=1){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);box(g,0,.04,0,.5,.08,.5,cream);mesh(toyConeGeo,orangeDark,g,0,.41,0);const stripe=mesh(own(new T.CylinderGeometry(.09,.14,.15,12)),cream,g,0,.43,0);return g;}
  for(let i=0;i<22;i++){
    const side=i%2?-1:1,z=-4-Math.floor(i/2)*4.2,x=roadX(z)+side*(3.6+(i%3)*1.25);
    if(i%3===0){const b=brick(plaza,x,-1.07,z,1.1+(i%4)*.22);b.rotation.y=side*.35;}
    else toyCone(plaza,x,-1.07,z,.9+(i%3)*.24);
    if(i%4===0){const block=box(plaza,x+side*3,-.47,z-1.5,2.1,1.2,1.75,orangeLight);block.rotation.y=side*.2;}
  }
  const wheelGeo=own(new T.CylinderGeometry(.235,.235,.18,16));wheelGeo.rotateZ(Math.PI/2);
  const hubGeo=own(new T.CylinderGeometry(.105,.105,.188,12));hubGeo.rotateZ(Math.PI/2);
  const wheelTreads=own(new T.BoxGeometry(.195,.05,.07));
  function jeep(parent,scale=1){
    const g=new T.Group();g.name='chunky-red-rc-jeep';g.scale.setScalar(scale);parent.add(g);
    box(g,0,.31,0,.83,.26,1.3,red);box(g,0,.43,-.37,.77,.15,.48,red);
    box(g,0,.55,.12,.69,.34,.62,toyGlass);box(g,0,.745,.12,.78,.08,.73,cream);
    for(const x of [-.35,.35]){box(g,x,.56,-.18,.05,.34,.06,red);box(g,x,.56,.4,.05,.34,.06,red);box(g,x,.42,.12,.075,.1,.62,red);}
    box(g,0,.3,-.69,.89,.12,.12,rubber);box(g,0,.3,.68,.89,.12,.12,rubber);
    box(g,0,.43,-.624,.33,.12,.026,rubber);
    for(const x of [-.29,.29])box(g,x,.44,-.624,.16,.1,.032,cream);
    const spare=mesh(wheelGeo,rubber,g,0,.48,.75);spare.rotation.y=Math.PI/2;const spareHub=mesh(hubGeo,hubMat,g,0,.48,.75);spareHub.rotation.y=Math.PI/2;
    const antenna=box(g,.25,.98,.32,.022,.46,.022,rubber);antenna.rotation.z=-.12;
    const wheels=[];for(const x of [-.46,.46])for(const z of [-.43,.43]){const pivot=new T.Group();pivot.position.set(x,.235,z);g.add(pivot);mesh(wheelGeo,rubber,pivot);mesh(hubGeo,hubMat,pivot);for(let i=0;i<12;i++){const a=i*Math.PI/6,t=mesh(wheelTreads,rubber,pivot,0,Math.cos(a)*.235,Math.sin(a)*.235);t.rotation.x=a;}wheels.push(pivot);}
    return {g,wheels};
  }
  const lead=jeep(plaza),leadCar=lead.g,wheels=lead.wheels;
  const shadow=mesh(own(new T.CircleGeometry(.8,24)),mat(0x854a2b,.19,{depthWrite:false}),leadCar,0,.008,0);shadow.rotation.x=-Math.PI/2;shadow.scale.set(.75,1.05,1);
  // Accents follow source matrices, but never change source transforms/materials.
  const anchored=new T.Group();anchored.matrixAutoUpdate=false;accents.add(anchored);
  const flame=mat(0x79cbff,.65,{depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}),core=mat(0xd5f4ff,.8,{depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const cone=own(new T.ConeGeometry(1,1,12,1,true));cone.rotateX(Math.PI/2);cone.translate(0,0,.5);
  const engines=[];for(let i=0;i<2;i++){const g=new T.Group();anchored.add(g);engines.push({g,plume:mesh(cone,flame,g),core:mesh(cone,core,g),size:1});}
  // Exhaust is directional in the source asset's own coordinates, never a halo.
  const wakeCount=36,wakeArray=new Float32Array(wakeCount*6),wakeGeo=own(new T.BufferGeometry());
  wakeGeo.setAttribute('position',new T.BufferAttribute(wakeArray,3));
  const wakeMat=own(new T.LineBasicMaterial({color:0x8cbad4,transparent:true,opacity:0,depthWrite:false}));
  const wake=new T.LineSegments(wakeGeo,wakeMat);wake.name='engine-directional-wake';wake.frustumCulled=false;wake.raycast=()=>{};anchored.add(wake);
  const scanner=new T.Group();scanner.name='facility-model-scan';accents.add(scanner);
  // Two optical shutters close towards a narrow inspection slot, then retract.
  // These are facility optics, deliberately without a gun or crosshair.
  const optics=new T.Group();optics.name='facility-focusing-optics';accents.add(optics);
  const opticalMat=mat(0x81b5ad,.24,{depthWrite:false}),opticalEdge=mat(0xb1dace,.52,{depthWrite:false});
  const shutters=[];for(const side of [-1,1]){const g=new T.Group();optics.add(g);box(g,0,0,0,1,.16,.035,opticalMat);box(g,0,-side*.082,.025,1,.012,.025,opticalEdge);shutters.push({g,side});}

  const scanBar=box(scanner,0,0,0,1,.012,1,mat(0xa2f4d9,.45,{depthWrite:false,blending:T.AdditiveBlending}));
  const scanMat=mat(0x87e8ce,.5,{depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,blending:T.AdditiveBlending});
  const scanUniforms={charge:{value:0},minY:{value:0},height:{value:1},sweep:{value:0}};
  scanMat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{portalCharge:scanUniforms.charge,portalMinY:scanUniforms.minY,portalHeight:scanUniforms.height,portalSweep:scanUniforms.sweep});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 portalWorld;').replace('#include <project_vertex>','#include <project_vertex>\nportalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 portalWorld;uniform float portalCharge;uniform float portalMinY;uniform float portalHeight;uniform float portalSweep;').replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, opacity );float py=(portalWorld.y-portalMinY)/max(.001,portalHeight);diffuseColor.a*=portalCharge*(.05+.8*exp(-pow(abs((py-portalSweep)*13.),2.)));');};
  scanMat.customProgramCacheKey=()=> 'contextual-facility-scan-v14';
  const warmLights=mat(0xffe3a8,.65,{depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const carDust=new T.Group();carDust.name='warm-car-road-dust';accents.add(carDust);
  const dustMat=mat(0xfccf92,.12,{depthWrite:false}),dust=[];for(let i=0;i<8;i++){const m=mesh(hillGeo,dustMat,carDust);dust.push(m);}
  // Bounded, owned 3D stagelets: visible throughout the two-second dwell.
  // They share the arrival frame, but never borrow or mutate game model assets.
  const anticipation=new T.Group();anticipation.name='owned-contextual-anticipation';anticipation.visible=false;scene.add(anticipation);
  const previewGroups={},previewParts=[];
  const previewSteel=mat(0x304149),previewEdge=mat(0x667f87),previewDark=mat(0x14242d),previewAmber=mat(0x977850);
  for(const name of ['helmet','robot','car']){const g=new T.Group();g.name='anticipation-'+name;anticipation.add(g);previewGroups[name]=g;}
  const part=(name,label,x,y,z,begin,end,animate)=>{const g=new T.Group();g.name=label;g.position.set(x,y,z);previewGroups[name].add(g);previewParts.push({g,begin,end,animate});return g;};
  for(const side of [-1,1]){
    const rail=part('helmet','launch-support-rail',side*.87,-.55,0,0,.35,(g,k)=>{g.scale.set(1,k,k);});
    box(rail,0,0,-.45,.16,.16,2.5,previewSteel);for(let i=0;i<5;i++)box(rail,0,.09,-1.3+i*.46,.12,.025,.08,previewAmber);
    const clamp=part('helmet','retracting-launch-clamp',side*.82,-.48,.05,.08,.94,(g,k)=>{g.position.x=side*(.82+k*.47);g.rotation.z=-side*k*.72;g.scale.setScalar(range(0,.22,k));});
    box(clamp,0,.28,0,.18,.65,.28,previewSteel);box(clamp,-side*.2,.59,0,.48,.13,.32,previewEdge);
    const wing=part('helmet','unfolding-flight-console',side*1.1,-.3,-.75,.15,.8,(g,k)=>{g.rotation.z=side*(1-k)*1.35;g.scale.setScalar(k);});
    box(wing,0,.1,0,.53,.65,.12,previewDark);for(let i=0;i<3;i++)box(wing,0,-.07+i*.17,.07,.35,.035,.025,i===1?previewAmber:previewEdge);
    const brace=part('helmet','canopy-launch-strut',side*1.3,.1,-1.03,.4,1,(g,k)=>{g.position.y=-.5+k*.6;g.scale.set(1,k,1);});
    box(brace,0,.45,0,.075,1.8,.11,previewSteel);const cap=box(brace,-side*.31,1.29,0,.7,.075,.11,previewEdge);cap.rotation.z=side*.28;
    const tower=part('robot','rising-airlock-column',side*1.05,-.65,-.72,0,.4,(g,k)=>{g.scale.y=k;});
    box(tower,0,.85,0,.23,1.9,.3,previewSteel);box(tower,-side*.135,.86,.17,.035,1.45,.025,previewEdge);
    const door=part('robot','physical-split-airlock',side*.46,-.65,-.85,.2,1,(g,k)=>{g.position.x=side*(.46+k*.84);g.rotation.y=-side*k*.25;g.scale.y=range(0,.28,k);});
    box(door,0,.77,0,.86,1.55,.14,previewDark);box(door,-side*.39,.77,.08,.045,1.46,.03,previewEdge);for(let i=0;i<3;i++)box(door,0,.3+i*.13,.09,.3,.04,.02,previewAmber);
    const gantry=part('robot','robot-service-arm',side*1.22,-.4,.1,.08,.9,(g,k)=>{g.rotation.z=side*(.5-k*.7);g.position.x=side*(1.02+k*.35);g.scale.setScalar(range(0,.28,k));});
    box(gantry,0,.22,0,.13,.65,.18,previewSteel);box(gantry,-side*.24,.55,0,.55,.13,.16,previewEdge);
  }
  const lintel=part('robot','telescoping-airlock-header',0,1.17,-.72,.15,.65,(g,k)=>{g.scale.set(k,1,1);});box(lintel,0,0,0,2.35,.17,.3,previewSteel);
  for(let i=0;i<7;i++){
    const slab=part('robot','extending-facility-floor',0,-.7,.7-i*.4,.05+i*.07,.5+i*.07,(g,k)=>{g.scale.set(k,.3+k*.7,k);});box(slab,0,0,0,2.45,.065,.41,previewDark);for(const side of [-1,1])box(slab,side*.92,.04,0,.045,.015,.25,previewEdge);
    const tile=part('car','unfolding-orange-toy-tile',0,-.6,.95-i*.52,i*.085,.33+i*.085,(g,k)=>{g.scale.set(1,k,k);g.rotation.x=(1-k)*-.95;});
    box(tile,0,-.05,0,2.75,.16,.51,i%2?orange:orangeLight);box(tile,0,.055,0,1.12,.055,.515,roadMat);
  }
  for(let i=0;i<10;i++){
    const side=i%2?1:-1,z=.7-Math.floor(i/2)*.7;
    const toy=part('car',i%3?'rising-toy-cone':'unfolding-studded-brick',side*1.04,-.55,z,.18+i*.043,.54+i*.043,(g,k)=>{g.rotation.z=side*(1-k)*1.1;g.scale.setScalar(k);});
    if(i%3)toyCone(toy,0,0,0,.55);else brick(toy,0,0,0,.55);
  }
  const miniature=part('car','starting-red-rc-jeep',0,-.51,.62,.35,1,(g,k)=>{g.position.z=.62-k*2.25;g.scale.setScalar(range(0,.2,k));});
  const previewJeep=jeep(miniature,.48),previewWheels=previewJeep.wheels;
  // A fixed GPU point pool bridges the digital homepage into physical stagelets.
  // No sprites, DOM layers, timers, source mutations or picking surfaces are added.
  const particleCount=224,particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3),particleSeeds=[];
  const particleGeo=own(new T.BufferGeometry());particleGeo.setAttribute('position',new T.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new T.BufferAttribute(particleColors,3));
  const particleMat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.NormalBlending,toneMapped:false,
    uniforms:{opacity:{value:0},pointScale:{value:1}},
    vertexShader:'attribute vec3 color;varying vec3 tint;uniform float pointScale;void main(){tint=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(pointScale*105./max(.1,-mv.z),1.,5.);}',
    fragmentShader:'varying vec3 tint;uniform float opacity;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.15,.5,d))*opacity;if(a<.002)discard;gl_FragColor=vec4(tint,a);}'
  }));
  const particles=new T.Points(particleGeo,particleMat);particles.name='owned-converging-entry-particles';particles.frustumCulled=false;particles.raycast=()=>{};particles.visible=false;scene.add(particles);
  for(let i=0;i<particleCount;i++){const a=random()*Math.PI*2,z=random()*2-1,r=Math.sqrt(1-z*z),spread=1.8+random()*2.1;particleSeeds.push({x:Math.cos(a)*r,y:z,z:Math.sin(a)*r,spread,phase:random()*Math.PI*2,tone:random()});}
  const silver=new T.Color(0xaac1ce),ice=new T.Color(0x72b6de),particleTint=new T.Color(),worldTint={helmet:new T.Color(0x94c9ed),robot:new T.Color(0x89c7b7),car:new T.Color(0xe8b376)};
  function poseParticles(p,travel=0,still=false){
    particles.position.copy(root.position);particles.quaternion.copy(root.quaternion);particles.scale.copy(root.scale);
    const gather=smooth(still?.62:p),move=still?0:range(0,.7,travel),palette=range(.04,.62,travel),fade=range(0,.2,p)*(1-range(.48,.96,travel));
    particleMat.uniforms.opacity.value=(still?.19:.52)*fade;particleMat.uniforms.pointScale.value=radius;
    particles.visible=!disposed&&fade>.0001;
    for(let i=0;i<particleCount;i++){const s=particleSeeds[i],j=i*3,extent=lerp(s.spread,.62+s.tone*.35,gather),swirl=(still?0:Math.sin(s.phase+gather*2.3)*.12*(1-gather));
      particlePositions[j]=s.x*extent+swirl;particlePositions[j+1]=s.y*extent*.82;
      particlePositions[j+2]=s.z*extent-move*(2+s.tone*18);
      particleTint.copy(silver).lerp(ice,s.tone*.65).lerp(worldTint[world],palette);
      particleColors[j]=particleTint.r;particleColors[j+1]=particleTint.g;particleColors[j+2]=particleTint.b;
    }
    particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;
  }
  // Distinct owned materials let the full-size destination emerge without an
  // opaque sky/floor suddenly covering the homepage at the dwell boundary.
  function fadeSet(group){const result=[],copies=new Map();group.traverse(node=>{if(!node.material)return;const copy=m=>{if(!copies.has(m)){const c=own(m.clone());copies.set(m,c);result.push({material:c,opacity:m.opacity,depthWrite:m.depthWrite,transparent:m.transparent});}return copies.get(m);};node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);});return result;}
  const travelMaterials=fadeSet(root),anticipationMaterials=fadeSet(anticipation),cockpitMaterials=fadeSet(cockpit);
  function fadeMaterials(set,opacity){for(const item of set){item.material.opacity=item.opacity*opacity;item.material.transparent=item.transparent||opacity<.999;item.material.depthWrite=item.depthWrite&&opacity>=.999;}}
  let entryCharge=1;
  let releaseProgress=0,chargeTarget=0,chargeVisualOffset=0,chargeReleasing=false;
  function poseAnticipation(p,still=false){
    const display=still?.62:p;anticipation.visible=display>.0001&&!disposed;
    anticipation.position.copy(root.position);anticipation.quaternion.copy(root.quaternion);anticipation.scale.copy(root.scale);
    const floorOffset=(world==='car'?.6:world==='robot'?.7:.55)-scratch.size.y/(2*radius);anticipation.position.add(V(0,floorOffset*radius,0).applyQuaternion(root.quaternion));
    for(const name of Object.keys(previewGroups))previewGroups[name].visible=name===world;
    for(const item of previewParts){const k=range(item.begin,item.end,display);item.g.visible=k>.0001;if(k>0)item.animate(item.g,k);}
    for(const w of previewWheels)w.rotation.x=-display*19;
  }
  const scratch={bounds:new T.Box3(),size:V(),center:V(),matrix:new T.Matrix4(),inv:new T.Matrix4(),sceneInv:new T.Matrix4(),anchorInv:new T.Matrix4(),nodeMatrix:new T.Matrix4(),localBounds:new T.Box3(),nodeBounds:new T.Box3(),anchorSize:V(),anchorCenter:V(),local:V(),look:V(),forward:V(),startLook:V()};
  let active=false,disposed=false,source=null,anchor=null,sourcePairs=[],lightPairs=[],world='helmet',radius=1.8,chargeProgress=0,elapsed=0,snapshot=null,route=null,returning=false,reducedMode=!!reduced,runDuration=duration,phase='idle';
  const cameraSnapshot=()=>({position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,near:camera.near,far:camera.far,zoom:camera.zoom});
  function restoreCamera(){if(!snapshot)return;camera.position.copy(snapshot.position);camera.quaternion.copy(snapshot.quaternion);camera.up.copy(snapshot.up);for(const k of ['fov','near','far','zoom'])camera[k]=snapshot[k];camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function visibleInTree(n){for(;n;n=n.parent)if(!n.visible)return false;return true;}
  function syncOverlays(){scene.updateWorldMatrix(true,false);scratch.sceneInv.copy(scene.matrixWorld).invert();if(anchor)anchored.matrix.multiplyMatrices(scratch.sceneInv,anchor.matrixWorld);for(const {node,copy}of [...sourcePairs,...lightPairs]){copy.matrix.multiplyMatrices(scratch.sceneInv,node.matrixWorld);copy.visible=visibleInTree(node)&&(!lightPairs.some(pair=>pair.copy===copy)||world==='car');if(node.morphTargetInfluences)copy.morphTargetInfluences=node.morphTargetInfluences;}}
  function releaseOverlays(){overlays.clear();for(const {copy}of lightPairs)copy.removeFromParent();sourcePairs=[];lightPairs=[];source=null;anchor=null;accents.visible=false;}
  function setSource(entry){
    const object=entry?.object||entry?.group||entry;if(!object?.isObject3D)return false;
    if(source!==object){releaseOverlays();source=object;anchor=entry?.asset?.isObject3D?entry.asset:source;source.updateWorldMatrix(true,true);
      source.traverse(node=>{if(!node.isMesh||!node.geometry)return;const copy=node.clone(false);copy.material=scanMat;copy.matrixAutoUpdate=false;copy.frustumCulled=false;copy.castShadow=false;copy.receiveShadow=false;copy.raycast=()=>{};copy.name='portal-energy-overlay';copy.userData={portalOwnedOverlay:true};overlays.add(copy);sourcePairs.push({node,copy});if(/Headlights|Taillights|Head_4/i.test(node.name)){const lamp=copy.clone(false);lamp.material=warmLights;accents.add(lamp);lightPairs.push({node,copy:lamp});}});
      scratch.anchorInv.copy(anchor.matrixWorld).invert();scratch.localBounds.makeEmpty();source.traverse(node=>{if(!node.isMesh||!node.geometry?.attributes?.position)return;scratch.nodeMatrix.multiplyMatrices(scratch.anchorInv,node.matrixWorld);scratch.nodeBounds.setFromBufferAttribute(node.geometry.attributes.position).applyMatrix4(scratch.nodeMatrix);scratch.localBounds.union(scratch.nodeBounds);});scratch.localBounds.getSize(scratch.anchorSize);scratch.localBounds.getCenter(scratch.anchorCenter);
      for(let i=0;i<engines.length;i++){const e=engines[i],socket=entry?.portalEngineLayout?.[i];e.g.position.set(...(socket||[scratch.anchorCenter.x+(i?1:-1)*scratch.anchorSize.x*.09,scratch.anchorCenter.y,scratch.anchorCenter.z+scratch.anchorSize.z*.3]));e.size=Math.max(.001,Number(entry?.portalEngineRadius)||scratch.anchorSize.x*.026);}
    }
    source.updateWorldMatrix(true,true);scratch.bounds.setFromObject(source);if(scratch.bounds.isEmpty())return false;scratch.bounds.getCenter(scratch.center);scratch.bounds.getSize(scratch.size);radius=Math.max(.75,Math.min(5,Math.max(scratch.size.x,scratch.size.y,scratch.size.z)*.57));root.position.copy(scratch.center);root.scale.setScalar(radius);scratch.matrix.lookAt(camera.position,scratch.center,camera.up);root.quaternion.setFromRotationMatrix(scratch.matrix);root.updateMatrixWorld(true);scanner.position.copy(scratch.center);optics.position.copy(scratch.center);optics.quaternion.copy(root.quaternion);optics.scale.setScalar(radius);carDust.position.set(scratch.center.x,scratch.bounds.min.y,scratch.center.z);scanUniforms.minY.value=scratch.bounds.min.y;scanUniforms.height.value=Math.max(.01,scratch.size.y);syncOverlays();return true;
  }
  function selectWorld(name){world=groups[name]?name:'helmet';for(const k of Object.keys(groups))groups[k].visible=k===world;anchored.visible=world==='helmet';scanner.visible=world==='robot';optics.visible=world==='robot';carDust.visible=world==='car';overlays.visible=world==='robot';for(const {copy}of lightPairs)copy.visible=world==='car';}
  function chargeEffects(p,still=false){
    chargeProgress=p;const e=smooth(still?.62:p),sweep=still?.52:lerp(.08,.95,e);scanUniforms.charge.value=.35+e*.65;scanUniforms.sweep.value=sweep;
    scanBar.material.opacity=.45;scanner.position.y=scanUniforms.minY.value+scratch.size.y*sweep;scanBar.scale.set(Math.max(.3,scratch.size.x)*1.04,.012,Math.max(.25,scratch.size.z)*1.05);
    flame.opacity=.32+e*.48;core.opacity=.45+e*.45;warmLights.opacity=.38+e*.5;
    for(const engine of engines){const s=engine.size,length=s*(2+e*6);engine.plume.scale.set(s*(.75+e*.25),s*(.75+e*.25),length);engine.core.scale.set(s*.36,s*.36,length*.72);}
    const wakePower=still?0:range(.16,.92,p);wakeMat.opacity=.4*wakePower;
    for(let i=0;i<wakeCount;i++){
      const engine=engines[i%2],lane=Math.floor(i/2),a=lane*2.399963,t=(lane/18+p*.8)%1,j=i*6;
      const spread=engine.size*(1.15+t*2.8),length=engine.size*(1+wakePower*11)*(1-t*.35);
      wakeArray[j]=wakeArray[j+3]=engine.g.position.x+Math.cos(a)*spread;
      wakeArray[j+1]=wakeArray[j+4]=engine.g.position.y+Math.sin(a)*spread;
      wakeArray[j+2]=engine.g.position.z+engine.size*(2+t*22);wakeArray[j+5]=wakeArray[j+2]+length;
    }wakeGeo.attributes.position.needsUpdate=true;
    const focus=range(.16,.7,e),unlock=range(.74,1,e);for(const {g,side}of shutters){g.position.set(0,side*lerp(.38,.115,focus)*(1+unlock*3),.55);g.scale.x=lerp(.36,.8,focus);}
    opticalMat.opacity=(still?.12:.24)*(1-unlock*.8);opticalEdge.opacity=(still?.22:.52)*(1-unlock*.8);
    for(let i=0;i<dust.length;i++){const d=dust[i],t=still?.25:(p+i/8)%1;d.position.set((i%2?1:-1)*scratch.size.x*.3,.025+t*.1,scratch.size.z*(.28+t*.32));d.scale.setScalar(Math.max(.025,scratch.size.x*(.022+t*.05)));}dustMat.opacity=still?0:.06+e*.1;
    const envelope=range(0,.1,p);scanUniforms.charge.value*=envelope;scanBar.material.opacity*=envelope;for(const m of [flame,core,warmLights,dustMat,wakeMat,opticalMat,opticalEdge])m.opacity*=envelope;
    // Mechanical movement carries anticipation; the socket effects remain secondary.
    poseAnticipation(p,still);poseParticles(p,0,still);fadeMaterials(anticipationMaterials,range(0,.08,p));
  }
  function clearCharge({immediate=false}={}){if(active)return;chargeTarget=0;if(!immediate&&!reducedMode&&releaseProgress>.001){chargeReleasing=true;phase='release';return;}releaseProgress=0;chargeVisualOffset=0;chargeReleasing=false;chargeProgress=0;anticipation.visible=false;particles.visible=false;particleMat.uniforms.opacity.value=0;root.visible=false;overlays.visible=false;scanUniforms.charge.value=0;releaseOverlays();phase='idle';}
  function updateCharge(dt){
    if(active||disposed)return;const step=Math.max(0,Math.min(.1,Number(dt)||0));
    if(chargeReleasing){releaseProgress=Math.max(0,releaseProgress-step/.36);chargeEffects(releaseProgress,reducedMode);if(releaseProgress<=0)clearCharge({immediate:true});}
    else if(phase==='charge'&&Math.abs(chargeVisualOffset)>.00001){chargeVisualOffset*=Math.exp(-step*9);releaseProgress=sat(chargeTarget+chargeVisualOffset);chargeEffects(releaseProgress,reducedMode);}
  }
  function charge({entry,world:name='helmet',progress=0,reduced:still=reducedMode}={}){
    if(disposed||active)return;const object=entry?.object||entry?.group||entry,same=source===object&&world===name,resume=same&&chargeReleasing;
    if(!entry||!setSource(entry)){clearCharge();return;}reducedMode=!!still;selectWorld(name);chargeTarget=sat(progress);
    if(resume)chargeVisualOffset=releaseProgress-chargeTarget;else if(!same)chargeVisualOffset=0;
    chargeReleasing=false;releaseProgress=sat(chargeTarget+chargeVisualOffset);root.visible=false;accents.visible=true;chargeEffects(releaseProgress,reducedMode);phase='charge';
  }

  function start({entry,world:name='helmet',reduced:still=reducedMode,duration:seconds=duration}={}){
    if(disposed||active)return false;
    const object=entry?.object||entry?.group||entry,carry=source===object&&world===name&&releaseProgress>0;
    const frame=carry?{position:root.position.clone(),quaternion:root.quaternion.clone(),scale:root.scale.clone()}:null;
    entryCharge=carry?releaseProgress:1;
    if(!setSource(entry)){clearCharge();return false;}
    if(frame){root.position.copy(frame.position);root.quaternion.copy(frame.quaternion);root.scale.copy(frame.scale);root.updateMatrixWorld(true);}
    selectWorld(name);snapshot=cameraSnapshot();elapsed=0;returning=false;runDuration=Math.max(.6,Math.min(2,Number(seconds)||duration));reducedMode=!!still;active=true;phase='approach';root.visible=!reducedMode;accents.visible=true;
    scratch.inv.copy(root.matrixWorld).invert();const startLocal=snapshot.position.clone().applyMatrix4(scratch.inv);
    const near=world==='helmet'?V(.78,.25,1.05):world==='robot'?V(.55,.18,.85):V(.8,.7,1.65);
    route={start:startLocal,near,mouth:world==='car'?V(roadX(-2),.55,-2):V(0,.1,-2.4),end:world==='car'?V(roadX(-13)+6.8,6.5,-13):world==='robot'?V(0,.18,-18):V(0,.14,-22)};
    camera.getWorldDirection(scratch.forward);scratch.startLook.copy(snapshot.position).addScaledVector(scratch.forward,Math.max(radius*5,camera.position.distanceTo(scratch.center)));chargeEffects(entryCharge,reducedMode);fadeMaterials(travelMaterials,0);applyTravel(0);return true;
  }
  function bezier(out,a,b,c,d,t){const s=1-t;return out.copy(a).multiplyScalar(s*s*s).addScaledVector(b,3*s*s*t).addScaledVector(c,3*s*t*t).addScaledVector(d,t*t*t);}
  function applyTravel(p){
    if(reducedMode)return;
    // The first quarter is a close hero fly-by; each world then has its own path.
    const approach=range(0,.36,p),depart=range(.30,1,p);
    if(p<.36){const a=route.start,b=a.clone().lerp(route.near,.4),c=route.near.clone().add(V(.18,.07,.7));bezier(scratch.local,a,b,c,route.near,approach);}else{
      const t=(p-.36)/.64,advance=t*t*(3-2*t);scratch.local.lerpVectors(route.near,route.end,advance);
      if(world==='car'){scratch.local.x=lerp(route.near.x,roadX(scratch.local.z)+6.8*smooth(t),smooth(t*2));scratch.local.y=lerp(lerp(route.near.y,.05,range(0,.3,t)),6.5,range(.27,1,t));}
    }
    camera.position.copy(scratch.local).applyMatrix4(root.matrixWorld);
    if(world==='car'){
      const z=lerp(-1.9,-20.8,depart),x=roadX(z);leadCar.position.set(x,-1.08,z);leadCar.rotation.y=-Math.atan2(roadX(z-.1)-x,.1);for(const w of wheels)w.rotation.x=-depart*42;
      scratch.look.set(x,-.65,z-.25);
    }else if(world==='robot')scratch.look.set(0,.2,lerp(0,-25,range(.14,.88,p)));
    else scratch.look.set(0,.22,lerp(0,-42,range(.14,.85,p)));
    scratch.look.applyMatrix4(root.matrixWorld);if(p<.18)scratch.look.lerp(scratch.startLook,1-range(0,.18,p));camera.up.copy(snapshot.up);camera.lookAt(scratch.look);
    if(world==='helmet')camera.rotateZ(Math.sin(p*Math.PI)*.026);
    camera.fov=world==='helmet'?lerp(snapshot.fov,66,range(.24,.88,p)):world==='car'?lerp(snapshot.fov,40,range(.1,.7,p)):lerp(snapshot.fov,52,range(.2,.8,p));camera.near=Math.min(snapshot.near,.055);camera.far=Math.max(snapshot.far,radius*150);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    for(const {g,side}of doors)g.position.x=side*(.77+range(.1,.48,p)*1.55);
    const cockpitFade=range(.2,.31,p)*(1-range(.56,.71,p));cockpit.visible=world==='helmet'&&cockpitFade>.0001;fadeMaterials(cockpitMaterials,cockpitFade*range(0,.34,p));cockpit.position.z=lerp(-2.3,-5.4,range(.26,.62,p));
    const speed=range(.38,.85,p);streakMat.opacity=speed*.65;const streakFade=travelMaterials.find(item=>item.material===streaks.material);if(streakFade)streakFade.opacity=streakMat.opacity;
    for(let i=0;i<streakCount;i++){const s=streakSeeds[i],j=i*6,z=-3-((s.z+elapsed*(6+speed*32)*s.v)%48),len=.06+speed*4;streakArray[j]=streakArray[j+3]=Math.cos(s.a)*s.r;streakArray[j+1]=streakArray[j+4]=Math.sin(s.a)*s.r;streakArray[j+2]=z;streakArray[j+5]=z-len;}streakGeo.attributes.position.needsUpdate=true;
  }
  function update(dt,{time=elapsed,reduced:still=reducedMode}={}){
    if(!active||disposed)return {active:false,done:false,progress:0,phase:'idle',veil:0,world};
    reducedMode=!!still;elapsed+=Math.max(0,Math.min(.1,Number(dt)||0));const travelProgress=sat(elapsed/(reducedMode?.28:returning?.7:runDuration)),p=returning?1-travelProgress:travelProgress;
    phase=reducedMode?'arrival':p<.36?'approach':p<.7?'crossing':'arrival';chargeEffects(lerp(entryCharge,1,range(0,.14,p)),reducedMode);poseParticles(lerp(entryCharge,1,range(0,.14,p)),p,reducedMode);fadeMaterials(travelMaterials,range(0,.34,p));fadeMaterials(anticipationMaterials,(1-range(.08,.32,p))*(returning?range(0,.22,p):1));if(returning){particleMat.uniforms.opacity.value*=range(0,.22,p);particles.visible=particleMat.uniforms.opacity.value>.0001;}syncOverlays();accents.visible=p<.34;overlays.visible=world==='robot'&&p<.34;scanUniforms.charge.value*=1-range(.12,.34,p);const accentFade=(1-range(.08,.34,p))*(returning?range(0,.22,p):1);for(const m of [flame,core,warmLights,dustMat,wakeMat,opticalMat,opticalEdge])m.opacity*=accentFade;scanBar.material.opacity=.45*accentFade;scanUniforms.charge.value*=returning?range(0,.22,p):1;root.visible=!reducedMode;anticipation.visible=!reducedMode&&p<.32;anticipation.scale.copy(root.scale).multiplyScalar(1-range(.1,.32,p)*.08);
    if(reducedMode){restoreCamera();}else applyTravel(p);
    const state={active:true,done:travelProgress>=1,progress:travelProgress,phase:returning?'return':phase,veil:returning?1-range(0,.25,travelProgress):range(reducedMode?.15:.92,1,p),world};onTravel?.(state);return state;
  }
  function reset(restore){if(restore)restoreCamera();active=false;chargeReleasing=false;chargeVisualOffset=0;releaseProgress=0;anticipation.visible=false;particles.visible=false;particleMat.uniforms.opacity.value=0;root.visible=false;overlays.visible=false;releaseOverlays();scanUniforms.charge.value=0;elapsed=0;chargeProgress=0;snapshot=null;route=null;phase='idle';}
  return {charge,clearCharge,updateCharge,start,update,startReturn(options){if(!start(options))return false;returning=true;return true;},cancel({restoreCamera:restore=true}={}){if(!disposed)reset(restore);},finish(){if(!disposed)reset(false);},getState(){return {active,world,phase,charge:chargeProgress,elapsed,reduced:reducedMode,visible:root.visible,anticipationVisible:anticipation.visible,releasing:chargeReleasing,sourceMeshCount:sourcePairs.length,particleCount,particlesVisible:particles.visible,particleOpacity:particleMat.uniforms.opacity.value,effect:world==='helmet'?'thrusters-cockpit':world==='robot'?'scan-airlock':'headlights-toy-plaza'};},dispose(){if(disposed)return;reset(true);disposed=true;root.removeFromParent();anticipation.removeFromParent();particles.removeFromParent();overlays.removeFromParent();accents.removeFromParent();for(const r of owned)r.dispose?.();owned.clear();},root};
}
