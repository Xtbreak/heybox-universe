// The opening Heybox, entering the way igloo.inc's igloo does: first a line drawing of every
// brick (brick-blueprint.js), then a scan plane sinks through it and the bricks are solid,
// white-hot where it has just passed, cooling to graphite. The box is a shell of big,
// bevelled bricks in running bond with interlocking corners; inside it sits the mark, built
// of small bricks. The shell breathes (its seams leak ice light from a core lamp), then burns
// away brick by brick into fine glitter, front first, and the mark is left. The mark keeps
// breathing until the scroll shatters it into grains.
import { NOISE_GLSL } from './lunar-opening.js?v=journey-41';
import { createBlueprint } from './brick-blueprint.js?v=journey-41';

export const BX = 12, BY = 12, LZ = 6;
// Seconds after the loading line clears.
export const INTRO = { draw: [.25, 2.1], net: [.45, 2.4, 3.6, 5.6], scan: [2, 3.4], ground: [2.9, 5.6], camera: [.1, 5.8], shed: 6.2 };
export const SHED_AT = INTRO.shed, SHED = { spread: 1.1, dur: .95 };
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const f = n => n.toFixed(4);
const NOISE_V = NOISE_GLSL.split('\nvec3 lnBump')[0];

const HEAD = `attribute vec3 aSlot;attribute vec4 aHalf,aInfo,aMore;
uniform float uShed,uP,uTime,uBreathe,uPeel,uAspect,uTremble,uFlash,uGlow,uScan;uniform vec2 uLeave,uPointer;uniform mat4 uAnchor;uniform vec3 uHalf;
varying vec3 vbLocal,vbIn,vbWorld,vbH,vbN;varying float vbGlow,vbSeed,vbAy,vbTs;
mat3 bkAxis(vec3 a,float r){float c=cos(r),s=sin(r),t=1.-c;return mat3(t*a.x*a.x+c,t*a.x*a.y+s*a.z,t*a.x*a.z-s*a.y,t*a.x*a.y-s*a.z,t*a.y*a.y+c,t*a.y*a.z+s*a.x,t*a.x*a.z+s*a.y,t*a.y*a.z-s*a.x,t*a.z*a.z+c);}
${NOISE_V}`;
const STATE = `float s1=aInfo.w,s2=aMore.x,shed=aInfo.y,shell=step(0.,shed);vec3 nOut=aMore.yzw;
vec3 rel=aSlot/uHalf,ar=abs(rel);
vec3 outA=mix(ar.x>ar.y&&ar.x>ar.z?vec3(sign(rel.x),0.,0.):ar.y>ar.z?vec3(0.,sign(rel.y),0.):vec3(0.,0.,sign(rel.z)),nOut,shell);
// Breathing: the shell lifts off its faces and the mark swells, so every seam opens and closes.
float open=(.5+.5*sin(uTime*1.2-length(aSlot)*2.6+s1*.8))*uBreathe;
vec3 jit=vec3(s1,s2,fract(s1*5.31+s2*2.7))-.5,ax=normalize(jit+vec3(.001,.002,.003));
vec3 loc=aSlot*(1.+.05*open*(1.-shell))+nOut*open*.04+jit*uTremble*.05*sin(uTime*47.+s1*40.);
mat3 Ra=mat3(uAnchor);float sA=length(Ra[0]);mat3 Rn=mat3(Ra[0]/sA,Ra[1]/sA,Ra[2]/sA);
vec3 P=(uAnchor*vec4(loc,1.)).xyz;
// Hand-laid: every shell brick sits a hair off square.
mat3 Rl=bkAxis(ax,(s2-.5)*.04*shell),R=Rn*Rl;
// Burning away: drift off the face, turning, while the stone dissolves into glitter.
float ts=shell>.5?clamp((uShed-shed*${f(SHED.spread)})/${f(SHED.dur)},0.,1.):0.;
if(ts>0.){float e=1.-pow(1.-ts,2.);P+=(Rn*(nOut*(.25+.4*s2)+jit*.3)*e+vec3(0.,.12*e,0.))*sA;R=Rn*bkAxis(ax,e*(.6+s1*1.8))*Rl;}
float att=1.-step(.0001,ts);
#ifdef BK_DEPTH
float peel=0.;
#else
vec4 clip=projectionMatrix*modelViewMatrix*vec4(P,1.);vec2 dp=(clip.xy/max(.001,clip.w)-uPointer)*vec2(uAspect,1.);
float peel=exp(-dot(dp,dp)*40.)*uPeel*att;
#endif
P+=Rn*outA*peel*(.1+s1*.16)*sA;
// The mark hands over to the grains brick by brick.
float vis=shed<0.?step(uP,mix(uLeave.x,uLeave.y,aInfo.z)):1.-step(.999,ts);
float scl=sA*vis*(1.-.15*ts);
// Bevelled box of any size: the unit geometry's core is stretched, its rounded rim keeps radius aHalf.w.
vec3 cu=clamp(position,-.4,.4),lp=cu/.4*(aHalf.xyz-aHalf.w)+(position-cu)/.1*aHalf.w;
lp+=normal*(lnN(lp*11.+s1*37.)-.5)*.014*shell;
vbLocal=lp;vbH=aHalf.xyz;vbN=nOut;vbAy=aSlot.y+lp.y;vbSeed=s1;vbTs=ts;
vbIn=transpose(R)*(Rn*normalize(-aSlot+.0001));
vbGlow=att*(uGlow*(.12+1.1*open)+uFlash*2.+uTremble*2.4)+peel*1.4;
vbWorld=(modelMatrix*vec4(P,1.)).xyz;`;
const DISCARD = `if(vbAy<uScan)discard;
  float bkN=lnN(vbLocal*22.+vbSeed*40.),bkT=vbTs*1.25-.12;if(vbTs>0.&&bkN<bkT)discard;`;

