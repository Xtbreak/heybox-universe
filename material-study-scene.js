import { createHeyboxCore } from './heybox-core.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

export const clamp01 = x => Math.max(0, Math.min(1, Number.isFinite(Number(x)) ? Number(x) : 0));
export const smooth = (a,b,x) => { const t=clamp01((x-a)/(b-a)); return t*t*(3-2*t); };
export function erosionAt(x,y,z) { return clamp01((.3+x*.115+y*.09+Math.sin(x*8+y*6+z*5)*.035)/.6); }
export function evaluateStudyProgress(p) {
  p=clamp01(p); return {p, erosion:clamp01((p-.12)/.31), formation:clamp01((p-.62)/.26), core:p<.435, ship:p>.62, ready:p>=.88, chapter:p<.15?0:p<.48?1:p<.84?2:3};
}
// Object-space geometry never moves during the morph: the lens and studio lights do.
// Shared knot derivatives make this rail C1, reversible, and still at the landing.
const cameraRail=[
  [0,[0,.45,9.3],[0,.1,0]],
  [.16,[-.95,.8,7.25],[-.12,.18,0]],
  [.34,[-1.2,1.05,8.05],[-.2,.15,-.25]],
  [.53,[1.45,.72,5.95],[.45,.03,-.7]],
  [.69,[1.1,1.2,7.25],[.3,.1,-.25]],
  [.88,[.2,1.02,8.6],[.04,.12,0]],
  [1,[0,.95,8.75],[0,.1,0]]
];
function railValue(p,column){
  let i=0;while(i<cameraRail.length-2&&p>cameraRail[i+1][0])i++;
  const a=cameraRail[i],b=cameraRail[i+1],span=b[0]-a[0],t=clamp01((p-a[0])/span),t2=t*t,t3=t2*t;
  const slope=(k,axis)=>{if(k===cameraRail.length-1)return 0;const lo=Math.max(0,k-1),hi=Math.min(cameraRail.length-1,k+1);return(cameraRail[hi][column][axis]-cameraRail[lo][column][axis])/(cameraRail[hi][0]-cameraRail[lo][0]);};
  return a[column].map((v,axis)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*span*slope(i,axis)+(-2*t3+3*t2)*b[column][axis]+(t3-t2)*span*slope(i+1,axis));
}
export function evaluateStudyCamera(p,width=1280,reduced=false){
  p=clamp01(p);const position=railValue(p,1),look=railValue(p,2),sweep=smooth(0,1,p),transit=Math.sin(Math.PI*smooth(.12,.88,p));
  if(width<700){position[2]=position[2]*1.48-1.164+transit*2.8+Math.sin(Math.PI*smooth(0,.34,p))*1.3+smooth(.43,.62,p)*4.2+Math.sin(Math.PI*smooth(.5,.88,p))*1.5;const frameShip=smooth(.5,.62,p);position[0]*=1-frameShip;look[0]=look[0]*(1-frameShip)-frameShip*.32;}
  if(reduced){position[0]*=.22;position[1]=.45+(position[1]-.45)*.35;position[2]=(width<700?12.6:9.3)+(position[2]-(width<700?12.6:9.3))*.22+(width<700?smooth(.43,.62,p)*3.3:0);look[0]*=.22;look[2]*=.22;}
  return{position,look,key:[-3+Math.sin(p*Math.PI)*6,5-p*1.8,4+Math.sin(p*Math.PI*2)*2],edge:[4-sweep*6,1+Math.sin(p*Math.PI)*2,-3+sweep*1.5]};
}
export function particleAt(source,target,seed,p,time=0) {
  const leave=.12+erosionAt(...source)*.31, arrive=.62+erosionAt(...target)*.26;
  const t=smooth(leave,arrive,p),arc=Math.sin(Math.PI*t),weight=arc**4,q=seed*2-1+(t-.5)*1.3,lane=(Math.floor(seed*997+.5)%3)-1;
  const ribbon=[q*3.05+.25,.62*Math.sin(q*1.55)+lane*.16+source[1]*.06+Math.sin(time*.65+seed*6.283)*.035,-.8+q*1.05+.7*Math.sin(q*2.2)+lane*.25+source[2]*.15+Math.cos(time*.53+seed*6.283)*.035];
  return {position:source.map((v,i)=>(v*(1-t)+target[i]*t)*(1-weight)+ribbon[i]*weight), alpha:smooth(leave,leave+.018,p)*(1-smooth(arrive-.018,arrive+.006,p)),leave,arrive,t};
}
export function sampleSurface(T,object,count=18000,seed=8821) {
  object.updateWorldMatrix(true,true); const triangles=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3(),ab=new T.Vector3(); let total=0;
  object.traverseVisible(mesh=>{ if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
    const pos=mesh.geometry.attributes.position, idx=mesh.geometry.index, n=idx?idx.count:pos.count;
    for(let i=0;i<n;i+=3){a.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(pos,idx?idx.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(pos,idx?idx.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);const area=cross.subVectors(b,a).cross(ab.subVectors(c,a)).length()*.5;if(area>1e-10){total+=area;triangles.push({a:a.clone(),b:b.clone(),c:c.clone(),end:total});}}
  });
  if(!triangles.length)throw new Error('Model has no visible triangle surface');
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}, result=new Float32Array(count*3);
  for(let i=0;i<count;i++){const area=random()*total;let lo=0,hi=triangles.length-1;while(lo<hi){const m=(lo+hi)>>1;if(triangles[m].end<area)lo=m+1;else hi=m;}const t=triangles[lo],r=Math.sqrt(random()),s=random();a.copy(t.a).multiplyScalar(1-r).addScaledVector(t.b,r*(1-s)).addScaledVector(t.c,r*s);result.set(a.toArray(),i*3);}
  return result;
}
const erosionGLSL=`float surfaceOrder(vec3 p){return clamp((.3+p.x*.115+p.y*.09+sin(p.x*8.+p.y*6.+p.z*5.)*.035)/.6,0.,1.);}`;
function installErosion(material,uniform,forming=false) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStudyCut=uniform;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStudyPosition;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvStudyPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\nvarying vec3 vStudyPosition;uniform float uStudyCut;${erosionGLSL}`)
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nfloat studyOrder=surfaceOrder(vStudyPosition);\n${forming?'if(studyOrder>uStudyCut)discard;':'if(studyOrder<uStudyCut)discard;'}\nfloat studyActive=step(.001,uStudyCut)*(1.-step(.999,uStudyCut));\nfloat studyEdge=(1.-smoothstep(.0,.028,abs(studyOrder-uStudyCut)))*studyActive;\nfloat studyGrain=.65+.35*sin(vStudyPosition.x*153.+sin(vStudyPosition.y*129.)*2.)*sin(vStudyPosition.z*141.+vStudyPosition.y*113.);`)
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(sin(vStudyPosition.x*180.)*sin(vStudyPosition.y*155.)*.035)+sin(vStudyPosition.x*9.+vStudyPosition.z*13.)*.022+studyEdge*studyGrain*.26,.12,1.);')
      .replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,outgoingLight*vec3(.83,1.03,1.09)+vec3(.13,.22,.26),studyEdge*studyGrain*.48);\n#include <opaque_fragment>');
  };material.customProgramCacheKey=()=>`study-erosion-frost-v2-${forming?1:0}`;material.needsUpdate=true;
}
export function createMaterialStudy({THREE:T,renderer,scene,camera,reduced=false,onProgress=()=>{},loadShip=null,environmentTexture=null,particleCount=null,viewport={width:globalThis.innerWidth||1280,height:globalThis.innerHeight||800,pixelRatio:globalThis.devicePixelRatio||1}}) {
  const previousEnvironment=scene.environment;const root=new T.Group();root.name='material-study';scene.add(root);const owned=new Set(),own=x=>(owned.add(x),x);
  const core=createHeyboxCore({THREE:T});root.add(core.group);core.group.rotation.set(-.1,-.43,-.075);core.group.position.set(0,.15,0);core.update(0,0);
  const cut={value:-.01},fill={value:-.01};const originals=new Set();
  core.group.traverse(o=>{if(o.isMesh){for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(!originals.has(m)){originals.add(m);m.roughness=Math.max(.19,m.roughness*.8);m.envMapIntensity=1.35;installErosion(m,cut);}}if(o.isLine)o.visible=false;});
  let env=null;if(environmentTexture){scene.environment=environmentTexture;}else{const envRoom=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);env=pmrem.fromScene(envRoom,.045);scene.environment=env.texture;envRoom.dispose();pmrem.dispose();}
  const ambient=new T.HemisphereLight(0xb7d1e4,0x252323,.65);root.add(ambient);
  const key=new T.DirectionalLight(0xe1ebed,3.3);key.position.set(-3,5,4);root.add(key);
  const edge=new T.DirectionalLight(0x86b2d0,2.3);edge.position.set(4,1,-3);root.add(edge);
  const fillLight=new T.DirectionalLight(0xe5d6bd,.65);fillLight.position.set(-4,-1,1);root.add(fillLight);
  const ground=own(new T.PlaneGeometry(16,16)),groundMat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.3}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uOpacity;void main(){float r=length((vUv-.5)*vec2(2.,4.));gl_FragColor=vec4(.015,.023,.03,exp(-r*r*15.)*uOpacity);}'}));
  const shadow=new T.Mesh(ground,groundMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=-2.3;root.add(shadow);
  const shipGroup=new T.Group();shipGroup.name='reconstituted-flight-ship';root.add(shipGroup);shipGroup.visible=false;
  let shipSource=null,points=null,progress=0,disposed=false,ready=false,loadGeneration=0,rejectLoad=null;const viewPointer=new T.Vector2();
  const shipMaterials=new Set(),engines=[];const count=particleCount||(viewport.width<700?16000:30000);
  const source=sampleSurface(T,core.group,count);
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const promise=new Promise((resolve,reject)=>{rejectLoad=reject;const generation=++loadGeneration;
    const accept=gltf=>{if(disposed||generation!==loadGeneration){if(!loadShip)gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))m?.dispose();});reject(new Error('Material study loading was cancelled'));return;}
      shipSource=gltf.scene;const clone=shipSource.clone(true),box=new T.Box3().setFromObject(clone),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());clone.position.sub(center);const normalized=new T.Group();normalized.add(clone);normalized.scale.setScalar(5.2/Math.max(size.x,size.y,size.z));shipGroup.add(normalized);shipGroup.rotation.set(.38,-.58,-.16);shipGroup.position.set(0,.1,0);shipGroup.visible=true;
      clone.traverse(o=>{if(!o.isMesh)return;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of(Array.isArray(o.material)?o.material:[o.material])){shipMaterials.add(m);m.envMapIntensity=1.2;if(m.roughness!==undefined)m.roughness=Math.max(.24,m.roughness);if(m.emissiveIntensity!==undefined)m.emissiveIntensity=Math.min(.55,m.emissiveIntensity);installErosion(m,fill,true);}});
      const target=sampleSurface(T,shipGroup,count,1783);
      for(const x of [-1.96,1.96])for(const y of [-.32,.32])for(const layer of [0,1]){const mat=own(new T.MeshBasicMaterial({color:layer?0xcfeaf2:0x6bb4d3,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending})),geo=own(new T.CylinderGeometry(layer?.052:.12,layer?.008:.025,1,12,1,true));geo.rotateX(Math.PI/2);const flame=new T.Mesh(geo,mat);flame.position.set(x,y,1.7);flame.scale.z=.001;flame.userData.layer=layer;shipGroup.add(flame);engines.push(flame);}
      const geometry=own(new T.BufferGeometry()),seeds=new Float32Array(count);for(let i=0;i<count;i++)seeds[i]=((i*73)%997)/997;
      geometry.setAttribute('position',new T.BufferAttribute(source,3));geometry.setAttribute('aTarget',new T.BufferAttribute(target,3));geometry.setAttribute('aSeed',new T.BufferAttribute(seeds,1));
      const material=own(new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,uniforms:{uProgress:{value:0},uTime:{value:0},uPixelRatio:{value:Math.min(viewport.pixelRatio,2)},uOpacity:{value:1}},vertexShader:`attribute vec3 aTarget;attribute float aSeed;uniform float uProgress;uniform float uTime;uniform float uPixelRatio;varying float vAlpha;varying float vSeed;varying float vEnergy;${erosionGLSL}
void main(){float leave=.12+surfaceOrder(position)*.31;float arrive=.62+surfaceOrder(aTarget)*.26;float t=smoothstep(leave,arrive,uProgress);float arc=sin(3.14159265*t);float weight=pow(arc,4.);float q=aSeed*2.-1.+(t-.5)*1.3;float lane=mod(floor(aSeed*997.+.5),3.)-1.;vec3 ribbon=vec3(q*3.05+.25,.62*sin(q*1.55)+lane*.16+position.y*.06+sin(uTime*.65+aSeed*6.283)*.035,-.8+q*1.05+.7*sin(q*2.2)+lane*.25+position.z*.15+cos(uTime*.53+aSeed*6.283)*.035);vec3 p=mix(mix(position,aTarget,t),ribbon,weight);vAlpha=smoothstep(leave,leave+.018,uProgress)*(1.-smoothstep(arrive-.018,arrive+.006,uProgress));vSeed=aSeed;vEnergy=arc*arc;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((17.+aSeed*15.+vEnergy*5.)/-mv.z,1.,4.5)*uPixelRatio;}`,fragmentShader:`uniform float uOpacity;varying float vAlpha;varying float vSeed;varying float vEnergy;void main(){float r=length(gl_PointCoord-.5);if(r>.5||vAlpha<.002)discard;float alpha=(1.-smoothstep(.12,.5,r))*vAlpha*uOpacity;vec3 color=mix(vec3(.30,.40,.47),vec3(.75,.84,.87),vSeed);color=mix(color,vec3(.66,.84,.91),vEnergy*.32);gl_FragColor=vec4(color,alpha);}` }));
      points=new T.Points(geometry,material);points.frustumCulled=false;points.name='surface-derived-material-stream';root.add(points);ready=true;setProgress(progress);onProgress(1);resolve(api);
    };if(loadShip){Promise.resolve().then(loadShip).then(source=>accept({scene:source.scene||source}),reject);}else{loader.load('./models/flight-ship-v8.glb',accept,event=>{if(event.total)onProgress(event.loaded/event.total);},reject);}
  });
  const raycaster=new T.Raycaster(),targetLook=new T.Vector3(),cameraTarget=new T.Vector3();
  function setProgress(p){progress=clamp01(p);const s=evaluateStudyProgress(progress);cut.value=s.erosion===0?-.01:s.erosion;fill.value=s.formation===0?-.01:s.formation;core.group.visible=s.core;shipGroup.visible=ready&&s.ship;if(points){points.visible=progress>.12&&progress<.89;points.material.uniforms.uProgress.value=progress;}return s;}
  function update(dt,time,charge=0,entry=0){if(disposed)return;if(points){points.material.uniforms.uTime.value=reduced?0:time;points.material.uniforms.uPixelRatio.value=Math.min(viewport.pixelRatio,2);}
    const pose=evaluateStudyCamera(progress,viewport.width,reduced),land=smooth(.88,1,progress),pointerWeight=(1-charge)*(1-entry);
    cameraTarget.set(pose.position[0]+(reduced?0:viewPointer.x*.11*pointerWeight),pose.position[1]+(reduced?0:viewPointer.y*.065*pointerWeight),pose.position[2]-entry*2.3);
    camera.position.lerp(cameraTarget,1-Math.exp(-dt*7));targetLook.set(...pose.look);targetLook.z-=entry*1.7;camera.lookAt(targetLook);
    key.position.set(...pose.key);edge.position.set(...pose.edge);
    // All sampled source/target matrices stay exact until the final particle has landed.
    shipGroup.position.y=.1+(reduced?0:Math.sin(time*.85)*.025)*land;
    for(const flame of engines){const power=smooth(.22,1,charge);flame.material.opacity=power*(flame.userData.layer?.65:.17);flame.scale.z=.1+power*(.8+(reduced?0:Math.sin(time*38)*.06))+entry*1.8;flame.scale.z*=flame.userData.layer?.7:1;flame.position.z=1.48+flame.scale.z*.5;flame.visible=charge>.02||entry>0;}
    key.intensity=3.3+Math.sin(progress*Math.PI)*.35+charge*.3;edge.intensity=2.3+Math.sin(progress*Math.PI)*.45+charge*.5;root.visible=entry<1;
    for(const m of shipMaterials)if(m.emissiveIntensity!==undefined)m.emissiveIntensity=.35+charge*.7;
  }
  function pick(ndc){if(!ready||progress<.88)return false;raycaster.setFromCamera(ndc,camera);return raycaster.intersectObject(shipGroup,true).length>0;}
  function dispose(){if(disposed)return;disposed=true;loadGeneration++;if(!ready)rejectLoad?.(new Error('Material study loading was cancelled'));root.removeFromParent();core.dispose();for(const x of owned)x.dispose?.();for(const m of shipMaterials)m.dispose();if(!loadShip)shipSource?.traverse(o=>{o.geometry?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});env?.dispose();if(scene.environment===(env?.texture||environmentTexture))scene.environment=previousEnvironment;}
  const api={root,core,shipGroup,ready:promise,setProgress,update,pick,dispose,setPointer(p){viewPointer.copy(p).clampScalar(-1,1);},get shipSource(){return shipSource;},get loaded(){return ready;},get progress(){return progress;}};return api;
}
