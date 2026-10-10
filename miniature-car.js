/* Chunky, original RC jeep. +Y up, -Z forward. Locally owned geometry/materials. */
export function createMiniatureCar({THREE:T,color=0xe54732}={}){
  if(!T)throw new Error('createMiniatureCar requires THREE');
  const root=new T.Group(),body=new T.Group();root.name='toy-rc-jeep';body.name='jeep-sprung-body';root.add(body);
  const materials={};
  for(const [key,c] of Object.entries({paint:color,cream:0xffe7b5,trim:0x303038,rubber:0x24232b,alloy:0xf4d6a4,glass:0xffe8b5,lamp:0xfff2cf,brake:0xed4034,amber:0xfaba55}))materials[key]=new T.MeshStandardMaterial({color:c,roughness:key==='glass'?.36:.8,flatShading:true});
  materials.lamp.emissive=new T.Color(0xffd890);materials.brake.emissive=new T.Color(0xff2810);
  const geometries=new Set(),batches=new Map();
  function add(g,key,parent=body){if(parent===body){if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);return;}geometries.add(g);const mesh=new T.Mesh(g,materials[key]);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function box(key,w,h,d,x,y,z,parent=body){const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);return add(g,key,parent);}
  function cylinder(key,r,h,x,y,z,axis='y',parent=body,n=12){const g=new T.CylinderGeometry(r,r,h,n);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);g.translate(x,y,z);return add(g,key,parent);}
  function rod(key,a,b,r=.05){const from=new T.Vector3(...a),to=new T.Vector3(...b),v=to.clone().sub(from),g=new T.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...from.add(to).multiplyScalar(.5).toArray());add(g,key);}
  function merge(gs){const p=[],n=[];for(const source of gs){const g=source.index?source.toNonIndexed():source; p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);if(g!==source)g.dispose();source.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));geometries.add(g);return g;}
  const wheelRadius=.55,wheelbase=2.56,track=2.06;
  box('trim',1.35,.22,3.3,0,.57,0);box('paint',1.64,.48,2.75,0,.96,.12);
  box('paint',1.72,.32,1.35,0,1.24,-1.0);box('paint',1.78,.15,1.43,0,1.435,-1.03);
  box('cream',.24,.012,1.25,-.27,1.518,-1.06);
  box('trim',1.8,.16,.27,0,.7,-1.91);box('trim',1.8,.16,.23,0,.7,1.77);
  box('paint',1.7,.55,.16,0,1.08,-1.72);box('trim',.87,.29,.032,0,1.13,-1.814);
  for(let i=-2;i<=2;i++)box('cream',.057,.22,.025,i*.15,1.13,-1.834);
  for(const side of [-1,1]){
    cylinder('trim',.23,.035,side*.64,1.18,-1.815,'z');cylinder('lamp',.175,.044,side*.64,1.18,-1.842,'z');
    box('amber',.17,.10,.036,side*.66,.87,-1.83);
    box('brake',.22,.16,.045,side*.66,1.03,1.535);
    box('trim',.27,.10,1.0,side*.97,.69,.1);
    box('paint',.19,.45,1.12,side*.78,1.29,.1);
    box('cream',.023,.1,.67,side*.89,1.36,.18);
    box('trim',.11,.09,.22,side*.87,1.67,-.29);
    box('paint',.24,.22,.13,side*.96,1.69,-.26);
    for(const z of [-wheelbase/2,wheelbase/2]){
      box('paint',.34,.13,.98,side*.96,1.18,z);
      cylinder('alloy',.065,.6,side*.70,.69,z);
      // Exposed spring rings and raised chassis give a legible toy suspension.
      for(let i=0;i<5;i++)cylinder('cream',.10,.035,side*.70,.5+i*.09,z);
    }
    rod('trim',[side*.72,1.35,-.39],[side*.69,2.13,-.27],.055);
    rod('trim',[side*.69,2.13,-.27],[side*.70,2.1,1.1],.06);
    rod('trim',[side*.70,2.1,1.1],[side*.76,1.22,1.38],.06);
    box('trim',.49,.39,.18,side*.4,1.46,.44);box('trim',.48,.14,.55,side*.4,1.22,.15);
  }
  rod('trim',[-.69,2.13,-.27],[.69,2.13,-.27],.06);rod('trim',[-.7,2.1,1.1],[.7,2.1,1.1],.06);
  box('glass',1.29,.49,.04,0,1.82,-.34);box('paint',1.52,.11,.17,0,2.12,-.31);
  box('paint',1.55,.075,1.34,0,2.17,.39);
  for(const x of [-.65,.65])rod('trim',[x,2.27,-.28],[x,2.27,1.08],.045);
  rod('trim',[-.65,2.27,-.28],[.65,2.27,-.28],.055);
  for(const x of [-.48,-.16,.16,.48]){box('trim',.25,.22,.17,x,2.32,-.34);box('lamp',.17,.13,.018,x,2.33,-.437);}
  box('paint',1.62,.48,.18,0,1.28,1.44);
  cylinder('rubber',.44,.25,0,1.36,1.69,'z');cylinder('alloy',.23,.27,0,1.36,1.70,'z');cylinder('trim',.07,.29,0,1.36,1.71,'z');
  rod('trim',[.63,1.45,1.20],[.71,2.95,1.31],.019);cylinder('amber',.054,.09,.71,2.98,1.31);
  for(const z of [-1.28,1.28])cylinder('trim',.11,1.93,0,.55,z,'x');
  for(const [key,gs] of batches){const m=new T.Mesh(merge(gs),materials[key]);m.name='jeep-'+key;m.castShadow=m.receiveShadow=true;body.add(m);}batches.clear();
  const wheels=[];
  for(const front of [true,false])for(const side of [-1,1]){
    const pivot=new T.Group(),roller=new T.Group();pivot.name=`wheel-${front?'front':'rear'}-${side<0?'left':'right'}-steer`;roller.name=pivot.name.replace('-steer','-roll');pivot.position.set(side*track/2,wheelRadius,front?-wheelbase/2:wheelbase/2);root.add(pivot);pivot.add(roller);
    cylinder('rubber',wheelRadius,.42,0,0,0,'x',roller,16);
    const tread=[];for(let j=0;j<14;j++){const a=j*Math.PI*2/14,g=new T.BoxGeometry(.44,.075,.17);g.rotateX(a);g.translate(0,Math.cos(a)*.545,Math.sin(a)*.545);tread.push(g);}const treadMesh=new T.Mesh(merge(tread),materials.rubber);treadMesh.castShadow=true;roller.add(treadMesh);
    cylinder('cream',.32,.438,0,0,0,'x',roller);cylinder('trim',.115,.46,0,0,0,'x',roller);
    for(let j=0;j<5;j++){const a=j*Math.PI*2/5;cylinder('trim',.037,.45,0,Math.cos(a)*.225,Math.sin(a)*.225,'x',roller,6);}
    pivot.userData={isWheel:true,front,side};roller.userData={isWheelRoller:true,front,side};wheels.push({pivot,roller,mesh:roller,front,side,radius:wheelRadius});
  }
  Object.defineProperty(root.userData,'body',{value:body,enumerable:false});root.userData.miniatureCar={forwardAxis:'-Z',wheelRadius,wheelbase,track,bodyName:body.name,wheelNames:wheels.map(w=>({pivot:w.pivot.name,roller:w.roller.name,front:w.front,side:w.side}))};Object.defineProperties(root.userData.miniatureCar,{wheels:{value:wheels,enumerable:false},body:{value:body,enumerable:false}});
  let disposed=false;
  function update({steering=0,wheelRotation,headlights=false,braking=false}={}){for(const w of wheels){if(w.front)w.pivot.rotation.y=steering;if(Number.isFinite(wheelRotation))w.roller.rotation.x=wheelRotation;}materials.lamp.emissiveIntensity=headlights?1.5:.12;materials.brake.emissiveIntensity=braking?1.8:.03;}
  function dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());root.removeFromParent();}
  update();return {root,body,wheels,wheelRadius,wheelbase,track,dimensions:{length:4.03,width:2.5,height:3.025,bodyWidth:1.8},materials,update,dispose};
}
