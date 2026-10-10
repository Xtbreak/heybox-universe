/** HEYBOX / PRECISION THEATRE. Procedural, self-contained cinematic scene. */
export function createDemo({THREE:T,scene,camera,renderer,reduced=false}) {
  const root=new T.Group(); scene.add(root);
  const geometries=new Set(), materials=new Set();
  const geo=g=>(geometries.add(g),g), mat=m=>(materials.add(m),m);
  const M={
    armor:mat(new T.MeshStandardMaterial({color:0x333e49,metalness:.8,roughness:.29})),
    edge:mat(new T.MeshStandardMaterial({color:0x99acbd,metalness:.82,roughness:.23})),
    black:mat(new T.MeshStandardMaterial({color:0x0b111a,metalness:.58,roughness:.37})),
    panel:mat(new T.MeshStandardMaterial({color:0x18222d,metalness:.72,roughness:.34})),
    light:mat(new T.MeshStandardMaterial({color:0x79dfff,emissive:0x29baff,emissiveIntensity:2.2,metalness:.25,roughness:.3})),
    pale:mat(new T.MeshStandardMaterial({color:0xd7e3eb,metalness:.52,roughness:.31})),
    amber:mat(new T.MeshStandardMaterial({color:0xffbf65,emissive:0xd76820,emissiveIntensity:.85,roughness:.38})),
    glass:mat(new T.MeshStandardMaterial({color:0x176487,metalness:.78,roughness:.16,transparent:true,opacity:.42,depthWrite:false})),
  };
  const box=geo(new T.BoxGeometry(1,1,1));
  const sphere=geo(new T.SphereGeometry(1,24,16));
  const cylinder=geo(new T.CylinderGeometry(1,1,1,48));
  const screwG=geo(new T.CylinderGeometry(.035,.035,.022,6));
  const roundedCache=new Map();
  function rounded(w,h,d,b=.065){
    const key=[w,h,d,b].join('/');if(roundedCache.has(key))return roundedCache.get(key);
    const s=new T.Shape();s.moveTo(-w/2+b,-h/2);s.lineTo(w/2-b,-h/2);s.lineTo(w/2,-h/2+b);s.lineTo(w/2,h/2-b);s.lineTo(w/2-b,h/2);s.lineTo(-w/2+b,h/2);s.lineTo(-w/2,h/2-b);s.lineTo(-w/2,-h/2+b);s.closePath();
    const g=geo(new T.ExtrudeGeometry(s,{depth:d-2*b,steps:1,bevelEnabled:true,bevelThickness:b,bevelSize:b*.48,bevelSegments:2,curveSegments:1}));g.translate(0,0,-d/2+b);roundedCache.set(key,g);return g;
  }
  function mesh(g,m,p,parent=root){const o=new T.Mesh(g,m);if(p)o.position.set(...p);parent.add(o);return o;}
  function block(w,h,d,m,p,parent=root,bevel=false){const o=mesh(bevel?rounded(w,h,d,Math.min(.06,d*.24)):box,m,p,parent);if(!bevel)o.scale.set(w,h,d);return o;}
  function torus(r,t,m,p,parent=root){return mesh(geo(new T.TorusGeometry(r,t,8,80)),m,p,parent);}
  function light(c,i,p){const l=new T.PointLight(c,i,35,2);l.position.set(...p);root.add(l);return l;}
  root.add(new T.HemisphereLight(0xb9d9ef,0x07111f,1.7));
  const key=new T.DirectionalLight(0xd0e2f5,4.5);key.position.set(3,7,6);root.add(key);
  const rim=new T.DirectionalLight(0x408be3,3.3);rim.position.set(-5,2,-5);root.add(rim);
  const fill=new T.DirectionalLight(0xffffff,1.1);fill.position.set(-3,-2,5);root.add(fill);
  light(0x4ecbff,13,[3,1,3]);light(0x4263ff,10,[1,-3,-3]);
  const rig=new T.Group();rig.position.set(1.65,.12,0);root.add(rig);
  const machine=new T.Group();rig.add(machine);
  // A precision chassis remains visible beneath independently articulated armor.
  const chassis=new T.Group();machine.add(chassis);
  for(const y of [-1.37,1.37])for(const z of [-1.24,1.24]){
    block(3.65,.13,.13,M.edge,[0,y,z],chassis,true);
    block(3.34,.023,.024,M.light,[0,y+Math.sign(y)*.072,z],chassis);
  }
  for(const x of [-1.77,1.77])for(const z of [-1.24,1.24])block(.13,2.7,.13,M.edge,[x,0,z],chassis,true);
  for(const x of [-1.77,1.77])for(const y of [-1.37,1.37])block(.13,.13,2.5,M.edge,[x,y,0],chassis,true);
  block(3.44,.17,2.4,M.black,[0,-1.28,0],chassis,true);
  block(3.3,2.5,.12,M.black,[0,0,-1.25],chassis,true);
  const panels=[];
  function panel(w,h,d,pos,axis,sign){
    const g=new T.Group();g.position.set(...pos);machine.add(g);
    block(w,h,d,M.armor,[0,0,0],g,true);
    block(w*.92,h*.9,.035,M.panel,[0,0,d/2+.01],g,true);
    const points=[];
    for(const x of [-w*.42,w*.42])for(const y of [-h*.41,h*.41])points.push([x,y,d/2+.044]);
    const inst=new T.InstancedMesh(screwG,M.edge,points.length),o=new T.Object3D();
    points.forEach((p,i)=>{o.position.set(...p);o.rotation.x=Math.PI/2;o.updateMatrix();inst.setMatrixAt(i,o.matrix);});g.add(inst);
    panels.push({g,base:new T.Vector3(...pos),axis,sign});return g;
  }
  // Twin front slabs have milled recesses, structural strakes and low-output indicators.
  for(const s of [-1,1]){
    const p=panel(1.72,2.67,.24,[s*.9,0,1.39],'front',s);
    for(let j=0;j<7;j++)block(1.23,.045,.044,M.black,[0,-.82+j*.11,.151],p);
    for(let j=0;j<4;j++)block(.024,.53,.018,M.edge,[s*(.25+j*.1),.58,.16],p);
    block(.026,1.73,.024,M.light,[-s*.73,.14,.157],p);
    block(.55,.12,.042,M.edge,[s*.22,.03,.165],p,true);
    block(.11,.047,.048,M.amber,[s*.65,-1.04,.16],p);
    for(let j=0;j<3;j++)block(.065,.025,.025,M.light,[-s*.31+j*.105,-1.03,.169],p);
    const side=panel(2.42,2.65,.19,[s*1.89,0,0],'side',s);side.rotation.y=s*Math.PI/2;
    for(let j=0;j<11;j++)block(.045,1.65,.052,M.black,[-.76+j*.15,0,.131],side);
    block(1.63,.023,.04,M.light,[0,.99,.14],side);
  }
  for(const s of [-1,1]){
    const p=panel(3.71,2.53,.18,[0,s*1.48,0],'lid',s);p.rotation.x=-s*Math.PI/2;
    for(let j=0;j<9;j++)block(2.93,.033,.04,M.black,[0,-.72+j*.18,.118],p);
    block(2.7,.025,.028,M.edge,[0,1.05,.13],p);
  }
  // Interior transverse rails extend with the doors, exposing the engine train.
  const rails=[];
  for(const s of [-1,1])for(const y of [-.96,.96]){
    const r=block(1.5,.065,.09,M.edge,[s*1.25,y,1.22],machine,true);rails.push({r,s});
    block(.32,.22,.12,M.black,[s*1.48,y,1.15],machine,true);
  }
  const engine=new T.Group();engine.position.z=-.3;machine.add(engine);
  const engineRings=[];
  for(let i=0;i<5;i++){
    const g=new T.Group();g.position.z=-.8+i*.38;engine.add(g);engineRings.push(g);
    torus(.95,.057,M.edge,[0,0,0],g);torus(.865,.024,i%2?M.light:M.armor,[0,0,.04],g);
    for(let j=0;j<12;j++){
      const a=j*Math.PI/6,blade=block(.10,.28,.13,M.armor,[Math.cos(a)*.89,Math.sin(a)*.89,0],g,true);blade.rotation.z=a+.5;
      if(j%3===0){const b=block(.05,.14,.022,M.light,[Math.cos(a)*1.02,Math.sin(a)*1.02,.075],g);b.rotation.z=a;}
    }
  }
  const orb=mesh(sphere,M.glass,[0,0,-.37],engine);orb.scale.setScalar(.65);
  const nucleus=mesh(geo(new T.IcosahedronGeometry(.34,1)),M.light,[0,0,-.35],engine);
  for(let j=0;j<3;j++){const r=torus(.57,.014,M.light,[0,0,-.35],engine);r.rotation.set(j*.83,j*.55,.6);}
  // Technical mounting plinth, graduated radial scale and suspended calibration arcs.
  const plinth=new T.Group();plinth.position.y=-2.05;rig.add(plinth);
  const base=mesh(cylinder,M.black,[0,0,0],plinth);base.scale.set(2.7,.13,2.7);
  const disk=mesh(cylinder,M.armor,[0,.075,0],plinth);disk.scale.set(2.49,.045,2.49);
  for(const r of [2.25,2.48,2.71]){const a=torus(r,.012,r===2.48?M.light:M.edge,[0,.108,0],plinth);a.rotation.x=Math.PI/2;}
  const tickGeo=geo(new T.BoxGeometry(.022,.013,.105)),ticks=new T.InstancedMesh(tickGeo,M.edge,100),dummy=new T.Object3D();
  for(let i=0;i<100;i++){let a=i/100*Math.PI*2;dummy.position.set(Math.sin(a)*2.58,.12,Math.cos(a)*2.58);dummy.rotation.y=a;dummy.scale.set(1,1,i%5===0?1.65:1);dummy.updateMatrix();ticks.setMatrixAt(i,dummy.matrix);}plinth.add(ticks);
  const exhibit=new T.Group();rig.add(exhibit);const worlds=[];
  function world(x,tint){
    const g=new T.Group();g.position.set(x,-.12,2.1);exhibit.add(g);
    const m=mat(new T.MeshStandardMaterial({color:tint,metalness:.4,roughness:.31,emissive:tint,emissiveIntensity:.12}));
    const b=mesh(cylinder,M.black,[0,-.6,0],g);b.scale.set(.64,.11,.64);
    const lip=torus(.61,.023,M.light,[0,-.535,0],g);lip.rotation.x=Math.PI/2;
    const collar=torus(.65,.045,M.edge,[0,-.60,0],g);collar.rotation.x=Math.PI/2;
    worlds.push({g,m});return {g,m};
  }
  // Exhibit I: a miniature illuminated vertical city.
  {
    const {g,m}=world(-1.68,0xa5d6f0);
    for(let i=0;i<26;i++){
      const a=i*2.39996,r=.43*Math.sqrt((i+.5)/26),h=.22+((i*17)%11)/13;
      const x=Math.cos(a)*r,z=Math.sin(a)*r;block(.075,h,.09,i%4?m:M.edge,[x,-.48+h/2,z],g);
      for(let j=0;j<3;j++)block(.009,.02,.094,M.light,[x+.017,-.41+h*j/3,z],g);
    }
    const arc=torus(.57,.009,M.light,[0,.02,0],g);arc.rotation.y=.8;arc.rotation.x=.3;
  }
  // Exhibit II: an impossible suspended mineral and its orbital instruments.
  {
    const {g,m}=world(0,0x7086dc);
    const crystal=mesh(geo(new T.OctahedronGeometry(.47,0)),m,[0,.05,0],g);crystal.scale.set(.7,1.6,.7);
    const wire=new T.LineSegments(geo(new T.EdgesGeometry(crystal.geometry)),mat(new T.LineBasicMaterial({color:0xcceeff,transparent:true,opacity:.65})));crystal.add(wire);
    for(let i=0;i<3;i++){const r=torus(.48+i*.06,.012,i===1?M.light:M.edge,[0,0,0],g);r.rotation.set(.6+i*.8,i*.65,0);}
  }
  // Exhibit III: an engineered miniature garden, terraced island and silver tree.
  {
    const {g,m}=world(1.68,0x6bbcac);
    for(let i=0;i<4;i++){const d=mesh(cylinder,m,[0,-.46+i*.09,0],g);d.scale.set(.48-i*.08,.09,.48-i*.08);}
    block(.045,.56,.045,M.edge,[0,-.02,0],g);
    for(let i=0;i<9;i++){
      const a=i*2.39996,r=.17+((i*7)%5)*.036,y=.14+((i*3)%7)*.054;
      const leaf=mesh(geo(new T.IcosahedronGeometry(.11,0)),m,[Math.cos(a)*r,y,Math.sin(a)*r],g);leaf.scale.set(1.3,.7,1);
      const stem=block(.016,.26,.016,M.edge,[Math.cos(a)*r*.5,y-.10,Math.sin(a)*r*.5],g);stem.rotation.set(Math.sin(a)*.6,0,-Math.cos(a)*.6);
    }
  }
  // Dust stays sparse and local, never becoming a cosmic background.
  const n=200,positions=new Float32Array(n*3);
  for(let i=0;i<n;i++){const a=i*2.399963;positions[i*3]=Math.sin(a)*(1+(i%37)/15);positions[i*3+1]=((i*29)%101)/101*6-3;positions[i*3+2]=Math.cos(a)*((i%23)/8);}
  const dustG=geo(new T.BufferGeometry());dustG.setAttribute('position',new T.BufferAttribute(positions,3));
  const dustM=mat(new T.PointsMaterial({color:0xaad8ed,size:.018,transparent:true,opacity:.4,depthWrite:false}));const dust=new T.Points(dustG,dustM);rig.add(dust);
  const scanner=new T.Group();machine.add(scanner);
  block(3.46,.012,.013,M.light,[0,0,1.59],scanner);
  for(const x of [-1.73,1.73])block(.015,.012,2.8,M.light,[x,0,.2],scanner);
  const scanM=mat(new T.MeshBasicMaterial({color:0x37bdff,transparent:true,opacity:.045,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));
  const sheet=mesh(geo(new T.PlaneGeometry(3.46,2.8)),scanM,[0,0,.2],scanner);sheet.rotation.x=Math.PI/2;
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const path=[V(7.8,4.8,11.5),V(6,3.15,10),V(3.1,1.0,6.4),V(1.8,.36,1.07),V(5,3.1,10.8),V(7.8,4.8,11.5)];
  const aims=[V(.0,-.05,0),V(.25,0,.1),V(.75,0,.2),V(1.5,.05,-.4),V(.4,.0,1.1),V(.0,-.05,0)];
  const stops=[0,.29,.48,.61,.78,1];
  const smooth=(a,b,x)=>{const v=T.MathUtils.clamp((x-a)/(b-a),0,1);return v*v*(3-2*v);};
  const cpos=new T.Vector3(),aim=new T.Vector3();let aspect=1;
  function update({time=0,dt=0,progress=0,pointer={x:0,y:0}}={}){
    const p=T.MathUtils.clamp(progress,0,1),t=reduced?0:time;
    const opened=smooth(.14,.47,p)*(1-smooth(.87,1,p));
    const chamber=smooth(.43,.61,p)*(1-smooth(.64,.76,p));
    const show=smooth(.63,.77,p)*(1-smooth(.89,.99,p));
    const float=reduced?0:Math.sin(t*.42)*.035;
    machine.position.y=float;machine.rotation.set(.025*Math.sin(t*.18),-.08+Math.sin(t*.15)*.018,0);
    for(const a of panels){
      a.g.position.copy(a.base);
      if(a.axis==='front'){a.g.position.x+=a.sign*opened*2.15;a.g.position.z+=opened*.65;a.g.rotation.y=-a.sign*opened*.22;}
      if(a.axis==='side'){a.g.position.x+=a.sign*opened*1.15;a.g.rotation.z=-a.sign*opened*.12;}
      if(a.axis==='lid'){a.g.position.y+=a.sign*opened*1.23;a.g.position.z-=opened*.3;a.g.rotation.x=-a.sign*(Math.PI/2+opened*.12);}
    }
    for(const {r,s} of rails){r.position.x=s*(1.25+opened*.75);r.scale.x=1+opened*1.4;}
    engineRings.forEach((g,i)=>{g.rotation.z=(i%2?-1:1)*t*.10+i*.18;g.position.z=-.8+i*(.38+opened*.11);});
    nucleus.rotation.set(t*.16,t*.21,0);nucleus.scale.setScalar(1+Math.sin(t*.8)*.03);
    engine.scale.setScalar(1-show*.23);engine.position.y=show*.18;
    exhibit.visible=show>.002;exhibit.scale.setScalar(Math.max(.001,show));
    worlds.forEach(({g},i)=>{g.position.y=-.10+show*.1+Math.sin(t*.65+i)*.025;g.position.z=1.25+show*1.45;g.rotation.y=t*.055*(i===1?-1:1);});
    scanner.visible=p<.52||p>.9;scanner.position.y=reduced?.5:Math.sin(t*.56)*1.17;
    plinth.rotation.y=t*.012;plinth.position.y=-2.05-opened*.25;
    dust.rotation.y=t*.017;dustM.opacity=.28+.1*opened;
    let k=0;while(k<stops.length-2&&p>stops[k+1])k++;
    const blend=smooth(stops[k],stops[k+1],p);cpos.lerpVectors(path[k],path[k+1],blend);aim.lerpVectors(aims[k],aims[k+1],blend);
    if(aspect<1){cpos.sub(aim).multiplyScalar(1.34).add(aim);aim.x+=.65;}
    cpos.x+=(reduced?0:pointer.x*.20);cpos.y+=(reduced?0:pointer.y*.12);
    camera.position.copy(cpos);camera.lookAt(aim);camera.fov=39+chamber*11;camera.near=.06;camera.far=70;camera.updateProjectionMatrix();
  }
  function resize(w,h){aspect=w/Math.max(1,h);}
  function dispose(){scene.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
  update({time:0,progress:0,pointer:{x:0,y:0}});
  return {update,resize,dispose};
}
