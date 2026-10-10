/* Responsive, deliberately forgiving planar rally dynamics. Metres, seconds, +Z forward. */
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
export const damp = (a,b,k,dt) => a+(b-a)*(1-Math.exp(-k*dt));
export const CAR = Object.freeze({halfWidth:1.255,halfLength:2.05,wheelbase:2.56,track:2.06,radius:.55});

// SAT separates the entire oriented car footprint, not just its centre.
export function footprintContact(p, obstacle, padding=0) {
  const f={x:Math.sin(p.heading),z:Math.cos(p.heading)}, r={x:f.z,z:-f.x};
  const dx=p.x-obstacle.x,dz=p.z-obstacle.z;
  const hw=CAR.halfWidth+padding,hl=CAR.halfLength+padding;
  const radius=obstacle.radius??obstacle.r;
  if(Number.isFinite(radius)) {
    const qx=-(dx*r.x+dz*r.z),qz=-(dx*f.x+dz*f.z);
    const cx=clamp(qx,-hw,hw),cz=clamp(qz,-hl,hl),ax=qx-cx,az=qz-cz,d=Math.hypot(ax,az);
    if(d>=radius)return null;
    if(d>.00001)return {x:-(ax*r.x+az*f.x)/d,z:-(ax*r.z+az*f.z)/d,depth:radius-d};
    const sx=hw-Math.abs(qx),sz=hl-Math.abs(qz);
    if(sx<sz){const side=qx>=0?-1:1;return {x:r.x*side,z:r.z*side,depth:radius+sx};}
    const side=qz>=0?-1:1;return {x:f.x*side,z:f.z*side,depth:radius+sz};
  }
  const angle=obstacle.heading??obstacle.rotation??0;
  const of={x:Math.sin(angle),z:Math.cos(angle)},or={x:of.z,z:-of.x};
  const ox=obstacle.hx??(obstacle.width||2)/2,oz=obstacle.hz??(obstacle.depth||2)/2;
  let minimum=Infinity,result=null;
  for(const axis of [r,f,or,of]) {
    const dot=(a,b)=>a.x*b.x+a.z*b.z;
    const extent=hw*Math.abs(dot(r,axis))+hl*Math.abs(dot(f,axis))+ox*Math.abs(dot(or,axis))+oz*Math.abs(dot(of,axis));
    const separation=dx*axis.x+dz*axis.z,overlap=extent-Math.abs(separation);
    if(overlap<=0)return null;
    if(overlap<minimum){minimum=overlap;const sign=separation>=0?1:-1;result={x:axis.x*sign,z:axis.z*sign,depth:overlap};}
  }
  return result;
}

export function buildSolidIndex(solids,cell=24) {
  const buckets=new Map();
  for(const s of solids) {
    const extent=s.radius??s.r??Math.hypot(s.hx??(s.width||2)/2,s.hz??(s.depth||2)/2);
    for(let ix=Math.floor((s.x-extent)/cell);ix<=Math.floor((s.x+extent)/cell);ix++)for(let iz=Math.floor((s.z-extent)/cell);iz<=Math.floor((s.z+extent)/cell);iz++){
      const key=ix+','+iz;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(s);
    }
  }
  return (x,z,r=4)=>{const found=new Set();for(let ix=Math.floor((x-r)/cell);ix<=Math.floor((x+r)/cell);ix++)for(let iz=Math.floor((z-r)/cell);iz<=Math.floor((z+r)/cell);iz++)for(const s of buckets.get(ix+','+iz)||[])found.add(s);return found;};
}

