
const coarsePointer=globalThis.matchMedia?.('(pointer: coarse)');/** Surface-derived material transport. Every grain begins/ends on an actual triangle.
 * Asset-local erosion order is shared verbatim by the solid and particle shaders. */
export const JOURNEY_TRANSITIONS = [
  { from:'core', to:'helmet', leave:[.065,.195], arrive:[.295,.367] },
  { from:'helmet', to:'robot', leave:[.432,.475], arrive:[.514,.573] },
  { from:'robot', to:'car', leave:[.647,.697], arrive:[.744,.798] },
  { from:'car', to:'closing', leave:[.883,.927], arrive:[.948,.989] }
];
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function journeySurfaceOrder(x,y,z){return clamp((.3+x*.115+y*.09+Math.sin(x*8+y*6+z*5)*.035)/.6);}
export function evaluateJourneyTransition(progress,index,sourceOrder=.5,targetOrder=.5){
  const r=JOURNEY_TRANSITIONS[index],leave=r.leave[0]+sourceOrder*(r.leave[1]-r.leave[0]),arrive=r.arrive[0]+targetOrder*(r.arrive[1]-r.arrive[0]);
  return{leave,arrive,t:smooth(leave,arrive,progress),alpha:smooth(leave,leave+.006,progress)*(1-smooth(arrive-.006,arrive+.002,progress))};
}
const erosionGLSL='float journeyOrder(vec3 p){return clamp((.3+p.x*.115+p.y*.09+sin(p.x*8.+p.y*6.+p.z*5.)*.035)/.6,0.,1.);}';
export function createJourneyParticles({THREE:T,root,camera,entries={},core,closingCore}){
  const count=72000,standardCount=18000,resources=new Set(),originals=new Map(),states=new Map(),jobs=new Map(),materialCopies=[];let disposed=false,clock=0,active=-1,quality='standard',drawCount=standardCount;
  const own=x=>(resources.add(x),x),names=['core','helmet','robot','car','closing'];
  const getGroup=n=>n==='core'?core?.group:n==='closing'?closingCore?.group:entries[n]?.group;
  let rng=77289;const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  const v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3();
  const inverseRoot=new T.Matrix4();
  function install(mesh,state){
    const localMatrix=state.localMatrices.get(mesh)||new T.Matrix4().multiplyMatrices(state.group.matrixWorld.clone().invert(),mesh.matrixWorld);
    if(originals.has(mesh))return;
    originals.set(mesh,mesh.material);
    const clone=m=>{
      const copy=own(m.clone()),previous=m.onBeforeCompile,cache=m.customProgramCacheKey?.bind(m);
      copy.onBeforeCompile=shader=>{
        previous?.call(copy,shader);
        Object.assign(shader.uniforms,state.uniforms);shader.uniforms.uJourneyLocalMatrix={value:localMatrix};
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vJourneyLocal;uniform mat4 uJourneyLocalMatrix;uniform vec3 uJourneyCenter;uniform float uJourneyScale;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvJourneyLocal=((uJourneyLocalMatrix*vec4(position,1.)).xyz-uJourneyCenter)*uJourneyScale;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vJourneyLocal;uniform float uJourneyFill,uJourneyCut;'+erosionGLSL)
          .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat jOrder=journeyOrder(vJourneyLocal);if(jOrder>uJourneyFill||jOrder<uJourneyCut)discard;float jEdge=max((1.-smoothstep(0.,.025,abs(jOrder-uJourneyFill)))*step(.001,uJourneyFill)*(1.-step(.999,uJourneyFill)),(1.-smoothstep(0.,.025,abs(jOrder-uJourneyCut)))*step(.001,uJourneyCut)*(1.-step(.999,uJourneyCut)));float jGrain=.65+.35*sin(vJourneyLocal.x*153.+sin(vJourneyLocal.y*129.)*2.)*sin(vJourneyLocal.z*141.+vJourneyLocal.y*113.);')
          .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+jEdge*jGrain*.27,.12,1.);')
          .replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,outgoingLight*vec3(.84,1.02,1.08)+vec3(.12,.20,.24),jEdge*jGrain*.50);\n#include <opaque_fragment>');
      };
      materialCopies.push([copy,m]);
      copy.customProgramCacheKey=()=>`journey-surface-frost-3-${cache?.()||m.type}`;copy.needsUpdate=true;return copy;
    };
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);
  }
  function* build(n){
    const group=getGroup(n);if(!group)return null;group.updateWorldMatrix(true,true);
    const inverse=group.matrixWorld.clone().invert(),triangles=[],bounds=new T.Box3();let total=0;
    const meshes=[];group.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
    const localMatrices=new Map(meshes.map(mesh=>[mesh,new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)]));
    let triangleWork=0;
    for(const mesh of meshes){
      let hidden=false;for(let node=mesh;node&&node!==group;node=node.parent)if(!node.visible)hidden=true;
      const position=mesh.geometry?.attributes?.position;if(!position||mesh.userData?.journeyIgnore)continue;
      // Exclude helper light/glow shells, retaining every real opaque material surface.
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.every(m=>m?.isShaderMaterial||m?.blending===T.AdditiveBlending))continue;
      const transform=localMatrices.get(mesh),indices=mesh.geometry.index,n=indices?.count||position.count;
      if(hidden)continue;
      for(let i=0;i+2<n;i+=3){
        if(++triangleWork%1024===0)yield null;
        const ids=[indices?indices.getX(i):i,indices?indices.getX(i+1):i+1,indices?indices.getX(i+2):i+2];
        a.fromBufferAttribute(position,ids[0]).applyMatrix4(transform);b.fromBufferAttribute(position,ids[1]).applyMatrix4(transform);c.fromBufferAttribute(position,ids[2]).applyMatrix4(transform);
        const area=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;
        if(area>1e-10){total+=area;triangles.push({mesh,ids,end:total,transform});bounds.expandByPoint(a);bounds.expandByPoint(b);bounds.expandByPoint(c);}
      }
    }
    if(!triangles.length)return null;
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),scale=3.5/Math.max(size.x,size.y,size.z,.001);
    const old=states.get(n),state={group,localMatrices,token:entries[n]?.object||group.children[0],childCount:group.children.length,samples:[],matrices:new Map(),posed:new Map(),uniforms:old?.uniforms||{uJourneyInverse:{value:inverse},uJourneyCenter:{value:center},uJourneyScale:{value:scale},uJourneyFill:{value:1.01},uJourneyCut:{value:-.01}}};
    state.uniforms.uJourneyCenter.value.copy(center);state.uniforms.uJourneyScale.value=scale;
    const requested=quality==='ultra'?count:standardCount;let installed=false;
    for(let i=0;i<requested;i++){
      if(i%512===0)yield null;
      const ticket=random()*total;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<ticket)lo=mid+1;else hi=mid;}
      const tri=triangles[lo],position=tri.mesh.geometry.attributes.position,r=Math.sqrt(random()),s=random();
      a.fromBufferAttribute(position,tri.ids[0]);b.fromBufferAttribute(position,tri.ids[1]);c.fromBufferAttribute(position,tri.ids[2]);
      a.multiplyScalar(1-r).addScaledVector(b,r*(1-s)).addScaledVector(c,r*s);
      v.copy(a).applyMatrix4(tri.transform).sub(center).multiplyScalar(scale);
      state.samples.push({mesh:tri.mesh,ids:tri.ids,w:[1-r,r*(1-s),r*s],x:a.x,y:a.y,z:a.z,order:journeySurfaceOrder(v.x,v.y,v.z)});
      if(!state.matrices.has(tri.mesh))state.matrices.set(tri.mesh,new T.Matrix4());
      if(i===standardCount-1){for(const mesh of meshes)if(mesh.material)install(mesh,state);states.set(n,state);installed=true;}
    }
    if(!installed)for(const mesh of meshes)if(mesh.material)install(mesh,state);
    states.set(n,state);return state;
  }
  const geometry=own(new T.BufferGeometry()),source=new Float32Array(count*3),target=new Float32Array(count*3),orders=new Float32Array(count*2),seeds=new Float32Array(count);
  for(let i=0;i<count;i++)seeds[i]=random();
  geometry.setAttribute('position',new T.BufferAttribute(source,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('aTarget',new T.BufferAttribute(target,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('aOrders',new T.BufferAttribute(orders,2).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('aSeed',new T.BufferAttribute(seeds,1));
  const uniforms={uProgress:{value:0},uTime:{value:0},uLeave:{value:new T.Vector2()},uArrive:{value:new T.Vector2()},uHeight:{value:800},uCamera:{value:new T.Vector3()},uUltra:{value:0},uPointer:{value:new T.Vector2()},uField:{value:0},uAspect:{value:1}};
  const material=own(new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,vertexShader:`
attribute vec3 aTarget;attribute vec2 aOrders;attribute float aSeed;uniform float uProgress,uTime,uHeight,uUltra,uField,uAspect;uniform vec2 uPointer;uniform vec2 uLeave,uArrive;uniform vec3 uCamera;varying float vAlpha,vSeed,vEnergy;
void main(){float leave=mix(uLeave.x,uLeave.y,aOrders.x),arrive=mix(uArrive.x,uArrive.y,aOrders.y);float t=smoothstep(leave,arrive,uProgress),arc=sin(3.14159265*t),weight=pow(arc,4.);float q=aSeed*2.-1.+(t-.5)*1.3;float lane=mod(floor(aSeed*997.+.5),3.)-1.;vec3 center=mix(position,aTarget,t);vec3 ribbon=vec3(q*3.05+.25,.62*sin(q*1.55)+lane*.16+sin(uTime*.65+aSeed*6.283)*.035,mix(center.z,uCamera.z-10.-q*5.+lane*.4,.82)+.7*sin(q*2.2));ribbon.xy+=mix(position.xy,aTarget.xy,t)*.12;vec3 p=mix(center,ribbon,weight);vAlpha=smoothstep(leave,leave+.006,uProgress)*(1.-smoothstep(arrive-.006,arrive+.002,uProgress));vSeed=aSeed;vEnergy=arc*arc;vec4 mv=modelViewMatrix*vec4(p,1.);
// Divergence-free trigonometric curl field; zero outside ultra flight.
vec3 curl=vec3(cos(p.y*1.4+uTime)*sin(p.z*.08+aSeed*6.),cos(p.z*.08+aSeed*6.)*sin(p.x*1.4+uTime),cos(p.x*1.4+uTime)*sin(p.y*1.4+uTime));
mv.xyz+=curl*weight*uUltra*.34;gl_Position=projectionMatrix*mv;
vec2 screen=gl_Position.xy/max(.001,gl_Position.w),delta=(screen-uPointer)*vec2(uAspect,1.);float radius=length(delta);
float field=exp(-radius*radius*24.)*uField*weight;gl_Position.xy+=delta/max(radius,.015)/vec2(uAspect,1.)*field*.085*gl_Position.w;
gl_PointSize=clamp((.018+aSeed*.020+vEnergy*.009)*uHeight*projectionMatrix[1][1]/max(1.,-mv.z),1.,4.5);vAlpha*=smoothstep(.3,1.5,-mv.z);}`,
fragmentShader:`uniform float uUltra,uProgress;varying float vAlpha,vSeed,vEnergy;void main(){float r=length(gl_PointCoord-.5);if(r>.5||vAlpha<.002)discard;float alpha=(1.-smoothstep(.12,.5,r))*vAlpha*.78;vec3 color=mix(vec3(.30,.40,.47),vec3(.75,.84,.87),vSeed);color=mix(color,vec3(.66,.84,.91),vEnergy*.32);color=mix(color,mix(vec3(.3,1.6,2.8),vec3(2.7,.4,1.6),sin(uProgress*3.14159)),uUltra*.8);gl_FragColor=vec4(color,alpha*(1.-uUltra*.48));}`}));
  const points=new T.Points(geometry,material);points.name='actual-surface-material-transport';points.frustumCulled=false;points.raycast=()=>{};points.renderOrder=1;root.add(points);
  // Deep, sparse star field has its own budget: no bounding-box cloud around models.
  const starGeo=own(new T.BufferGeometry()),starPositions=new Float32Array(1800*3);
  for(let i=0;i<1800;i++){const angle=random()*Math.PI*2,r=18+random()*105;starPositions.set([Math.cos(angle)*r,Math.sin(angle)*r,-random()*510],i*3);}
  starGeo.setAttribute('position',new T.BufferAttribute(starPositions,3));
  const starMat=own(new T.PointsMaterial({color:0x7893a2,size:.075,transparent:true,opacity:.32,depthWrite:false,sizeAttenuation:true}));
  const stars=new T.Points(starGeo,starMat);stars.name='quiet-distant-stars';stars.raycast=()=>{};root.add(stars);
  function fillPositions(state,array){
    const skeletons=new Set();
    for(const [mesh,matrix] of state.matrices){
      matrix.multiplyMatrices(inverseRoot,mesh.matrixWorld);
      if(mesh.isSkinnedMesh||mesh.morphTargetInfluences?.some(weight=>weight!==0)){
        if(mesh.skeleton&&!skeletons.has(mesh.skeleton)){mesh.skeleton.update();skeletons.add(mesh.skeleton);}
        const position=mesh.geometry.attributes.position;let cache=state.posed.get(mesh);if(!cache){cache=new Float32Array(position.count*3);state.posed.set(mesh,cache);}
        // Skin/morph each unique vertex once, never once per particle.
        for(let i=0;i<position.count;i++){mesh.getVertexPosition(i,v);cache[i*3]=v.x;cache[i*3+1]=v.y;cache[i*3+2]=v.z;}
      }else state.posed.delete(mesh);
    }
    for(let i=0;i<drawCount;i++){
      const s=state.samples[i],e=state.matrices.get(s.mesh).elements,cache=state.posed.get(s.mesh);let x=s.x,y=s.y,z=s.z;
      if(cache){x=0;y=0;z=0;for(let k=0;k<3;k++){const at=s.ids[k]*3,weight=s.w[k];x+=cache[at]*weight;y+=cache[at+1]*weight;z+=cache[at+2]*weight;}}
      array[i*3]=e[0]*x+e[4]*y+e[8]*z+e[12];array[i*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13];array[i*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
    }
  }
  function update(options={}){
    if(disposed)return;const p=clamp(options.progress||0);clock+=options.reduced?0:Math.min(.1,Math.max(0,options.dt||0));
    root.updateWorldMatrix(true,true);inverseRoot.copy(root.matrixWorld).invert();
    for(const name of names){
      const group=getGroup(name);if(!group||!group.children.length)continue;
      const token=entries[name]?.object||group.children[0],state=states.get(name),job=jobs.get(name);
      if((!state||state.token!==token||state.childCount!==group.children.length||(quality==='ultra'&&state.samples.length<count&&!job))&&(!job||job.token!==token)){
        job?.iterator.return();jobs.set(name,{token,iterator:build(name)});
      }
    }
    // Asset arrivals never scan an entire GLB in one frame. One shared 3 ms
    // preparation budget covers triangle-area scans and 512-grain sample chunks.
    const now=()=>globalThis.performance?.now?.()??Date.now(),deadline=now()+3;
    for(const [name,job] of jobs){
      let result;do{result=job.iterator.next();}while(!result.done&&now()<deadline);
      if(result.done)jobs.delete(name);if(now()>=deadline)break;
    }
    for(const [copy,source] of materialCopies){copy.opacity=source.opacity;copy.depthWrite=source.depthWrite;if(copy.emissive&&source.emissive)copy.emissiveIntensity=source.emissiveIntensity;}
    for(const name of names){
      const group=getGroup(name),state=states.get(name);if(!group||!state)continue;
      state.uniforms.uJourneyInverse.value.copy(group.matrixWorld).invert();
      const incoming=JOURNEY_TRANSITIONS.find(r=>r.to===name),outgoing=JOURNEY_TRANSITIONS.find(r=>r.from===name);
      let fill=incoming?clamp((p-incoming.arrive[0])/(incoming.arrive[1]-incoming.arrive[0])):1;
      let cut=outgoing&&states.has(outgoing.to)?clamp((p-outgoing.leave[0])/(outgoing.leave[1]-outgoing.leave[0])):0;
      // The three final interactive destinations reconstruct together after travel.
      if(['helmet','robot','car'].includes(name)&&p>.93){fill=clamp((p-.955)/.032);cut=0;}
      state.uniforms.uJourneyFill.value=fill<=0?-.01:fill>=1?1.01:fill;
      state.uniforms.uJourneyCut.value=cut<=0?-.01:cut>=1?1.01:cut;
    }
    const index=JOURNEY_TRANSITIONS.findIndex(r=>p>=r.leave[0]&&p<=r.arrive[1]+.003),range=JOURNEY_TRANSITIONS[index],from=range&&states.get(range.from),to=range&&states.get(range.to);
    points.visible=!!from&&!!to&&index>=0;
    if(points.visible){
      drawCount=Math.min(quality==='ultra'?count:standardCount,from.samples.length,to.samples.length);
      material.blending=quality==='ultra'?T.AdditiveBlending:T.NormalBlending;uniforms.uUltra.value=quality==='ultra'?1:0;uniforms.uAspect.value=(options.width||1280)/(options.height||800);uniforms.uPointer.value.set(options.pointerX||0,options.pointerY||0);uniforms.uField.value=quality==='ultra'&&!options.reduced&&!coarsePointer?.matches?1:0;
      fillPositions(from,source);fillPositions(to,target);
      if(active!==index||from!==points.userData.from||to!==points.userData.to||points.userData.drawCount!==drawCount){for(let i=0;i<drawCount;i++){orders[i*2]=from.samples[i].order;orders[i*2+1]=to.samples[i].order;}geometry.attributes.aOrders.needsUpdate=true;active=index;points.userData.from=from;points.userData.to=to;points.userData.drawCount=drawCount;}
      geometry.attributes.position.needsUpdate=true;geometry.attributes.aTarget.needsUpdate=true;
      uniforms.uProgress.value=p;uniforms.uTime.value=clock;uniforms.uLeave.value.set(...range.leave);uniforms.uArrive.value.set(...range.arrive);uniforms.uHeight.value=options.height||800;uniforms.uCamera.value.copy(camera.position);
      geometry.setDrawRange(0,options.reduced?7000:quality==='ultra'?drawCount:(options.width||1280)<700?11000:standardCount);
    }
  }
  return{update,setQuality:value=>{quality=value;},getCount:()=>drawCount,isPrepared:name=>states.has(name),setVisible(value){stars.visible=!!value;if(!value){points.visible=false;for(const state of states.values()){state.uniforms.uJourneyFill.value=1.01;state.uniforms.uJourneyCut.value=-.01;}}},dispose(){if(disposed)return;disposed=true;for(const [mesh,material] of originals)mesh.material=material;originals.clear();states.clear();for(const job of jobs.values())job.iterator.return();jobs.clear();materialCopies.length=0;points.removeFromParent();stars.removeFromParent();for(const r of resources)r.dispose?.();resources.clear();}};
}
