import { createSpaceBackdrop } from './space-backdrop.js?v=journey-37';
import { createJourneyUltra } from './journey-ultra.js?v=journey-37';
import { createVoxelHeybox } from './voxel-heybox.js?v=journey-37';
import { createJourneyParticles } from './journey-particles.js?v=journey-37';
import { createCommunityPlaza } from './community-plaza.js?v=journey-37';

const coarsePointer=globalThis.matchMedia?.('(pointer: coarse)');
// A continuous, scene-space expedition. Imported GLB transforms are never modified.
export function createCosmicJourney({ THREE, scene, camera, entries }) {
  const root = new THREE.Group(); root.name = 'cosmic-journey'; scene.add(root);
  const resources = new Set(), keep = v => (resources.add(v), v);
  const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
  // After the toy park the road ends at a friend's house; the rail stops inside, seated.
  const END = 1, clampRail = clamp;
  const smooth = (a,b,v) => { const x=clamp((v-a)/(b-a)); return x*x*(3-2*x); };
  const names=['helmet','robot','car'], originalParents=new Map();
  for (const name of names) { const g=entries[name]?.group; if(g){originalParents.set(g,g.parent);root.add(g);} }
  const group=(parent=root,p=[0,0,0])=>{const g=new THREE.Group();g.position.set(...p);parent.add(g);return g;};
  const material=(color,options={})=>keep(new THREE.MeshStandardMaterial({color,metalness:.83,roughness:.29,...options}));
  const black=material(0x080e15), silver=material(0x4c5761), dark=material(0x1a2128), lunar=material(0x3c444b,{metalness:.16,roughness:.92});
  const ice=keep(new THREE.MeshBasicMaterial({color:0xa7dfff})); ice.color.multiplyScalar(.82);
  const faint=keep(new THREE.MeshBasicMaterial({color:0x759bb3,transparent:true,opacity:.26,depthWrite:false}));
  const wire=keep(new THREE.LineBasicMaterial({color:0x7196ad,transparent:true,opacity:.25}));
  const mesh=(geo,mat=black,parent=root,p=[0,0,0])=>{const o=new THREE.Mesh(keep(geo),mat);o.position.set(...p);parent.add(o);return o;};
  const box=(x,y,z,m=black,p=root,pos)=>mesh(new THREE.BoxGeometry(x,y,z),m,p,pos);
  const ring=(r,t=.015,m=ice,p=root,pos)=>mesh(new THREE.TorusGeometry(r,t,6,88),m,p,pos);
  let seed=402981;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const texData=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,a=Math.pow(Math.max(0,1-Math.hypot(x-31.5,y-31.5)/32),2.8);texData.set([180,219,245,Math.round(a*255)],i);}
  const glowMap=keep(new THREE.DataTexture(texData,64,64));glowMap.needsUpdate=true;
  function glow(parent,size,pos=[0,0,0],opacity=.3){const s=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:glowMap,color:0xa4dfff,transparent:true,opacity:opacity*.65,depthWrite:false,blending:THREE.AdditiveBlending})));s.position.set(...pos);s.scale.setScalar(size);parent.add(s);return s;}
  function label(parent,text,pos,width=3.2){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');if(!ctx)return null;ctx.fillStyle='#c9d3da';ctx.font="500 30px 'JetBrains Mono',Menlo,Consolas,monospace";ctx.textAlign='center';ctx.fillText(text,512,74);const t=keep(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false})));s.position.set(...pos);s.scale.set(width,width/8,1);parent.add(s);return s;}
  // The black box is a field of small obsidian grains (voxel-heybox.js). It faces the
  // camera at an angle; scrolling turns it square-on, where its logo channel lines up.
  const heroAnchor=group(root,[1.1,.15,0]);heroAnchor.name='voxel-hero-anchor';const tableAnchor=new THREE.Group();tableAnchor.name='voxel-table-anchor';{const b=new THREE.Mesh(keep(new THREE.BoxGeometry(2.2,2.2,1.32)),keep(new THREE.MeshBasicMaterial({visible:false})));b.raycast=()=>{};tableAnchor.add(b);}
  const REVEAL_AT=.07;let introStart=null,lastT=0,tiltX=0,tiltY=0,heroReveal=0;
  // The shared GPU particle layer owns the background stars and travel dust.
  // Nebular scattering is additive and mostly transparent, leaving silhouettes readable.
  for(let i=0;i<10;i++){const g=glow(root,35+random()*45,[(random()-.5)*90,(random()-.5)*60,-35-i*47],.045);g.scale.y*=.5;}
  // Open helical ribbons carry the eye through real depth. There are no repeated hoops.
  const ribbonMaterial=keep(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},strength:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
      void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),1.8);
      float ends=smoothstep(0.,.065,vUv.x)*(1.-smoothstep(.86,1.,vUv.x));
      float flow=pow(.5+.5*sin(vUv.x*42.-time*.38),9.);
      gl_FragColor=vec4(mix(vec3(.22,.30,.36),vec3(.52,.68,.76),flow),edge*ends*strength*(.20+flow*.24));}`
  }));
  function tunnel(z,length,radius,turns){
    const g=group(root,[0,0,z]);g.name='continuous-spiral-wormhole';
    const mat=keep(ribbonMaterial.clone());
    for(let strand=0;strand<4;strand++){
      const segments=240,positions=new Float32Array((segments+1)*6),uv=new Float32Array((segments+1)*4),indices=[];
      for(let i=0;i<=segments;i++){
        const u=i/segments,a=u*Math.PI*2*turns+strand*Math.PI*.5;
        const r=radius+Math.sin(u*Math.PI*2+strand)*.34;
        for(let side=0;side<2;side++){
          const angle=a+(side-.5)*.038,n=i*6+side*3;
          positions[n]=Math.cos(angle)*r+Math.sin(u*Math.PI*2)*.35;
          positions[n+1]=Math.sin(angle)*r;positions[n+2]=-u*length;
          uv[i*4+side*2]=u;uv[i*4+side*2+1]=side;
        }
        if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
      }
      const geo=keep(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);geo.computeBoundingSphere();
      g.add(new THREE.Mesh(geo,mat));
    }
    return{g,mat};
  }
  const tunnelWindows=[[.12,.20,.31,.365],[.435,.465,.515,.56],[.63,.675,.75,.795]];
  const tunnels=[tunnel(-7,83,4.7,1.85),tunnel(-116,76,5.0,1.55),tunnel(-229,84,5.6,2.1)];
  const worlds={},portalSpinners=[],modelLocations={helmet:[2,.15,-108],robot:[2,0,-204],car:[2,-.25,-338]};
  // Soft contact shadow under each display model, so it sits on its stand.
  const contactShadow=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
    r.addColorStop(0,'rgba(0,0,0,.85)');r.addColorStop(.45,'rgba(0,0,0,.5)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);
    const t=keep(new THREE.CanvasTexture(c));return keep(new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,opacity:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));})();
  function portal(name,r){const p=modelLocations[name],g=group(root,p),back=group(g,[0,0,-2]);worlds[name]={g,back};
    ring(r,.085,silver,back);ring(r+.15,.013,ice,back);
    const inner=ring(r-.13,.022,ice,back);portalSpinners.push(inner);
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const b=box(i%4===0?.13:.05,.26,.18,i%4===0?ice:dark,back,[Math.sin(a)*(r+.05),Math.cos(a)*(r+.05),.03]);b.rotation.z=-a;}
    glow(back,r*3,[0,0,-.2],.12);label(g,'[ 悬停 1s ]',[0,-2.35,.5],2.5);hologram(g,name);
    const floor=mesh(new THREE.CylinderGeometry(2.35,2.5,.18,64),black,g,[0,-1.8,-.1]);const floorR=ring(2.37,.018,ice,g,[0,-1.69,-.1]);floorR.rotation.x=Math.PI/2;
    const blob=mesh(new THREE.PlaneGeometry(1,1),contactShadow,g,[0,-1.695,0]);blob.rotation.x=-Math.PI/2;blob.scale.set(name==='car'?3.6:name==='robot'?2.2:2.6,name==='car'?2.4:name==='robot'?1.6:1.5,1);blob.renderOrder=1;
    return g;
  }
  // Pedestal hologram: a triangulated wire cylinder with slow rising grains inside it.
  const holoWire=keep(new THREE.LineBasicMaterial({color:0x9fb4c2,transparent:true,opacity:.13,depthWrite:false}));
  const dustMaterial=keep(new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},
    vertexShader:'attribute vec3 aSeed;uniform float uTime;varying float vA;void main(){float h=fract(aSeed.z+uTime*.035*(.5+aSeed.y));float a=aSeed.x*6.2832+uTime*.05;float r=.4+aSeed.y*1.4;vec3 p=vec3(cos(a)*r,-1.65+h*3.6,sin(a)*r);vA=sin(3.14159*h);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(28./-mv.z,1.,3.);}',
    fragmentShader:'varying float vA;void main(){gl_FragColor=vec4(vec3(.78,.84,.88),vA*.55);}'}));
  const dustGeo=keep(new THREE.BufferGeometry());{const d=new Float32Array(220*3);for(let i=0;i<d.length;i++)d[i]=random();dustGeo.setAttribute('aSeed',new THREE.BufferAttribute(d,3));dustGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(220*3),3));}
  function hologram(g,name){const r=name==='car'?2.2:1.85,c=keep(new THREE.WireframeGeometry(keep(new THREE.CylinderGeometry(r,r,3.6,14,4,true))));const w=new THREE.LineSegments(c,holoWire);w.position.y=.1;w.raycast=()=>{};g.add(w);
    const d=new THREE.Points(dustGeo,dustMaterial);d.frustumCulled=false;d.raycast=()=>{};g.add(d);}
  const helmetStage=portal('helmet',2.55),robotStage=portal('robot',2.7),carStage=portal('car',2.65);
  // Orbital destination: fractured planet, tilted orbital paths and drifting debris.
  const orbitalScenery=group();
  const planet=mesh(new THREE.IcosahedronGeometry(13,4),lunar,orbitalScenery,[-16,-8,-128]);planet.rotation.set(.6,.2,.4);
  const planetOrbit=ring(18,.035,silver,orbitalScenery,[-16,-8,-128]);planetOrbit.rotation.set(1.17,.32,.25);
  ring(13.15,.055,ice,orbitalScenery,[-16,-8,-128]);glow(orbitalScenery,38,[-16,-8,-137],.13);
  const asteroidGeo=keep(new THREE.IcosahedronGeometry(1,0)),asteroids=new THREE.InstancedMesh(asteroidGeo,dark,120),dummy=new THREE.Object3D();
  for(let i=0;i<120;i++){const a=random()*Math.PI*2,r=6+random()*21;dummy.position.set(Math.cos(a)*r,Math.sin(a)*r*.7,-126-random()*65);dummy.rotation.set(random()*6,random()*6,random()*6);dummy.scale.set(.3+random()*1.2,.2+random()*.6,.3+random());dummy.updateMatrix();asteroids.setMatrixAt(i,dummy.matrix);}orbitalScenery.add(asteroids);keep(asteroids);
  // Moon architecture: tall silver colonnades orbiting an immense low lunar horizon.
  const lunarScenery=group();
  const moon=mesh(new THREE.SphereGeometry(24,48,32),lunar,lunarScenery,[-8,-29,-222]);
  const buildings=new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1,1,1)),silver,26);
  for(let i=0;i<26;i++){const a=i/26*Math.PI*2,r=10+(i%3)*3,h=4+(i%5)*1.7;dummy.position.set(Math.cos(a)*r,-3+h*.5,-211+Math.sin(a)*r*.6);dummy.rotation.set(0,-a,0);dummy.scale.set(.65,h,.85);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);const bar=box(.04,h,.045,ice,lunarScenery,[dummy.position.x+.36,dummy.position.y,dummy.position.z+.45]);}lunarScenery.add(buildings);keep(buildings);
  const skyRing=ring(14,.045,silver,lunarScenery,[0,4,-220]);skyRing.rotation.x=1.03;
  // Silver highway vanishing through repeated luminous gate towers.
  const highway=group(root,[2,-2.05,-338]);box(7,.18,87,black,highway,[0,0,-29]);
  for(const x of [-3.2,3.2])box(.035,.05,87,ice,highway,[x,.11,-29]);
  for(let i=0;i<24;i++){box(.06,.025,1.6,i%3===0?ice:silver,highway,[0,.12,8-i*3.3]);if(i%3===0){for(const x of [-3.8,3.8]){box(.21,7,.35,silver,highway,[x,3.4,-i*3.3]);box(.035,6.7,.04,ice,highway,[x-.14,3.4,.21-i*3.3]);}box(7.8,.2,.35,silver,highway,[0,6.9,-i*3.3]);}}
  const particles=createJourneyParticles({THREE,root,camera,entries,core:null,transport:false});
  const backdrop=createSpaceBackdrop({THREE,root});
  const ultraEffects=createJourneyUltra({THREE,root,camera,entries,core:null});
  // The same Heybox, small, waits on the friends' coffee table.
  const plaza=createCommunityPlaza({THREE,parent:root,core:{group:tableAnchor,ready:Promise.resolve(),update(){}}});
  const voxels=createVoxelHeybox({THREE,root,camera,particles,heroAnchor,tableAnchor,modelLocations});
  const iceBase=ice.color.clone(),hdrMaterials=[];
  const optics={center:new THREE.Vector3(),strength:0,radius:.22};
  // Each scenic assembly owns a bounded set of fade materials; imported game assets are untouched.
  function fadingGroup(g){const cache=new Map(),mats=[];g.traverse(o=>{if(!o.material)return;
    const clone=m=>{if(cache.has(m))return cache.get(m);const c=keep(m.clone());c.transparent=true;c.depthWrite=false;cache.set(m,c);if(m===ice)hdrMaterials.push(c);mats.push([c,m.opacity,m.depthWrite]);return c;};
    o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});
    return value=>{g.visible=value>0.0001;for(const [m,base,depthWrite] of mats){m.opacity=base*value;m.depthWrite=depthWrite&&value>.995;}};}
  const worldFades=names.map(n=>fadingGroup(worlds[n].g)),sceneryFades=[orbitalScenery,lunarScenery,highway].map(fadingGroup);
  const windowFade=(p,a,b,c,d)=>smooth(a,b,p)*(1-smooth(c,d,p));
  const nodes=[
    [0, 0,.3,9, 1.1,.1,0,42], [.065, -.35,.55,7.9, 1.25,.14,0,43], [.12, -.55,.7,6.6, .7,.1,-.5,45],
    [.19, .2,.1,2.6, 0,0,-14,59], [.23, 0,0,-10, 0,0,-38,67],
    [.29, .25,-.2,-58, 0,0,-86,69], [.34, -.1,.45,-94, 1,.1,-108,47],
    [.375, 0.03005259204,0.4639368896,-97.39015778,0.365026296,0.169947408,-108,43], [.43, 0.03005259204,0.4639368896,-97.39015778,0.365026296,0.169947408,-108,43],
    [.45, 0,.25,-101, .1,0,-135,49], [.50, -1.8,.75,-151, 0,0,-180,62],
    [.54, .1,.5,-193, .4,.1,-204,45], [.575, 0.04373177843,0.4145772595,-193.7,0.3645772595,0.1,-204,44],
    [.645, 0.04373177843,0.4145772595,-193.7,0.3645772595,0.1,-204,44], [.66, 0,.15,-211, 0,0,-243,60],
    [.72, -.4,.5,-272, 0,0,-300,69], [.77, 0,.9,-326.5, .6,-.3,-338,47],
    [.8, 0.04067382812,0.8296630859,-327.9,0.4406738281,-0.3,-338,44], [.88, 0.04067382812,0.8296630859,-327.9,0.4406738281,-0.3,-338,44],
    // Down the park road to the porch, through the door, and onto the spare cushion.
    [.905, 2.2,.55,-370, 2,.1,-412,52], [.93, 2.05,.42,-405.6, 2,-.1,-412.04,50],
    [.955, 1.85,.42,-411.6, 1.95,-.9,-418.6,56], [.975, 1.45,.4,-412.1, 1.9,-1.2,-418.9,59],
    [.99, 1.4,.38,-412.3, 1.9,-1.24,-418.9,60], [1, 1.4,.38,-412.3, 1.9,-1.24,-418.9,60]
  ];
  const pose=new Array(7).fill(0),focus=new THREE.Vector3();let active='helmet',lastFov=-1,indoorMix=0;
  let hoverTarget=null,hoverCameraOffset=null,hoverApproach=0;const heldModelPoses=new Map();
  // Monotone cubic Hermite rail: continuous velocity through flight waypoints,
  // exactly stationary on the three existing interaction plateaus, no overshoot.
  const tangents=nodes.map(()=>new Float64Array(7));
  for(let k=0;k<7;k++)for(let i=1;i<nodes.length-1;i++){
    const h0=nodes[i][0]-nodes[i-1][0],h1=nodes[i+1][0]-nodes[i][0];
    const d0=(nodes[i][k+1]-nodes[i-1][k+1])/h0,d1=(nodes[i+1][k+1]-nodes[i][k+1])/h1;
    if(d0*d1>0){const w0=2*h1+h0,w1=h1+2*h0;tangents[i][k]=(w0+w1)/(w0/d0+w1/d1);}
  }
  function sample(p){let j=0;while(j<nodes.length-2&&p>nodes[j+1][0])j++;
    const a=nodes[j],b=nodes[j+1],h=b[0]-a[0],u=clamp((p-a[0])/h),u2=u*u,u3=u2*u;
    for(let k=0;k<7;k++)pose[k]=(2*u3-3*u2+1)*a[k+1]+(u3-2*u2+u)*h*tangents[j][k]+(-2*u3+3*u2)*b[k+1]+(u3-u2)*h*tangents[j+1][k];
    return pose;
  }
  function update(progress,time=0,dt=0,options={}){
    const ultra=options.quality==='ultra';
    ice.color.copy(iceBase).multiplyScalar(ultra?1.35:.8);hdrMaterials.forEach(m=>m.color.copy(ice.color));
    const p=clampRail(progress),pj=Math.min(1,p),t=Number.isFinite(time)?time:0,{width=1280,height=800,reduced=options.reducedMotion||false,pointerX=0,pointerY=0}=options;
    const hovered=names.includes(options.hoverTarget)?options.hoverTarget:null;
    if(hovered!==hoverTarget){
      hoverTarget=hovered;heldModelPoses.clear();hoverCameraOffset=hovered?{x:reduced?0:pointerX*.13,y:reduced?0:pointerY*.09}:null;
      if(hovered){const g=entries[hovered]?.group;if(g)heldModelPoses.set(hovered,{position:g.position.clone(),rotation:g.rotation.clone()});}
    }
    const mobile=width/Math.max(1,height)<.85,flight=Math.max(smooth(.16,.23,p)*(1-smooth(.30,.35,p)),smooth(.445,.48,p)*(1-smooth(.51,.55,p)),smooth(.65,.68,p)*(1-smooth(.735,.78,p)));
    // Indoors the pointer only nudges the gaze, and the mobile pull-back stays outside the walls.
    const indoor=smooth(.93,.955,p),sway=1-.7*indoor;indoorMix=smooth(.875,.925,p);
    sample(p);camera.position.set(pose[0]+(hoverCameraOffset?.x??(reduced?0:pointerX*.13*sway)),pose[1]+(hoverCameraOffset?.y??(reduced?0:pointerY*.09*sway)),pose[2]+(mobile?(2.2+.8*smooth(.12,.23,p))*(1-indoor):0));
    focus.set(pose[3],pose[4],pose[5]);if(mobile){const own=1-smooth(.88,.92,p);focus.x=focus.x*(1-own)+own*(1.1*(1-smooth(.12,.23,p))+1.5*smooth(.30,.36,p));}
    // The hit hull stays frozen in screen space while this small approach is rendered.
    hoverApproach=THREE.MathUtils.damp(hoverApproach,hovered&&!reduced?clamp(options.hoverProgress)*.055:0,9,Math.max(0,dt));
    camera.position.lerp(focus,hoverApproach);
    camera.lookAt(focus);if(!reduced)camera.rotateZ(Math.sin(p*Math.PI*9)*flight*.045);
    const fov=(ultra&&!reduced?THREE.MathUtils.lerp(pose[6],52+18*ultraEffects.rift(p),ultraEffects.rift(p)):pose[6])+(mobile?5+17*indoor:0);if(Math.abs(fov-lastFov)>.01 || Math.abs(camera.fov-fov)>.01 || camera.far<900){camera.fov=fov;camera.far=Math.max(camera.far,900);camera.updateProjectionMatrix();lastFov=fov;}
    // Opening: the construction sketch draws itself, then the grains settle in layer by layer.
    lastT=t;if(introStart===null&&p>.01)introStart=t-9;
    const since=introStart===null?0:reduced?99:t-introStart;
    const intro={draw:smooth(.1,1.9,since),build:smooth(1.5,3.6,since),sketch:1-.55*smooth(3.4,4.8,since)};
    tiltX=THREE.MathUtils.damp(tiltX,reduced?0:pointerX,3.5,Math.max(0,dt));tiltY=THREE.MathUtils.damp(tiltY,reduced?0:pointerY,3.5,Math.max(0,dt));
    // Scroll turns the box square to the camera; at REVEAL_AT the channel is exactly aligned.
    const align=smooth(0,REVEAL_AT,p),off=1-align,drift=reduced?0:Math.sin(t*.21)*.05*off;
    heroAnchor.position.set(1.1,.15+(reduced?0:Math.sin(t*.45)*.04*off),0);heroAnchor.scale.setScalar(mobile?.9:1.08);
    heroAnchor.lookAt(camera.position);heroAnchor.rotateY((.62+drift)*off+tiltX*.16*off);heroAnchor.rotateX((-.2*off+tiltY*.1*off));
    heroReveal=Math.max(0,1-Math.abs(.62*off+tiltX*.16*off)/.3)**2*smooth(.5,1,intro.build);
    for(let i=0;i<tunnels.length;i++){const q=tunnels[i],w=tunnelWindows[i],alpha=windowFade(p,...w);q.g.visible=alpha>.0001;
      q.mat.uniforms.time.value=reduced?0:t;q.mat.uniforms.strength.value=alpha*(.12+flight*.10);}
    plaza.update({progress:p,time:t,dt,reduced,camera,quality:options.quality});
    for(let i=0;i<names.length;i++){
      const name=names[i],entry=entries[name],location=modelLocations[name];if(!entry?.group)continue;
      const g=entry.group;g.visible=particles.isPrepared(name)&&(name==='helmet'?p>.292&&p<.477:name==='robot'?p>.511&&p<.700:p>.741&&p<.915);
      g.position.set(location[0],location[1]+(name==='car'?.53:0)+(reduced?0:Math.sin(t*.7+i)*.07),location[2]);
      g.rotation.set(name==='car'?.04:name==='helmet'?.32:0,name==='helmet'?Math.PI-1.0+Math.sin(t*.18)*.09:name==='robot'?-.19:name==='car'?-Math.PI*.19:0,0);
      const held=heldModelPoses.get(name);if(held){g.position.copy(held.position);g.rotation.copy(held.rotation);}
      g.scale.setScalar(name==='car'?1.38:name==='robot'?1.05:1.07);
      worldFades[i](i===0?windowFade(p,.265,.30,.475,.51):i===1?windowFade(p,.47,.51,.67,.70):windowFade(p,.70,.75,.895,.915));portalSpinners[i].rotation.z=reduced?0:t*(i%2?-.1:.12);
    }
    sceneryFades[0](windowFade(p,.255,.29,.51,.56));sceneryFades[1](windowFade(p,.465,.50,.67,.70));sceneryFades[2](windowFade(p,.70,.745,.925,.95));
    planet.rotation.y=reduced?0:t*.012;skyRing.rotation.z=reduced?0:t*.025;
    backdrop.update({quality:options.quality,progress:pj,time:t,reduced,width,height,pointerX,pointerY,desktop:!coarsePointer?.matches,cameraZ:camera.position.z});
    ultraEffects.update({progress:pj,time:t,dt,reduced,quality:options.quality,hoverTarget:hovered,hoverProgress:options.hoverProgress||0});
    particles.update({cut:{car:smooth(.862,.9,p)},progress:p,time:t,dt,reduced,quality:options.quality,width,height,pointerX,pointerY,hoverTarget:hovered,hoverProgress:options.hoverProgress||0,flight});
    dustMaterial.uniforms.uTime.value=reduced?0:t;
    voxels.update({progress:p,time:t,dt,reduced,quality:options.quality,width,height,pointerX,pointerY,peel:!!options.peel&&!coarsePointer?.matches,intro,reveal:heroReveal});
    optics.center.copy(hovered&&entries[hovered]?.group?entries[hovered].group.position:p<.23?heroAnchor.position:focus);
    optics.strength=reduced?0:Math.max(windowFade(p,.085,.11,.15,.205)*.55,heroReveal*.25,hovered?clamp(options.hoverProgress)*.55:0,flight*.16);
    optics.radius=hovered?.20:.25;
    active=p<.49?'helmet':p<.715?'robot':'car';return active;
  }
  return {root,update,setQuality(value){ultraEffects.setQuality(value);backdrop.setQuality(value);particles.setQuality?.(value);},getRift:p=>ultraEffects.rift(p),riftEnd:ultraEffects.end,getParticleCount:()=>particles.getCount(),loadPlaza:()=>plaza.load(),ready:null,REVEAL_AT,getReveal:()=>heroReveal,flashHero(){voxels.flash();},startIntro(instant=false){if(introStart===null)introStart=instant?lastT-9:lastT;},getOptics:()=>optics,getIndoor:()=>indoorMix,getWorld:()=>active,openHero(){return false;},getHeroCenter:()=>heroAnchor.position,setVisible(value){root.visible=!!value;particles.setVisible?.(!!value);},samplePose(progress){return sample(clampRail(progress)).slice();},dispose(){plaza.dispose();backdrop.dispose();ultraEffects.dispose();voxels.dispose();particles.dispose();for(const [g,parent] of originalParents)if(parent)parent.add(g);root.removeFromParent();resources.forEach(r=>r.dispose?.());resources.clear();}};
}
