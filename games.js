import * as THREE from './vendor/three.module.js';

/** Standalone, dependency-free Three.js mini-worlds. Parent owns all DOM controls. */
export async function mountMiniGame(canvas, type = 'neon', onUpdate = () => {}) {
  if (!['neon', 'circuit', 'island'].includes(type)) throw new Error(`Unknown game: ${type}`);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 450);
  let previousFrame = performance.now();
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const ownedGeometries = new Set(), ownedMaterials = new Set(), ownedTextures = new Set();
  const clickable = [];
  let hovered = null;
  const previousCursor = canvas.style.cursor;
  let disposed = false, raf = 0, elapsed = 0, emitClock = 0, visualTime = 0, flash = 0;
  let state = { status: 'ready', score: 0, health: 3, time: type === 'neon' ? 25 : 0, instruction: '' };
  let runTick = () => {}, resetGame = () => {}, select = () => {}, move = () => {};
  let seed = 9127;
  function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function material(color, emissive = 0x000000, intensity = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .4, metalness: .3, emissive, emissiveIntensity: intensity });
    ownedMaterials.add(m); return m;
  }
  function mesh(geometry, mat, parent = scene) {
    ownedGeometries.add(geometry); const m = new THREE.Mesh(geometry, mat); parent.add(m); return m;
  }
  function box(w,h,d,mat,x=0,y=0,z=0,parent=scene) { const m=mesh(new THREE.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m; }
  function sphere(r,mat,x=0,y=0,z=0,parent=scene) {const m=mesh(new THREE.SphereGeometry(r,18,12),mat,parent);m.position.set(x,y,z);return m;}
  function emit() { if (!disposed) onUpdate({ ...state }); }
  function win() { state.status='won';state.instruction=type==='neon'?'航线完成！再次出发，刷新纪录。':type==='circuit'?'所有能量节点已连通。星门开启！':'五枚晶体已收集。天空群岛恢复能量！';emit(); }
  function stars(color, count=240, spread=100) {
    const points=[];for(let i=0;i<count;i++) points.push((random()-.5)*spread,(random()-.3)*spread,(random()-.5)*spread);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));ownedGeometries.add(g);
    const m=new THREE.PointsMaterial({color,size:.16,sizeAttenuation:true,transparent:true,opacity:.7});ownedMaterials.add(m);const p=new THREE.Points(g,m);scene.add(p);return p;
  }
  function label(text, color='#ffffff') {
    const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle=color;ctx.font='700 72px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(text),64,64);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;ownedTextures.add(t);
    const mat=new THREE.SpriteMaterial({map:t,depthTest:false});ownedMaterials.add(mat);const s=new THREE.Sprite(mat);s.scale.set(1.2,1.2,1.2);return s;
  }
  const ambient=new THREE.HemisphereLight(type==='island'?0xc7edff:0x9cbeff,type==='island'?0x365749:0x16142c,2);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,12,8);scene.add(key);

  if(type==='neon') {
    scene.background=new THREE.Color('#05091a');scene.fog=new THREE.FogExp2('#05091a',.012);
    camera.position.set(0,5.8,11);camera.lookAt(0,1,-20);stars(0x7394ff,260,160);
    const asphalt=material(0x111a37), pink=material(0xff287e,0xff1465,3), cyan=material(0x27efff,0x08dfff,3), metal=material(0x646aff,0x4548ff,.8), white=material(0xffffff,0x8beeff,1.6);
    box(11,.4,270,asphalt,0,-.3,-110);
    [-5.4,-1.8,1.8,5.4].forEach(x=>box(.065,.035,270,cyan,x,0,-110));
    for(let i=0;i<36;i++) {
      const z=-i*7, height=3+random()*13;
      box(1.5,height,2,material(0x101732),-8-random()*8,height/2,z);
      box(.045,height,2.04,i%3===0?pink:cyan,-7.23-random()*.1,height/2,z);
      box(2,height*.8,2,material(0x151b38),8+random()*6,height*.4,z-3);
    }
    const craft=new THREE.Group();scene.add(craft);craft.position.set(0,.75,3);
    const hull=mesh(new THREE.ConeGeometry(.55,2,4),white,craft);hull.rotation.x=-Math.PI/2;
    box(1.6,.13,.65,metal,0,0,.25,craft);sphere(.23,cyan,0,.18,.1,craft);const engine=sphere(.26,pink,0,0,.9,craft);
    const strips=[];for(let i=0;i<24;i++){const m=box(10,.025,.045,metal,0,.01,-i*10);strips.push(m);}
    const obstacles=[],pickups=[];
    for(let i=0;i<18;i++) {
      const g=new THREE.Group();scene.add(g);box(2.1,1.6,.5,pink,0,.85,0,g);box(1.6,.85,.53,asphalt,0,.75,.01,g);box(2.1,.1,.57,white,0,1.65,0,g);obstacles.push({g,lane:0,z:0,hit:false});
      const p=mesh(new THREE.OctahedronGeometry(.32),cyan);pickups.push({g:p,lane:0,z:0,hit:false});
    }
    let lane=1, invulnerable=0;
    move=direction=>{if(state.status!=='playing')return;lane=THREE.MathUtils.clamp(lane+direction,0,2);};
    resetGame=()=>{lane=1;invulnerable=0;craft.position.x=0;craft.visible=true;seed=913;
      obstacles.forEach((o,i)=>{o.lane=Math.floor(random()*3);o.z=-22-i*19;o.hit=false;o.g.visible=true;o.g.position.set((o.lane-1)*3.6,0,o.z); const p=pickups[i];p.lane=(o.lane+1+(i%2))%3;p.z=o.z+7;p.hit=false;p.g.visible=true;p.g.position.set((p.lane-1)*3.6,.95,p.z);});
      state.instruction='左右切换航道，避开粉色障碍，收集蓝色能量。坚持 25 秒。';
    };
    runTick=(dt,t)=>{
      engine.scale.setScalar(.9+Math.sin(t*15)*.12);craft.rotation.z=THREE.MathUtils.lerp(craft.rotation.z,(craft.position.x-(lane-1)*3.6)*.11,Math.min(1,dt*8));
      if(state.status!=='playing')return;
      craft.position.x=THREE.MathUtils.lerp(craft.position.x,(lane-1)*3.6,Math.min(1,dt*13));invulnerable=Math.max(0,invulnerable-dt);craft.visible=invulnerable===0||Math.floor(t*18)%2===0;
      strips.forEach((m,i)=>m.position.z=-((i*10-elapsed*14)%240+240)%240+5);
      obstacles.forEach(o=>{o.g.position.z=o.z+elapsed*14;if(!o.hit&&o.g.position.z>2.1&&o.g.position.z<4.6&&Math.abs(craft.position.x-o.g.position.x)<1.35){o.hit=true;if(invulnerable===0){state.health--;invulnerable=.95;flash=.35;if(state.health<=0){state.status='lost';state.instruction='护盾耗尽。重新开始，再挑战一次！';emit();}}}});
      pickups.forEach(p=>{p.g.rotation.y=t*2;p.g.position.z=p.z+elapsed*14;if(!p.hit&&p.g.position.z>2&&p.g.position.z<4.5&&Math.abs(craft.position.x-p.g.position.x)<1.1){p.hit=true;p.g.visible=false;state.score+=100;}});
      state.time=Math.max(0,25-elapsed);if(state.time<=0&&state.status==='playing'){state.score+=state.health*150;craft.visible=true;win();}
    };
  } else if(type==='circuit') {
    scene.background=new THREE.Color('#0d0725');scene.fog=new THREE.FogExp2('#0d0725',.019);camera.position.set(0,7.4,17);camera.lookAt(0,0,0);
    const sky=stars(0xc0a6ff,350,80), purple=material(0x503090,0x351b72,.5), core=material(0xece3ff,0xb789ff,2), connected=material(0x55ffe0,0x22eec2,3), ringmat=material(0xb88aff,0x9554ff,2);
    const platform=mesh(new THREE.CylinderGeometry(7,7.6,.45,64),purple);platform.position.y=-1.4;
    const baseRing=mesh(new THREE.TorusGeometry(7,.035,8,100),ringmat);baseRing.rotation.x=Math.PI/2;baseRing.position.y=-1.1;
    const nodes=[],links=[];let next=1,mistakes=0;
    const positions=[[-4,.1,2.5],[-3.5,1,-2],[0,.4,-4.3],[3.8,1,-2],[4,.1,2.3],[0,1.2,3.4]];
    positions.forEach((p,i)=>{const root=new THREE.Group();root.position.set(...p);scene.add(root);const orb=sphere(.51,core,0,0,0,root);orb.userData.number=i+1;clickable.push(orb);const r=mesh(new THREE.TorusGeometry(.83,.045,8,44),ringmat,root);r.rotation.x=.8;const n=label(i+1);n.position.y=1.15;root.add(n);nodes.push({root,orb,r,baseY:p[1]});
      sphere(.14,connected,0,-1,0,root);
    });
    for(let i=0;i<5;i++){const g=new THREE.CylinderGeometry(.055,.055,1,10),m=mesh(g,connected);m.visible=false;links.push(m);}
    function connect(index){const a=nodes[index].root.position,b=nodes[index+1].root.position,d=new THREE.Vector3().subVectors(b,a);const l=links[index];l.position.copy(a).add(b).multiplyScalar(.5);l.scale.y=d.length();l.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());l.visible=true;}
    select=n=>{if(state.status!=='playing'||!Number.isInteger(n)||n<1||n>6)return;
      if(n!==next){mistakes++;next=1;state.score=0;nodes.forEach(o=>o.orb.material=core);links.forEach(l=>l.visible=false);flash=.35;state.instruction='顺序中断。重新从 1 开始连接。';emit();return;}
      nodes[n-1].orb.material=connected;if(n>1)connect(n-2);state.score+=100;next++;state.instruction=`能量接通！接下来选择 ${next}。`;if(next===7){state.score+=Math.max(0,200-mistakes*25);win();}else emit();
    };
    resetGame=()=>{next=1;mistakes=0;nodes.forEach(o=>o.orb.material=core);links.forEach(l=>l.visible=false);state.instruction='按 1 → 6 的顺序点亮节点，连接星门能量。';};
    runTick=(dt,t)=>{sky.rotation.y=t*.015;nodes.forEach((o,i)=>{o.root.position.y=o.baseY+Math.sin(t*1.3+i)*.12;o.r.rotation.y=t*.6+i;o.r.rotation.z=t*.25;o.orb.scale.setScalar(hovered===o.orb?1.2:state.status==='playing'&&i===next-1?1+Math.sin(t*5)*.09:1);});links.forEach((l,i)=>{if(l.visible)connect(i);});};
  } else {
    scene.background=new THREE.Color('#7ca8c3');scene.fog=new THREE.Fog('#7ca8c3',35,90);camera.position.set(11,11,16);camera.lookAt(0,0,0);
    const grass=material(0x62ab88),rock=material(0x395465),rock2=material(0x526b7b),gold=material(0xffdd7e,0xffb52b,1.8),trunk=material(0x6b5660),leaf=material(0x327f70),water=material(0x88d7e5,0x2c8aaf,.6),white=material(0xe4edf0);
    const islands=[],crystals=[],positions=[[-5,0,1],[-2,.7,-4],[3,.1,-3.5],[5,-.2,2],[0,.3,4.2]];
    function island(x,y,z,r){const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);const top=mesh(new THREE.CylinderGeometry(r,r*.91,.6,7),grass,g);top.position.y=-.4;const bottom=mesh(new THREE.ConeGeometry(r*.93,r*2,7),rock,g);bottom.rotation.z=Math.PI;bottom.position.y=-r-.4;const strata=mesh(new THREE.CylinderGeometry(r*.88,r*.75,.4,7),rock2,g);strata.position.y=-1;
      for(let k=0;k<3;k++){const a=k*2.1+.5;const tx=Math.cos(a)*r*.6,tz=Math.sin(a)*r*.6;const stem=mesh(new THREE.CylinderGeometry(.06,.09,.65,5),trunk,g);stem.position.set(tx,.15,tz);const crown=mesh(new THREE.ConeGeometry(.34,.9,5),leaf,g);crown.position.set(tx,.8,tz);}islands.push(g);return g;}
    island(0,-.4,0,1.9);
    positions.forEach((p,i)=>{island(...p,1.6);const root=new THREE.Group();root.position.set(p[0],p[1]+.9,p[2]);scene.add(root);const crystal=mesh(new THREE.OctahedronGeometry(.43),gold,root);crystal.scale.y=1.5;crystal.userData.number=i+1;clickable.push(crystal);const n=label(i+1,'#fff2c3');n.position.y=1.1;root.add(n);const ring=mesh(new THREE.TorusGeometry(.7,.035,8,44),gold,root);ring.rotation.x=Math.PI/2;ring.position.y=-.45;crystals.push({root,crystal,ring,collected:false,baseY:p[1]+.9});});
    const avatar=new THREE.Group();scene.add(avatar);const body=mesh(new THREE.CylinderGeometry(.42,.29,.2,20),white,avatar);sphere(.24,water,0,.25,0,avatar);const halo=mesh(new THREE.TorusGeometry(.46,.045,8,32),water,avatar);halo.rotation.x=Math.PI/2;halo.position.y=-.14;
    const clouds=[];for(let i=0;i<15;i++){const c=sphere(1.7+random(),material(0xd2e7ed), (random()-.5)*40,-5-random()*3,(random()-.5)*40);c.scale.set(2,.3,1);clouds.push(c);}
    let target=null, travel=0, from=new THREE.Vector3(), destination=new THREE.Vector3(), resting=new THREE.Vector3(0,.5,0);
    select=n=>{if(state.status!=='playing'||target!==null||!Number.isInteger(n)||n<1||n>5||crystals[n-1].collected)return;target=n-1;travel=0;from.copy(avatar.position);const p=positions[target];destination.set(p[0],p[1]+.85,p[2]);state.instruction=`正在前往晶体 ${n}…`;emit();};
    resetGame=()=>{target=null;travel=0;resting.set(0,.5,0);avatar.position.copy(resting);crystals.forEach(c=>{c.collected=false;c.root.visible=true;});state.instruction='点击金色晶体，让飞行器跨越浮岛。收集全部 5 枚。';};
    runTick=(dt,t)=>{crystals.forEach((c,i)=>{c.crystal.rotation.y=t+i;c.root.position.y=c.baseY+Math.sin(t*2+i)*.13;c.ring.rotation.z=t*.5;});clouds.forEach((c,i)=>c.position.x+=Math.sin(t*.08+i)*dt*.045);halo.rotation.z=t;
      if(target!==null&&state.status==='playing'){travel=Math.min(1,travel+dt*.65);const ease=travel*travel*(3-2*travel);avatar.position.lerpVectors(from,destination,ease);avatar.position.y+=Math.sin(travel*Math.PI)*2.2;avatar.rotation.y=Math.atan2(destination.x-from.x,destination.z-from.z);
        if(travel===1){crystals[target].collected=true;crystals[target].root.visible=false;state.score+=100;resting.copy(destination);target=null;state.instruction='已找到晶体！选择下一座浮岛。';if(crystals.every(c=>c.collected))win();else emit();}
      }else avatar.position.y=resting.y+Math.sin(t*2)*.08;
    };
  }
  function reset(){elapsed=0;emitClock=0;flash=0;state={status:'ready',score:0,health:3,time:type==='neon'?25:0,instruction:''};resetGame();emit();}
  function action(name,payload){if(disposed)return;if(name==='reset'){reset();return;}if(name==='start'&&state.status==='ready'){state.status='playing';previousFrame=performance.now();emit();return;}if(name==='left')move(-1);if(name==='right')move(1);if(name==='select')select(Number(payload));}
  function pointerPosition(event){const r=canvas.getBoundingClientRect();mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(clickable,false).filter(h=>h.object.visible&&h.object.parent.visible);}
  function onPointer(event){if(state.status!=='playing')return;const hit=pointerPosition(event)[0];if(hit)select(hit.object.userData.number);}
  function onHover(event){hovered=state.status==='playing'?pointerPosition(event)[0]?.object:null;canvas.style.cursor=hovered?'pointer':previousCursor;}
  function onLeave(){hovered=null;canvas.style.cursor=previousCursor;}
  function onKey(event){if(state.status!=='playing'||event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName||''))return;
    const k=event.key.toLowerCase();if(type==='neon'&&['arrowleft','a','arrowright','d'].includes(k)){event.preventDefault();move(['arrowleft','a'].includes(k)?-1:1);}else if(type!=='neon'&&/^[1-6]$/.test(k)){event.preventDefault();select(Number(k));}}
  function resize(){if(disposed)return;const r=canvas.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(48)/2)/Math.min(1,camera.aspect)));camera.updateProjectionMatrix();}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);canvas.addEventListener('pointerdown',onPointer);canvas.addEventListener('pointermove',onHover);canvas.addEventListener('pointerleave',onLeave);window.addEventListener('keydown',onKey);
  function tick(){if(disposed)return;raf=requestAnimationFrame(tick);const now=performance.now();const dt=Math.min(Math.max(0,(now-previousFrame)/1000),.05);previousFrame=now;if(document.hidden)return;visualTime+=dt;if(state.status==='playing'){elapsed+=dt;emitClock+=dt;if(type!=='neon')state.time=elapsed;}runTick(dt,visualTime);flash=Math.max(0,flash-dt);camera.rotation.z=Math.sin(visualTime*65)*flash*.025;renderer.render(scene,camera);if(emitClock>=.15){emitClock=0;emit();}}
  reset();resize();tick();
  return { action, dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();canvas.removeEventListener('pointerdown',onPointer);canvas.removeEventListener('pointermove',onHover);canvas.removeEventListener('pointerleave',onLeave);canvas.style.cursor=previousCursor;window.removeEventListener('keydown',onKey);ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());scene.clear();renderer.dispose();} };
}
