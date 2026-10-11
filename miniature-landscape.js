/* HEYBOX Toy Yard — an original explorable toy exhibition. All resources are owned here. */
export function createMiniatureLandscape({THREE:T,scene,reduced=false}){
  const root=new T.Group();root.name='HEYBOX · orange toy yard';scene.add(root);
  const geometries=new Set(),materials=new Set(),instances=[],batches=new Map(),colliders=[];
  const G=g=>(geometries.add(g),g),M=m=>(materials.add(m),m),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mat=c=>M(new T.MeshStandardMaterial({color:c,roughness:.91,flatShading:true}));
  const palette={ground:0xf49b53,sand:0xf5aa61,cream:0xffefd0,white:0xfff9e8,orange:0xef783c,red:0xc6503e,dark:0x574342,wood:0xce8750,teal:0x659b95,yellow:0xf9ca65,rose:0xd37c6c};
  const P=palette,m=Object.fromEntries(Object.entries(palette).map(([k,v])=>[k,mat(v)]));
  const box=G(new T.BoxGeometry(1,1,1)),cylinder=G(new T.CylinderGeometry(1,1,1,16));
  function add(g,mt,x,y,z,sx=1,sy=sx,sz=sx,yaw=0){const key=g.uuid+mt.uuid;if(!batches.has(key))batches.set(key,{g,mt,items:[]});batches.get(key).items.push([x,y,z,sx,sy,sz,yaw]);}
  function mesh(g,mt,name){const o=new T.Mesh(g,mt);o.name=name;o.receiveShadow=true;o.castShadow=true;root.add(o);return o;}
  const bounds=90,groundHeight=()=>0;
  // Overscan floor and no perimeter walls: recovery is handled by the driving controller.
  const floor=G(new T.PlaneGeometry(900,900,12,12));floor.rotateX(-Math.PI/2);const fp=floor.attributes.position,fc=[];for(let i=0;i<fp.count;i++){const a=clamp((fp.getX(i)+85)/170,0,1),b=clamp((fp.getZ(i)+85)/170,0,1),color=new T.Color(0xf5883c).lerp(new T.Color(0xff9043),a).lerp(new T.Color(0xfccf92),b*.68);fc.push(color.r,color.g,color.b);}floor.setAttribute('color',new T.Float32BufferAttribute(fc,3));const fm=mat(0xffffff);fm.vertexColors=true;const floorMesh=mesh(floor,fm,'Seamless warm gradient floor');floorMesh.castShadow=false;
  function plate(x,z,w,d,mt=m.sand,level=.036){add(box,mt,x,level/2,z,w,level,d);}
  // Block-built lettering stays crisp without canvas textures, fonts or external assets.
  const glyph={A:['01110','11011','11011','11111','11011','11011','11011'],B:['11110','11011','11011','11110','11011','11011','11110'],C:['01111','11000','11000','11000','11000','11000','01111'],D:['11110','11011','11011','11011','11011','11011','11110'],E:['11111','11000','11000','11110','11000','11000','11111'],F:['11111','11000','11000','11110','11000','11000','11000'],G:['01111','11000','11000','11011','11011','11011','01111'],H:['11011','11011','11011','11111','11011','11011','11011'],I:['111','010','010','010','010','010','111'],J:['00111','00011','00011','00011','11011','11011','01110'],K:['11011','11010','11100','11100','11110','11011','11011'],L:['11000','11000','11000','11000','11000','11000','11111'],M:['11011','11111','11111','11011','11011','11011','11011'],N:['11001','11101','11101','11011','11011','11011','11001'],O:['01110','11011','11011','11011','11011','11011','01110'],P:['11110','11011','11011','11110','11000','11000','11000'],R:['11110','11011','11011','11110','11100','11011','11011'],S:['01111','11000','11000','01110','00011','00011','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['11011','11011','11011','11011','11011','11011','01110'],V:['11011','11011','11011','11011','11011','01010','00100'],W:['11011','11011','11011','11011','11111','11111','01010'],X:['11011','11011','01010','00100','01010','11011','11011'],Y:['11011','11011','01010','00100','00100','00100','00100'],Z:['11111','00011','00110','00100','01100','11000','11111'],'0':['01110','11011','11011','11011','11011','11011','01110'],'1':['010','110','010','010','010','010','111'],'2':['11110','00011','00011','01110','11000','11000','11111'],'3':['11110','00011','00011','01110','00011','00011','11110'],'4':['11011','11011','11011','11111','00011','00011','00011'],'5':['11111','11000','11000','11110','00011','00011','11110'],'6':['01111','11000','11000','11110','11011','11011','01110'],'+':['00000','00100','00100','11111','00100','00100','00000']};
  function lettering(text,x,z,scale=.24,{upright=false,y=.056,depth=.035,material=m.cream}={}){
    const chars=[...text.toUpperCase()],width=chars.reduce((s,c)=>s+(glyph[c]?.[0].length||3)+1,0)-1;let cursor=x-width*scale/2;
    for(const ch of chars){const rows=glyph[ch];if(rows)for(let r=0;r<7;r++){let a=0;while(a<rows[r].length){if(rows[r][a]!=='1'){a++;continue;}let b=a+1;while(rows[r][b]==='1')b++;const xx=cursor+(a+b)*scale/2;if(upright)add(box,material,xx,y+(6.5-r)*scale,z,(b-a)*scale,scale,depth);else add(box,material,xx,y,z+(r-3)*scale,(b-a)*scale,depth,scale);a=b;}}cursor+=((rows?.[0].length||3)+1)*scale;}
  }
  // Upright block lettering as prop parts, relative to the body's bottom centre.
  function letterParts(text,y,z,scale,depth,color){const parts=[],chars=[...text.toUpperCase()],width=chars.reduce((s,c)=>s+(glyph[c]?.[0].length||3)+1,0)-1;let cursor=-width*scale/2;
    for(const ch of chars){const rows=glyph[ch];if(rows)for(let r=0;r<7;r++){let a=0;while(a<rows[r].length){if(rows[r][a]!=='1'){a++;continue;}let b=a+1;while(rows[r][b]==='1')b++;parts.push(['box',color,cursor+(a+b)*scale/2,y+(6.5-r)*scale,z,(b-a)*scale,scale,depth]);a=b;}}cursor+=((rows?.[0].length||3)+1)*scale;}return parts;}
  function border(x,z,w,d,mt=m.cream){for(let xx=x-w/2;xx<=x+w/2;xx+=2.8)for(const zz of [z-d/2,z+d/2])add(box,mt,xx,.065,zz,1.3,.13,.32);for(let zz=z-d/2+2.8;zz<z+d/2;zz+=2.8)for(const xx of [x-w/2,x+w/2])add(box,mt,xx,.065,zz,.32,.13,1.3);}
  const pathTiles=[];
  function path(id,points,width=7){const out=[];for(let k=1;k<points.length;k++){const a=points[k-1],b=points[k],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),count=Math.ceil(len/.9);for(let i=0;i<count;i++){const f=i/count;out.push({x:a[0]+dx*f,y:0,z:a[1]+dz*f});}const yaw=Math.atan2(dx,dz);for(let t=1.8;t<len;t+=3.4){const x=a[0]+dx*t/len,z=a[1]+dz*t/len;if(Math.abs(x)<18&&z>-7&&z<29)continue;for(const side of [-1,1]){const px=x+dz/len*side*width/2,pz=z-dx/len*side*width/2;if(pathTiles.some(q=>Math.hypot(q.x-px,q.z-pz)<1.5))continue;pathTiles.push({x:px,z:pz});add(box,m.cream,px,.044,pz,.46,.075,1.3,yaw);}}}const p=points.at(-1);out.push({x:p[0],y:0,z:p[1]});return{id,width,surface:'gravel',points:out,closed:false};}
  const roads=[path('toy-loop',[[0,18],[-20,18],[-48,12],[-49,-30],[-18,-43],[18,-43],[53,-32],[56,13],[36,31],[0,32],[-20,18]]),path('crossroads',[[-48,12],[-22,5],[0,10],[26,9],[56,13]],8),path('gallery-link',[[0,10],[0,-17],[0,-43]],7),path('south-link',[[0,18],[0,32],[0,51],[28,51]],7)];
  function arrow(x,z,yaw=0,s=1){const pts=[[-.3,-1.5],[.3,-1.5],[.3,.1],[1,.1],[0,1.5],[-1,.1],[-.3,.1]],p=[],idx=[];for(const [u,v] of pts)p.push(x+(u*Math.cos(yaw)+v*Math.sin(yaw))*s,.105,z+(-u*Math.sin(yaw)+v*Math.cos(yaw))*s);for(const tri of T.ShapeUtils.triangulateShape(pts.map(([u,v])=>new T.Vector2(u,v)),[])){const[a,b,c]=tri,A=pts[a],B=pts[b],C=pts[c],cross=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);idx.push(a,cross>0?c:b,cross>0?b:c);}const g=G(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,m.cream,'Floor direction arrow');}
  // INTRO / CROSSROADS: the car arrives in the middle of a designed, human-scale place.
  plate(0,14,27,26);border(0,14,27,26);// Six independent dynamic letter bodies form the title at z=0.
  lettering('DRIVE + PLAY',0,7,.25);lettering('W A S D',-6,26,.24);
  add(cylinder,m.cream,11,.025,19,2.5,.05,2.5);lettering('RESET',11,19,.135,{y:.075,material:m.orange});
  for(const [x,z,yaw] of [[-18,12,-Math.PI/2],[19,12,Math.PI/2],[0,30,0],[0,-14,Math.PI]])arrow(x,z,yaw,1.25);
  // A tiny RC controller exhibit and a friendly information kiosk flank the plaza.
  plate(-17,0,7,7,m.orange);plate(18,0,8,7,m.orange);
  // BOWLING: inset lane, gutters, a ten-pin triangle and a real movable ball.
  plate(-34,-8,14,37,m.orange);plate(-34,-8,8.2,33,m.wood,.07);for(const x of [-38.9,-29.1])add(box,m.red,x,.11,-8,.6,.22,33);
  for(let z=-23;z<8;z+=2.7)add(box,m.sand,-34,.086,z,8,.016,.07);
  lettering('BOWL',-34,15,.38);lettering('01',-43,-20,.3);border(-34,-8,14,37);
  add(box,m.cream,-34,.089,3,8,.028,.23);for(const x of [-36.5,-35.25,-34,-32.75,-31.5])arrow(x,-6,Math.PI,.3);
  // SMASH: carefully arranged dominoes and a brick wall, surrounded by runout space.
  plate(-28,39,33,23,m.sand);border(-28,39,33,23);lettering('SMASH',-28,49,.4);lettering('02',-45,33,.3);
  // GALLERY: three small architectural islands with toy-scale display objects.
  lettering('DISCOVER',-7,-35,.38);
  lettering('CREATE',-16,-18.7,.23);lettering('HEYBOX',0,-19.8,.21);lettering('EXPLORE',16,-19.8,.21);
  // PARK / STUNTS: generous straight approaches, two jump scales and two bridges.
  const playground={center:{x:0,z:10},bounds:{minX:-60,maxX:65,minZ:-55,maxZ:62},resetPad:{x:11,z:19,radius:2.5},ramps:[
    {id:'little-hop',kind:'jump',x:28,z:-2,yaw:Math.PI,length:9,width:6,height:1.5},
    {id:'big-air',kind:'jump',x:43,z:-7,yaw:Math.PI,length:12,width:7,height:2.5},
    {id:'return-hop',kind:'jump',x:46,z:-38,yaw:Math.PI/2,length:9,width:6,height:1.8},
    {id:'toy-bridge',kind:'bridge',x:32,z:33,yaw:Math.PI/2,length:24,width:6,height:2,approach:7},
    {id:'gallery-bridge',kind:'bridge',x:-18,z:-44,yaw:Math.PI/2,length:18,width:6,height:1.5,approach:5}],props:[]};
  plate(37,-5,29,43,m.sand);border(37,-5,29,43);lettering('JUMP',36,16,.46);lettering('03',54,-10,.3);for(const x of [28,43])arrow(x,9,Math.PI,1);
  plate(33,34,34,14,m.orange);lettering('BRIDGE',32,44,.32);
  function rampLocal(r,x,z){const dx=x-r.x,dz=z-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw);return{x:dx*c-dz*s,z:dx*s+dz*c};}
  function rampRise(r,v){const t=clamp(v+r.length/2,0,r.length);return r.kind==='bridge'?r.height*Math.min(1,t/r.approach,(r.length-t)/r.approach):r.height*t/r.length;}
  function rampHeight(r,x,z){const q=rampLocal(r,x,z);if(Math.abs(q.x)>r.width/2+1e-8||Math.abs(q.z)>r.length/2+1e-8)return null;const gx=clamp((q.x+r.width/2)/r.width*r.cols,0,r.cols-1e-9),gz=clamp((q.z+r.length/2)/r.length*r.rows,0,r.rows-1e-9),i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,k=j*(r.cols+1)+i,a=r.heights[k],b=r.heights[k+1],c=r.heights[k+r.cols+1],d=r.heights[k+r.cols+2];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}
  for(const r of playground.ramps){r.cols=Math.ceil(r.width/.65);r.rows=Math.ceil(r.length/.65);r.heights=[];r.y=.065;const p=[],idx=[];for(let j=0;j<=r.rows;j++)for(let i=0;i<=r.cols;i++){const u=(i/r.cols-.5)*r.width,v=(j/r.rows-.5)*r.length,y=.065+rampRise(r,v);r.heights.push(y);p.push(r.x+u*Math.cos(r.yaw)+v*Math.sin(r.yaw),y,r.z-u*Math.sin(r.yaw)+v*Math.cos(r.yaw));}for(let j=0;j<r.rows;j++)for(let i=0;i<r.cols;i++){const k=j*(r.cols+1)+i;idx.push(k,k+r.cols+1,k+1,k+1,k+r.cols+1,k+r.cols+2);}const top=G(new T.BufferGeometry());top.setAttribute('position',new T.Float32BufferAttribute(p,3));top.setIndex(idx);top.computeVertexNormals();mesh(top,r.kind==='bridge'?m.wood:m.cream,'Physical top · '+r.id);
    const perimeter=[];for(let i=0;i<=r.cols;i++)perimeter.push(i);for(let j=1;j<=r.rows;j++)perimeter.push(j*(r.cols+1)+r.cols);for(let i=r.cols-1;i>=0;i--)perimeter.push(r.rows*(r.cols+1)+i);for(let j=r.rows-1;j>0;j--)perimeter.push(j*(r.cols+1));const sides=[],si=[];for(let n=0;n<perimeter.length;n++){const a=p.slice(perimeter[n]*3,perimeter[n]*3+3),b=p.slice(perimeter[(n+1)%perimeter.length]*3,perimeter[(n+1)%perimeter.length]*3+3),k=sides.length/3;sides.push(...a,...b,b[0],.01,b[2],a[0],.01,a[2]);si.push(k,k+1,k+2,k,k+2,k+3);}const g=G(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(sides,3));g.setIndex(si);g.computeVertexNormals();mesh(g,m.orange,'Solid wedge sides · '+r.id);
    const bands=[],bi=[],vs=r.kind==='bridge'?Array.from({length:19},(_,i)=>(i+1)*r.length/20-r.length/2):[-r.length/2+.6,r.length/2-.4];for(const v of vs){const k=bands.length/3;for(const [u,w] of [[-r.width/2+.13,v-.05],[-r.width/2+.13,v+.05],[r.width/2-.13,v-.05],[r.width/2-.13,v+.05]]){const x=r.x+u*Math.cos(r.yaw)+w*Math.sin(r.yaw),z=r.z-u*Math.sin(r.yaw)+w*Math.cos(r.yaw);bands.push(x,rampHeight(r,x,z)+.014,z);}bi.push(k,k+1,k+2,k+2,k+1,k+3);}const bg=G(new T.BufferGeometry());bg.setAttribute('position',new T.Float32BufferAttribute(bands,3));bg.setIndex(bi);bg.computeVertexNormals();mesh(bg,r.kind==='bridge'?m.cream:m.red,'Ramp surface bands · '+r.id);
  }
  function sampleSurface(x,z){for(const r of playground.ramps){const y=rampHeight(r,x,z);if(y!==null){const q=rampLocal(r,x,z),eps=.015,u=clamp(q.x,-r.width/2+eps,r.width/2-eps),v=clamp(q.z,-r.length/2+eps,r.length/2-eps),cx=r.x+u*Math.cos(r.yaw)+v*Math.sin(r.yaw),cz=r.z-u*Math.sin(r.yaw)+v*Math.cos(r.yaw),hx=((rampHeight(r,cx+eps,cz)??y)-(rampHeight(r,cx-eps,cz)??y))/(2*eps),hz=((rampHeight(r,cx,cz+eps)??y)-(rampHeight(r,cx,cz-eps)??y))/(2*eps),n=Math.hypot(hx,1,hz);return{height:y,onRoad:true,surface:r.kind==='bridge'?'bridge':'ramp',water:false,friction:1,playgroundId:r.id,normal:{x:-hx/n,y:1/n,z:-hz/n}};}}return{height:0,onRoad:true,surface:'gravel',water:false,friction:1,normal:{x:0,y:1,z:0}};}
  const prop=(id,type,x,z,size,mass=2,y=0,yaw=0,extra={})=>playground.props.push({id,type,x,z,size,mass,y,yaw,...extra});
  // Everything you can see standing up in the yard is a movable body: no fixed colliders remain.
  for(const [i,x,z,a] of [[0,-7.7,22,Math.PI/2],[1,-6,22,0],[2,-4.3,22,-Math.PI/2],[3,-6,20.3,Math.PI]])prop('key-'+i,'crate',x,z,{x:1.4,y:.6,z:1.4},4,0,0,{parts:[['box',P.white,0,.27,0,1.4,.54,1.4],['tri',P.wood,0,.56,0,.34,.05,.34,0,a,0]]});
  prop('rc-controller','crate',-17,0,{x:4,y:2.5,z:2.2},18,.15,.15,{color:P.dark});
  for(const x of [-1,1])prop('rc-stick'+x,'crate',-17+x*.99,.15,{x:.64,y:.95,z:.64},1.5,2.65,.15,{parts:[['cyl',P.white,0,.085,0,.32,.17,.32],['cyl',P.dark,0,.52,0,.12,.7,.12]]});
  prop('rc-antenna','brick',-17-.09,-.6,{x:.3,y:2.5,z:.3},1,2.65,0,{color:P.dark});
  prop('hi-base','brick',18,0,{x:5.7,y:.4,z:2.2},20,0,0,{color:P.dark});
  prop('hi-kiosk','crate',18,.3,{x:5,y:4.2,z:1.6},16,.4,0,{parts:[['box',P.cream,0,2.1,0,5,4.2,1],['box',P.teal,0,2.4,.54,4.25,2.45,.13],...letterParts('HI',1.7,.67,.24,.13,P.white)]});
  for(const [id,x,z,w,d] of [['create',-16,-25,10,8],['heybox',0,-27,9,9],['explore',16,-27,9,9]]){plate(x,z,w+3,d+3,m.orange);for(const i of [-1,1])for(const k of [-1,1])prop('pedestal-'+id+i+k,'brick',x+i*w/4,z+k*d/4,{x:w/2-.04,y:.64,z:d/2-.04},9,0,0,{color:P.cream});}
  prop('create-board','crate',-16,-26,{x:8,y:4.76,z:.65},14,.64,0,{parts:[['box',P.dark,0,2.38,0,8,4.6,.65],['box',P.teal,0,2.56,.36,7,3.6,.12],['box',P.yellow,-1,2.76,.48,2.1,1.6,.12],['box',P.cream,1.2,2.06,.49,1.4,.8,.14]]});
  prop('create-keyboard','brick',-16,-22.7,{x:5,y:.25,z:2.4},3,.64,0,{color:P.dark});
  prop('heybox-lid','brick',0,-27,{x:5.6,y:.35,z:5.6},6,5.14,.15,{color:P.cream});
  prop('heybox-head','crate',0,-27,{x:5,y:4.5,z:5},22,.64,.15,{parts:[['box',P.orange,0,2.25,0,5,4.5,5],['ball',P.dark,-1.15,2.66,2.7,.39,.44,.25],['ball',P.dark,1.15,2.66,2.7,.39,.44,.25],['box',P.dark,0,1.61,2.71,1.2,.22,.16]]});
  prop('explore-drum','crate',16,-27,{x:6,y:1.8,z:6},40,.64,0,{parts:[['cyl',P.red,0,.9,0,3,1.8,3]]});
  prop('explore-globe','ball',16,-27,{x:5.2,y:5.2,z:5.2},14,2.44,0,{parts:[['ball',P.yellow,0,2.6,0,2.6,2.6,2.6],['box',P.white,0,2.6,2.3,3,.65,.4,0,-.12,0]]});
  for(const [i,letter] of [...'HEYBOX'].entries())playground.props.push({id:'title-'+letter,type:'letter',letter,x:-10+i*4,z:0,size:{x:3.4,y:4.8,z:1.15},mass:8,y:0,yaw:0});
  for(let row=0;row<4;row++)for(let c=0;c<=row;c++)prop('pin-'+row+'-'+c,'pin',-34+(c-row/2)*1.3,-17-row*1.4,{x:.76,y:2.25,z:.76},1.9);
  prop('bowling-ball','ball',-34,6,{x:2.4,y:2.4,z:2.4},8);
  for(let i=0;i<12;i++)prop('domino-'+i,'brick',-40+i*1.75,35+Math.sin(i*.4)*2,{x:.48,y:2.3,z:1.2},2.5,0,0);
  for(let row=0;row<3;row++)for(let c=0;c<5-row;c++)prop('wall-'+row+'-'+c,'brick',-33+c*1.65+row*.8,43,{x:1.58,y:.8,z:.8},2.5,row*.81);
  for(const [i,x,z,y] of [[0,-16,33,0],[1,-14.5,33,0],[2,-15.25,33,1.3],[3,-12,37,0],[4,-13,39,0],[5,-10,40,0],[6,55,-27,0],[7,57,-29,0]])prop('crate-'+i,'crate',x,z,1.3,3.5,y);
  // A flowing slalom at the south edge is visible from the introductory plaza.
  lettering('SLALOM',14,59,.36);for(let i=0;i<9;i++)prop('slalom-'+i,'cone',-10+i*4.4,52+(i%2?3:-3),{x:1,y:1.55,z:1},1.2);
  for(const [i,x,z] of [[0,24,7],[1,32,7],[2,39,5],[3,47,5],[4,-40,10],[5,-28,10]])prop('entry-cone-'+i,'cone',x,z,{x:.9,y:1.35,z:.9},1.2);
  // Small exhibits and planted pockets frame the routes rather than fill them at random.
  function planter(x,z,s=1){prop('planter-'+x+'-'+z,'crate',x,z,{x:3.3*s,y:1.26*s,z:3.3*s},14*s,0,0,{parts:[['cyl',P.cream,0,.6*s,0,1.65*s,1.2*s,1.65*s],['cyl',P.red,0,1.22*s,0,1.43*s,.08,1.43*s]]});
    prop('tree-'+x+'-'+z,'crate',x,z,{x:2.6*s,y:5.8*s,z:2.6*s},5*s,1.26*s,0,{parts:[['cyl',P.dark,0,1.4*s,0,.21*s,2.8*s,.21*s],['canopy',P.yellow,0,2.74*s,0,1.3*s,2.3*s,1.2*s,0,.35,0]]});}
  for(const [x,z,s] of [[-24,-8,.9],[-48,-36,1.2],[25,-42,1.05],[58,22,1],[-49,26,.85],[-7,39,.7],[20,23,.8],[-57,2,1],[-7,-48,.85]])planter(x,z,s);
  function bench(x,z,yaw=0){prop('bench-'+x+'-'+z,'crate',x,z,{x:4,y:1.92,z:1.3},8,0,yaw,{parts:[['box',P.wood,0,.85,0,4,.28,1.3],['box',P.dark,-1.5,.42,0,.25,.84,1],['box',P.dark,1.5,.42,0,.25,.84,1],['box',P.cream,0,1.45,-.5,4,.95,.2]]});}
  // Low cream block corners echo a hand-built toy construction set.
  for(const [x,z] of [[-21,27],[23,23],[-52,-17],[9,-48]])for(let row=0;row<2;row++)for(let i=0;i<4;i++)prop('block-'+x+'-'+z+'-'+row+'-'+i,'brick',x+i*1.6+(row%2)*.35,z,{x:1.5,y:.74,z:.8},2.5,row*.745,0,{color:P.cream});
  bench(-24,-13);bench(17,26);bench(-48,20);
  // Toy gantries make the remote corners recognizable in silhouette.
  for(const [x,z,label] of [[-34,-28,'BOWL'],[43,-28,'AIR']]){for(const dx of [-5,5])prop('gantry-'+label+dx,'brick',x+dx,z,{x:.7,y:5.55,z:.7},10,0,0,{color:P.red});prop('gantry-'+label,'crate',x,z,{x:11,y:.9,z:1},12,5.56,0,{parts:[['box',P.cream,0,.45,0,11,.9,1],...letterParts(label,.95,.56,.36,.36,P.white)]});}
  // Tiny architectural detail at the far crossroads: paired flags, seating and an open arch.
  for(const x of [-6,6])prop('flag'+x,'crate',x,-53,{x:.36,y:7,z:.36},4,0,0,{parts:[['cyl',P.red,0,3.5,0,.16,7,.16],['box',x<0?P.yellow:P.teal,1.4,6.1,0,2.8,1.6,.12]]});lettering('FREE TO ROAM',0,-57,.27);
  const dummy=new T.Object3D();for(const {g,mt,items} of batches.values()){const inst=new T.InstancedMesh(g,mt,items.length);inst.name='Batched toy-yard details';inst.castShadow=true;inst.receiveShadow=true;for(let i=0;i<items.length;i++){const [x,y,z,sx,sy,sz,a]=items[i];dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,a,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);}inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();root.add(inst);instances.push(inst);}batches.clear();
  const landmarks=[{id:'plaza',name:'HEYBOX 出发广场',x:0,z:14},{id:'bowling',name:'玩具保龄球',x:-34,z:-8},{id:'smash',name:'多米诺工坊',x:-28,z:39},{id:'gallery',name:'发现小岛',x:0,z:-27},{id:'jumps',name:'飞跃跳台',x:37,z:-5},{id:'bridge',name:'积木桥',x:32,z:33},{id:'slalom',name:'绕桩乐园',x:14,z:52}];
  const spawn={x:0,z:18,heading:Math.PI};let disposed=false;
  function update(){}
  function dispose(){if(disposed)return;disposed=true;scene.remove(root);for(const o of instances)o.dispose?.();for(const g of geometries)g.dispose();for(const mt of materials)mt.dispose();root.clear();}
  return{root,roads,landmarks,spawn,bounds,playground,sampleSurface,colliders,groundHeight,update,dispose,diagnostics:{palette,terrainStep:0,geometryCount:geometries.size,materialCount:materials.size,resourceOwnership:'All scene resources owned and disposed by landscape',theme:'orange-toy-exhibit'}};
}
