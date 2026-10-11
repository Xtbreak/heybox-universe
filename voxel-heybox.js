// The black box is a grain field: 20×20×12 small obsidian cubes, one instanced draw.
// Scrolling sheds every grain that is not part of the mark: they tumble onto the floor
// and leave a solid voxel logo, back-lit by a halo. The same grains then scatter and
// re-form as each world, and finally stream through the front door, snow-white on the
// way, into the little logo on the living-room table.
export const NX = 20, NY = 20, NZ = 12, VOXELS = NX * NY * NZ, PITCH = .11;
export const VOXEL_PATH = [
  { from: 'box', to: 'helmet', leave: [.088, .15], arrive: [.295, .367], burst: 2.6 },
  { from: 'helmet', to: 'robot', leave: [.432, .475], arrive: [.514, .573], burst: 1.3 },
  { from: 'robot', to: 'car', leave: [.647, .697], arrive: [.744, .798], burst: 1.3 },
  { from: 'car', to: 'table', leave: [.862, .885], arrive: [.94, .975], burst: 1.1 }
];
const MARK = ['M228 87Q228 80 234 84L387 172Q395 176 395 184V327Q395 335 388 339L346 364Q339 368 339 360V219Q339 211 332 207L291 183Q283 178 283 186V220Q283 228 275 228H236Q228 228 228 220Z'];
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mono = "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace";

// Logo cells on the front face (row 0 = bottom). Falls back to an empty mask without canvas.
function logoMask() {
  const mask = new Uint8Array(NX * NY);
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return mask;
  const c = document.createElement('canvas'); c.width = NX * 8; c.height = NY * 8; const g = c.getContext('2d'); if (!g) return mask;
  const k = 15 * 8 / 408; g.translate((c.width - 368 * k) / 2 - 72 * k, (c.height - 408 * k) / 2 - 52 * k); g.scale(k, k);
  const path = new Path2D(MARK[0]); g.fill(path); g.translate(256, 256); g.rotate(Math.PI); g.translate(-256, -256); g.fill(path);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    let a = 0; for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) a += data[((y * 8 + v) * c.width + x * 8 + u) * 4 + 3];
    if (a / 64 > 100) mask[(NY - 1 - y) * NX + x] = 1;
  }
  return mask;
}

