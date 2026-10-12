// The opening landscape: sunlit regolith with craters and half-buried rocks, a low dust
// haze along the horizon and the Earth over it. Procedural only. Everything dissolves
// from the far edge inwards as the camera leaves for the first world. On arrival it grows the
// other way: out from under the box, behind a ragged, glowing pixel front (uGrow, in metres).
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Shared GLSL: 3D value noise, and a regolith treatment for MeshStandardMaterial.
export const NOISE_GLSL = `float lnH(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float lnN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(lnH(i),lnH(i+vec3(1,0,0)),f.x),mix(lnH(i+vec3(0,1,0)),lnH(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(lnH(i+vec3(0,0,1)),lnH(i+vec3(1,0,1)),f.x),mix(lnH(i+vec3(0,1,1)),lnH(i+vec3(1,1,1)),f.x),f.y),f.z);}
float lnF(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*lnN(p);p=p*2.03+vec3(1.7,-.9,.4);a*=.5;}return s;}
vec3 lnBump(vec3 n,vec3 viewPos,float h){vec3 sx=dFdx(viewPos),sy=dFdy(viewPos),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);
  vec3 g=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*n-g);}`;

function regolith(T, material, uniforms, { bump = .9, scale = 1 } = {}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRw;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 rw=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        rw=instanceMatrix*rw;
        #endif
        vRw=(modelMatrix*rw).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vRw;uniform float uFade,uGrow;uniform vec3 uCenter;\n${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(uFade<.999){float far=clamp(length(vRw.xz-uCenter.xz)/48.,0.,1.);if(lnN(vRw*1.7)*.4+far*.6>uFade*1.02)discard;}
        float gF=uGrow-length(vRw.xz-uCenter.xz)-(lnH(floor(vRw*3.))*.5+lnN(vRw*.6)*1.2)*min(1.,uGrow*.4);if(gF<0.)discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 q=vRw*${scale.toFixed(2)};float n1=lnF(q*vec3(.42,.8,.42)),n2=lnN(q*3.3+7.),sp=lnH(floor(q*24.));
        diffuseColor.rgb*=.6+.6*n1+.16*(n2-.5)+(sp>.975?.32:sp<.02?-.22:0.);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-.08*n2,.55,1.);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float bh=lnF(q*4.6)*.55+lnN(q*17.)*.22+lnN(q*46.)*.08;normal=lnBump(normal,-vViewPosition,bh*${bump.toFixed(2)}*.06);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.75,.88,1.)*(1.-smoothstep(0.,.45,gF))*step(uGrow,500.)*1.6;');
  };
  material.customProgramCacheKey = () => 'lunar-regolith-' + bump + '-' + scale;
  return material;
}

