// The opening Heybox as big weathered bricks. They lie scattered on the regolith, lift and
// stack themselves into a cube, breathe (seams open and leak ice light from a core lamp),
// then every brick that is not part of the mark pops out and drops onto the moon in a
// puff of dust. The mark keeps breathing until the scroll shatters it into grains.
import { NOISE_GLSL } from './lunar-opening.js?v=journey-39';

export const BX = 12, BY = 12, BZ = 6, BRICKS = BX * BY * BZ;
export const ASSEMBLE = { start: .3, spread: 2.4, dur: .95 }, SHED_AT = 4.6, SHED = { spread: 1.8, dur: 1.05 };
const LAND = SHED.dur * (.15 + .85 / 1.12);
const clamp = x => Math.max(0, Math.min(1, x));

const HEAD = `attribute vec3 aSlot;attribute vec4 aStart,aGround,aInfo,aMore;
uniform float uSince,uShed,uP,uTime,uBreathe,uPeel,uAspect,uTremble,uFlash,uGlow,uSize;uniform vec2 uLeave,uPointer;uniform mat4 uAnchor;uniform vec3 uHalf;
varying vec3 vbLocal,vbIn,vbWorld;varying float vbGlow,vbSeed;
mat3 bkAxis(vec3 a,float r){float c=cos(r),s=sin(r),t=1.-c;return mat3(t*a.x*a.x+c,t*a.x*a.y+s*a.z,t*a.x*a.z-s*a.y,t*a.x*a.y-s*a.z,t*a.y*a.y+c,t*a.y*a.z+s*a.x,t*a.x*a.z+s*a.y,t*a.y*a.z-s*a.x,t*a.z*a.z+c);}
mat3 bkOrtho(mat3 m){vec3 x=normalize(m[0]);vec3 y=normalize(m[1]-x*dot(x,m[1]));return mat3(x,y,cross(x,y));}
mat3 bkLay(float yaw,float tilt){float c=cos(yaw),s=sin(yaw),ct=cos(tilt),st=sin(tilt);return mat3(c,0.,-s,0.,1.,0.,s,0.,c)*mat3(1.,0.,0.,0.,ct,st,0.,-st,ct);}`;
const f = n => n.toFixed(4);
const STATE = `float s1=aInfo.w,s2=aMore.x,zs=aMore.y,shed=aInfo.y;
vec3 rel=aSlot/uHalf,ar=abs(rel);
vec3 outA=ar.x>ar.y&&ar.x>ar.z?vec3(sign(rel.x),0.,0.):ar.y>ar.z?vec3(0.,sign(rel.y),0.):vec3(0.,0.,sign(rel.z));
// Breathing: a slow wave from the core opens and closes the seams.
float open=(.5+.5*sin(uTime*1.2-length(aSlot)*2.6+s1*.8))*uBreathe;
vec3 jit=vec3(s1,s2,fract(s1*5.31+s2*2.7))-.5;
vec3 loc=aSlot*(1.+.075*open)+jit*uTremble*.05*sin(uTime*47.+s1*40.);
mat3 Ra=mat3(uAnchor);float sA=length(Ra[0]);mat3 Rn=mat3(Ra[0]/sA,Ra[1]/sA,Ra[2]/sA);
vec3 A=(uAnchor*vec4(loc,1.)).xyz;
// Assembly: lift off the regolith, arc over and seat in the slot.
float ta=clamp((uSince-(${f(ASSEMBLE.start)}+aInfo.x*${f(ASSEMBLE.spread)}))/${f(ASSEMBLE.dur)},0.,1.),ea=1.-pow(1.-ta,3.),flying=step(.0001,ta)*(1.-step(.999,ta));
vec3 P=mix(aStart.xyz,A,ea)+vec3(0.,sin(3.14159*ta)*(.6+s2*.9),0.);
vec3 ax=normalize(jit+vec3(.001,.002,.003));
mat3 R=bkAxis(ax,(1.-ea)*(3.+s1*5.)*step(.0001,ta))*bkOrtho(bkLay(aStart.w,(s2-.5)*.5)*(1.-ea)+Rn*ea);
// Shedding: pop out of the face, tumble down, hop once and rest on the ground.
float ts=shed<0.?0.:clamp((uShed-shed*${f(SHED.spread)})/${f(SHED.dur)},0.,1.),dd=0.;
if(ts>0.){float pop=smoothstep(0.,.22,ts);vec3 P0=A+Rn[2]*zs*pop*(.22+.2*s2);
  float fl=clamp((ts-.15)/.85,0.,1.);dd=min(1.,fl*1.12);float ho=1.-(1.-dd)*(1.-dd);
  P=vec3(mix(P0.x,aGround.x,ho),P0.y+(aGround.y-P0.y)*dd*dd,mix(P0.z,aGround.z,ho));P.y+=.07*sin(3.14159*clamp((fl-.89)/.11,0.,1.));
  R=bkAxis(ax,sin(3.14159*dd)*(2.+s1*4.)+pop*(s2-.5)*.7)*bkOrtho(Rn*(1.-ho)+bkLay(aGround.w,(s1-.5)*.45)*ho);}
float att=step(.999,ta)*(1.-step(.0001,ts));
#ifdef BK_DEPTH
float peel=0.;
#else
vec4 clip=projectionMatrix*modelViewMatrix*vec4(P,1.);vec2 dp=(clip.xy/max(.001,clip.w)-uPointer)*vec2(uAspect,1.);
float peel=exp(-dot(dp,dp)*40.)*uPeel*att;
#endif
P+=Rn*outA*peel*(.1+s1*.16);
// The mark hands over to the grains brick by brick.
float vis=shed<0.?step(uP,mix(uLeave.x,uLeave.y,aInfo.z)):1.;
float scl=uSize*sA*vis;
vbLocal=position;vbIn=transpose(R)*(Rn*normalize(-aSlot+.0001));vbSeed=s1;
vbGlow=att*(uGlow*(.12+1.1*open)+uFlash*2.+uTremble*2.4)+peel*1.4+flying*.12+(1.-dd)*step(.0001,ts)*.25;
vbWorld=(modelMatrix*vec4(P,1.)).xyz;`;

