// The black box is a grain field: 20×20×12 small obsidian cubes, one instanced draw.
// A logo-shaped channel runs straight through it; a light sheet behind the box shows
// only when the camera looks exactly down that channel. The same grains then scatter
// and re-form as each world, and finally as the small box on the living-room table.
export const NX = 20, NY = 20, NZ = 12, VOXELS = NX * NY * NZ, PITCH = .11;
export const VOXEL_PATH = [
  { from: 'box', to: 'helmet', leave: [.088, .15], arrive: [.295, .367], burst: 2.6 },
  { from: 'helmet', to: 'robot', leave: [.432, .475], arrive: [.514, .573], burst: 1.3 },
  { from: 'robot', to: 'car', leave: [.647, .697], arrive: [.744, .798], burst: 1.3 },
  { from: 'car', to: 'table', leave: [.862, .9], arrive: [.936, .972], burst: 1.1 }
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

const HEAD = `attribute vec3 aFrom,aTo;attribute vec2 aOrder;attribute vec4 aSeed;
uniform float uP,uTime,uBurst,uFromBox,uToBox,uSizeFrom,uSizeTo,uBuild,uPeel,uAspect,uSeam,uActive;
uniform vec2 uLeave,uArrive,uPointer;uniform vec3 uCam,uCamF,uCamR,uCamU,uFromC,uToC;uniform mat3 uFromRot,uToRot;
varying vec3 vxLocal,vxInward;varying float vxGlow,vxStream,vxLift;
mat3 vxAxis(vec3 a,float r){float c=cos(r),s=sin(r),t=1.-c;return mat3(t*a.x*a.x+c,t*a.x*a.y+s*a.z,t*a.x*a.z-s*a.y,t*a.x*a.y-s*a.z,t*a.y*a.y+c,t*a.y*a.z+s*a.x,t*a.x*a.z+s*a.y,t*a.y*a.z-s*a.x,t*a.z*a.z+c);}
mat3 vxOrtho(mat3 m){vec3 x=normalize(m[0]);vec3 y=normalize(m[1]-x*dot(x,m[1]));return mat3(x,y,cross(x,y));}`;
// Shared with the CPU copy in path(): burst outwards, escort the camera, settle on target.
const STATE = `float leave=mix(uLeave.x,uLeave.y,aOrder.x),arrive=mix(uArrive.x,uArrive.y,aOrder.y);
float t=clamp((uP-leave)/max(.0001,arrive-leave),0.,1.);float s1=aSeed.x,s2=aSeed.y,hole=aSeed.z;
vec3 dir=normalize(aFrom-uFromC+(vec3(s1,s2,fract(s1*7.13+s2*3.7))-.5)*.7);
float kick=(1.-exp(-t*14.))*(1.-smoothstep(.15,.6,t));
float e=smoothstep(.12,.95,t);vec3 base=mix(aFrom,aTo,e)+dir*uBurst*(.6+s2*1.6)*kick;
float a=s1*6.2832+t*7.+uTime*.15,R=3.2+s2*4.2;
vec3 swarm=uCam+uCamF*(9.+s1*16.)+(uCamR*cos(a)+uCamU*sin(a))*R;
float w=pow(sin(3.14159265*smoothstep(.1,.92,t)),1.5);
vec3 vxP=mix(base,swarm,w);
float build=smoothstep(aSeed.w*.85,aSeed.w*.85+.15,uBuild);vxP.y+=(1.-build)*(1.-build)*.7*uFromBox*(1.-step(.0001,t));
float startVis=mix(step(.0001,t),1.-hole*(1.-step(.0001,t)),uFromBox)*mix(1.,build,uFromBox);
float endVis=mix(1.-smoothstep(.965,1.,t),1.-hole*smoothstep(.97,1.,t),uToBox);
vec4 clip=projectionMatrix*modelViewMatrix*vec4(vxP,1.);vec2 d=(clip.xy/max(.001,clip.w)-uPointer)*vec2(uAspect,1.);
float peel=exp(-dot(d,d)*55.)*uPeel*(1.-w);
vxP+=(uCamR*d.x+uCamU*d.y)/max(.02,length(d))*peel*(.18+s1*.3)-uCamF*peel*(.35+s2*.5);
float vis=max(startVis*endVis,peel*step(.5,uActive))*uActive;
float boxness=uFromBox*(1.-e)+uToBox*e;
float vxScale=mix(uSizeFrom,uSizeTo,e)*(1.-.45*w)*mix(.78+s2*.44,1.,boxness)*vis;
vec3 axis=normalize(vec3(s1,s2,fract(s1*3.1+s2*5.3))-.5);
mat3 vxR=vxAxis(axis,sin(3.14159*t)*(2.+s1*6.)+kick*s2*3.+peel*(2.+s1*4.))*vxOrtho(uFromRot*(1.-e)+uToRot*e);
vxLocal=position;vxInward=transpose(vxR)*normalize(uFromC-vxP+.0001);
vxGlow=uSeam*smoothstep(0.,.04,t)*(1.-smoothstep(.25,.7,t))*(.5+.5*s2);vxStream=w;vxLift=peel;`;

export function createVoxelHeybox({ THREE: T, root, camera, particles, heroAnchor, tableAnchor, modelLocations }) {
  const own = new Set(), keep = r => (own.add(r), r);
  const mask = logoMask();
  const grid = new Float32Array(VOXELS * 3), layer = new Float32Array(VOXELS), boxOrder = new Float32Array(VOXELS), tableOrder = new Float32Array(VOXELS);
  let seed = 90127; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const geo = keep(new T.InstancedBufferGeometry()), cubeGeo = keep(new T.BoxGeometry(1, 1, 1));
  geo.index = cubeGeo.index; for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, cubeGeo.attributes[k]);
  const from = new Float32Array(VOXELS * 3), to = new Float32Array(VOXELS * 3), orders = new Float32Array(VOXELS * 2), seeds = new Float32Array(VOXELS * 4);
  for (let i = 0; i < VOXELS; i++) {
    const ix = i % NX, iy = Math.floor(i / NX) % NY, iz = Math.floor(i / (NX * NY));
    grid.set([(ix - (NX - 1) / 2) * PITCH, (iy - (NY - 1) / 2) * PITCH, (iz - (NZ - 1) / 2) * PITCH], i * 3);
    const r = rand(); layer[i] = iy / (NY - 1) * .82 + r * .18;
    boxOrder[i] = clamp(.55 * (iz / (NZ - 1)) + .45 * rand()); tableOrder[i] = clamp(iy / (NY - 1) * .75 + rand() * .25);
    seeds.set([rand(), rand(), mask[iy * NX + ix], layer[i]], i * 4);
  }
  const attr = (name, array, size, dynamic) => { const a = new T.InstancedBufferAttribute(array, size); if (dynamic) a.setUsage(T.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  const fromAttr = attr('aFrom', from, 3, true), toAttr = attr('aTo', to, 3, true), orderAttr = attr('aOrder', orders, 2, true); attr('aSeed', seeds, 4);
  geo.instanceCount = VOXELS;
  const accent = new T.Color(0x8fdcff);
  const uniforms = {
    uP: { value: 0 }, uTime: { value: 0 }, uBurst: { value: 1 }, uFromBox: { value: 1 }, uToBox: { value: 0 }, uSizeFrom: { value: PITCH * .9 }, uSizeTo: { value: .085 },
    uBuild: { value: 0 }, uPeel: { value: 0 }, uAspect: { value: 1 }, uSeam: { value: 0 }, uActive: { value: 1 }, uLeave: { value: new T.Vector2() }, uArrive: { value: new T.Vector2() },
    uPointer: { value: new T.Vector2(9, 9) }, uCam: { value: new T.Vector3() }, uCamF: { value: new T.Vector3() }, uCamR: { value: new T.Vector3() }, uCamU: { value: new T.Vector3() },
    uFromC: { value: new T.Vector3() }, uToC: { value: new T.Vector3() }, uFromRot: { value: new T.Matrix3() }, uToRot: { value: new T.Matrix3() },
    uAccent: { value: new T.Color() }, uSheen: { value: .5 }
  };
  // Matte obsidian with an ice edge sheen; inner faces glow while the seams are open.
  const material = keep(new T.MeshStandardMaterial({ color: 0x08090b, metalness: .3, roughness: .5, envMapIntensity: .16 }));
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <beginnormal_vertex>', STATE + '\nvec3 objectNormal=vxR*normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=vxR*(position*vxScale)+vxP;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uAccent;uniform float uSheen;varying vec3 vxLocal,vxInward;varying float vxGlow,vxStream,vxLift;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 la=abs(vxLocal);float mid=max(min(la.x,la.y),min(max(la.x,la.y),la.z));float edge=smoothstep(.44,.5,mid);
        vec3 fn=la.x>la.y&&la.x>la.z?vec3(sign(vxLocal.x),0.,0.):la.y>la.z?vec3(0.,sign(vxLocal.y),0.):vec3(0.,0.,sign(vxLocal.z));
        float inward=max(0.,dot(fn,vxInward));
        totalEmissiveRadiance+=uAccent*(edge*(uSheen*.22+vxLift*1.1+vxStream*.12)+vxGlow*inward*inward*1.1);`);
  };
  material.customProgramCacheKey = () => 'voxel-heybox-1';
  const mesh = new T.Mesh(geo, material); mesh.name = 'voxel-heybox-grains'; mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh);

  // Light sheets: one behind the hero box, one shallow inside the table box.
  const sheetTexture = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); if (!g) return null;
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 256, 256); const cw = 256 / NX, ch = 256 / NY;
    const draw = () => { for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) if (mask[y * NX + x]) g.fillRect(x * cw - 1, (NY - 1 - y) * ch - 1, cw + 2, ch + 2); };
    g.fillStyle = '#ffffff'; g.filter = 'blur(6px)'; draw(); g.filter = 'none'; draw();
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  function sheet(anchor, depth) {
    const m = keep(new T.MeshBasicMaterial({ map: sheetTexture, color: 0x000000, depthWrite: true, fog: false }));
    const s = new T.Mesh(keep(new T.PlaneGeometry(NX * PITCH, NY * PITCH)), m); s.position.z = depth; s.raycast = () => {}; anchor.add(s); return s;
  }
  const heroSheet = sheet(heroAnchor, -NZ * PITCH / 2 - .02), tableSheet = sheet(tableAnchor, NZ * PITCH / 2 - PITCH * 1.6);

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
  const picks = [VOXELS - 1 - 20 * 3 - 4, VOXELS - 1 - 20 * 9 - 15, VOXELS - 1 - 20 * 15 - 2, VOXELS - 1 - 20 * 6 - 11, VOXELS - 1 - 20 * 18 - 8, VOXELS - 1 - 20 * 12 - 17, VOXELS - 1 - 20 * 1 - 9];
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
    flash = Math.max(0, flash - dt * 1.6);
    const ultra = quality === 'ultra';
    u.uSeam.value = ultra ? 1 : .7; u.uSheen.value = (.25 + .5 * reveal + 1.2 * flash) * (index === 0 ? 1 : .5);
    u.uAccent.value.copy(accent).multiplyScalar(ultra ? 1.2 : 1);
    // Light sheets: always lit, brighter as the channel aligns, and fully open in the flash.
    const leaving = smooth(.088, .125, p), heroBuilt = index === 0 ? smooth(.4, 1, intro.build) : 0;
    const gone = smooth(.09, .1, p); heroSheet.visible = index === 0 && heroBuilt > 0 && gone < 1;
    heroSheet.material.color.copy(accent).multiplyScalar((.45 + 1.1 * reveal + 3.5 * flash * (1 - leaving)) * heroBuilt * (1 - gone));
    const tableBuilt = index === 3 ? smooth(.955, .975, p) : 0; tableSheet.visible = tableBuilt > 0;
    tableSheet.material.color.copy(accent).multiplyScalar(tableBuilt * 1.3 * (reduced ? 1 : .8 + .2 * Math.sin(clock * 2.2)));
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
    dispose() { mesh.removeFromParent(); sketch.removeFromParent(); heroSheet.removeFromParent(); tableSheet.removeFromParent(); constellation.removeFromParent(); starLabels.forEach(s => s?.removeFromParent()); own.forEach(r => r.dispose?.()); own.clear(); }
  };
}