// Unit box whose outer rows are pulled into a rim of radius .1 (the vertex shader rescales it).
function bevelBox(T) {
  const g = new T.BoxGeometry(1, 1, 1, 8, 8, 8), p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
  const remap = x => { const a = Math.abs(x), s = Math.sign(x); return a > .49 ? x : a > .37 ? s * .45 : x / .25 * .4; };
  for (let i = 0; i < p.count; i++) {
    v.set(remap(p.getX(i)), remap(p.getY(i)), remap(p.getZ(i)));
    c.set(Math.max(-.4, Math.min(.4, v.x)), Math.max(-.4, Math.min(.4, v.y)), Math.max(-.4, Math.min(.4, v.z)));
    d.copy(v).sub(c); if (d.lengthSq() < 1e-9) continue; d.normalize(); v.copy(c).addScaledVector(d, .1); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d.x, d.y, d.z);
  }
  return g;
}

export function createBrickHero({ THREE: T, root, heroAnchor, lunar, mask, pitch, voxels, keep }) {
  const P = pitch, G = heroAnchor.position;
  let seed = 77113; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const bricks = [];
  // The mark: small bricks on a grid, LZ deep.
  for (let iz = 0; iz < LZ; iz++) for (let iy = 0; iy < BY; iy++) for (let ix = 0; ix < BX; ix++) if (mask[iy * BX + ix])
    bricks.push({ c: [(ix - (BX - 1) / 2) * P, (iy - (BY - 1) / 2) * P, (iz - (LZ - 1) / 2) * P], h: [P * .47, P * .47, P * .47], r: .016, n: [0, 0, 0], shed: -1, leave: clamp(rand() * .7 + (1 - iz / (LZ - 1)) * .3) });
  const logoCount = bricks.length;
  // The shell: walls in running bond whose corners interlock course by course, and two capping layers.
  const t = .2, W = BX * P + 2 * t + .06, H = BY * P + 2 * t + .06, D = LZ * P + 2 * t + .06, L = W / 4, COURSES = 6, ch = (H - 2 * t) / COURSES;
  const split = (a, b, shift) => { const cuts = [a]; for (let x = Math.ceil((a - shift) / L) * L + shift; x < b - 1e-6; x += L) if (x - cuts[cuts.length - 1] > .15 && b - x > .15) cuts.push(x); cuts.push(b); return cuts.slice(1).map((x, i) => [cuts[i], x]); };
  const lay = (c, size, n) => { const gap = .009 + rand() * .006; bricks.push({ c, h: size.map(s => s / 2 - gap), r: .03, n, shed: 0 }); };
  for (let k = 0; k < COURSES; k++) {
    const y = -H / 2 + t + ch * (k + .5), even = k % 2 === 0, shift = even ? 0 : L / 2;
    for (const sz of [-1, 1]) for (const [a, b] of split(even ? -W / 2 : -W / 2 + t, even ? W / 2 : W / 2 - t, shift)) lay([(a + b) / 2, y, sz * (D - t) / 2], [b - a, ch, t], [0, 0, sz]);
    for (const sx of [-1, 1]) for (const [a, b] of split(even ? -D / 2 + t : -D / 2, even ? D / 2 - t : D / 2, shift)) lay([sx * (W - t) / 2, y, (a + b) / 2], [t, ch, b - a], [sx, 0, 0]);
  }
  const ROWS = 4, rw = D / ROWS;
  for (const sy of [-1, 1]) for (let r = 0; r < ROWS; r++) for (const [a, b] of split(-W / 2, W / 2, r % 2 ? L / 2 : 0)) lay([(a + b) / 2, sy * (H - t) / 2, -D / 2 + rw * (r + .5)], [b - a, t, rw], [0, sy, 0]);
  // Burn order: the front face from its middle outwards, then the sides and caps, the back last.
  for (const b of bricks) if (b.shed >= 0) { const [nx, ny, nz] = b.n; b.shed = clamp((nz > .5 ? Math.hypot(b.c[0], b.c[1]) / 1.6 * .45 : nz < -.5 ? .62 + Math.hypot(b.c[0], b.c[1]) / 1.6 * .25 : .32 + (1 - (b.c[2] + D / 2) / D) * .25) + rand() * .12); }
  const N = bricks.length, half = new T.Vector3(BX * P / 2, BY * P / 2, LZ * P / 2), size = new T.Vector3(W, H, D);
  const slot = new Float32Array(N * 3), halfs = new Float32Array(N * 4), info = new Float32Array(N * 4), more = new Float32Array(N * 4);
  bricks.forEach((b, i) => { slot.set(b.c, i * 3); halfs.set([...b.h, b.r], i * 4); info.set([0, b.shed, b.leave ?? 0, rand()], i * 4); more.set([rand(), ...b.n], i * 4); });
  // The grains that replace each mark brick when it shatters: a 3×3×3 split of the brick.
  const shards = new Float32Array(voxels * 3), shardOrder = new Float32Array(voxels);
  for (let i = 0; i < voxels; i++) {
    const b = i % logoCount, sub = Math.floor(i / logoCount) % 27, o = [sub % 3 - 1, Math.floor(sub / 3) % 3 - 1, Math.floor(sub / 9) - 1];
    for (let k = 0; k < 3; k++) shards[i * 3 + k] = slot[b * 3 + k] + o[k] * P / 3;
    shardOrder[i] = info[b * 4 + 2];
  }
  const unit = keep(bevelBox(T)), geo = keep(new T.InstancedBufferGeometry());
  geo.index = unit.index; for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, unit.attributes[k]);
  const attr = (name, array, size) => geo.setAttribute(name, new T.InstancedBufferAttribute(array, size));
  attr('aSlot', slot, 3); attr('aHalf', halfs, 4); attr('aInfo', info, 4); attr('aMore', more, 4);
  geo.instanceCount = N;
  const uniforms = {
    uShed: { value: -1 }, uP: { value: 0 }, uTime: { value: 0 }, uBreathe: { value: 1 }, uPeel: { value: 0 }, uAspect: { value: 1 }, uTremble: { value: 0 }, uFlash: { value: 0 }, uGlow: { value: 1 }, uScan: { value: 1e3 },
    uLeave: { value: new T.Vector2(.088, .15) }, uPointer: { value: new T.Vector2(9, 9) }, uAnchor: { value: new T.Matrix4() }, uHalf: { value: half },
    uAccent: { value: new T.Color(0x8fdcff) }, uFade: lunar.uniforms.uFade, uCenter: lunar.uniforms.uCenter
  };
  // Graphite stone: mottled, with mica flecks that catch the sun, chipped pale arrises and a fine
  // bump. Seams glow ice from the core; freshly scanned stone is white-hot; burning edges glitter.
  const material = keep(new T.MeshStandardMaterial({ color: 0x1b1d21, roughness: .7, metalness: .04, envMapIntensity: .35 }));
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <beginnormal_vertex>', STATE + '\nvec3 objectNormal=R*normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=R*(lp*scl)+P;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec3 uAccent,uCenter;uniform float uFade,uScan;varying vec3 vbLocal,vbIn,vbWorld,vbH,vbN;varying float vbGlow,vbSeed,vbAy,vbTs;\n${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(uFade<.999){float far=clamp(length(vbWorld.xz-uCenter.xz)/48.,0.,1.);if(lnN(vbWorld*1.7)*.4+far*.6>uFade*1.02)discard;}
        ${DISCARD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 la=abs(vbLocal)/max(vbH,vec3(.001))*.5;float mid=max(min(la.x,la.y),min(max(la.x,la.y),la.z));
        vec3 q=vbLocal*6.+vbSeed*31.;float n1=lnF(q*1.6),n2=lnN(q*6.5),pit=smoothstep(.72,.9,lnN(q*15.+3.)),mica=step(.975,lnH(floor(q*30.)));float worn=smoothstep(.42,.5,mid);
        diffuseColor.rgb*=.55+.8*n1+.22*(n2-.5);diffuseColor.rgb+=vec3(.055,.06,.068)*worn*smoothstep(.35,.8,n2)+vec3(.09,.1,.11)*mica;diffuseColor.rgb*=1.-.45*pit;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mica>.5?.22:clamp(.6+.32*n2-.2*worn,.3,.95);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=lnBump(normal,-vViewPosition,(n1*.5+n2*.3+pit*.25)*.012);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 fn=la.x>la.y&&la.x>la.z?vec3(sign(vbLocal.x),0.,0.):la.y>la.z?vec3(0.,sign(vbLocal.y),0.):vec3(0.,0.,sign(vbLocal.z));
        // The mark: faces turned to the core catch its light. The shell: only the joint faces, seen through the seams.
        float shellB=step(.5,dot(vbN,vbN)),inner=max(0.,dot(fn,normalize(vbIn))),joint=1.-abs(dot(fn,vbN)),edge=smoothstep(.45,.5,mid);
        float seam=mix(inner*inner*1.4+edge*inner*.6,(joint*.4+inner*.12)*smoothstep(.3,.5,mid),shellB);
        totalEmissiveRadiance+=uAccent*vbGlow*seam*(.75+.5*n2);
        float heat=exp(-max(0.,vbAy-uScan)*3.4)*step(-50.,uScan);totalEmissiveRadiance+=vec3(.82,.92,1.)*heat*(.9+edge*.7);
        float burn=step(.0001,vbTs)*(1.-smoothstep(0.,.1,bkN-bkT));totalEmissiveRadiance+=vec3(.7,.9,1.)*burn*1.9;`);
  };
  material.customProgramCacheKey = () => 'brick-hero-2';
  const depth = keep(new T.MeshDepthMaterial()); depth.defines = { BK_DEPTH: '' };
  depth.onBeforeCompile = shader => { Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD).replace('#include <begin_vertex>', STATE + '\nvec3 transformed=R*(lp*scl)+P;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uScan;varying vec3 vbLocal;varying float vbSeed,vbAy,vbTs;\n${NOISE_V}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + DISCARD); };
  depth.customProgramCacheKey = () => 'brick-hero-depth-2';
  const mesh = new T.Mesh(geo, material); mesh.name = 'brick-heybox'; mesh.customDepthMaterial = depth; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh);

  const blueprint = createBlueprint({ THREE: T, root, heroAnchor, center: new T.Vector3(G.x, G.y, G.z), boxes: bricks.map(b => ({ c: b.c, h: b.h, fine: b.shed < 0 })), size, keep, rand, draw: INTRO.draw, net: INTRO.net });

  // Glitter from the burning shell: each brick lets go of its sparks as it dissolves.
  const PER = 30, GL = (N - logoCount) * PER, gPos = new Float32Array(GL * 3), gInfo = new Float32Array(GL * 4), gN = new Float32Array(GL * 3);
  for (let i = logoCount, k = 0; i < N; i++) for (let j = 0; j < PER; j++, k++) {
    gPos.set([0, 1, 2].map(a => slot[i * 3 + a] + (rand() * 2 - 1) * halfs[i * 4 + a]), k * 3); gN.set(more.subarray(i * 4 + 1, i * 4 + 4), k * 3); gInfo.set([info[i * 4 + 1], rand(), rand(), rand()], k * 4);
  }
  const gGeo = keep(new T.BufferGeometry()); gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3)); gGeo.setAttribute('aInfo', new T.BufferAttribute(gInfo, 4)); gGeo.setAttribute('aN', new T.BufferAttribute(gN, 3));
  const gMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uAnchor: uniforms.uAnchor, uShed: uniforms.uShed, uTime: uniforms.uTime, uView: { value: 800 }, uAlpha: { value: 1 } },
    vertexShader: `attribute vec4 aInfo;attribute vec3 aN;uniform mat4 uAnchor;uniform float uShed,uTime,uView,uAlpha;varying float vA;varying vec3 vC;
      void main(){float age=uShed-aInfo.x*${f(SHED.spread)}-${f(SHED.dur * .25)}-aInfo.y*${f(SHED.dur * .6)};float life=1.4+aInfo.z*1.6,u=clamp(age/life,0.,1.);
        vec3 r=vec3(aInfo.y,aInfo.z,aInfo.w)-.5;vec3 p=position+(aN*(.35+.6*aInfo.w)+r*.9)*(1.-exp(-max(age,0.)*1.6))+vec3(0.,.25*u,0.);
        vec4 mv=modelViewMatrix*(uAnchor*vec4(p,1.));gl_Position=projectionMatrix*mv;
        vA=uAlpha*step(0.,age)*(1.-u)*smoothstep(0.,.06,age)*(.55+.45*sin(uTime*(10.+aInfo.w*8.)+aInfo.y*60.));
        vC=mix(vec3(.55,.85,1.),vec3(1.),aInfo.z);gl_PointSize=clamp((.012+.02*aInfo.w)*projectionMatrix[1][1]*uView*.5/max(.3,-mv.z),1.,4.5);}`,
    fragmentShader: 'varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);float a=min(1.,vA*(1.-smoothstep(.05,.5,r)));gl_FragColor=vec4(vC*a,a);}' }));
  const glitter = new T.Points(gGeo, gMat); glitter.name = 'brick-shell-glitter'; glitter.frustumCulled = false; glitter.renderOrder = 4; glitter.raycast = () => {}; root.add(glitter);

  // Seam sparks: fine ice glitter that leaks out between the breathing mark bricks, drifts and winks out.
  const SPARKS = 1100, sparkPos = new Float32Array(SPARKS * 3), sparkInfo = new Float32Array(SPARKS * 4);
  for (let i = 0; i < SPARKS; i++) { const b = Math.floor(rand() * logoCount); const ax = Math.floor(rand() * 3), sg = rand() < .5 ? -1 : 1;
    const o = [(rand() - .5) * P, (rand() - .5) * P, (rand() - .5) * P]; o[ax] = sg * P * .5;
    sparkPos.set([slot[b * 3] + o[0], slot[b * 3 + 1] + o[1], slot[b * 3 + 2] + o[2]], i * 3); sparkInfo.set([rand(), rand(), rand(), rand()], i * 4); }
  const sparkGeo = keep(new T.BufferGeometry()); sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('aInfo', new T.BufferAttribute(sparkInfo, 4));
  const sparkMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uAnchor: uniforms.uAnchor, uTime: uniforms.uTime, uView: { value: 800 }, uAlpha: { value: 0 }, uHalf: { value: half } },
    vertexShader: `attribute vec4 aInfo;uniform mat4 uAnchor;uniform float uTime,uView,uAlpha;uniform vec3 uHalf;varying float vA;varying vec3 vC;
      void main(){float life=2.2+aInfo.x*2.8,age=mod(uTime+aInfo.y*life,life)/life;
        vec3 out_=normalize(position/uHalf+vec3(aInfo.z,aInfo.w,aInfo.x)*.6-.3);
        vec3 p=position*(1.+.05*sin(uTime*1.2-length(position)*2.6))+out_*(.04+age*(.35+aInfo.z*.55))+vec3(sin(uTime*.9+aInfo.w*20.)*.03,age*(.12+.2*aInfo.w),cos(uTime*.7+aInfo.z*20.)*.03);
        vec4 mv=modelViewMatrix*(uAnchor*vec4(p,1.));gl_Position=projectionMatrix*mv;
        float breath=.5+.5*sin(uTime*1.2-length(position)*2.6+aInfo.x*.8);
        vA=1.6*uAlpha*smoothstep(0.,.08,age)*(1.-smoothstep(.45,1.,age))*(.35+.65*breath)*(.6+.4*sin(uTime*(9.+aInfo.w*7.)+aInfo.y*50.));
        vC=mix(vec3(.55,.85,1.),vec3(1.),aInfo.w*.7);gl_PointSize=clamp((.014+.022*aInfo.z)*projectionMatrix[1][1]*uView*.5/max(.3,-mv.z),1.2,5.);}`,
    fragmentShader: 'varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);float a=min(1.,vA*(1.-smoothstep(.05,.5,r)));gl_FragColor=vec4(vC*a,a);}' }));
  const sparks = new T.Points(sparkGeo, sparkMat); sparks.name = 'brick-seam-sparks'; sparks.frustumCulled = false; sparks.renderOrder = 4; sparks.raycast = () => {}; root.add(sparks);

  // The core lamp: lights the joint faces through the open seams, then the bare mark.
  const core = new T.PointLight(0x8fdcff, 0, 7, 2); core.name = 'brick-core-light'; heroAnchor.add(core);

  const inv = new T.Matrix4();
  function update({ since = 0, shed = -1, progress = 0, time = 0, reduced = false, quality = 'standard', pointer, peel = false, aspect = 1, flash = 0, tremble = 0, height = 800, visible = true }) {
    mesh.visible = core.visible = visible; sparks.visible = visible && !reduced; glitter.visible = visible && !reduced && shed > 0 && shed < SHED.spread + SHED.dur + 3.5;
    if (!visible) { blueprint.update({ visible }); return; }
    root.updateWorldMatrix(true, false); heroAnchor.updateWorldMatrix(true, false);
    inv.copy(root.matrixWorld).invert(); uniforms.uAnchor.value.multiplyMatrices(inv, heroAnchor.matrixWorld);
    const u = uniforms, top = H / 2 + .06, [s0, s1] = INTRO.scan;
    u.uScan.value = reduced || since >= s1 ? -99 : since < s0 ? 1e3 : top - (since - s0) / (s1 - s0) * (2 * top + 1.2);
    blueprint.update({ since, scan: u.uScan.value, reduced, quality, visible });
    u.uShed.value = shed; u.uP.value = progress; u.uTime.value = reduced ? 0 : time; u.uBreathe.value = reduced ? 0 : 1;
    u.uPeel.value = peel && !reduced ? 1 : 0; if (pointer) u.uPointer.value.copy(pointer); u.uAspect.value = aspect;
    u.uTremble.value = reduced ? 0 : tremble; u.uFlash.value = flash; u.uGlow.value = quality === 'ultra' ? 1.25 : 1;
    const view = height * Math.min(2, globalThis.devicePixelRatio || 1), ultra = quality === 'ultra' ? 1 : .8;
    // The lamp swells with the breath and fades as the mark gives way.
    const solid = smooth(s1 - .3, s1 + 1, since), gone = clamp((progress - .088) / .05);
    sparkMat.uniforms.uView.value = gMat.uniforms.uView.value = view; gMat.uniforms.uAlpha.value = 1.5 * ultra;
    sparkMat.uniforms.uAlpha.value = clamp((since - SHED_AT - 1.2) / 1.5) * (1 - gone) * ultra * (1 + 1.5 * tremble + flash);
    core.intensity = solid * (1 - gone) * (reduced ? 2.4 : 1.6 + 1.6 * (.5 + .5 * Math.sin(time * 1.2))) * (1 + 3 * flash + 2 * tremble);
  }
  return { mesh, update, shards, shardOrder, half, size, logoCount,
    dispose() { blueprint.dispose(); for (const o of [mesh, glitter, sparks, core]) o.removeFromParent(); core.dispose?.(); } };
}
