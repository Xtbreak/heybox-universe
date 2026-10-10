// 黑盒宇宙 — original procedural Three.js installation. No assets or global side effects.
export function createDemo({THREE:T,scene,camera,renderer,reduced=false}) {
 const root=new T.Group();scene.add(root);const geometries=[],materials=[];
 const geo=g=>(geometries.push(g),g),mat=m=>(materials.push(m),m);
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x)};
 const mix=(a,b,t)=>a+(b-a)*t;
 let seed=719;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const dummy=new T.Object3D(),v=new T.Vector3(),look=new T.Vector3();let mx=0,my=0,W=1440,H=900;
 const ambient=new T.HemisphereLight(0x8badc4,0x07090e,1.5);root.add(ambient);
 function area(color,intensity,x,y,z){const l=new T.DirectionalLight(color,intensity);l.position.set(x,y,z);root.add(l);return l}
 area(0xecf7ff,5,5,8,9);area(0x478bbb,2,-7,0,1);area(0xaedfff,3,3,-4,-8);
 const key=new T.PointLight(0xbbeaff,70,30,2);root.add(key);
 // Rounded black-metal modules: the original cube is genuinely volumetric.
 const shape=new T.Shape();shape.moveTo(-.29,-.29);shape.lineTo(.29,-.29);shape.lineTo(.29,.29);shape.lineTo(-.29,.29);shape.closePath();
 const shardGeo=geo(new T.ExtrudeGeometry(shape,{depth:.58,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.055,bevelThickness:.055,curveSegments:1}));shardGeo.translate(0,0,-.29);
 const shardMat=mat(new T.MeshStandardMaterial({color:0x11171e,metalness:.87,roughness:.25,emissive:0x112433,emissiveIntensity:.18}));
 const N=125,shards=new T.InstancedMesh(shardGeo,shardMat,N);shards.instanceMatrix.setUsage(T.DynamicDrawUsage);shards.frustumCulled=false;root.add(shards);
 // Fine blue-white engravings are instanced narrow bars, not a solid emissive cube.
 const barGeo=geo(new T.BoxGeometry(.52,.013,.013));const barMat=mat(new T.MeshBasicMaterial({color:0x82b8d7,transparent:true,opacity:.42}));
 const bars=new T.InstancedMesh(barGeo,barMat,N*4);bars.instanceMatrix.setUsage(T.DynamicDrawUsage);bars.frustumCulled=false;root.add(bars);
 const base=[],scatter=[],phase=[];for(let i=0;i<N;i++){base.push(new T.Vector3((i%5-2)*.67,(Math.floor(i/5)%5-2)*.67,(Math.floor(i/25)-2)*.67));const a=rnd()*Math.PI*2,r=4+rnd()*8;scatter.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r*.75,-rnd()*20));phase.push(rnd()*6.28)}
 const rot=new T.Quaternion(),euler=new T.Euler(),local=new T.Vector3(),bq=new T.Quaternion(),boxCenter=new T.Vector3(),target=new T.Vector3(),signatureOffset=new T.Vector3();
 // Everything luminous uses soft procedural point sprites; dense enough to read without bloom.
 const pvert=`attribute float aSize;attribute float aPhase;attribute vec3 aColor;varying vec3 vColor;varying float vAlpha;uniform float uTime;uniform float uPixel;uniform float uOpacity;uniform float uMode;uniform float uFlow;void main(){vec3 p=position;float t=uTime; if(uMode>0.5&&uMode<1.5){float a=t*.035;float c=cos(a),s=sin(a);p.xz=mat2(c,-s,s,c)*p.xz;p.y+=sin(t*.13+aPhase)*.11;} if(uMode>1.5){p.z=-mod(-p.z+t*uFlow,80.0)+10.0;float a=sin(p.z*.085+t*.1)*.13;float c=cos(a),s=sin(a);p.xy=mat2(c,-s,s,c)*p.xy;}vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPixel*55.0/max(1.0,-mv.z),1.0,25.0);vColor=aColor;vAlpha=uOpacity*(.70+.30*sin(aPhase+t*.3));}`;
 const pfrag=`precision highp float;varying vec3 vColor;varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float r=length(p);if(r>.5)discard;float core=exp(-r*r*100.0);float halo=exp(-r*r*14.0)*.28;gl_FragColor=vec4(vColor,(core+halo)*vAlpha);}`;
 function points(count,mode,fn,opacity=1){const pos=new Float32Array(count*3),sz=new Float32Array(count),ph=new Float32Array(count),col=new Float32Array(count*3);for(let i=0;i<count;i++){const p=fn(i);pos.set(p,i*3);sz[i]=.5+rnd()*2.1;ph[i]=rnd()*6.28;const blue=rnd();col.set([.45+blue*.45,.65+blue*.3,.85+blue*.15],i*3)}const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('aSize',new T.BufferAttribute(sz,1));g.setAttribute('aPhase',new T.BufferAttribute(ph,1));g.setAttribute('aColor',new T.BufferAttribute(col,3));const m=mat(new T.ShaderMaterial({vertexShader:pvert,fragmentShader:pfrag,transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uPixel:{value:1},uOpacity:{value:opacity},uMode:{value:mode},uFlow:{value:0}}}));const mesh=new T.Points(g,m);mesh.frustumCulled=false;root.add(mesh);return mesh}
 const stars=points(7000,0,()=>[(rnd()-.5)*100,(rnd()-.5)*60,10-rnd()*110],.6);
 const orbit=points(6200,1,()=>{const a=rnd()*6.28,r=3.3+Math.pow(rnd(),2)*4;return[Math.cos(a)*r,(rnd()-.5)*.13,Math.sin(a)*r]},.9);orbit.rotation.set(.42,0,.2);orbit.position.set(1.25,0,0);
 const dust=points(1300,1,()=>{const a=rnd()*6.28,r=2.6+rnd()*4;return[Math.cos(a)*r,Math.sin(a)*r*.7,(rnd()-.5)*5]},.42);dust.position.x=1.25;
 const tunnel=points(12000,2,()=>{const a=rnd()*6.28,r=3.5+Math.pow(rnd(),3)*13;return[Math.cos(a)*r,Math.sin(a)*r,10-rnd()*80]},0);
 // Long tapered constellation streaks establish forward motion through the wormhole.
 const streakPos=new Float32Array(900*6);for(let i=0;i<900;i++){let a=rnd()*6.28,r=4+rnd()*17,z=8-rnd()*80;streakPos.set([Math.cos(a)*r,Math.sin(a)*r,z,Math.cos(a)*r,Math.sin(a)*r,z-1-rnd()*4],i*6)}
 const sg=geo(new T.BufferGeometry());sg.setAttribute('position',new T.BufferAttribute(streakPos,3));const sm=mat(new T.LineBasicMaterial({color:0x82bfdc,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));const streaks=new T.LineSegments(sg,sm);root.add(streaks);
 function ring(radius,color,opacity){const g=geo(new T.TorusGeometry(radius,.008,6,180));const m=mat(new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));return new T.Mesh(g,m)}
 const orbitRings=new T.Group();root.add(orbitRings);orbitRings.position.copy(orbit.position);orbitRings.rotation.set(1.08,.18,.22);for(let i=0;i<3;i++){const r=ring(3.8+i*.7,0x76aac7,.24-i*.045);r.rotation.x=i*.08;orbitRings.add(r)}
 const portals=[];
 const portalVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const portalFrag=`precision highp float;varying vec2 vUv;uniform float uTime;uniform float uOpacity;uniform float uKind;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);float ring=exp(-pow(abs((r-.88)*75.),2.));float inner=exp(-pow(abs((r-.83)*32.),2.))*.15;float acc=pow(.5+.5*sin(a*3.+uTime*.16+uKind*2.),5.);float spiral=.5+.5*sin(a*5.+r*35.-uTime*.18+uKind*2.);float haze=exp(-r*4.)*.22+spiral*.035*(1.-smoothstep(.1,.85,r));float grid=pow(.5+.5*sin(p.x*38.+sin(p.y*8.)*2.),24.)*pow(.5+.5*sin(p.y*38.),24.)*.035;vec3 c=mix(vec3(.16,.35,.49),vec3(.74,.88,1.),ring);gl_FragColor=vec4(c,(ring*(.25+acc*.75)+inner+haze+grid)*uOpacity);}`;
 for(let j=0;j<3;j++){const group=new T.Group();group.position.set((j-1)*5.3+1.0,j===1?.1:-.25,-48-(j===1?1.4:0));root.add(group);const pm=mat(new T.ShaderMaterial({vertexShader:portalVertex,fragmentShader:portalFrag,uniforms:{uTime:{value:0},uOpacity:{value:0},uKind:{value:j}},transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));const face=new T.Mesh(geo(new T.PlaneGeometry(4.5,4.5)),pm);group.add(face);const rs=[];for(let k=0;k<3;k++){const r=ring(2.04+k*.08,0x9ec9dd,0);group.add(r);rs.push(r)}const cloud=points(1800,0,()=>{const a=rnd()*6.28,r=1.75+rnd()*.55;return[Math.cos(a)*r,Math.sin(a)*r,(rnd()-.5)*.6]},0);root.remove(cloud);group.add(cloud);portals.push({group,pm,rs,cloud})}
 // Center mark appears on the fully assembled object, with no external type or logo asset.
 const sig=new T.Group();root.add(sig);const sigMat=mat(new T.MeshBasicMaterial({color:0xbdddeb,transparent:true,opacity:.9}));for(const x of [-.2,.2]){const m=new T.Mesh(geo(new T.BoxGeometry(.07,.57,.012)),sigMat);m.position.x=x;sig.add(m)}const bridge=new T.Mesh(geo(new T.BoxGeometry(.44,.065,.012)),sigMat);sig.add(bridge);
 function update({time=0,dt=.016,progress=0,pointer={x:0,y:0}}){const p=clamp(progress),t=reduced?time*.1:time;const inertia=1-Math.exp(-Math.min(dt,.1)*4);mx+=(pointer.x-mx)*inertia;my+=(pointer.y-my)*inertia;
 const ex=smooth(.13,.40,p),flight=smooth(.27,.67,p),world=smooth(.56,.72,p)*(1-smooth(.84,.97,p)),finish=smooth(.83,1,p);
 const cz=mix(10.8,-33,flight)-finish*1.3;camera.position.set(mx*.38,my*.25,cz);look.set(mix(.7,1,flight)+mx*.12,-my*.1,mix(0,-48,flight));camera.lookAt(look);camera.fov=mix(43,58,Math.sin(flight*Math.PI))-(finish*3);camera.updateProjectionMatrix();
 key.position.set(3,4,cz-2);boxCenter.set(mix(1.3,1.0,flight),0,mix(0,-47,finish));euler.set(.18+my*.09,.48+mx*.13+(reduced?0:t*.055),.05);rot.setFromEuler(euler);
 for(let i=0;i<N;i++){const b=base[i];v.copy(b).applyQuaternion(rot).add(boxCenter);const s=scatter[i],j=i%3,idx=Math.floor(i/3),a=idx/42*6.28+phase[i]*.035;const wx=(j-1)*5.3+1+Math.cos(a)*2.28,wy=(j===1?.1:-.25)+Math.sin(a)*2.28,wz=-48-(j===1?1.4:0)+Math.sin(a*3)*.3;
 const transit=smooth(.37,.7,p);const explodeWeight=ex*(1-finish);const sx=mix(1.3+s.x,wx,transit),sy=mix(s.y,wy,transit),sz=mix(s.z,wz,transit);target.set(sx,sy,sz);v.lerp(target,explodeWeight);
 dummy.position.copy(v);dummy.rotation.set(euler.x+explodeWeight*(phase[i]+t*.1),euler.y+explodeWeight*(phase[i]*.7+t*.09),euler.z+explodeWeight*phase[i]);const sc=mix(1,.35,ex)*(1-finish)+finish;dummy.scale.setScalar(sc);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);
 bq.copy(dummy.quaternion);for(let k=0;k<4;k++){local.set(k<2?0:(k===2?-.29:.29),k<2?(k===0?-.29:.29):0,.351);local.multiplyScalar(sc).applyQuaternion(bq).add(v);dummy.position.copy(local);dummy.quaternion.copy(bq);if(k>=2)dummy.rotateZ(Math.PI/2);dummy.updateMatrix();bars.setMatrixAt(i*4+k,dummy.matrix);dummy.quaternion.copy(bq)}
 }
 shards.instanceMatrix.needsUpdate=true;bars.instanceMatrix.needsUpdate=true;barMat.opacity=.28+finish*.18;
 signatureOffset.set(0,0,1.7).applyQuaternion(rot);sig.position.copy(boxCenter).add(signatureOffset);sig.quaternion.copy(rot);sig.visible=ex<.15||finish>.92;sigMat.opacity=(1-ex)+finish;
 orbit.material.uniforms.uOpacity.value=.85*(1-smooth(.15,.43,p));dust.material.uniforms.uOpacity.value=.40*(1-flight);orbit.visible=p<.47;dust.visible=p<.65;orbitRings.visible=p<.42;orbitRings.rotation.z=.22+t*.025;orbitRings.children.forEach((r,i)=>r.material.opacity=(.24-i*.045)*(1-ex));
 const tunnelAlpha=smooth(.17,.39,p)*(1-smooth(.64,.84,p));tunnel.material.uniforms.uOpacity.value=tunnelAlpha*.95;tunnel.material.uniforms.uFlow.value=reduced?.1:2+8*Math.sin(flight*Math.PI);sm.opacity=tunnelAlpha*.19;streaks.rotation.z=t*.009;streaks.position.z=reduced?0:(t*.5)%4;
 stars.material.uniforms.uOpacity.value=.45+finish*.15;
 for(const x of [stars,orbit,dust,tunnel]){x.material.uniforms.uTime.value=t;x.material.uniforms.uPixel.value=Math.min(2,renderer.getPixelRatio?renderer.getPixelRatio():1)}
 for(let j=0;j<3;j++){const z=portals[j];z.pm.uniforms.uTime.value=t;z.pm.uniforms.uOpacity.value=world;z.group.rotation.y=Math.sin(t*.13+j)*.065+mx*.025;z.rs.forEach((r,k)=>{r.material.opacity=world*(k===1?.45:.1);r.rotation.x=Math.sin(t*.1+j)*.03});z.cloud.material.uniforms.uTime.value=t;z.cloud.material.uniforms.uOpacity.value=world*.85;z.cloud.material.uniforms.uPixel.value=Math.min(2,renderer.getPixelRatio?renderer.getPixelRatio():1)}
 }
 function resize(w,h){W=w;H=h;camera.aspect=w/h;camera.updateProjectionMatrix()}
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;scene.remove(root);shards.dispose();bars.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear()}
 return {update,resize,dispose};
}