const HEAD = `attribute vec3 aFrom,aTo;attribute vec2 aOrder;attribute vec4 aSeed,aGround;
uniform float uP,uTime,uBurst,uFromBox,uToBox,uSizeFrom,uSizeTo,uBuild,uPeel,uAspect,uSeam,uActive,uDrop,uFall,uBreathe,uRoute,uWhite;
uniform vec2 uLeave,uArrive,uPointer;uniform vec3 uCam,uCamF,uCamR,uCamU,uFromC,uToC,uDoorA,uDoorB,uDoorR,uDoorU,uDoorN;uniform mat3 uFromRot,uToRot;
varying vec3 vxLocal,vxInward;varying float vxGlow,vxStream,vxLift,vxWhite,vxKeep;
mat3 vxAxis(vec3 a,float r){float c=cos(r),s=sin(r),t=1.-c;return mat3(t*a.x*a.x+c,t*a.x*a.y+s*a.z,t*a.x*a.z-s*a.y,t*a.x*a.y-s*a.z,t*a.y*a.y+c,t*a.y*a.z+s*a.x,t*a.x*a.z+s*a.y,t*a.y*a.z-s*a.x,t*a.z*a.z+c);}
mat3 vxOrtho(mat3 m){vec3 x=normalize(m[0]);vec3 y=normalize(m[1]-x*dot(x,m[1]));return mat3(x,y,cross(x,y));}`;
// Shared with the CPU copy in path(): burst outwards, escort the camera, settle on target.
const STATE = `float leave=mix(uLeave.x,uLeave.y,aOrder.x),arrive=mix(uArrive.x,uArrive.y,aOrder.y);
float t=clamp((uP-leave)/max(.0001,arrive-leave),0.,1.);float s1=aSeed.x,s2=aSeed.y,ex=aSeed.z;
// Excess grains tumble off the hero cube, hop once and come to rest on the floor.
float fd=uFall*ex*clamp((uDrop-aGround.w)/.38,0.,1.),dd=min(1.,fd*1.12),ho=1.-(1.-dd)*(1.-dd);
vec3 src=vec3(mix(aFrom.x,aGround.x,ho),aFrom.y+(aGround.y-aFrom.y)*dd*dd+(.2+.3*s2)*4.*dd*(1.-dd),mix(aFrom.z,aGround.z,ho));
src.y+=.05*sin(3.14159*clamp((fd-.89)/.11,0.,1.));
// Breathing: resting grains drift a hair along their offset from the centre.
float br=(.5+.5*sin(uTime*1.25+s1*6.2832))*.12+.05*sin(uTime*.7);
src+=normalize(aFrom-uFromC+.0001)*br*uSizeFrom*uFromBox*(1.-fd)*uBreathe;
vec3 dst=aTo+normalize(aTo-uToC+.0001)*br*uSizeTo*uToBox*(1.-ex)*uBreathe;
vec3 dir=normalize(src-uFromC+(vec3(s1,s2,fract(s1*7.13+s2*3.7))-.5)*.7);dir.y=mix(dir.y,abs(dir.y)+.6,step(.001,fd));dir=normalize(dir);
float kick=(1.-exp(-t*14.))*(1.-smoothstep(.15,.6,t));
float e=smoothstep(.12,.95,t);
// Routed leg: down the road, square through the door opening, then over to the table.
float er=1.-pow(1.-t,1.6);vec3 jd=uDoorR*(s1-.5)*2.+uDoorU*(s2-.5)*2.,q1=uDoorA+jd,q2=uDoorB+jd*.8,rp;
if(er<.46){float u=er/.46;vec3 c=q1+uDoorN;rp=mix(mix(src,c,u),mix(c,q1,u),u);}
else if(er<.6)rp=mix(q1,q2,(er-.46)/.14);
else{float u=(er-.6)/.4;vec3 c=q2-uDoorN*.45;rp=mix(mix(q2,c,u),mix(c,dst,u),u);}
vec3 base=mix(mix(src,dst,e),rp,uRoute)+dir*uBurst*(.6+s2*1.6)*kick*(1.-.6*uRoute);
float a=s1*6.2832+t*7.+uTime*.15,R=3.2+s2*4.2;
vec3 swarm=uCam+uCamF*(9.+s1*16.)+(uCamR*cos(a)+uCamU*sin(a))*R;
float w=pow(sin(3.14159265*smoothstep(.1,.92,t)),1.5)*(1.-uRoute);
vec3 vxP=mix(base,swarm,w);
float build=smoothstep(aSeed.w*.85,aSeed.w*.85+.15,uBuild);vxP.y+=(1.-build)*(1.-build)*.7*uFromBox*(1.-step(.0001,t));
float startVis=mix(step(.0001,t),1.,uFromBox)*mix(1.,build,uFromBox);
float endVis=mix(1.-smoothstep(.965,1.,t),1.-ex*smoothstep(.8,.98,t),uToBox);
vec4 clip=projectionMatrix*modelViewMatrix*vec4(vxP,1.);vec2 d=(clip.xy/max(.001,clip.w)-uPointer)*vec2(uAspect,1.);
float peel=exp(-dot(d,d)*55.)*uPeel*(1.-w)*(1.-step(.001,fd));
vxP+=(uCamR*d.x+uCamU*d.y)/max(.02,length(d))*peel*(.18+s1*.3)-uCamF*peel*(.35+s2*.5);
float vis=max(startVis*endVis,peel*step(.5,uActive))*uActive;
float boxness=uFromBox*(1.-e)+uToBox*e;
vxWhite=uWhite*smoothstep(.08,.3,t)*(1.-smoothstep(.72,.93,t));
float vxScale=mix(uSizeFrom,uSizeTo,e)*(1.-.45*w)*(1.-.35*vxWhite)*mix(.78+s2*.44,1.,boxness)*vis;
vec3 axis=normalize(vec3(s1,s2,fract(s1*3.1+s2*5.3))-.5);
float yaw=s1*6.2832;mat3 lay=mat3(cos(yaw),0.,-sin(yaw),0.,1.,0.,sin(yaw),0.,cos(yaw));
mat3 fromR=vxOrtho(uFromRot*(1.-ho)+lay*ho);
mat3 vxR=vxAxis(axis,sin(3.14159*t)*(2.+s1*6.)+kick*s2*3.+peel*(2.+s1*4.)+sin(3.14159*dd)*(2.+s1*4.))*vxOrtho(fromR*(1.-e)+uToRot*e);
vxLocal=position;vxInward=transpose(vxR)*normalize(uFromC-vxP+.0001);vxKeep=(1.-ex)*boxness;
vxGlow=uSeam*smoothstep(0.,.04,t)*(1.-smoothstep(.25,.7,t))*(.5+.5*s2);vxStream=w;vxLift=peel;`;