// Unit rounded box: a 5-segment box whose rows are pulled to the edges, then spherified.
function roundedBox(T, r = .14) {
  const g = new T.BoxGeometry(1, 1, 1, 5, 5, 5), p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3();
  const remap = x => { const a = Math.abs(x), s = Math.sign(x); return a > .45 ? x : a > .25 ? s * (.5 - r * .5) : s * (.5 - r); };
  for (let i = 0; i < p.count; i++) {
    v.set(remap(p.getX(i)), remap(p.getY(i)), remap(p.getZ(i)));
    c.set(Math.max(-.5 + r, Math.min(.5 - r, v.x)), Math.max(-.5 + r, Math.min(.5 - r, v.y)), Math.max(-.5 + r, Math.min(.5 - r, v.z)));
    const d = v.clone().sub(c); if (d.lengthSq() < 1e-9) continue; d.normalize(); v.copy(c).addScaledVector(d, r); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d.x, d.y, d.z);
  }
  return g;
}

export function createBrickHero({ THREE: T, root, heroAnchor, lunar, mask, pitch, voxels, keep }) {
  const P = pitch, half = new T.Vector3(BX * P / 2, BY * P / 2, BZ * P / 2);
  let seed = 77113; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const slot = new Float32Array(BRICKS * 3), start = new Float32Array(BRICKS * 4), ground = new Float32Array(BRICKS * 4), info = new Float32Array(BRICKS * 4), more = new Float32Array(BRICKS * 4);
  const logo = [], G = heroAnchor.position;
  for (let i = 0; i < BRICKS; i++) {
    const ix = i % BX, iy = Math.floor(i / BX) % BY, iz = Math.floor(i / (BX * BY));
    slot.set([(ix - (BX - 1) / 2) * P, (iy - (BY - 1) / 2) * P, (iz - (BZ - 1) / 2) * P], i * 3);
    const inMark = !!mask[iy * BX + ix], zDepth = Math.min(iz, BZ - 1 - iz);
    if (inMark) logo.push(i);
    // Rubble field around the plinth, half sunk into the regolith.
    const a = rand() * 6.2832, r = 1.7 + Math.pow(rand(), .9) * 4.2, x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r * .9;
    start.set([x, lunar.heightAt(x, z) + P * .3, z, rand() * 6.2832], i * 4);
    info.set([clamp(iy / (BY - 1) * .8 + rand() * .2), inMark ? -1 : clamp(zDepth / 3 * .72 + (1 - iy / (BY - 1)) * .1 + rand() * .18), clamp(rand() * .7 + (1 - iz / (BZ - 1)) * .3), rand()], i * 4);
    more.set([rand(), iz < BZ / 2 ? -1 : 1, zDepth, 0], i * 4);
  }
  // The grains that replace each mark brick when it shatters: a 3×3×3 split of the brick.
  const shards = new Float32Array(voxels * 3), shardOrder = new Float32Array(voxels);
  for (let i = 0; i < voxels; i++) {
    const b = logo[i % logo.length], sub = Math.floor(i / logo.length) % 27, o = [sub % 3 - 1, Math.floor(sub / 3) % 3 - 1, Math.floor(sub / 9) - 1];
    for (let k = 0; k < 3; k++) shards[i * 3 + k] = slot[b * 3 + k] + o[k] * P / 3;
    shardOrder[i] = info[b * 4 + 2];
  }
  const cube = keep(roundedBox(T)), geo = keep(new T.InstancedBufferGeometry());
  geo.index = cube.index; for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, cube.attributes[k]);
  const attr = (name, array, size) => { const a = new T.InstancedBufferAttribute(array, size); geo.setAttribute(name, a); return a; };
  attr('aSlot', slot, 3); attr('aStart', start, 4); const groundAttr = attr('aGround', ground, 4); attr('aInfo', info, 4); attr('aMore', more, 4);
  geo.instanceCount = BRICKS;
  const uniforms = {
    uSince: { value: 0 }, uShed: { value: -1 }, uP: { value: 0 }, uTime: { value: 0 }, uBreathe: { value: 1 }, uPeel: { value: 0 }, uAspect: { value: 1 }, uTremble: { value: 0 }, uFlash: { value: 0 }, uGlow: { value: 1 },
    uSize: { value: P * .94 }, uLeave: { value: new T.Vector2(.088, .15) }, uPointer: { value: new T.Vector2(9, 9) }, uAnchor: { value: new T.Matrix4() }, uHalf: { value: half },
    uAccent: { value: new T.Color(0x8fdcff) }, uFade: lunar.uniforms.uFade, uCenter: lunar.uniforms.uCenter
  };
  // Weathered basalt: mottled albedo, chipped light edges, pits, a fine bump; seams glow.
  const material = keep(new T.MeshStandardMaterial({ color: 0x17191c, roughness: .72, metalness: .05, envMapIntensity: .35 }));
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <beginnormal_vertex>', STATE + '\nvec3 objectNormal=R*normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=R*(position*scl)+P;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec3 uAccent,uCenter;uniform float uFade;varying vec3 vbLocal,vbIn,vbWorld;varying float vbGlow,vbSeed;\n${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(uFade<.999){float far=clamp(length(vbWorld.xz-uCenter.xz)/48.,0.,1.);if(lnN(vbWorld*1.7)*.4+far*.6>uFade*1.02)discard;}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 la=abs(vbLocal);float mid=max(min(la.x,la.y),min(max(la.x,la.y),la.z));
        vec3 q=vbLocal*2.4+vbSeed*31.;float n1=lnF(q*1.6),n2=lnN(q*6.5),pit=smoothstep(.7,.88,lnN(q*15.+3.));float worn=smoothstep(.4,.5,mid);
        diffuseColor.rgb*=.5+.85*n1+.25*(n2-.5);diffuseColor.rgb+=vec3(.05,.055,.06)*worn*smoothstep(.4,.8,n2);diffuseColor.rgb*=1.-.5*pit;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(.58+.35*n2-.2*worn,.3,.95);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=lnBump(normal,-vViewPosition,(n1*.5+n2*.3+pit*.25)*.012);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 fn=la.x>la.y&&la.x>la.z?vec3(sign(vbLocal.x),0.,0.):la.y>la.z?vec3(0.,sign(vbLocal.y),0.):vec3(0.,0.,sign(vbLocal.z));
        // Only faces turned towards the core catch its light, i.e. the insides of the seams.
        float inner=max(0.,dot(fn,normalize(vbIn))),edge=smoothstep(.45,.5,mid);
        totalEmissiveRadiance+=uAccent*vbGlow*(inner*inner*1.4+edge*inner*.6)*(.75+.5*n2);`);
  };
  material.customProgramCacheKey = () => 'brick-hero-1';
  const depth = keep(new T.MeshDepthMaterial()); depth.defines = { BK_DEPTH: '' };
  depth.onBeforeCompile = shader => { Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD).replace('#include <begin_vertex>', STATE + '\nvec3 transformed=R*(position*scl)+P;'); };
  depth.customProgramCacheKey = () => 'brick-hero-depth-1';
  const mesh = new T.Mesh(geo, material); mesh.name = 'brick-heybox'; mesh.customDepthMaterial = depth; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh);

  // Regolith dust: puffs where a brick lifts off, and where a shed brick lands.
  const lifts = 3, lands = 5, dustCount = BRICKS * lifts + (BRICKS - logo.length) * lands;
  const dustPos = new Float32Array(dustCount * 3), dustInfo = new Float32Array(dustCount * 4), landing = [];
  let d = 0;
  for (let i = 0; i < BRICKS; i++) {
    for (let k = 0; k < lifts; k++, d++) { dustPos.set([start[i * 4], start[i * 4 + 1] - P * .3, start[i * 4 + 2]], d * 3); dustInfo.set([0, ASSEMBLE.start + info[i * 4] * ASSEMBLE.spread, rand(), rand()], d * 4); }
    if (info[i * 4 + 1] >= 0) for (let k = 0; k < lands; k++, d++) { landing.push([d, i]); dustInfo.set([1, info[i * 4 + 1] * SHED.spread + LAND, rand(), rand()], d * 4); }
  }
  const dustGeo = keep(new T.BufferGeometry()); const dustAttr = new T.BufferAttribute(dustPos, 3); dustGeo.setAttribute('position', dustAttr); dustGeo.setAttribute('aDust', new T.BufferAttribute(dustInfo, 4));
  const dustMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uSince: uniforms.uSince, uShed: uniforms.uShed, uView: { value: 800 }, uAlpha: { value: 1 } },
    vertexShader: `attribute vec4 aDust;uniform float uSince,uShed,uView,uAlpha;varying float vA;
      void main(){float age=(aDust.x<.5?uSince:uShed)-aDust.y;float on=step(0.,age)*step(age,2.6);age=max(age,0.);
        float a=aDust.z*6.2832,R=(.12+.5*aDust.w)*(1.-exp(-age*2.6));
        vec3 p=position+vec3(cos(a)*R,.04+.22*aDust.w*(1.-exp(-age*1.6))+age*.025,sin(a)*R);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp((.07+.16*age)*projectionMatrix[1][1]*uView*.5/max(.2,-mv.z),1.,90.);
        vA=on*uAlpha*smoothstep(0.,.06,age)*(1.-smoothstep(.5,2.6,age))*(.18+.14*aDust.w)*(aDust.x<.5?.45:1.);}`,
    fragmentShader: 'varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(.62,.6,.57),vA*(1.-smoothstep(.1,.5,r)));}' }));
  const dust = new T.Points(dustGeo, dustMat); dust.frustumCulled = false; dust.renderOrder = 3; dust.raycast = () => {}; root.add(dust);

  // The core lamp: lights the inner faces through the open seams and spills onto the ground.
  const core = new T.PointLight(0x8fdcff, 0, 7, 2); core.name = 'brick-core-light'; heroAnchor.add(core);

  const inv = new T.Matrix4(), m = new T.Matrix4(), v = new T.Vector3(), xa = new T.Vector3(), za = new T.Vector3();
  let grounded = false;
  // Landing spots are fixed once, from the box pose at the moment it starts to shed.
  function settle() {
    grounded = true; const e = uniforms.uAnchor.value.elements, sA = Math.hypot(e[0], e[1], e[2]);
    xa.set(e[0], e[1], e[2]).normalize(); za.set(e[8], e[9], e[10]).normalize();
    for (let i = 0; i < BRICKS; i++) {
      if (info[i * 4 + 1] < 0) continue;
      v.set(slot[i * 3], slot[i * 3 + 1], slot[i * 3 + 2]).applyMatrix4(uniforms.uAnchor.value);
      const zs = more[i * 4 + 1], reach = .45 + Math.pow(rand(), 1.3) * 2.5 + more[i * 4 + 2] * .25;
      v.addScaledVector(za, zs * reach).addScaledVector(xa, (rand() - .5) * 1.3);
      const stack = Math.floor(Math.pow(rand(), 3) * 2.5) * P * sA * .8;
      ground.set([v.x, lunar.heightAt(v.x, v.z) + P * sA * .4 + stack, v.z, rand() * 6.2832], i * 4);
    }
    for (const [k, i] of landing) dustPos.set([ground[i * 4], ground[i * 4 + 1] - P * .4, ground[i * 4 + 2]], k * 3);
    groundAttr.needsUpdate = true; dustAttr.needsUpdate = true;
  }
  function update({ since = 0, shed = -1, progress = 0, time = 0, reduced = false, quality = 'standard', pointer, peel = false, aspect = 1, flash = 0, tremble = 0, height = 800, visible = true }) {
    mesh.visible = dust.visible = visible; core.visible = visible;
    if (!visible) return;
    root.updateWorldMatrix(true, false); heroAnchor.updateWorldMatrix(true, false);
    inv.copy(root.matrixWorld).invert(); uniforms.uAnchor.value.multiplyMatrices(inv, heroAnchor.matrixWorld);
    if (shed > 0 && !grounded) settle();
    const u = uniforms; u.uSince.value = since; u.uShed.value = shed; u.uP.value = progress; u.uTime.value = reduced ? 0 : time; u.uBreathe.value = reduced ? 0 : 1;
    u.uPeel.value = peel && !reduced ? 1 : 0; if (pointer) u.uPointer.value.copy(pointer); u.uAspect.value = aspect;
    u.uTremble.value = reduced ? 0 : tremble; u.uFlash.value = flash; u.uGlow.value = quality === 'ultra' ? 1.25 : 1;
    dustMat.uniforms.uView.value = height * Math.min(2, globalThis.devicePixelRatio || 1);
    // The lamp swells with the breath and fades as the mark gives way.
    const assembled = clamp((since - ASSEMBLE.start - ASSEMBLE.spread * .5) / 1.5), gone = clamp((progress - .088) / .05);
    core.intensity = assembled * (1 - gone) * (reduced ? 2.4 : 1.6 + 1.6 * (.5 + .5 * Math.sin(time * 1.2))) * (1 + 3 * flash + 2 * tremble);
  }
  return { mesh, update, shards, shardOrder, half, logoCount: logo.length,
    dispose() { mesh.removeFromParent(); dust.removeFromParent(); core.removeFromParent(); core.dispose?.(); } };
}