export function createDynamics(pose) {
  return {x:pose.x,z:pose.z,y:pose.y||0,vy:0,grounded:true,suspension:0,suspensionVelocity:0,heading:pose.heading||0,vx:0,vz:0,yaw:0,steering:0,throttle:0,braking:false,skid:0,reverseWait:0};
}
export function integrateCar(p,controls,ground,dt) {
  if(p.grounded===false){
    p.steering=damp(p.steering,clamp(controls.steer||0,-1,1),6,dt);
    p.yaw=damp(p.yaw,p.steering*.18,1.5,dt);
    p.heading=wrap(p.heading+p.yaw*dt);p.vx*=Math.exp(-.025*dt);p.vz*=Math.exp(-.025*dt);
    p.x+=p.vx*dt;p.z+=p.vz*dt;p.braking=false;p.skid=damp(p.skid,0,5,dt);
    return {forward:p.vx*Math.sin(p.heading)+p.vz*Math.cos(p.heading),lateral:0,wheelAngle:p.steering*.55};
  }
  const f={x:Math.sin(p.heading),z:Math.cos(p.heading)},r={x:f.z,z:-f.x};
  let forward=p.vx*f.x+p.vz*f.z,lateral=p.vx*r.x+p.vz*r.z;
  const isRoad=['asphalt','tarmac','road','bridge','tile','concrete','cream'].includes(ground.surface),isDirt=['gravel','dirt','earth','sand','orange'].includes(ground.surface);
  const grip=isRoad?10.5:isDirt?8.8:7.4,rolling=isRoad?.045:isDirt?.065:.09;
  p.steering=damp(p.steering,clamp(controls.steer||0,-1,1),controls.steer?12:15,dt);
  p.throttle=damp(p.throttle,Math.abs(controls.drive||0),12,dt);
  p.braking=false;
  const drive=clamp(controls.drive||0,-1,1);
  if(drive<-.05&&forward>.4||drive>.05&&forward<-.4) {
    const decel=22*Math.abs(drive)*dt;
    forward-=Math.sign(forward)*Math.min(Math.abs(forward),decel);p.braking=true;p.reverseWait=.12;
  } else if(Math.abs(drive)>.05) {
    p.reverseWait=Math.max(0,p.reverseWait-dt);
    if(p.reverseWait===0){
      // Modest aerodynamic drag, not a cubic wall at 60 km/h: lively launch, bounded cruise.
      const limit=drive>0?(isRoad?34:isDirt?33:31):8;
      const power=drive>0?(isRoad?17:isDirt?16:15):7.5;
      forward+=drive*power*Math.max(0,1-Math.abs(forward)/limit)*dt;
    }
  } else p.reverseWait=0;
  if(controls.handbrake){forward*=Math.exp(-1.65*dt);p.braking=true;}
  forward*=Math.exp(-(rolling+.00012*forward*forward)*dt);
  forward-=clamp(ground.grade||0,-.5,.5)*9.8*dt;
  if(Math.abs(drive)<.05&&Math.abs(forward)<.055)forward=0;
  const wheelAngle=p.steering*.55/(1+Math.abs(forward)*.032);
  // Limit high-speed lateral acceleration so keyboard steering remains recoverable.
  const maxYaw=Math.min(1.85,(isRoad?18:isDirt?17:16)/Math.max(1,Math.abs(forward)));
  const desiredYaw=clamp(Math.tan(wheelAngle)*forward/CAR.wheelbase,-maxYaw,maxYaw)*(controls.handbrake?1.38:1);
  p.yaw=damp(p.yaw,desiredYaw,controls.handbrake?4.5:7,dt);
  p.heading=wrap(p.heading+p.yaw*dt);
  // Tire side-force follows heading with a finite grip rate; retained inertia produces controllable slides.
  const nf={x:Math.sin(p.heading),z:Math.cos(p.heading)},nr={x:nf.z,z:-nf.x};
  const wx=f.x*forward+r.x*lateral,wz=f.z*forward+r.z*lateral;
  forward=wx*nf.x+wz*nf.z;lateral=wx*nr.x+wz*nr.z;
  lateral*=Math.exp(-(controls.handbrake?1.35:grip)*dt);
  p.vx=nf.x*forward+nr.x*lateral;p.vz=nf.z*forward+nr.z*lateral;
  p.skid=damp(p.skid,clamp(Math.abs(lateral)/5+(controls.handbrake&&Math.abs(forward)>3?.3:0),0,1),8,dt);
  p.x+=p.vx*dt;p.z+=p.vz*dt;
  return {forward,lateral,wheelAngle};
}

// Wheel contact carries its vertical momentum over crests. Airborne motion is ballistic;
// suspension is an independent damped spring driven by the landing impulse.
export function integrateVertical(p,previous,next,dt) {
  if(!dt)return 0;
  let impact=0;
  if(p.grounded!==false){
    const rise=next.height-previous.height,expected=p.vy*dt;
    if((p.vy>.8&&rise<expected-.022)||rise<-.24){p.grounded=false;}
    else {p.y=next.height;
      const n=next.normal;
      const tangent=n&&n.y>.1?-(n.x*p.vx+n.z*p.vz)/n.y:damp(p.vy,clamp(rise/dt,-12,18),25,dt);
      p.vy=clamp(tangent,-12,18);}
  }
  if(p.grounded===false){
    p.vy-=18*dt;p.y+=p.vy*dt;
    if(p.y<=next.height&&p.vy<=0){
      impact=-p.vy;p.y=next.height;p.vy=0;p.grounded=true;
      p.suspensionVelocity-=Math.min(5,impact*.32);
    }
  }
  p.suspensionVelocity+=(-145*p.suspension-17*p.suspensionVelocity)*dt;
  p.suspension+=p.suspensionVelocity*dt;
  if(p.suspension<-.24){p.suspension=-.24;p.suspensionVelocity=Math.max(0,p.suspensionVelocity)*.35;}
  if(p.suspension>.12){p.suspension=.12;p.suspensionVelocity=Math.min(0,p.suspensionVelocity);}
  return impact;
}
