// Intent belongs to a model visit, not to one animation frame. A short camera /
// stability settle may defer a visit; active scrolling must disable it entirely.
export function createModelHoverEntry({duration=2000,stableDuration=250,intentDuration=1200}={}) {
 let target=null,started=0,cooldownUntil=0,progress=0,stableSince=null,armed=false,explicit=false,intentUntil=-Infinity;
 const clear=()=>{target=null;started=0;progress=0;armed=false;explicit=false;intentUntil=-Infinity;};
 const empty=eligible=>({target:null,progress:0,enter:null,eligible});
 return {
  get isExplicit(){return explicit;},
  activate(now,id){const cancel=explicit&&target===id;clear();stableSince=null;if(cancel)return false;target=id;started=now;armed=true;explicit=true;cooldownUntil=0;return true;},
  reset(now=0,cooldown=0){clear();stableSince=null;cooldownUntil=Math.max(cooldownUntil,now+cooldown);},
  update(now,hit,enabled=true,options){
   const strict=!!options,stable=options?.stable!==false;
   if(explicit){
    if(!enabled||!stable){clear();return empty(false);}
    progress=Math.max(0,Math.min(1,(now-started)/duration));
    const result={target,progress,enter:progress>=1?target:null,eligible:true,explicit:true};
    if(result.enter){clear();cooldownUntil=now+duration;}
    return result;
   }
   if(!enabled||(!stable&&!options?.settling)){clear();stableSince=null;return empty(false);}
   if(stable){if(stableSince===null)stableSince=now;}else stableSince=null;
   const settled=stable&&(!strict||now-stableSince>=stableDuration)&&now>=cooldownUntil;
   if(!hit){clear();return empty(settled);}
   if(target!==hit){clear();target=hit;}
   if(options?.intent)intentUntil=now+intentDuration;
   // A changing camera can never advance an armed dwell.
   if(!stable&&armed){clear();return empty(false);}
   if(settled&&(!strict||now<=intentUntil)&&!armed){armed=true;started=now;}
   if(!armed)return empty(settled);
   progress=Math.max(0,Math.min(1,(now-started)/duration));
   const enter=progress>=1?target:null;
   const result={target,progress,enter,eligible:settled};
   if(enter){clear();stableSince=null;cooldownUntil=now+duration;}
   return result;
  }
 };
}

// A convex projected model box is predictable even through gaps between limbs.
// Call with the owned model root, never the scene, floor or portal effects.
export function projectModelHoverHull(THREE,object,camera){
 const bounds=new THREE.Box3().setFromObject(object),points=[];
 if(bounds.isEmpty())return [];
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const point=new THREE.Vector3(x,y,z).project(camera);
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.z < -1||point.z > 1)return [];
  points.push({x:point.x,y:point.y});
 }
 points.sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),lower=[],upper=[];
 for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...points].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 lower.pop();upper.pop();return lower.concat(upper);
}
export function isInsideModelHoverHull(hull,x,y){
 if(hull.length<3)return false;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if((b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x)<-1e-8)return false;}
 return true;
}