export function createLunarOpening({ THREE: T, root, center, floorY }) {
  const own = new Set(), keep = r => (own.add(r), r);
  const group = new T.Group(); group.name = 'lunar-opening'; root.add(group);
  let seed = 55021; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const h2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, z) => { let s = 0, a = .5; for (let i = 0; i < 5; i++) { s += a * vnoise(x, z); x = x * 2.03 + 1.7; z = z * 2.03 - .9; a *= .5; } return s; };
  // Craters in hero-local x/z. None under the box, none between it and the camera.
  const craters = [[-4.6, -3.2, 1.5, .32], [5.8, -6.5, 3, .55], [-9.5, -13, 5, .9], [12, -21, 6.5, 1.2], [-1.5, -24, 3.6, .6], [8.6, 3.4, 2, .35], [-13.5, 1.5, 3, .5], [21, -8, 4.5, .7], [-24, -18, 7, 1.1], [3.5, -38, 8, 1.3], [-6, 6.5, 1.3, .22]];
  for (let i = 0; i < 46; i++) { const a = rand() * 6.283, r = 6 + rand() * 60, x = Math.cos(a) * r, z = Math.sin(a) * r - 12; if (z > 4 && Math.abs(x + 1.1) < 5) continue; craters.push([x, z, .4 + rand() * rand() * 4, .08 + rand() * .3]); }
  function height(x, z) {
    const d = Math.hypot(x, z);
    let h = (fbm(x * .07, z * .07) - .5) * 2.2 * smooth(5, 26, d) + (fbm(x * .55, z * .55) - .5) * .16;
    for (const [cx, cz, r, depth] of craters) { const q = Math.hypot(x - cx, z - cz) / r; if (q < 1.7) h += (q < 1 ? -depth * (1 - q * q) : 0) + depth * .38 * Math.exp(-(((q - 1) / .24) ** 2)); }
    return h * (.12 + .88 * smooth(1.4, 4.2, d)) - d * d / 1800;
  }
  const uniforms = { uFade: { value: 1 }, uGrow: { value: 1e3 }, uCenter: { value: new T.Vector3(center.x, floorY, center.z) } };

  // Ground: one dense sheet, biased towards where the camera looks (-z).
  const geo = keep(new T.PlaneGeometry(150, 150, 240, 240)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -38);
  const gp = geo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, height(gp.getX(i), gp.getZ(i)));
  geo.computeVertexNormals();
  const groundMat = keep(regolith(T, new T.MeshStandardMaterial({ color: 0x605e5b, roughness: .96, metalness: 0, envMapIntensity: .25 }), uniforms, { bump: 1 }));
  const ground = new T.Mesh(geo, groundMat); ground.name = 'lunar-regolith'; ground.position.set(center.x, floorY, center.z); ground.receiveShadow = true; ground.raycast = () => {}; group.add(ground);

  // Rocks: lumpy, half buried, denser close by; a few boulders further out.
  const rockGeo = keep(new T.IcosahedronGeometry(1, 3)); { const p = rockGeo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = vnoise(v.x * 1.7 + 3, v.y * 1.7 + v.z * 1.3) * .5 + vnoise(v.x * 4.1, v.z * 4.1 + v.y) * .22; v.multiplyScalar(.78 + n * .5); p.setXYZ(i, v.x, v.y * .62, v.z); }
    rockGeo.computeVertexNormals(); }
  const rockMat = keep(regolith(T, new T.MeshStandardMaterial({ color: 0x4f4d4a, roughness: .9, metalness: 0, envMapIntensity: .25 }), uniforms, { bump: 1.6, scale: 1.6 }));
  const ROCKS = 300, rocks = new T.InstancedMesh(rockGeo, rockMat, ROCKS), dummy = new T.Object3D();
  for (let i = 0; i < ROCKS; i++) {
    let x, z, r; do { const a = rand() * 6.283; r = 1.6 + Math.pow(rand(), 1.6) * 50; x = Math.cos(a) * r; z = Math.sin(a) * r - 6; } while (z > 4 && Math.abs(x + 1.1) < 2.4 && r < 12);
    const s = r > 14 && rand() < .18 ? .8 + rand() * 2.2 : .04 + Math.pow(rand(), 3) * .42 * (r < 4 ? .6 : 1);
    dummy.position.set(center.x + x, floorY + height(x, z) - s * .25, center.z + z); dummy.rotation.set(rand() * .5, rand() * 6.28, rand() * .5); dummy.scale.set(s * (.8 + rand() * .5), s * (.7 + rand() * .5), s * (.8 + rand() * .5));
    dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = rocks.receiveShadow = true; rocks.name = 'lunar-rocks'; rocks.raycast = () => {}; group.add(rocks); keep(rocks);

  // The Earth: ocean, continents and cloud bands, lit from the same sun, with a thin limb.
  const sunDir = new T.Vector3(-7, 4.2, 2.6).normalize();
  const earthMat = keep(new T.ShaderMaterial({ uniforms: { uSun: { value: sunDir }, uFade: uniforms.uFade, uSky: { value: 1 }, uTime: { value: 0 } }, fog: false,
    vertexShader: 'varying vec3 vN,vO,vW;void main(){vO=position;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform vec3 uSun;uniform float uFade,uSky,uTime;varying vec3 vN,vO,vW;${NOISE_GLSL}
      void main(){vec3 n=normalize(vN),p=normalize(vO);float l=dot(n,uSun);
        float land=smoothstep(.5,.56,lnF(p*2.3+3.1)),cl=smoothstep(.52,.78,lnF(p*vec3(3.,6.,3.)+vec3(uTime*.004,0.,0.)));
        vec3 c=mix(vec3(.012,.05,.13),mix(vec3(.10,.14,.07),vec3(.33,.27,.17),lnN(p*7.)),land);
        c=mix(c,vec3(.9,.93,.96),cl*.85);float day=smoothstep(-.1,.3,l);
        vec3 col=c*day*1.5+vec3(.9,.7,.4)*.04*(1.-day)*land;
        float rim=pow(1.-max(0.,dot(n,normalize(cameraPosition-vW))),3.);col+=vec3(.22,.48,1.)*rim*smoothstep(-.25,.35,l)*1.1;
        gl_FragColor=vec4(col*uFade*uSky,1.);}` }));
  const earth = new T.Mesh(keep(new T.SphereGeometry(10, 64, 48)), earthMat); earth.position.set(center.x - 62, floorY + 30, center.z - 175); earth.rotation.set(.35, 0, .2); earth.raycast = () => {}; group.add(earth);

  // Horizon haze: a back-lit dust band where the ground meets the sky.
  const hazeMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.BackSide, uniforms: { uFade: uniforms.uFade, uSky: { value: 1 }, uBase: { value: floorY - 6 } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform float uFade,uSky,uBase;varying vec3 vW;void main(){float h=clamp((vW.y-uBase)/9.,0.,1.);gl_FragColor=vec4(vec3(.36,.39,.43)*.55,pow(1.-h,2.6)*.55*uFade*uSky);}' }));
  const haze = new T.Mesh(keep(new T.CylinderGeometry(58, 58, 12, 72, 1, true)), hazeMat); haze.position.set(center.x, floorY, center.z - 6); haze.raycast = () => {}; group.add(haze);

  // Ground mist: two slow, thin layers hugging the regolith around the box.
  const mistMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uFade: uniforms.uFade, uSky: { value: 1 }, uTime: { value: 0 }, uAlpha: { value: .2 } },
    vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uFade,uSky,uTime,uAlpha;varying vec2 vP;${NOISE_GLSL}
      void main(){float r=length(vP);float n=lnF(vec3(vP*.32+vec2(uTime*.035,-uTime*.02),uTime*.03));
        float a=smoothstep(.35,.85,n)*(1.-smoothstep(3.,10.,r))*uAlpha*uFade*uSky;gl_FragColor=vec4(vec3(.62,.67,.74)*a,1.);}` }));
  const mists = [[.06, .22], [.38, .1]].map(([y, a], i) => { const m = i ? mistMat.clone() : mistMat; if (i) keep(m); m.uniforms = { ...mistMat.uniforms, uSky: { value: 1 }, uAlpha: { value: a } };
    const o = new T.Mesh(keep(new T.PlaneGeometry(22, 22)), m); o.rotation.x = -Math.PI / 2; o.position.set(center.x + i * .8, floorY + y, center.z - 1.5); o.renderOrder = 2; o.raycast = () => {}; group.add(o); return o; });

  // A low, hard sun from the left: long shadows, bright brick edges.
  const sun = new T.DirectionalLight(0xfff0de, 3.4); sun.position.copy(sunDir).multiplyScalar(14).add(new T.Vector3(center.x, floorY + 1.5, center.z)); sun.target.position.set(center.x, floorY + 1, center.z);
  sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 34 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .025; sun.shadow.radius = 2.5;
  group.add(sun, sun.target);

  // grow: 0..1 for the ground spreading out; sky: 0..1 for the Earth, haze and mist; light: the sun.
  function update({ fade = 1, grow = 1, sky = 1, light = 1, time = 0, reduced = false }) {
    uniforms.uFade.value = fade; group.visible = fade > .001;
    uniforms.uGrow.value = grow >= 1 ? 1e3 : grow <= 0 ? -9 : .9 + 118 * Math.pow(grow, 2.4); earthMat.uniforms.uSky.value = sky; earth.visible = sky > .001;
    hazeMat.uniforms.uSky.value = sky; for (const m of mists) m.material.uniforms.uSky.value = grow;
    sun.intensity = 3.4 * fade * light; sun.shadow.autoUpdate = fade > .001;
    earthMat.uniforms.uTime.value = reduced ? 0 : time; for (const m of mists) m.material.uniforms.uTime.value = reduced ? 0 : time;
  }
  return {
    group, sun, update, height, uniforms,
    heightAt: (x, z) => floorY + height(x - center.x, z - center.z),
    dispose() { group.removeFromParent(); sun.shadow.map?.dispose(); own.forEach(r => r.dispose?.()); own.clear(); }
  };
}