export function createVoxelHeybox({ THREE: T, root, camera, particles, heroAnchor, tableAnchor, modelLocations, room = null, doorway = null }) {
  const own = new Set(), keep = r => (own.add(r), r);
  const mask = logoMask();
  const grid = new Float32Array(VOXELS * 3), layer = new Float32Array(VOXELS), boxOrder = new Float32Array(VOXELS), tableOrder = new Float32Array(VOXELS);
  let seed = 90127; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const geo = keep(new T.InstancedBufferGeometry()), cubeGeo = keep(new T.BoxGeometry(1, 1, 1));
  geo.index = cubeGeo.index; for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, cubeGeo.attributes[k]);
  const from = new Float32Array(VOXELS * 3), to = new Float32Array(VOXELS * 3), orders = new Float32Array(VOXELS * 2), seeds = new Float32Array(VOXELS * 4), ground = new Float32Array(VOXELS * 4);
  // The mark is kept as a six-grain-deep slab through the middle of the cube; the rest is excess.
  const kept = [], G = heroAnchor.position, floorY = G.y - 1.7;
  for (let i = 0; i < VOXELS; i++) {
    const ix = i % NX, iy = Math.floor(i / NX) % NY, iz = Math.floor(i / (NX * NY));
    grid.set([(ix - (NX - 1) / 2) * PITCH, (iy - (NY - 1) / 2) * PITCH, (iz - (NZ - 1) / 2) * PITCH], i * 3);
    const r = rand(); layer[i] = iy / (NY - 1) * .82 + r * .18;
    boxOrder[i] = clamp(.55 * (iz / (NZ - 1)) + .45 * rand()); tableOrder[i] = clamp(iy / (NY - 1) * .75 + rand() * .25);
    const keep = mask[iy * NX + ix] && iz >= 3 && iz <= 8; if (keep) kept.push(i);
    seeds.set([rand(), rand(), keep ? 0 : 1, layer[i]], i * 4);
    // Outer shell first, so the mark is uncovered from the outside in; piles up under the box.
    const depth = Math.min(ix, NX - 1 - ix, iy, NY - 1 - iy, iz, NZ - 1 - iz) / 5, ang = Math.atan2(grid[i * 3 + 2], grid[i * 3]) + (rand() - .5) * 1.4, rad = .35 + 2.9 * Math.pow(rand(), .75);
    ground.set([G.x + Math.cos(ang) * rad, floorY + PITCH * (.5 + Math.floor(Math.pow(rand(), 4) * 3)), G.z + Math.sin(ang) * rad * .85, (.6 * depth + .4 * rand()) * .62], i * 4);
  }
  const attr = (name, array, size, dynamic) => { const a = new T.InstancedBufferAttribute(array, size); if (dynamic) a.setUsage(T.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  const fromAttr = attr('aFrom', from, 3, true), toAttr = attr('aTo', to, 3, true), orderAttr = attr('aOrder', orders, 2, true); attr('aSeed', seeds, 4); attr('aGround', ground, 4);
  geo.instanceCount = VOXELS;
  const accent = new T.Color(0x8fdcff);
  const uniforms = {
    uP: { value: 0 }, uTime: { value: 0 }, uBurst: { value: 1 }, uFromBox: { value: 1 }, uToBox: { value: 0 }, uSizeFrom: { value: PITCH * .9 }, uSizeTo: { value: .085 },
    uBuild: { value: 0 }, uPeel: { value: 0 }, uAspect: { value: 1 }, uSeam: { value: 0 }, uActive: { value: 1 }, uLeave: { value: new T.Vector2() }, uArrive: { value: new T.Vector2() },
    uPointer: { value: new T.Vector2(9, 9) }, uCam: { value: new T.Vector3() }, uCamF: { value: new T.Vector3() }, uCamR: { value: new T.Vector3() }, uCamU: { value: new T.Vector3() },
    uFromC: { value: new T.Vector3() }, uToC: { value: new T.Vector3() }, uFromRot: { value: new T.Matrix3() }, uToRot: { value: new T.Matrix3() },
    uAccent: { value: new T.Color() }, uSheen: { value: .5 }, uDrop: { value: 0 }, uFall: { value: 0 }, uBreathe: { value: 1 }, uRoute: { value: 0 }, uWhite: { value: 0 },
    uDoorA: { value: new T.Vector3() }, uDoorB: { value: new T.Vector3() }, uDoorR: { value: new T.Vector3() }, uDoorU: { value: new T.Vector3() }, uDoorN: { value: new T.Vector3() }
  };
  // Matte obsidian with an ice edge sheen; inner faces glow while the seams are open.
  const material = keep(new T.MeshStandardMaterial({ color: 0x08090b, metalness: .3, roughness: .5, envMapIntensity: .16 }));
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <beginnormal_vertex>', STATE + '\nvec3 objectNormal=vxR*normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=vxR*(position*vxScale)+vxP;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uAccent;uniform float uSheen;varying vec3 vxLocal,vxInward;varying float vxGlow,vxStream,vxLift,vxWhite,vxKeep;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.96,.98),vxWhite);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 la=abs(vxLocal);float mid=max(min(la.x,la.y),min(max(la.x,la.y),la.z));float edge=smoothstep(.44,.5,mid);
        vec3 fn=la.x>la.y&&la.x>la.z?vec3(sign(vxLocal.x),0.,0.):la.y>la.z?vec3(0.,sign(vxLocal.y),0.):vec3(0.,0.,sign(vxLocal.z));
        float inward=max(0.,dot(fn,vxInward));
        totalEmissiveRadiance+=uAccent*(edge*(uSheen*.22*(1.+vxKeep*2.6)+vxLift*1.1+vxStream*.12)+vxGlow*inward*inward*1.1)+vec3(.3,.32,.34)*vxWhite;`);
  };
  material.customProgramCacheKey = () => 'voxel-heybox-2';
  const mesh = new T.Mesh(geo, material); mesh.name = 'voxel-heybox-grains'; mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh);

  // A soft halo behind the hero: rim light on the cube, then the back-light of the mark.
  const haloTexture = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); if (!g) return null;
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); const t = keep(new T.CanvasTexture(c)); return t;
  })();
  const heroSheet = new T.Mesh(keep(new T.PlaneGeometry(NX * PITCH * 1.7, NY * PITCH * 1.7)), keep(new T.MeshBasicMaterial({ map: haloTexture, color: 0x000000, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
  heroSheet.position.z = -NZ * PITCH / 2 - .35; heroSheet.raycast = () => {}; heroAnchor.add(heroSheet);

  // The floor the excess grains land on: a dark plinth with a faint ice grid.
  const floor = new T.Mesh(keep(new T.PlaneGeometry(9, 9)), keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uOpacity: { value: 0 }, uColor: { value: new T.Color(0x8fdcff) } },
    vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uOpacity;uniform vec3 uColor;varying vec2 vP;void main(){float r=length(vP);vec2 g=abs(fract(vP/${(PITCH * 2).toFixed(3)}+.5)-.5)/fwidth(vP/${(PITCH * 2).toFixed(3)});
      float line=1.-min(min(g.x,g.y),1.),ring=1.-smoothstep(0.,.025,abs(r-3.35));float fade=1.-smoothstep(1.2,4.3,r);
      gl_FragColor=vec4(mix(vec3(.035,.04,.048),uColor,line*.35+ring*.6),uOpacity*(fade*(.55+line*.12)+ring*.4));}` })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(G.x, floorY, G.z); floor.renderOrder = -1; floor.raycast = () => {}; root.add(floor);

  // Atmosphere: slow motes drifting up through the light, like the reference's air.
  function motes(parent, count, size, at, color, world) {
    const pos = new Float32Array(count * 3), sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { pos.set([(rand() - .5) * size[0], (rand() - .5) * size[1], (rand() - .5) * size[2]], i * 3); sd.set([rand(), rand(), rand(), rand()], i * 4); }
    const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new T.BufferAttribute(sd, 4));
    const m = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uSize: { value: world }, uView: { value: 800 }, uBox: { value: new T.Vector3(...size) }, uColor: { value: new T.Color(color) } },
      vertexShader: `attribute vec4 aSeed;uniform float uTime,uAlpha,uSize,uView;uniform vec3 uBox;varying float vA;
        void main(){vec3 p=position;p.y=mod(p.y+uBox.y*.5+uTime*(.04+aSeed.x*.07)*uBox.y*.12,uBox.y)-uBox.y*.5;
          p.x+=sin(uTime*.31+aSeed.y*6.28)*uBox.x*.02;p.z+=cos(uTime*.27+aSeed.z*6.28)*uBox.z*.02;
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;float d=max(.2,-mv.z);
          gl_PointSize=clamp(uSize*(.5+aSeed.w)*projectionMatrix[1][1]*uView*.5/d,1.,9.);
          vA=uAlpha*smoothstep(.8,2.5,d)*(1.-smoothstep(.38,.5,abs(p.y/uBox.y)))*(.35+.65*(.5+.5*sin(uTime*(.8+aSeed.y)+aSeed.x*30.)));}`,
      fragmentShader: 'uniform vec3 uColor;varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(uColor,vA*(1.-smoothstep(.15,.5,r)));}' }));
    const pts = new T.Points(g, m); pts.position.set(...at); pts.frustumCulled = false; pts.raycast = () => {}; parent.add(pts); return pts;
  }
  const heroAir = motes(root, 900, [12, 7, 11], [G.x - .6, G.y + 1, G.z + .5], 0xd6f1ff, .022);
  const roomAir = room ? motes(room, 320, [7.4, 2.5, 6.6], [0, 1.3, 0], 0xffd9a8, .016) : null;

  // Construction sketch: progressive thin lines, numbered points and dimensions.
  const sketch = new T.Group(); sketch.name = 'voxel-construction-sketch'; heroAnchor.add(sketch);
  const hx = NX * PITCH / 2, hy = NY * PITCH / 2, hz = NZ * PITCH / 2;
  const corner = (x, y, z) => [x * hx, y * hy, z * hz];
  const edges = [[[-1, -1, 1], [1, -1, 1]], [[1, -1, 1], [1, 1, 1]], [[1, 1, 1], [-1, 1, 1]], [[-1, 1, 1], [-1, -1, 1]], [[-1, -1, 1], [-1, -1, -1]], [[1, -1, 1], [1, -1, -1]], [[1, 1, 1], [1, 1, -1]], [[-1, 1, 1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1]], [[1, -1, -1], [1, 1, -1]], [[1, 1, -1], [-1, 1, -1]], [[-1, 1, -1], [-1, -1, -1]]].map(([a, b]) => [corner(...a), corner(...b)]);
  const o = .32, extra = [
    [[-hx, -hy, hz], [hx, hy, hz]], [[hx, -hy, hz], [-hx, hy, hz]], [[0, -hy - .12, hz], [0, hy + .12, hz]], [[-hx - .12, 0, hz], [hx + .12, 0, hz]],
    [[-hx, -hy - o, hz], [hx, -hy - o, hz]], [[-hx, -hy - o - .06, hz], [-hx, -hy - o + .06, hz]], [[hx, -hy - o - .06, hz], [hx, -hy - o + .06, hz]],
    [[hx + o, -hy, hz], [hx + o, hy, hz]], [[hx + o - .06, -hy, hz], [hx + o + .06, -hy, hz]], [[hx + o - .06, hy, hz], [hx + o + .06, hy, hz]],
    [[hx + o * .7, -hy - o * .7, hz], [hx + o * .7, -hy - o * .7, -hz]]
  ];
  const lines = [...edges, ...extra], K = 18, linePos = [], lineOrder = [];
  lines.forEach(([a, b], n) => { for (let k = 0; k < K; k++) { for (const u of [k / K, (k + 1) / K]) { linePos.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u); lineOrder.push((n + k / K) / lines.length); } } });
  const lineGeo = keep(new T.BufferGeometry()); lineGeo.setAttribute('position', new T.Float32BufferAttribute(linePos, 3)); lineGeo.setAttribute('aOrder', new T.Float32BufferAttribute(lineOrder, 1));
  const lineMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uDraw: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new T.Color(0xc9d3da) } },
    vertexShader: 'attribute float aOrder;varying float vO;void main(){vO=aOrder;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uDraw,uOpacity;uniform vec3 uColor;varying float vO;void main(){if(vO>uDraw)discard;gl_FragColor=vec4(uColor,uOpacity*(.55+.45*smoothstep(uDraw-.04,uDraw,vO)));}' }));
  const sketchLines = new T.LineSegments(lineGeo, lineMat); sketchLines.raycast = () => {}; sketch.add(sketchLines);
  function textSprite(text, { height = .12, color = '#c9d3da', marker = false, parent = sketch, at = [0, 0, 0] } = {}) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'), g = c.getContext('2d'); if (!g) return null;
    g.font = `500 44px ${mono}`; const w = Math.ceil(g.measureText(text).width) + (marker ? 58 : 12); c.width = w; c.height = 64;
    g.font = `500 44px ${mono}`; g.fillStyle = color; g.textBaseline = 'middle';
    if (marker) { g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(6, 22, 20, 20); }
    g.fillText(text, marker ? 44 : 6, 34);
    const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })));
    s.center.set(marker ? 22 / w : .5, .5); s.scale.set(height * w / 64, height, 1); s.position.set(...at); s.raycast = () => {}; parent.add(s); return s;
  }
  const marks = [];
  const point = (p, n, order) => { const s = textSprite(String(n).padStart(2, '0'), { marker: true, at: p }); if (s) marks.push([s, order]); };
  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]].forEach((c, i) => point(corner(...c), [23, 57, 38, 15, 4, 91, 62, 70][i], [0, 1, 2, 3, 4, 5, 6, 7].map(n => n / 23)[i] + .02));
  const dims = [['220', [0, -hy - o - .13, hz], .58], ['220', [hx + o + .26, 0, hz], .64], ['132', [hx + o * .7 + .2, -hy - o * .7 - .1, 0], .72]];
  for (const [text, at, order] of dims) { const s = textSprite(text, { at, height: .1 }); if (s) marks.push([s, order]); }
  const caption = textSprite('HBX—01 / 20×20×12 / 4800', { at: [-hx, hy + .26, hz], height: .085, color: '#8b979f' }); if (caption) { caption.center.set(0, .5); marks.push([caption, .2]); }

  // Numbered constellation lines between a few grains while the box comes apart.
  const picks = kept.length > 40 ? [3, 41, 17, 63, 29, 88, 52].map(k => kept[Math.floor(k / 100 * kept.length)]) : [VOXELS - 1 - 20 * 3 - 4, VOXELS - 1 - 20 * 9 - 15, VOXELS - 1 - 20 * 15 - 2, VOXELS - 1 - 20 * 6 - 11, VOXELS - 1 - 20 * 18 - 8, VOXELS - 1 - 20 * 12 - 17, VOXELS - 1 - 20 * 1 - 9];
  const starGeo = keep(new T.BufferGeometry()), starPos = new Float32Array((picks.length - 1) * 6);
  starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3).setUsage(T.DynamicDrawUsage));
  const starMat = keep(new T.LineBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0, depthWrite: false }));
  const constellation = new T.LineSegments(starGeo, starMat); constellation.frustumCulled = false; constellation.raycast = () => {}; root.add(constellation);
  const starLabels = picks.map((_, i) => textSprite(['23', '57', '38', '15', '04', '91', '62'][i], { parent: root, height: .13, color: '#d6f2ff' }));

  const v = new T.Vector3(), m4 = new T.Matrix4(), inv = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
  let active = -1, clock = 0, flash = 0, pointer = new T.Vector2(9, 9);
  const anchorMatrix = anchor => { anchor.updateWorldMatrix(true, false); return m4.multiplyMatrices(inv, anchor.matrixWorld); };
  function fillBox(anchor, out, center, rot) {
    const e = anchorMatrix(anchor).elements;
    for (let i = 0; i < VOXELS; i++) { const x = grid[i * 3], y = grid[i * 3 + 1], z = grid[i * 3 + 2];
      out[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    m4.decompose(center, q, sc); rot.setFromMatrix4(m4); return sc.x;
  }
  function fill(name, out, ord, center, rot, which) {
    if (name === 'box' || name === 'table') { const s = fillBox(name === 'box' ? heroAnchor : tableAnchor, out, center, rot); for (let i = 0; i < VOXELS; i++) ord[i * 2 + which] = name === 'box' ? boxOrder[i] : tableOrder[i]; return s; }
    const tmp = fill.tmp || (fill.tmp = new Float32Array(VOXELS));
    rot.identity();
    if (particles.sample(name, out, tmp, VOXELS)) { for (let i = 0; i < VOXELS; i++) ord[i * 2 + which] = tmp[i]; center.set(0, 0, 0); for (let i = 0; i < VOXELS; i += 16) center.x += out[i * 3], center.y += out[i * 3 + 1], center.z += out[i * 3 + 2]; center.multiplyScalar(16 / VOXELS); return 0; }
    // Model still loading: a loose grain cloud in its place.
    const p = modelLocations[name]; center.set(p[0], p[1], p[2]);
    for (let i = 0; i < VOXELS; i++) { out[i * 3] = p[0] + grid[i * 3] * 1.3; out[i * 3 + 1] = p[1] + grid[i * 3 + 1] * 1.3; out[i * 3 + 2] = p[2] + grid[i * 3 + 2] * 2; ord[i * 2 + which] = layer[i]; }
    return 0;
  }
  // CPU twin of STATE (without the pointer peel) for the numbered constellation.
  function path(i, p, out) {
    const u = uniforms, s1 = seeds[i * 4], s2 = seeds[i * 4 + 1];
    const leave = u.uLeave.value.x + orders[i * 2] * (u.uLeave.value.y - u.uLeave.value.x), arrive = u.uArrive.value.x + orders[i * 2 + 1] * (u.uArrive.value.y - u.uArrive.value.x);
    const t = clamp((p - leave) / Math.max(1e-4, arrive - leave)), F = [from[i * 3], from[i * 3 + 1], from[i * 3 + 2]], Tt = [to[i * 3], to[i * 3 + 1], to[i * 3 + 2]], c = u.uFromC.value;
    const dir = v.set(F[0] - c.x + (s1 - .5) * .7, F[1] - c.y + (s2 - .5) * .7, F[2] - c.z + (fract(s1 * 7.13 + s2 * 3.7) - .5) * .7).normalize();
    const kick = (1 - Math.exp(-t * 14)) * (1 - smooth(.15, .6, t)), e = smooth(.12, .95, t), b = u.uBurst.value * (.6 + s2 * 1.6) * kick;
    const a = s1 * 6.2832 + t * 7 + u.uTime.value * .15, R = 3.2 + s2 * 4.2, w = Math.pow(Math.sin(Math.PI * smooth(.1, .92, t)), 1.5);
    const C = u.uCam.value, Fw = u.uCamF.value, Rt = u.uCamR.value, Up = u.uCamU.value, dd = 9 + s1 * 16;
    for (let k = 0, key = 'xyz'; k < 3; k++) { const ax = key[k], base = F[k] + (Tt[k] - F[k]) * e + dir[ax] * b, sw = C[ax] + Fw[ax] * dd + (Rt[ax] * Math.cos(a) + Up[ax] * Math.sin(a)) * R; out[k] = base + (sw - base) * w; }
    return t;
  }
  function update({ progress = 0, time = 0, dt = 0, reduced = false, quality = 'standard', width = 1280, height = 800, pointerX = 9, pointerY = 9, peel = false, intro = { draw: 1, build: 1, sketch: 0 }, reveal = 0 } = {}) {
    const p = clamp(progress); clock = reduced ? 0 : time;
    root.updateWorldMatrix(true, false); inv.copy(root.matrixWorld).invert();
    let index = VOXEL_PATH.findIndex(r => p <= r.arrive[1] + .004); if (index < 0) index = VOXEL_PATH.length - 1;
    const r = VOXEL_PATH[index], u = uniforms, isBox = n => n === 'box' || n === 'table';
    // Grains resting inside a model are invisible: skip the per-frame surface reads.
    const moving = p >= r.leave[0] - .002;
    mesh.visible = moving || isBox(r.from) || (isBox(r.to) && p > r.arrive[0]);
    if (mesh.visible) {
      const sf = fill(r.from, from, orders, u.uFromC.value, u.uFromRot.value, 0), st = moving ? fill(r.to, to, orders, u.uToC.value, u.uToRot.value, 1) : 0;
      u.uSizeFrom.value = isBox(r.from) ? PITCH * .9 * sf : .085; u.uSizeTo.value = isBox(r.to) ? PITCH * .9 * (st || 1) : .085;
      fromAttr.needsUpdate = toAttr.needsUpdate = orderAttr.needsUpdate = true;
    }
    active = index;
    u.uP.value = p; u.uTime.value = clock; u.uBurst.value = reduced ? r.burst * .4 : r.burst; u.uLeave.value.set(...r.leave); u.uArrive.value.set(...r.arrive);
    u.uFromBox.value = r.from === 'box' || r.from === 'table' ? 1 : 0; u.uToBox.value = r.to === 'box' || r.to === 'table' ? 1 : 0;
    u.uBuild.value = index === 0 ? intro.build : 1; u.uActive.value = index === 0 && intro.build <= 0 ? 0 : 1;
    camera.updateMatrixWorld(true); u.uCam.value.copy(camera.position).applyMatrix4(inv);
    camera.getWorldDirection(u.uCamF.value).transformDirection(inv); u.uCamR.value.setFromMatrixColumn(camera.matrixWorld, 0).transformDirection(inv); u.uCamU.value.setFromMatrixColumn(camera.matrixWorld, 1).transformDirection(inv);
    u.uAspect.value = width / Math.max(1, height);
    const k = 1 - Math.exp(-Math.max(0, dt) * 10); if (peel && !reduced) pointer.lerp(v.set(pointerX, pointerY, 0), pointer.x > 5 ? 1 : k); else pointer.set(9, 9);
    u.uPointer.value.copy(pointer); u.uPeel.value = peel && !reduced ? 1 : 0;
    // Scroll sheds the excess; the last leg is routed through the front door and turns snow-white.
    const drop = smooth(.004, .064, p); u.uFall.value = index === 0 ? 1 : 0; u.uDrop.value = index === 0 ? drop : 0; u.uBreathe.value = reduced ? 0 : 1;
    u.uRoute.value = index === 3 && doorway ? 1 : 0; u.uWhite.value = index === 3 ? 1 : 0;
    if (index === 3 && doorway) { doorway.group.updateWorldMatrix(true, false); const dm = m4.multiplyMatrices(inv, doorway.group.matrixWorld), ln = new T.Matrix3().setFromMatrix4(dm);
      u.uDoorA.value.set(...doorway.outside).applyMatrix4(dm); u.uDoorB.value.set(...doorway.inside).applyMatrix4(dm);
      u.uDoorR.value.set(doorway.halfWidth, 0, 0).applyMatrix3(ln); u.uDoorU.value.set(0, doorway.halfHeight, 0).applyMatrix3(ln); u.uDoorN.value.set(0, 0, doorway.approach).applyMatrix3(ln); }
    const built = index === 0 ? smooth(.4, 1, intro.build) : 0;
    floor.material.uniforms.uOpacity.value = built * (.35 + .65 * smooth(0, .25, drop)) * (1 - smooth(.105, .16, p)); floor.visible = floor.material.uniforms.uOpacity.value > .002;
    const view = height * Math.min(2, globalThis.devicePixelRatio || 1);
    for (const [air, alpha] of [[heroAir, built * (1 - smooth(.13, .2, p))], [roomAir, smooth(.935, .965, p)]]) { if (!air) continue;
      air.visible = alpha > .002; air.material.uniforms.uAlpha.value = alpha * (quality === 'ultra' ? .9 : .7); air.material.uniforms.uTime.value = reduced ? 0 : clock; air.material.uniforms.uView.value = view; }
    flash = Math.max(0, flash - dt * 1.6);
    const ultra = quality === 'ultra';
    u.uSeam.value = ultra ? 1 : .7; u.uSheen.value = index === 0 ? .25 + .5 * reveal + 1.2 * flash : index === 3 ? .12 + 2 * smooth(.955, .985, p) : .12;
    u.uAccent.value.copy(accent).multiplyScalar(ultra ? 1.2 : 1);
    // Halo: a rim behind the cube that becomes the mark's back-light, peaking in the flash.
    const gone = smooth(.09, .11, p); heroSheet.visible = index === 0 && built > 0 && gone < 1;
    heroSheet.material.color.copy(accent).multiplyScalar((.05 + .12 * drop + .22 * reveal + .9 * flash) * built * (1 - gone) * (reduced ? 1 : .92 + .08 * Math.sin(clock * 1.3)));
    // Sketch: draws, holds faint, then leaves with the first scroll.
    lineMat.uniforms.uDraw.value = intro.draw * 1.001; const sketchAlpha = intro.sketch * (1 - smooth(.02, .07, p));
    lineMat.uniforms.uOpacity.value = sketchAlpha * .55; sketch.visible = sketchAlpha > .002;
    for (const [s, order] of marks) s.material.opacity = sketchAlpha * smooth(order, order + .05, intro.draw);
    // Constellation through the explosion.
    const starAlpha = index === 0 && !reduced ? smooth(.092, .105, p) * (1 - smooth(.15, .175, p)) : 0;
    constellation.visible = starAlpha > .002;
    for (let i = 0; i < picks.length; i++) { const lab = starLabels[i]; if (lab) lab.visible = constellation.visible; }
    if (constellation.visible) {
      const pts = picks.map(i => { const out = [0, 0, 0]; path(i, p, out); return out; });
      for (let i = 0; i < picks.length - 1; i++) starPos.set([...pts[i], ...pts[i + 1]], i * 6);
      starGeo.attributes.position.needsUpdate = true; starMat.opacity = starAlpha * .7;
      pts.forEach((pt, i) => { const lab = starLabels[i]; if (lab) { lab.position.set(pt[0] + .1, pt[1] + .1, pt[2]); lab.material.opacity = starAlpha; } });
    }
    return index;
  }
  return {
    mesh, update, getActive: () => active, flash() { flash = 1; },
    dispose() { mesh.removeFromParent(); sketch.removeFromParent(); heroSheet.removeFromParent(); floor.removeFromParent(); heroAir.removeFromParent(); roomAir?.removeFromParent(); constellation.removeFromParent(); starLabels.forEach(s => s?.removeFromParent()); own.forEach(r => r.dispose?.()); own.clear(); }
  };
}
