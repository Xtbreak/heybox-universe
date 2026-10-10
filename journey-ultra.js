import { riftEnvelope } from './cinematic-pass.js?v=journey-22';

const smooth = (a, b, p) => { const t = Math.max(0, Math.min(1, (p - a) / (b - a))); return t*t*(3-2*t); };
export function createJourneyUltra({ THREE: T, root, camera, entries, core, closingCore }) {
  const owned = new Set(), own = resource => (owned.add(resource), resource);
  const group = new T.Group(); group.name = 'ultra-homepage-effects'; root.add(group);
  const riftSection = globalThis.document?.querySelector('#time-rift');
  const start = Number(riftSection?.dataset.p) || .66, end = Number(riftSection?.dataset.end) || .77;
  let enabled = false, clock = 0, disposed = false;
  let seed = 221198; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

  // A single instanced draw call. Camera-relative streaks have genuine perspective depth.
  const streakGeo = own(new T.InstancedBufferGeometry());
  const quad = own(new T.PlaneGeometry(1, 1));
  streakGeo.index = quad.index; streakGeo.attributes = { ...quad.attributes };
  const seeds = new Float32Array(1600 * 4);
  for (let i = 0; i < 1600; i++) seeds.set([random()*Math.PI*2, 4+random()*19, random(), .45+random()], i*4);
  streakGeo.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 4)); streakGeo.instanceCount = 1600;
  const tunnelMat = own(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { uTime:{value:0}, uTravel:{value:0}, uPower:{value:0}, uMix:{value:0} },
    vertexShader:`attribute vec4 aSeed;uniform float uTime,uTravel,uPower;varying vec2 vUv,vScreen;
      void main(){vUv=uv;float a=aSeed.x;float z=-3.-fract(aSeed.z-uTravel*.7-uTime*.09)*115.;
      float len=(1.+uPower*13.)*aSeed.w;vec3 p=vec3(cos(a)*aSeed.y,sin(a)*aSeed.y,z);
      p.xy+=vec2(-sin(a),cos(a))*position.x*.027*aSeed.w;p.z+=position.y*len;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);vScreen=gl_Position.xy/gl_Position.w*.5+.5;}`,
    fragmentShader:`uniform float uPower,uMix;varying vec2 vUv,vScreen;
      void main(){float edge=pow(1.-abs(vUv.x*2.-1.),1.5);float tail=sin(vUv.y*3.14159);
      float title=smoothstep(.16,.43,length((vScreen-vec2(.5,.51))*vec2(1.,1.4)));
      vec3 color=mix(vec3(.3,1.9,3.6),vec3(3.1,.24,2.2),uMix);
      gl_FragColor=vec4(color,edge*tail*uPower*(.12+title*.88));}`
  }));
  const tunnel = new T.Mesh(streakGeo, tunnelMat); tunnel.name = 'hyperspace-light-tunnel';
  tunnel.frustumCulled = false; tunnel.raycast = () => {}; group.add(tunnel);

  const charge = new T.Group(); charge.name = 'inward-energy-charge'; group.add(charge);
  const energyMat = own(new T.ShaderMaterial({
    transparent:true, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide,
    uniforms:{uTime:{value:0},uPower:{value:0},uColor:{value:new T.Color()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime,uPower;uniform vec3 uColor;
      void main(){float flow=pow(.5+.5*sin(vUv.x*52.-uTime*(2.+uPower*10.)),4.);
      gl_FragColor=vec4(uColor*(1.4+uPower*2.7+flow),(.18+flow*.72)*uPower);}`
  }));
  const ringGeo = own(new T.TorusGeometry(1, .008, 5, 96));
  const rings = Array.from({length:3},()=>{const ring=new T.Mesh(ringGeo,energyMat);charge.add(ring);ring.raycast=()=>{};return ring;});
  const sparkGeo = own(new T.BufferGeometry()), sparkSeeds = new Float32Array(480*3);
  for(let i=0;i<480;i++)sparkSeeds.set([random(),random(),random()],i*3);
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkSeeds,3));
  const sparkMat = own(new T.ShaderMaterial({
    uniforms:energyMat.uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime,uPower;varying float vAlpha;
      void main(){float q=fract(position.z+uTime*.28);float a=position.x*6.283+uTime*(.4+uPower*2.);
      float r=(1.-q)*(.9+position.y*.9);vec3 p=vec3(cos(a)*r,sin(a)*r,(position.y-.5)*.5);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.+uPower*2.;vAlpha=q*(1.-q)*4.*uPower;}`,
    fragmentShader:`uniform vec3 uColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);
      gl_FragColor=vec4(uColor*3.5,(1.-smoothstep(.08,.5,r))*vAlpha);}`
  }));
  const sparks=new T.Points(sparkGeo,sparkMat);sparks.frustumCulled=false;sparks.raycast=()=>{};charge.add(sparks);
  const bounds=new T.Box3(),size=new T.Vector3();

  // Four existing parting lines are duplicated as thin HDR guides. Source geometry is borrowed.
  const seamMat=own(energyMat.clone());seamMat.uniforms.uColor.value.setRGB(.32,1.5,2.8);
  const seamCopies=[]; const attached=new WeakSet();
  for(const assembly of [core,closingCore]) assembly.ready?.then(()=>{
    if(disposed)return;
    assembly.group.traverse(node=>{
      if(!/circumferential-shell-seam/.test(node.name)||!node.isMesh||attached.has(node))return;
      attached.add(node);const copy=new T.Mesh(node.geometry,seamMat);copy.name='ultra-flowing-seam';
      copy.userData.journeyIgnore=true;copy.raycast=()=>{};node.add(copy);seamCopies.push(copy);
      copy.visible=enabled;
    });
  });

  function setQuality(value) {
    enabled=value==='ultra';group.visible=enabled;
    for(const copy of seamCopies)copy.visible=enabled;
  }
  function update({progress=0,time=0,dt=0,reduced=false,quality='standard',hoverTarget,hoverProgress=0}={}) {
    if(disposed)return;setQuality(quality);if(!enabled)return;
    clock=reduced?0:time;
    tunnel.position.copy(camera.position);tunnel.quaternion.copy(camera.quaternion);
    const power=riftEnvelope(progress,start,end),phase=Math.max(0,Math.min(1,(progress-start)/(end-start)));
    tunnel.visible=progress>start&&progress<end;
    tunnelMat.uniforms.uPower.value=power*(reduced?.28:1);
    tunnelMat.uniforms.uTime.value=clock;tunnelMat.uniforms.uTravel.value=reduced?0:phase*phase*7;
    tunnelMat.uniforms.uMix.value=Math.sin(phase*Math.PI)**2;
    const source=entries[hoverTarget]?.object;
    charge.visible=!!source&&hoverProgress>0&&!reduced;
    if(charge.visible){
      source.updateWorldMatrix(true,true);bounds.setFromObject(source);bounds.getCenter(charge.position);bounds.getSize(size);
      charge.quaternion.copy(camera.quaternion);charge.scale.setScalar(Math.max(size.x,size.y,size.z)*.63);
      energyMat.uniforms.uColor.value.set(hoverTarget==='robot'?0xffad52:hoverTarget==='car'?0xff713b:0x73deff);
      energyMat.uniforms.uTime.value=clock;energyMat.uniforms.uPower.value=hoverProgress;
      for(let i=0;i<rings.length;i++){const ring=rings[i];ring.scale.setScalar(1.35+i*.18-hoverProgress*.40);ring.rotation.set(.17*i,.24*i,clock*(.3+hoverProgress*2)*(i%2?-1:1));}
    }
    seamMat.uniforms.uTime.value=clock;
    seamMat.uniforms.uPower.value=.44+.5*smooth(.02,.18,progress);
  }
  setQuality('standard');
  return {update,setQuality,rift:p=>riftEnvelope(p,start,end),end,
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const copy of seamCopies)copy.removeFromParent();seamCopies.length=0;for(const resource of owned)resource.dispose?.();owned.clear();}
  };
}
