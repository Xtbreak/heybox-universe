// A procedural ice block that grows around the closing black box at the end of
// the journey: faceted shell with fake internal fractures plus quartz-like
// shards that crystallise from the bottom up. No textures, no extra passes.
const NOISE = `
float iceHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float iceNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(iceHash(i),iceHash(i+vec3(1,0,0)),f.x),mix(iceHash(i+vec3(0,1,0)),iceHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(iceHash(i+vec3(0,0,1)),iceHash(i+vec3(1,0,1)),f.x),mix(iceHash(i+vec3(0,1,1)),iceHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float iceFbm(vec3 p){return iceNoise(p)*.62+iceNoise(p*2.13+4.1)*.38;}`;

const VERTEX = `
uniform float uGrow;
varying vec3 vWorld,vLocal;varying float vOrder,vGrowth;
#ifdef SHARD
attribute float aDelay;
#endif
void main(){
  vec3 p=position;float growth=1.;
#ifdef SHARD
  growth=clamp((uGrow*1.3-aDelay)/.24,0.,1.);growth=growth*growth*(3.-2.*growth);
  p.y*=growth;p.xz*=mix(.25,1.,growth);
  vec4 local=instanceMatrix*vec4(p,1.);vOrder=aDelay;
#else
  vec4 local=vec4(p,1.);vOrder=(p.y+2.25)/4.6;
#endif
  vLocal=local.xyz;vGrowth=growth;
  vec4 world=modelMatrix*local;vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;

const FRAGMENT = `
uniform float uGrow,uTime,uAlpha;uniform vec2 uPointer;
varying vec3 vWorld,vLocal;varying float vOrder,vGrowth;
${NOISE}
void main(){
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  vec3 v=normalize(cameraPosition-vWorld);if(dot(n,v)<0.)n=-n;
  float order=vOrder;
#ifndef SHARD
  order+=(iceFbm(vLocal*1.7)-.5)*.42;
#endif
  float front=uGrow*1.3-order;
#ifdef SHARD
  if(vGrowth<.002)discard;
#else
  if(front<0.)discard;
#endif
  float rim=1.-smoothstep(0.,.07,front);
  float fres=pow(1.-max(0.,dot(n,v)),2.6);
  vec3 r=refract(-v,n,.76);float veins=0.,bubbles=0.;
  for(int i=1;i<=3;i++){
    vec3 q=vLocal*.9+r*float(i)*.55+vec3(0.,0.,uTime*.012);
    float c=1.-abs(iceFbm(q*1.25)*2.-1.);veins+=pow(c,26.)*1.4/float(i);
    bubbles+=step(.965,iceHash(floor(q*7.)))*smoothstep(.4,0.,length(fract(q*7.)-.5))/float(i);
  }
  vec3 light=normalize(vec3(.35+uPointer.x*.6,.75+uPointer.y*.4,.55));
  vec3 refl=reflect(-v,n);float spec=pow(max(0.,dot(refl,light)),48.);
  float sky=.5+.5*refl.y;
  vec3 deep=vec3(.015,.055,.085),edge=vec3(.42,.72,.9);
  vec3 col=mix(deep,edge,fres*.85+sky*.12);
  col+=vec3(.55,.86,1.)*veins*.55+vec3(.8,.95,1.)*bubbles*.45;
  col+=vec3(.12,-.02,.16)*fres*sin(dot(n,vec3(9.,7.,5.))+uTime*.3)*.6;
  col+=vec3(1.,1.,1.1)*spec*1.6;
  col+=vec3(.55,1.05,1.7)*rim*1.6;
  float alpha=(.09+fres*.6+veins*.34+bubbles*.2+spec*.4+rim*.6)*uAlpha;
  gl_FragColor=vec4(col,clamp(alpha,0.,1.));
}`;

export function createIceVault({ THREE: T }) {
  const owned = new Set(), own = r => (owned.add(r), r);
  const group = new T.Group(); group.name = 'finale-ice-vault';
  const uniforms = { uGrow: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 }, uPointer: { value: new T.Vector2() } };
  const material = defines => own(new T.ShaderMaterial({ uniforms, defines, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    transparent: true, depthWrite: false, side: T.DoubleSide }));

  let seed = 90127; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  // Chunky block slightly larger than the closed core; displacement keyed on
  // position so shared edges between the six box faces stay sealed.
  const W = 3.9, H = 4.5, D = 2.1, center = new T.Vector3(.13, .23, .1);
  const shellGeo = new T.BoxGeometry(W, H, D, 5, 6, 3), pos = shellGeo.attributes.position, v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = [Math.round(v.x * 100), Math.round(v.y * 100), Math.round(v.z * 100)];
    const n = hash(...k) - .5, m = hash(k[2], k[0], k[1]) - .5;
    v.multiplyScalar(1 + n * .07); v.x += m * .09; v.z += n * .07;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const shell = new T.Mesh(own(shellGeo.toNonIndexed()), material({})); shellGeo.dispose();
  shell.renderOrder = 10; shell.raycast = () => {}; group.add(shell);

  const shardGeo = own(new T.OctahedronGeometry(1, 0)); shardGeo.translate(0, 1, 0);
  const COUNT = 96, delays = new Float32Array(COUNT);
  const shards = new T.InstancedMesh(shardGeo, material({ SHARD: '' }), COUNT);
  const dummy = new T.Object3D(), up = new T.Vector3(0, 1, 0), dir = new T.Vector3(), base = new T.Vector3();
  for (let i = 0; i < COUNT; i++) {
    // Most crystals root along the base and lower faces; a few crown the top edge.
    const crown = i % 6 === 0, face = Math.floor(random() * 4);
    const y = crown ? H / 2 : -H / 2 + Math.pow(random(), 1.8) * H * .7;
    const s = (random() - .5) * 2;
    if (face === 0) base.set(s * W / 2, y, D / 2), dir.set(0, 0, 1);
    else if (face === 1) base.set(s * W / 2, y, -D / 2), dir.set(0, 0, -1);
    else if (face === 2) base.set(W / 2, y, s * D / 2), dir.set(1, 0, 0);
    else base.set(-W / 2, y, s * D / 2), dir.set(-1, 0, 0);
    dir.y += crown ? 1.4 : (y < -H * .3 ? -.25 : .35); dir.x += (random() - .5) * .9; dir.z += (random() - .5) * .9; dir.normalize();
    dummy.position.copy(base).multiplyScalar(.96);
    dummy.quaternion.setFromUnitVectors(up, dir);
    const len = (crown ? .35 : .25) + random() * (y < 0 ? .75 : .45), girth = .07 + random() * .1;
    dummy.scale.set(girth, len * .5, girth); dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix);
    delays[i] = Math.min(1, (y + H / 2) / H * .85 + random() * .15);
  }
  shardGeo.setAttribute('aDelay', new T.InstancedBufferAttribute(delays, 1));
  shards.renderOrder = 11; shards.frustumCulled = false; shards.raycast = () => {}; own(shards); group.add(shards);
  for (const child of [shell, shards]) child.position.copy(center);

  function update({ grow = 0, alpha = 1, time = 0, pointerX = 0, pointerY = 0, visible = true } = {}) {
    const g = Math.max(0, Math.min(1, grow));
    group.visible = visible && g > .001 && alpha > .001;
    uniforms.uGrow.value = g; uniforms.uAlpha.value = alpha; uniforms.uTime.value = time;
    uniforms.uPointer.value.set(pointerX, pointerY);
  }
  return { group, update, dispose() { group.removeFromParent(); owned.forEach(r => r.dispose?.()); owned.clear(); } };
}
