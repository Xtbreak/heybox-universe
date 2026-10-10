import * as THREE from './vendor/three.module.js';

export function getTimeline(progress) {
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  const s=(a,b)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
  const opening=s(.16,.47),entry=s(.48,.72),flight=s(.68,1),centering=s(.06,.46);
  return {progress:p,opening,entry,flight,centering,cameraZ:8.5-12.4*entry-82*flight};
}

// A self-contained, reversible, scroll-directed WebGL film.
export async function createWorld(canvas, { onReady, onError } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { onError?.(e); throw e; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070611, .021);
  const camera = new THREE.PerspectiveCamera(44, 1, .08, 180);
  const root = new THREE.Group(); scene.add(root);
  const resources = new Set();
  const keep = r => { resources.add(r); return r; };
  const mat = (c, metal=.65, rough=.28, more={}) => keep(new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough,...more}));
  const black = mat(0x171922,.83,.26), edge = mat(0x777c98,.94,.2), dark = mat(0x080912,.55,.32);
  const purple = mat(0x6924e9,.4,.22,{emissive:0x862dff,emissiveIntensity:2.5});
  const cyan = mat(0x70e8ff,.3,.2,{emissive:0x08beff,emissiveIntensity:3});
  const pink = mat(0xeb54ff,.3,.22,{emissive:0xc41bff,emissiveIntensity:2});
  const orange = mat(0xffca86,.5,.25,{emissive:0xff580c,emissiveIntensity:2});
  const materials=[purple,cyan,pink,orange];
  const ambient = new THREE.HemisphereLight(0x9cacff,0x140923,3); scene.add(ambient);
  function point(c,intensity,pos,dist=35) {const l=new THREE.PointLight(c,intensity,dist,1.7);l.position.set(...pos);scene.add(l);return l;}
  point(0x9685ff,100,[-3,4,5]); point(0x24cfff,85,[5,1,3]); point(0xff52a7,65,[0,-4,-2]);
  const key=new THREE.DirectionalLight(0xf5eeff,3.2);key.position.set(-3,6,6);scene.add(key);
  // Studio reflections generated entirely on-device, avoiding network-bound HDR assets.
  const envScene=new THREE.Scene();envScene.background=new THREE.Color(0x161628);
  for(const [c,x,y,z,s] of [[0xb8c6ff,0,6,1,8],[0x6644dd,-6,1,1,7],[0x41bcff,6,0,1,5],[0xffffff,0,0,7,3]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(s,s),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);envScene.add(m);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);let envTarget;
  try {envTarget=pmrem.fromScene(envScene,.06);scene.environment=envTarget.texture;} catch (_) {}
  envScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
  const box=(w,h,d)=>keep(new THREE.BoxGeometry(w,h,d));
  const torus=(r,t=.018,rs=7,ts=80)=>keep(new THREE.TorusGeometry(r,t,rs,ts));
  function mesh(geo,material,parent=root,pos=[0,0,0]) {const m=new THREE.Mesh(geo,material);m.position.set(...pos);parent.add(m);return m;}
  function bevel(w,h,d,b=.09){const s=new THREE.Shape();s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();const g=keep(new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:b*.4,bevelThickness:b*.35,bevelSegments:3,steps:1,curveSegments:1}));g.translate(0,0,-d/2);return g;}
  const cube=new THREE.Group();root.add(cube);const panels=[];
  const directions=[[0,0,1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,-1]];
  const panelGeo=bevel(2.22,2.22,.18,.19),insetGeo=bevel(1.78,1.78,.06,.2),frameGeo=bevel(.11,1.88,.09,.04);
  const boltGeo=keep(new THREE.CylinderGeometry(.045,.045,.045,6));boltGeo.rotateX(Math.PI/2);
  const boltMesh=new THREE.InstancedMesh(boltGeo,edge,24);cube.add(boltMesh);const boltDummy=new THREE.Object3D();
  directions.forEach((v,i)=>{
    const dir=new THREE.Vector3(...v), group=new THREE.Group();group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);group.position.copy(dir).multiplyScalar(1.16);cube.add(group);
    mesh(panelGeo,black,group);mesh(insetGeo,dark,group,[0,0,.14]);
    for(const x of [-.98,.98]) mesh(frameGeo,edge,group,[x,0,.16]);
    for(const y of [-.98,.98]) {const m=mesh(frameGeo,edge,group,[0,y,.16]);m.rotation.z=Math.PI/2;}
    for(let k=0;k<5;k++) {mesh(box(.052,.37,.035),k===2?cyan:edge,group,[-.68+k*.14,-.53,.2]);}
    const stripe=mesh(bevel(.055,1.3,.02,.02),i%2?cyan:purple,group,[.69,0,.205]);
    const mark=mesh(bevel(.83,.11,.05,.045),edge,group,[-.19,.53,.2]);mark.rotation.z=-Math.PI/4;
    const mark2=mesh(bevel(.83,.11,.05,.045),edge,group,[.19,.53,.2]);mark2.rotation.z=Math.PI/4;
    const vent=mesh(torus(.35,.035,8,48),edge,group,[0,-.08,.2]);
    for(let k=0;k<8;k++){const a=k*Math.PI/4;const m=mesh(box(.09,.2,.025),black,group,[Math.cos(a)*.22,Math.sin(a)*.22-.08,.22]);m.rotation.z=a-.4;}
    mesh(keep(new THREE.CircleGeometry(.11,32)),purple,group,[0,-.08,.235]);
    panels.push({group,dir,baseQ:group.quaternion.clone(),i});
  });
  const core=new THREE.Group();cube.add(core);
  const nucleus=mesh(keep(new THREE.IcosahedronGeometry(.58,1)),mat(0x8cabff,.75,.08,{emissive:0x4813cc,emissiveIntensity:1.3}),core);
  const inner=mesh(keep(new THREE.OctahedronGeometry(.72)),new THREE.MeshBasicMaterial({color:0xc3a0ff,wireframe:true,transparent:true,opacity:.75}),core);keep(inner.material);
  const rings=[];
  for(let i=0;i<3;i++){const g=new THREE.Group();core.add(g);g.rotation.set(i*.8,i*.63,i*.4);mesh(torus(.87+i*.13,.026,8,100),i%2?cyan:purple,g);for(let j=0;j<8;j++){const a=j*Math.PI/4;const m=mesh(box(.16,.07,.1),edge,g,[Math.cos(a)*(.88+i*.13),Math.sin(a)*(.88+i*.13),0]);m.rotation.z=a;}rings.push(g);}
  // Soft additive light blooms preserve a clean one-pass render on mobile.
  const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-size/2,y-size/2)/(size/2);const a=Math.pow(Math.max(0,1-r),3);const n=(y*size+x)*4;data[n]=data[n+1]=data[n+2]=255;data[n+3]=Math.round(a*255);}
  const glowTex=keep(new THREE.DataTexture(data,size,size));glowTex.magFilter=THREE.LinearFilter;glowTex.minFilter=THREE.LinearFilter;glowTex.needsUpdate=true;
  function glow(parent,color,scale,pos=[0,0,0],opacity=.8){const m=keep(new THREE.SpriteMaterial({map:glowTex,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));const s=new THREE.Sprite(m);s.position.set(...pos);s.scale.setScalar(scale);parent.add(s);return s;}
  glow(core,0x772eff,5);glow(core,0x48ddff,2);const coreLight=point(0x663fff,45,[0,0,0],12);
  const shards=new THREE.Group();root.add(shards);const shardItems=[];for(let i=0;i<20;i++){const a=i*2.399;const r=2.7+(i%4)*.36;const m=mesh(bevel(.16+(i%3)*.12,.35+(i%4)*.12,.13,.06),i%5===0?purple:black,shards,[Math.cos(a)*r,Math.sin(a)*r*.8,Math.sin(i*1.7)*1.5]);m.rotation.set(i*.7,i*.9,a);shardItems.push(m);}
  // Tunnel: nested segmented solid portal ribs, longitudinal conduits, and luminous spirals.
  const tunnel=new THREE.Group();root.add(tunnel);const tunnelRings=[];
  const archGeo=torus(3.55,.085,8,64),thinGeo=torus(3.37,.016,5,64),nodeGeo=box(.18,.52,.2);
  const tunnelNodes=new THREE.InstancedMesh(nodeGeo,edge,29*8);tunnel.add(tunnelNodes);
  const ledGeo=box(.045,.28,.22);const tunnelLeds=materials.map(m=>{const o=new THREE.InstancedMesh(ledGeo,m,58);tunnel.add(o);return o;});
  const ledCounts=[0,0,0,0],ribDummy=new THREE.Object3D();
  for(let i=0;i<29;i++){
    const g=new THREE.Group();g.position.z=-6-i*3.2;g.rotation.z=i*.105;tunnel.add(g);mesh(archGeo,i%3===0?edge:black,g);mesh(thinGeo,materials[i%4],g);
    for(let j=0;j<8;j++){const a=j*Math.PI/4+i*.105;ribDummy.position.set(Math.cos(a)*3.52,Math.sin(a)*3.52,-6-i*3.2);ribDummy.rotation.z=a;ribDummy.updateMatrix();tunnelNodes.setMatrixAt(i*8+j,ribDummy.matrix);ribDummy.position.set(Math.cos(a)*3.42,Math.sin(a)*3.42,-6-i*3.2+.04);ribDummy.updateMatrix();const c=(i+j)%4;tunnelLeds[c].setMatrixAt(ledCounts[c]++,ribDummy.matrix);}
    if(i%3===0)glow(g, i%2?0x8f22ff:0x08aaff,6,[0,0,0],.18);
    tunnelRings.push(g);
  }
  for(let j=0;j<8;j++){const a=j*Math.PI/4;mesh(box(.09,.09,94),j%2?purple:cyan,tunnel,[Math.cos(a)*3.9,Math.sin(a)*3.9,-50]);}
  for(let j=0;j<4;j++){
    const pts=[];for(let i=0;i<150;i++){const t=i/149;const a=t*Math.PI*5+j*Math.PI/2;pts.push(new THREE.Vector3(Math.cos(a)*3.02,Math.sin(a)*3.02,-5-t*94));}
    mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),210,.022,5,false)),materials[j],tunnel);
  }
  const portal=new THREE.Group();portal.position.z=-5.5;root.add(portal);
  for(let i=0;i<4;i++){const r=mesh(torus(2.4+i*.2,.03+i*.012,8,100),i%2?cyan:purple,portal);r.rotation.z=i*.2;}
  glow(portal,0x6837ff,9,[0,0,-.1],.58);
  // Instanced volumetric dust spans the full travel distance.
  const count=550,particleGeo=keep(new THREE.IcosahedronGeometry(.018,0));const particleMat=keep(new THREE.MeshBasicMaterial({color:0xada3ff,transparent:true,opacity:.65}));const particles=new THREE.InstancedMesh(particleGeo,particleMat,count);root.add(particles);const dummy=new THREE.Object3D();
  let seed=531;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){const a=rand()*Math.PI*2,r=1.3+rand()*7;dummy.position.set(Math.cos(a)*r,Math.sin(a)*r,10-rand()*115);dummy.scale.setScalar(.5+rand()*2.5);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);}
  let paused=false;let progress=0,target=0,px=0,py=0,reduced=false,disposed=false,frame=0,last=performance.now(),elapsed=0,ready=false,width=1,height=1;
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  const q=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),look=new THREE.Vector3();
  function render(now){if(disposed)return;if(paused||document.hidden){last=now;frame=requestAnimationFrame(render);return;}const dt=Math.min((now-last)/1000,.06);last=now;if(!reduced)elapsed+=dt;
    progress=THREE.MathUtils.damp(progress,target,reduced?40:9,dt);const p=progress;
    const {opening,entry,flight,centering,cameraZ}=getTimeline(p);
    cube.position.set((width/height>1.15?1.55:0)*(1-centering),0,0);cube.rotation.set(.17*(1-entry)+Math.sin(elapsed*.2)*.02,.48+p*.65+(!reduced?elapsed*.055:0),-.1*(1-entry));
    cube.scale.setScalar(1-.18*entry);cube.visible=p<.82;shards.visible=p<.82;
    panels.forEach(({group,dir,baseQ,i})=>{group.position.copy(dir).multiplyScalar(1.16+opening*(1.35+(i%2)*.3));q.setFromAxisAngle(axis,opening*(i%2?1:-1)*.48);group.quaternion.copy(baseQ).multiply(q);});
    cube.updateMatrixWorld(true);
    let bi=0;for(const {group} of panels){for(const x of [-.85,.85])for(const y of [-.85,.85]){boltDummy.position.set(x,y,.23).applyQuaternion(group.quaternion).add(group.position);boltDummy.quaternion.copy(group.quaternion);boltDummy.updateMatrix();boltMesh.setMatrixAt(bi++,boltDummy.matrix);}}boltMesh.instanceMatrix.needsUpdate=true;
    nucleus.rotation.set(elapsed*.24,elapsed*.3,p*2);inner.rotation.set(-elapsed*.12,elapsed*.2,elapsed*.1);rings.forEach((g,i)=>{g.rotation.z=elapsed*(i%2?-.25:.3)+i*.4;g.rotation.y=i*.63+opening*.6;});
    coreLight.position.copy(cube.position);coreLight.intensity=40+opening*30;
    shards.position.copy(cube.position);shards.rotation.y=elapsed*.07;shardItems.forEach((m,i)=>{m.rotation.z+=reduced?0:dt*.06*(i%2?1:-1);});shards.scale.setScalar(1+opening*.35);
    portal.rotation.z=elapsed*.08;portal.scale.setScalar(.84+opening*.16);tunnel.rotation.z=Math.sin(elapsed*.08)*.025;
    const z=cameraZ;
    camera.position.set((Math.sin(p*4)*.55+px*.18)*(1-entry)+Math.sin(flight*7)*.28*flight,py*.15*(1-entry)+Math.sin(flight*5)*.24,z);
    look.set(0,-.03,-entry*12-flight*88);camera.lookAt(look);camera.rotation.z+=Math.sin(flight*5)*.075*flight;
    scene.fog.density=.021+entry*.011;renderer.toneMappingExposure=1.18+entry*.08;
    try{renderer.render(scene,camera);if(!ready){ready=true;onReady?.();}}catch(e){onError?.(e);return;}
    frame=requestAnimationFrame(render);
  }
  const lost=e=>{e.preventDefault();cancelAnimationFrame(frame);onError?.(new Error('WebGL context lost'));};canvas.addEventListener('webglcontextlost',lost);
  frame=requestAnimationFrame(render);
  return {setPaused(v){paused=!!v;},setProgress(p){target=THREE.MathUtils.clamp(Number(p)||0,0,1);},setPointer(x,y){px=THREE.MathUtils.clamp(x,-1,1);py=THREE.MathUtils.clamp(y,-1,1);},setReducedMotion(v){reduced=!!v;},dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();canvas.removeEventListener('webglcontextlost',lost);resources.forEach(r=>r.dispose());envTarget?.dispose();renderer.dispose();}};
}
