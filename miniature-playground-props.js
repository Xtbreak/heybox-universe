import {clamp,footprintContact,buildSolidIndex} from './miniature-driving-physics.js?v=journey-31';

// Small deterministic impulse solver for the orange toy world. Bodies have 3D velocity,
// angular momentum, rotated collision extents, pair contacts and ground sleep.
export function createPlaygroundProps({THREE:T,root,world,sample}) {
  const specs=(world.playground?.props||[]).slice(0,64),geometries=[],materials=[];
  const mat=(color)=>{const m=new T.MeshStandardMaterial({color,roughness:.88});materials.push(m);return m;};
  const vertexMaterial=mat(0xffffff);vertexMaterial.vertexColors=true;
  const wood=mat(0xf7cd83),woodEdge=mat(0xc58b4b),orange=mat(0xee6535),cream=mat(0xffefd0),brick=mat(0x71ada6),red=mat(0xdf4d39),blue=mat(0x416779);
  const geo=g=>(geometries.push(g),g),group=new T.Group();group.name='playground · movable objects';root.add(group);
  const extentMatrix=new T.Matrix4();
  const solids=buildSolidIndex(world.colliders||world.solids||[]),axis=new T.Vector3(),rotation=new T.Quaternion();
  const bodies=specs.map((s,i)=>{
    const defaults=s.type==='letter'?{x:3,y:4,z:1.1}:s.type==='pin'?{x:.75,y:2.3,z:.75}:s.type==='ball'?{x:2.4,y:2.4,z:2.4}:s.type==='cone'?{x:.72,y:1.15,z:.72}:s.type==='brick'?{x:1.22,y:.64,z:.64}:{x:1.24,y:1.24,z:1.24};
    const size=typeof s.size==='number'?{x:s.size,y:s.size,z:s.size}:{...defaults,...s.size};
    const mesh=new T.Group();mesh.name='playground-prop-'+(s.id??i);group.add(mesh);
    if(s.type==='letter'){
      // Individually movable chunky letter bodies, built as solid cream blocks.
      const glyphs={H:['101','101','111','101','101'],E:['111','100','110','100','111'],Y:['101','101','010','010','010'],B:['110','101','110','101','110'],O:['111','101','101','101','111'],X:['101','101','010','101','101']};
      const rows=glyphs[String(s.letter||s.label||'H').toUpperCase()]||glyphs.H;
      rows.forEach((row,iy)=>[...row].forEach((cell,ix)=>{if(cell==='1'){const block=new T.Mesh(geo(new T.BoxGeometry(size.x/3,size.y/5,size.z)),cream);block.position.set((ix-1)*size.x/3,(2-iy)*size.y/5,0);mesh.add(block);}}));
    }else if(s.type==='ball'){
      mesh.add(new T.Mesh(geo(new T.IcosahedronGeometry(size.x/2,2)),blue));
      for(const a of [-.19,.19]){const hole=new T.Mesh(geo(new T.SphereGeometry(size.x*.055,8,6)),woodEdge);hole.position.set(a,size.y*.43,-size.z*.22);mesh.add(hole);}
    }else if(s.type==='pin'){
      const points=[[0,0],[.29,0],[.40,.1],[.46,.22],[.47,.35],[.40,.48],[.26,.6],[.18,.7],[.18,.76],[.26,.82],[.29,.89],[.24,.96],[.10,1],[0,1]].map(([r,h])=>new T.Vector2(r*size.x,(h-.5)*size.y));
      mesh.add(new T.Mesh(geo(new T.LatheGeometry(points,12)),cream));
      for(const h of [.70,.75]){const stripe=new T.Mesh(geo(new T.CylinderGeometry(size.x*.19,size.x*.19,size.y*.032,12)),red);stripe.position.y=(h-.5)*size.y;mesh.add(stripe);}
    }else if(s.type==='cone'){
      const base=new T.Mesh(geo(new T.BoxGeometry(size.x,.12,size.z)),woodEdge);base.position.y=-size.y/2+.06;mesh.add(base);
      const cone=new T.Mesh(geo(new T.ConeGeometry(size.x*.43,size.y-.12,8)),orange);cone.position.y=.06;mesh.add(cone);
      const band=new T.Mesh(geo(new T.CylinderGeometry(size.x*.14,size.x*.23,.18,8)),cream);band.position.y=.15;mesh.add(band);
    }else{
      mesh.add(new T.Mesh(geo(new T.BoxGeometry(size.x,size.y,size.z)),s.type==='brick'?brick:wood));
      if(s.type!=='brick')for(const side of [-1,1]){
        const rail=new T.Mesh(geo(new T.BoxGeometry(size.x*.13,size.y*1.015,size.z*1.015)),woodEdge);rail.position.x=side*size.x*.35;mesh.add(rail);
      }
    }
    // One draw per movable body, including the crate bands and cone stripe.
    const positions=[],normals=[],colors=[];
    for(const part of [...mesh.children]){
      part.updateMatrix();const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrix);
      const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=part.material.color;
      for(let j=0;j<p.count;j++){positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j),n.getY(j),n.getZ(j));colors.push(c.r,c.g,c.b);}g.dispose();mesh.remove(part);
    }
    const merged=geo(new T.BufferGeometry());merged.setAttribute('position',new T.Float32BufferAttribute(positions,3));merged.setAttribute('normal',new T.Float32BufferAttribute(normals,3));merged.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const solidMesh=new T.Mesh(merged,vertexMaterial);solidMesh.castShadow=true;solidMesh.receiveShadow=true;mesh.add(solidMesh);
    const b={id:String(s.id??i),type:s.type||'crate',size,mass:clamp(s.mass??(s.type==='letter'?22:s.type==='pin'?2:s.type==='ball'?18:s.type==='cone'?1.5:s.type==='brick'?5:10),.5,50),mesh,
      position:new T.Vector3(),velocity:new T.Vector3(),quaternion:new T.Quaternion(),omega:new T.Vector3(),extent:new T.Vector3(),sleep:0,sleeping:false};
    b.initial={x:s.x,y:(Number.isFinite(s.y)?s.y:sample(s.x,s.z).height)+size.y/2,z:s.z,yaw:s.yaw||0};return b;
  });
  function extents(b){
    if(b.type==='ball'){b.extent.set(b.size.x/2,b.size.y/2,b.size.z/2);return;}
    const e=extentMatrix.makeRotationFromQuaternion(b.quaternion).elements,h=b.size;
    b.extent.set((Math.abs(e[0])*h.x+Math.abs(e[4])*h.y+Math.abs(e[8])*h.z)/2,(Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z)/2,(Math.abs(e[2])*h.x+Math.abs(e[6])*h.y+Math.abs(e[10])*h.z)/2);
  }
  function sync(b){b.mesh.position.copy(b.position);b.mesh.quaternion.copy(b.quaternion);}
  function reset(){for(const b of bodies){b.position.set(b.initial.x,b.initial.y,b.initial.z);b.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),b.initial.yaw);b.velocity.set(0,0,0);b.omega.set(0,0,0);b.sleep=0;b.sleeping=false;extents(b);sync(b);}}
  function wake(b){b.sleeping=false;b.sleep=0;}
  function pair(a,b){
    const dx=b.position.x-a.position.x,dy=b.position.y-a.position.y,dz=b.position.z-a.position.z;
    const ox=a.extent.x+b.extent.x-Math.abs(dx),oy=a.extent.y+b.extent.y-Math.abs(dy),oz=a.extent.z+b.extent.z-Math.abs(dz);
    if(ox<=0||oy<=0||oz<=0)return;
    const dim=oy<=ox&&oy<=oz?'y':ox<oz?'x':'z',delta=dim==='x'?dx:dim==='y'?dy:dz,sign=delta>=0?1:-1,overlap=dim==='x'?ox:dim==='y'?oy:oz;
    const ia=1/a.mass,ib=1/b.mass,total=ia+ib;
    a.position[dim]-=sign*Math.max(0,overlap-.0005)*ia/total;b.position[dim]+=sign*Math.max(0,overlap-.0005)*ib/total;
    const relative=(b.velocity[dim]-a.velocity[dim])*sign;
    if(relative<0){
      const j=-(1+(Math.abs(relative)>1?.13:0))*relative/total;
      a.velocity[dim]-=sign*j*ia;b.velocity[dim]+=sign*j*ib;
      if(Math.abs(relative)>.45){wake(a);wake(b);if(dim!=='y'){const spinAxis=dim==='x'?'z':'x',spinSign=dim==='x'?-sign:sign;a.omega[spinAxis]-=spinSign*j*ia*(a.type==='pin'?.55:.12);b.omega[spinAxis]+=spinSign*j*ib*(b.type==='pin'?.55:.12);}}
      // Contact friction removes relative sliding, including between stacked bricks.
      for(const tangent of ['x','y','z'])if(tangent!==dim){const jt=clamp((b.velocity[tangent]-a.velocity[tangent])/total,-j*.35,j*.35);a.velocity[tangent]+=jt*ia;b.velocity[tangent]-=jt*ib;}
    }
  }
  function groundContact(b,dt){
    const floor=sample(b.position.x,b.position.z).height,penetration=floor+b.extent.y-b.position.y;
    if(penetration>=-.003){
      b.position.y=Math.max(b.position.y,floor+b.extent.y);
      if(b.velocity.y<0)b.velocity.y=Math.abs(b.velocity.y)>1.2?-b.velocity.y*.18:0;
      const friction=b.type==='ball'?.85:5.5; b.velocity.x*=Math.exp(-friction*dt);b.velocity.z*=Math.exp(-friction*dt);b.omega.multiplyScalar(Math.exp(-(b.type==='ball'?1.0:5)*dt));
      if(b.type==='ball'&&b.velocity.lengthSq()>.015){b.omega.x=b.velocity.z/(b.size.y/2);b.omega.z=-b.velocity.x/(b.size.y/2);}
    }
  }
  function step(dt,car){
    if(!dt)return 0;let strongest=0;
    for(const b of bodies){
      // Sleeping stacks must wake as soon as their support is knocked away.
      if(b.sleeping){
        const bottom=b.position.y-b.extent.y,floor=sample(b.position.x,b.position.z).height;
        const supported=bottom-floor<.025||bodies.some(a=>a!==b&&Math.abs(bottom-a.position.y-a.extent.y)<.03&&Math.abs(a.position.x-b.position.x)<a.extent.x+b.extent.x-.02&&Math.abs(a.position.z-b.position.z)<a.extent.z+b.extent.z-.02);
        if(!supported)wake(b);
      }
      if(!b.sleeping){b.omega.multiplyScalar(Math.exp(-.35*dt)).clampLength(0,18);b.velocity.y-=18*dt;b.velocity.multiplyScalar(Math.exp(-.12*dt));b.position.addScaledVector(b.velocity,dt);
        const spin=b.omega.length();if(spin>.00001){axis.copy(b.omega).divideScalar(spin);rotation.setFromAxisAngle(axis,spin*dt);b.quaternion.premultiply(rotation).normalize();}extents(b);groundContact(b,dt);
      }
      if(car&&b.position.y+b.extent.y>car.y+.12&&b.position.y-b.extent.y<car.y+2.18){
        const hit=footprintContact(car,{x:b.position.x,z:b.position.z,...(b.type==='ball'?{radius:b.size.x/2}:{hx:b.extent.x,hz:b.extent.z})});
        if(hit){
          const nx=-hit.x,nz=-hit.z,relative=(car.vx-b.velocity.x)*nx+(car.vz-b.velocity.z)*nz;
          if(relative>.03||hit.depth>.025){
            wake(b);b.position.x+=nx*(hit.depth+.004)*.97;b.position.z+=nz*(hit.depth+.004)*.97;
            car.x-=nx*hit.depth*.03;car.z-=nz*hit.depth*.03;
            if(relative>0){const impulse=(1.12*relative)/(1/b.mass+1/650);b.velocity.x+=nx*impulse/b.mass;b.velocity.z+=nz*impulse/b.mass;
              car.vx-=nx*impulse/650;car.vz-=nz*impulse/650;
              const kick=Math.min(3.5,relative*.16);b.velocity.y+=kick;b.omega.x+=nz*relative*.65;b.omega.z-=nx*relative*.65;
              b.omega.y+=(car.vx*nz-car.vz*nx)*.07;strongest=Math.max(strongest,relative);
            }
          }
        }
      }
      for(const s of solids(b.position.x,b.position.z,3)){
        const sy=s.y??sample(s.x,s.z).height;if(b.position.y+b.extent.y<sy||b.position.y-b.extent.y>sy+(s.height??20))continue;
        // Each object uses its rotated horizontal envelope against static world geometry.
        const radius=s.radius??s.r;
        let dx=b.position.x-s.x,dz=b.position.z-s.z,nx=0,nz=0,depth=0;
        if(Number.isFinite(radius)){const len=Math.hypot(dx,dz),reach=radius+Math.max(b.extent.x,b.extent.z);if(len<reach){depth=reach-len;nx=len?dx/len:1;nz=len?dz/len:0;}}
        else {const a=s.heading??s.rotation??0,c=Math.cos(a),sn=Math.sin(a),lx=dx*c-dz*sn,lz=dx*sn+dz*c;
          const ex=(s.hx??(s.width||2)/2)+Math.abs(c)*b.extent.x+Math.abs(sn)*b.extent.z,ez=(s.hz??(s.depth||2)/2)+Math.abs(sn)*b.extent.x+Math.abs(c)*b.extent.z;
          if(Math.abs(lx)<ex&&Math.abs(lz)<ez){if(ex-Math.abs(lx)<ez-Math.abs(lz)){depth=ex-Math.abs(lx);nx=Math.sign(lx||1)*c;nz=-Math.sign(lx||1)*sn;}else{depth=ez-Math.abs(lz);nx=Math.sign(lz||1)*sn;nz=Math.sign(lz||1)*c;}}
        }
        if(depth>0){b.position.x+=nx*depth;b.position.z+=nz*depth;const v=b.velocity.x*nx+b.velocity.z*nz;if(v<0){b.velocity.x-=nx*v*1.15;b.velocity.z-=nz*v*1.15;}}
      }
      const limit=typeof world.bounds==='number'?world.bounds-3:162;
      for(const a of ['x','z'])if(Math.abs(b.position[a])>limit){b.position[a]=clamp(b.position[a],-limit,limit);b.velocity[a]*=-.2;}
    }
    for(let pass=0;pass<5;pass++){
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)pair(bodies[i],bodies[j]);
      for(const b of bodies)groundContact(b,dt/5);
    }
    // Pair correction can push a pile back into the chassis. Project its final
    // contact before rendering so the car stays solid even in dense brick piles.
    if(car)for(let pass=0;pass<2;pass++)for(const b of bodies){
      if(b.position.y+b.extent.y<=car.y+.12||b.position.y-b.extent.y>=car.y+2.18)continue;
      const hit=footprintContact(car,{x:b.position.x,z:b.position.z,...(b.type==='ball'?{radius:b.size.x/2}:{hx:b.extent.x,hz:b.extent.z})});
      if(hit){b.position.x-=hit.x*(hit.depth+.001);b.position.z-=hit.z*(hit.depth+.001);wake(b);}
    }
    for(const b of bodies){
      b.velocity.clampLength(0,55);b.omega.clampLength(0,18);
      if(b.velocity.lengthSq()<.015&&b.omega.lengthSq()<.015){b.sleep+=dt;if(b.sleep>.85){b.sleeping=true;b.velocity.set(0,0,0);b.omega.set(0,0,0);}}else b.sleep=0;
      sync(b);
    }
    return strongest;
  }
  function snapshot(){return bodies.map(b=>({id:b.id,position:b.position.toArray(),velocity:b.velocity.toArray(),quaternion:b.quaternion.toArray(),omega:b.omega.toArray(),sleeping:b.sleeping}));}
  function restore(saved){
    reset();if(!Array.isArray(saved))return false;
    for(const b of bodies){const s=saved.find(s=>s?.id===b.id);if(!s)continue;
      if(![s.position,s.velocity,s.quaternion,s.omega].every((a,i)=>Array.isArray(a)&&a.length===(i===2?4:3)&&a.every(Number.isFinite)))continue;
      if(Math.abs(s.position[0])>(typeof world.bounds==='number'?world.bounds:90)||Math.abs(s.position[2])>(typeof world.bounds==='number'?world.bounds:90)||s.position[1]<-10||s.position[1]>80)continue;
      b.position.fromArray(s.position);b.velocity.fromArray(s.velocity).clampLength(0,60);b.quaternion.fromArray(s.quaternion).normalize();b.omega.fromArray(s.omega).clampLength(0,30);b.sleeping=s.sleeping===true;extents(b);sync(b);
    }return true;
  }
  function state(){return {count:bodies.length,moving:bodies.filter(b=>!b.sleeping).length,bodies:snapshot().map((s,i)=>({...s,type:bodies[i].type,size:{...bodies[i].size}}))};}
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  reset();return {step,snapshot,restore,reset,state,dispose};
}
