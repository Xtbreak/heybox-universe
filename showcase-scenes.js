// Toy dioramas around the three display models, each with a looping slice of its game:
// a dogfight and a rescue at an orbital station, a sentry patrol under fire in a facility
// bay, and a jeep drifting through block towers in a little park town. Built from merged
// flat-shaded batches (one draw per material per cluster); clusters rise into place as
// their chapter fades in, and every loop only runs while its scene is on screen.
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { createToyShip, createToyCarrier } from './toy-ship.js?v=journey-40';

const noop = () => {};
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const PALETTE = {
  paint: 0x2a6fc4, cream: 0xe8c894, trim: 0x2b2b33, accent: 0xf0a92c, purple: 0x6d4b93, lilac: 0xd8c8ea, red: 0xe0483a, hull: 0xe8dcc4,
  steel: 0x66707b, steelDark: 0x353b42, deck: 0x40474f, yellow: 0xf2b632, green: 0x7db45b, greenDark: 0x4f8a3c, leaf: 0x93c75a, bark: 0x8d5c3b,
  peach: 0xf3b28a, mint: 0x9fd8c0, sky: 0x8fc6ea, roof: 0xc8553d, roofBrown: 0x8a4b32, asphalt: 0x50545b, white: 0xf3eee4, wood: 0xb98552
};
const GLOWS = { ice: 0x8fdcff, orange: 0xffa34a, redGlow: 0xff5a4a, warm: 0xffd38a, greenGlow: 0x7dffb0 };

export function createShowcaseScenes({ THREE: T, root, locations }) {
  const own = new Set(), keep = r => (own.add(r), r);
  let seed = 61331; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296), rr = (a, b) => a + (b - a) * rand();
  const mats = {};
  for (const [k, c] of Object.entries(PALETTE)) mats[k] = keep(new T.MeshStandardMaterial({ color: c, roughness: .78, metalness: 0, flatShading: true, envMapIntensity: .55 }));
  mats.panel = keep(new T.MeshStandardMaterial({ color: 0x1d3d7a, roughness: .35, metalness: .4, flatShading: true }));
  mats.metal = keep(new T.MeshStandardMaterial({ color: 0x9aa6b2, roughness: .42, metalness: .6, flatShading: true }));
  for (const [k, c] of Object.entries(GLOWS)) mats[k] = keep(new T.MeshBasicMaterial({ color: c }));
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S = new T.Vector3(1, 1, 1), U = new T.Vector3(), W = new T.Vector3();
  // A batch builder: primitives are baked per material and merged into one mesh each.
  function kit() {
    const batches = new Map();
    const add = (g, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      g.deleteAttribute('uv'); const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose();
      n.applyMatrix4(M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S)); if (!batches.has(key)) batches.set(key, []); batches.get(key).push(n); return k;
    };
    const k = {
      box: (key, w, h, d, ...p) => add(new T.BoxGeometry(w, h, d), key, ...p),
      cyl: (key, rt, rb, h, n, ...p) => add(new T.CylinderGeometry(rt, rb, h, n), key, ...p),
      cone: (key, r, h, n, ...p) => add(new T.ConeGeometry(r, h, n), key, ...p),
      ball: (key, r, d, ...p) => add(new T.IcosahedronGeometry(r, d), key, ...p),
      ring: (key, R, t, n, ...p) => add(new T.TorusGeometry(R, t, 6, n), key, ...p),
      build(parent, name = 'diorama-batch') {
        const g = new T.Group(); g.name = name;
        for (const [key, list] of batches) { const merged = mergeGeometries(list, false); list.forEach(x => x.dispose()); if (!merged) continue; keep(merged); const m = new T.Mesh(merged, mats[key]); m.raycast = noop; g.add(m); }
        batches.clear(); parent?.add(g); return g;
      }
    };
    return k;
  }
  const glowTex = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); if (!g) return null;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return keep(new T.CanvasTexture(c));
  })();
  function sprite(parent, color, size, pos = [0, 0, 0], opacity = 1, additive = true) {
    const s = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending })));
    s.position.set(...pos); s.scale.setScalar(size); s.raycast = noop; parent.add(s); return s;
  }
  // Soft light shafts: brightest at the lamp (uv.y=1), fading out at the far end and at grazing angles.
  function beamMaterial(color, alpha, stripe = 0) {
    return keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uColor: { value: new T.Color(color) }, uAlpha: { value: alpha }, uTime: { value: 0 }, uStripe: { value: stripe } },
      vertexShader: 'varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 uColor;uniform float uAlpha,uTime,uStripe;varying vec2 vUv;varying vec3 vN,vV;void main(){float f=abs(dot(normalize(vN),normalize(vV)));float a=pow(vUv.y,1.4)*f*f*uAlpha*(1.+uStripe*.7*sin(vUv.y*30.+uTime*8.));gl_FragColor=vec4(uColor*max(a,0.),1.);}' }));
  }
  function beam(parent, color, alpha, rTop, rBottom, stripe = 0) {
    const geo = keep(new T.CylinderGeometry(rTop, rBottom, 1, 24, 1, true)); geo.translate(0, -.5, 0);
    const m = new T.Mesh(geo, beamMaterial(color, alpha, stripe)); m.raycast = noop; m.renderOrder = 4; parent.add(m); return m;
  }
  const DOWN = new T.Vector3(0, -1, 0);
  const aim = (m, from, to) => { m.position.copy(from); U.subVectors(to, from); const len = U.length(); m.quaternion.setFromUnitVectors(DOWN, U.multiplyScalar(1 / Math.max(1e-4, len))); m.scale.set(1, len, 1); };
  function motes(parent, count, size, center, color, px) {
    const pos = new Float32Array(count * 3), sd = new Float32Array(count);
    for (let i = 0; i < count; i++) { pos.set([rr(-.5, .5) * size[0], rr(-.5, .5) * size[1], rr(-.5, .5) * size[2]], i * 3); sd[i] = rand(); }
    const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new T.BufferAttribute(sd, 1));
    const m = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new T.Color(color) }, uH: { value: size[1] } },
      vertexShader: `attribute float aSeed;uniform float uTime,uAlpha,uH;varying float vA;void main(){vec3 p=position;p.y=mod(p.y+uH*.5+uTime*(.05+aSeed*.12),uH)-uH*.5;p.x+=sin(uTime*.4+aSeed*40.)*.3;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(${px.toFixed(1)}/-mv.z,1.,6.);vA=uAlpha*(.3+.7*(.5+.5*sin(uTime*(1.+aSeed*2.)+aSeed*50.)))*(1.-smoothstep(.35,.5,abs(p.y/uH)));}`,
      fragmentShader: 'uniform vec3 uColor;varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(uColor,vA*(1.-smoothstep(.1,.5,r)));}' }));
    const p = new T.Points(g, m); p.position.set(...center); p.frustumCulled = false; p.raycast = noop; parent.add(p); return m;
  }
  // A pool of short-lived sprites: puffs, sparks, flashes.
  function pool(parent, n, color, additive) {
    const items = Array.from({ length: n }, () => { const s = sprite(parent, color, 1, [0, 0, 0], 0, additive); s.visible = false; return { s, age: 9, life: 1, v: new T.Vector3(), size: [1, 1], alpha: 1 }; });
    let next = 0;
    return {
      spawn(pos, vel, life, size, alpha = 1) { const it = items[next++ % n]; it.s.position.copy(pos); it.v.copy(vel); it.age = 0; it.life = life; it.size = size; it.alpha = alpha; it.s.visible = true; },
      update(dt) { for (const it of items) { if (it.age >= it.life) { it.s.visible = false; continue; } it.age += dt; const u = clamp(it.age / it.life);
        it.s.position.addScaledVector(it.v, dt); it.v.multiplyScalar(Math.exp(-dt * 1.5)); it.s.scale.setScalar(it.size[0] + (it.size[1] - it.size[0]) * u); it.s.material.opacity = it.alpha * Math.sin(Math.PI * Math.min(1, u * 1.15 + .05)) * (1 - u * .3); } }
    };
  }
  const scenes = [];
  function stage(name, at) {
    const g = new T.Group(); g.name = `showcase-${name}`; g.position.set(...at); g.visible = false; root.add(g);
    const sc = { g, clusters: [], animate: noop, fade: 0, mote: null }; scenes.push(sc);
    // Every cluster rises into place on its own beat while the chapter fades in.
    sc.cluster = (o, delay, drop = 3) => { sc.clusters.push({ o, delay, drop, y: o.position.y, s: o.scale.clone() }); if (!o.parent) g.add(o); return o; };
    return sc;
  }
  const group = (parent, p = [0, 0, 0]) => { const g = new T.Group(); g.position.set(...p); parent?.add(g); return g; };

  // ---------- 1. Deep-space rescue ----------
  {
    const sc = stage('rescue', locations.helmet), g = sc.g;
    // Orbital station: a turning habitat wheel on a hub with long solar arrays.
    const station = sc.cluster(group(null, [-10, 7.5, -26]), .05, 6); station.rotation.set(.3, .6, .12);
    const hub = kit(); hub.cyl('paint', .9, .9, 2.6, 12, 0, 0, 0, Math.PI / 2).cyl('cream', .6, .9, .8, 12, 0, 0, 1.6, Math.PI / 2).cyl('trim', .14, .14, 9, 6, 0, 0, -4.4, Math.PI / 2);
    for (const z of [-5.2, -7.6]) for (const s of [-1, 1]) { hub.box('panel', 3.6, .05, 1.8, s * 2.4, 0, z); hub.box('trim', 3.7, .08, .08, s * 2.4, 0, z - .92); hub.box('trim', .1, .1, .1, s * .5, 0, z); }
    hub.box('hull', 1.2, 1.2, 1.4, 0, 1.3, .4).box('accent', 1.25, .2, 1.45, 0, 1.6, .4).build(station);
    const wheel = group(station); { const k = kit(); k.ring('hull', 3.4, .32, 40).ring('trim', 3.4, .14, 40, 0, 0, .28);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.box('trim', .16, 2.6, .16, Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0, 0, 0, a - Math.PI / 2); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(i % 3 ? 'cream' : 'paint', .6, .55, .7, Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0, 0, 0, a); }
      k.build(wheel); }
    const beacons = [[0, 0, 1.9, 0xff5a4a], [0, 0, -9, 0x7dffb0], [4.2, 0, -7.6, 0xff5a4a], [-4.2, 0, -5.2, 0x7dffb0]].map(([x, y, z, c]) => sprite(station, c, .9, [x, y, z]));
    // The rescue carrier, holding station, with a tractor beam reeling in an escape pod.
    const ship = sc.cluster(group(null, [9.5, 3.4, -16]), .25, 4), carrier = createToyCarrier({ THREE: T, length: 7.5 });
    carrier.root.rotation.y = Math.PI / 2 - .4; ship.add(carrier.root); carrier.root.traverse(o => { o.raycast = noop; });
    const engines = carrier.engineLayout.map(p => sprite(carrier.root, 0xffa34a, 1.1, p, .9));
    const podRig = sc.cluster(group(null), .45, 2), pod = group(podRig); { const k = kit(); k.cyl('cream', .2, .27, .55, 10).ring('accent', .27, .05, 14, 0, -.05, 0, Math.PI / 2).box('ice', .2, .12, .05, 0, .08, .25).cone('trim', .08, .2, 6, 0, .37, 0); k.build(pod); }
    const podLight = sprite(pod, 0xffa34a, .45, [0, .5, 0]), tractor = beam(podRig, 0x8fdcff, .55, .45, 1.05, 1);
    const podFrom = new T.Vector3(6.4, -1.1, -10.5), belly = new T.Vector3(9.5, 2.3, -16);
    // Dogfight: our starfighter chases a raider round a figure-eight and finally downs it.
    const fight = sc.cluster(group(null), .35, 2);
    const hero = createToyShip({ THREE: T, faction: 'player', length: 1.6 }), raider = createToyShip({ THREE: T, faction: 'enemy', length: 1.45 });
    for (const s of [hero, raider]) { fight.add(s.root); s.root.traverse(o => { o.raycast = noop; }); }
    const heroFlame = hero.engineLayout.map(p => sprite(hero.root, 0x8fdcff, .45, p)), raiderFlame = raider.engineLayout.map(p => sprite(raider.root, 0xff5a4a, .4, p));
    const boltGeo = keep(new T.BoxGeometry(.05, .05, .5)), bolts = Array.from({ length: 10 }, () => { const m = new T.Mesh(boltGeo, mats.ice); m.visible = false; m.raycast = noop; fight.add(m); return { m, t: 9, from: new T.Vector3(), to: new T.Vector3() }; });
    const shardGeo = keep(new T.BoxGeometry(.13, .13, .13)), shards = Array.from({ length: 22 }, (_, i) => { const m = new T.Mesh(shardGeo, [mats.purple, mats.lilac, mats.red, mats.orange][i % 4]); m.visible = false; m.raycast = noop; fight.add(m); return { m, v: new T.Vector3(), w: new T.Vector3() }; });
    const flash = sprite(fight, 0xffb46a, 1, [0, 0, 0], 0), sparks = pool(fight, 16, 0xffd38a, true);
    const D = new T.Vector3(-4, 3.2, -12), path = (s, out) => out.set(D.x + Math.sin(s) * 5.6, D.y + Math.sin(2 * s) * 1.1 + Math.cos(s) * .4, D.z + Math.cos(s) * 3);
    const pA = new T.Vector3(), pB = new T.Vector3(), pC = new T.Vector3();
    function fly(obj, s, bankScale = 1) {
      path(s, pA); path(s + .04, pB); path(s + .08, pC); obj.position.copy(pA);
      obj.lookAt(W.copy(pA).multiplyScalar(2).sub(pB)); U.subVectors(pB, pA).cross(V.subVectors(pC, pB)); obj.rotateZ(Math.max(-.9, Math.min(.9, -U.y * 900)) * bankScale);
    }
    // Wreckage of the raid: broken hull plates tumbling slowly around the stage.
    const wreck = [];
    for (let i = 0; i < 18; i++) {
      let x, y, z; do { x = rr(-13, 15); y = rr(-3.2, 6.5); z = rr(-26, 3); } while (x > -8 && x < 4 && y > -2.8 && y < 4.2);
      const o = sc.cluster(group(null, [x, y, z]), .1 + rand() * .6, 2.5), k = kit(), s = rr(.35, 1.1);
      k.box(['hull', 'paint', 'cream', 'steel'][i % 4], s, s * rr(.15, .4), s * rr(.5, 1.2)).box(['trim', 'accent', 'paint'][i % 3], s * rr(.3, .7), s * rr(.2, .5), s * rr(.2, .6), s * .3, s * .2, s * rr(-.3, .3), rr(0, 1), rr(0, 1), 0);
      if (i % 3 === 0) k.box('steelDark', s * .9, s * .08, s * .08, 0, -s * .2, s * .3, 0, .5, .3);
      k.build(o); o.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      wreck.push({ o, w: new T.Vector3(rr(-.25, .25), rr(-.25, .25), rr(-.25, .25)), spark: i % 4 === 1 ? sprite(o, 0xffa34a, .5, [s * .3, 0, 0], 0) : null, ph: rand() * 9, y });
    }
    sc.mote = motes(g, 260, [30, 14, 26], [0, 1, -8], 0xd6f1ff, 30);
    let fired = 0, boom = false;
    sc.animate = (t, dt, ev) => {
      wheel.rotation.z = t * .14; beacons.forEach((b, i) => { b.material.opacity = (t * .8 + i * .27) % 1 < .14 ? 1 : .06; });
      ship.position.y = ship.userData.baseY + Math.sin(t * .4) * .14; carrier.root.rotation.z = Math.sin(t * .31) * .025;
      engines.forEach((e, i) => { e.material.opacity = .75 + .25 * Math.sin(t * 23 + i * 2); });
      // Rescue loop (9 s): beam on, reel the pod up into the hold, beam off.
      const c = t % 9, reel = smooth(1, 7, c), inside = smooth(6.8, 7.4, c), beamOn = smooth(.3, 1.1, c) * (1 - smooth(7.4, 8.4, c));
      pod.position.lerpVectors(podFrom, belly, reel); pod.position.y += Math.sin(t * 1.7) * .08 * (1 - reel); pod.rotation.set(Math.sin(t * .9) * .4, t * .8, Math.cos(t * .7) * .3);
      pod.scale.setScalar(Math.max(.001, (1 - inside) * smooth(0, .6, c))); podLight.material.opacity = (t * 1.6) % 1 < .3 ? 1 : .15;
      aim(tractor, belly, pod.position); tractor.material.uniforms.uAlpha.value = .55 * beamOn; tractor.material.uniforms.uTime.value = t; tractor.visible = beamOn > .01;
      if (c > 7 && c - dt <= 7) ev.push({ name: 'pickup', intensity: .12, pan: .5 });
      // Dogfight loop (8 s): chase, bursts of fire, the raider breaks apart, then warps back in.
      const s = t * .55, f = t % 8; fly(hero.root, s - .55); fly(raider.root, s, 1.2);
      heroFlame.forEach(e => { e.material.opacity = .7 + .3 * Math.sin(t * 31); });
      const alive = f < 5.4 || f > 6.6; raider.root.scale.setScalar(f > 6.6 ? smooth(6.6, 7.1, f) : alive ? 1 : .001);
      raiderFlame.forEach(e => { e.visible = alive; });
      if (f > .8 && f < 5.2 && Math.floor(f / .14) !== fired && Math.floor(f / .14) % 5 < 3) {
        fired = Math.floor(f / .14); const b = bolts.find(x => x.t >= 1) || bolts[0]; b.t = 0;
        b.from.copy(hero.root.position); b.to.copy(raider.root.position).addScaledVector(W.subVectors(raider.root.position, hero.root.position).normalize(), .2);
        if (fired % 5 === 0) ev.push({ name: 'plasma', intensity: .05, pan: -.3 });
      }
      for (const b of bolts) { if (b.t >= 1) { b.m.visible = false; continue; } b.t += dt / .2; b.m.visible = true; b.m.position.lerpVectors(b.from, b.to, Math.min(1, b.t)); b.m.lookAt(fight.localToWorld(W.copy(b.to)));
        if (b.t >= 1) sparks.spawn(b.to, W.set(rr(-1, 1), rr(-1, 1), rr(-1, 1)), .25, [.25, .6], .9); }
      if (f >= 5.4 && !boom) { boom = true; ev.push({ name: 'explosion', intensity: .16, pan: -.3 }); flash.position.copy(raider.root.position);
        for (const sh of shards) { sh.m.visible = true; sh.m.position.copy(raider.root.position); sh.v.set(rr(-1, 1), rr(-.6, 1), rr(-1, 1)).normalize().multiplyScalar(rr(1.5, 4)); sh.w.set(rr(-8, 8), rr(-8, 8), rr(-8, 8)); }
        for (let i = 0; i < 6; i++) sparks.spawn(raider.root.position, W.set(rr(-2, 2), rr(-2, 2), rr(-2, 2)), .6, [.4, 1.4], 1); }
      if (f < 5.4) boom = false;
      const ef = f - 5.4; flash.material.opacity = ef > 0 && ef < .7 ? 1 - ef / .7 : 0; flash.scale.setScalar(1 + ef * 7);
      for (const sh of shards) { if (!sh.m.visible) continue; sh.m.position.addScaledVector(sh.v, dt); sh.m.rotation.x += sh.w.x * dt; sh.m.rotation.y += sh.w.y * dt; sh.m.scale.setScalar(Math.max(.001, 1 - ef / 1.5)); if (ef > 1.5 || ef < 0) sh.m.visible = false; }
      sparks.update(dt);
      for (const w of wreck) { w.o.rotation.x += w.w.x * dt; w.o.rotation.y += w.w.y * dt; w.o.rotation.z += w.w.z * dt; if (w.spark) w.spark.material.opacity = Math.sin(t * 9 + w.ph) > .6 ? .9 : 0; }
    };
    ship.userData.baseY = 3.4;
  }

  // ---------- 2. Facility breach ----------
  {
    const sc = stage('facility', locations.robot), g = sc.g, Y = -1.95, GX = -2;
    const deck = kit(); deck.box('deck', 22, .2, 15, 0, Y - .1, -2.5);
    for (let x = -10; x <= 10; x += 2) deck.box('steelDark', .04, .02, 15, x, Y + .01, -2.5);
    for (let z = -9; z <= 4; z += 2) deck.box('steelDark', 22, .02, .04, 0, Y + .01, z);
    for (let i = 0; i < 22; i++) deck.box(i % 2 ? 'yellow' : 'trim', 1, .03, .35, -10.5 + i, Y + .02, 4.6);
    for (let i = 0; i < 8; i++) deck.box(i % 2 ? 'yellow' : 'trim', .5, .03, .35, GX - 1.75 + i * .5, Y + .02, -8.2);
    sc.cluster(deck.build(null, 'facility-deck'), 0, 1.5);
    // Back wall with a blast gate, ribs, a pipe run, valves and a catwalk.
    const wall = kit(), WY = 1.55;
    wall.box('steel', 8.6, 7, .4, -7.8, WY, -9).box('steel', 10.6, 7, .4, 5.3, WY, -9).box('steel', 3.4, 2.5, .4, GX, 3.8, -9);
    for (let x = -9.4; x <= 9.6; x += 2.2) if (x < GX - 2.2 || x > GX + 2.2) wall.box('steelDark', .3, 7, .3, x, WY, -8.7);
    wall.box('steelDark', 20, .4, .5, 0, 5.1, -8.8);
    for (let i = 0; i < 8; i++) { wall.box(i % 2 ? 'yellow' : 'trim', .42, .45, .5, GX - 1.8, Y + .225 + i * .45, -8.75); wall.box(i % 2 ? 'trim' : 'yellow', .42, .45, .5, GX + 1.8, Y + .225 + i * .45, -8.75); }
    for (let i = 0; i < 9; i++) wall.box(i % 2 ? 'yellow' : 'trim', .45, .4, .5, GX - 1.8 + i * .45, 2.75, -8.75);
    for (const s of [-1, 1]) { wall.box('steelDark', .3, 4.5, 3.4, GX + s * 1.9, Y + 2.25, -10.8).box('trim', .32, 4.5, .2, GX + s * 1.9, Y + 2.25, -12.5); for (const z of [-9.8, -10.8, -11.8]) wall.box('ice', .05, 2.6, .1, GX + s * 1.74, Y + 1.7, z); }
    wall.box('steelDark', 4.1, .3, 3.4, GX, Y + 4.4, -10.8);
    wall.cyl('accent', .18, .18, 20, 10, 0, 3.9, -8.45, 0, 0, Math.PI / 2).cyl('steel', .12, .12, 20, 8, 0, 4.4, -8.5, 0, 0, Math.PI / 2);
    for (const x of [-6.6, 2, 6.2]) { wall.cyl('accent', .18, .18, 5.85, 10, x, .98, -8.45).ball('accent', .22, 1, x, 3.9, -8.45);
      for (const y of [-1.2, 1.4, 3.3]) wall.cyl('trim', .25, .25, .12, 10, x, y, -8.45); wall.ring('red', .28, .05, 12, x, .4, -8.15).box('red', .5, .05, .05, x, .4, -8.15).box('red', .05, .5, .05, x, .4, -8.15); }
    wall.cyl('accent', .22, .22, 12, 10, 8.6, Y + .3, -3, Math.PI / 2); for (const z of [-7, -3, 1]) wall.box('trim', .5, .3, .2, 8.6, Y + .1, z);
    // Catwalk on the right, with railings and stairs.
    wall.box('metal', 2.4, .12, 4, 6, 1.3, -6.5); for (const z of [-8.4, -6.5, -4.6]) for (const x of [4.9, 7.1]) wall.box('trim', .08, 3.25, .08, x, Y + 1.62, z);
    for (const z of [-8.4, -6.5, -4.6]) wall.box('yellow', .06, .9, .06, 4.85, 1.8, z); wall.box('yellow', .06, .06, 4, 4.85, 2.25, -6.5).box('yellow', .06, .06, 4, 4.85, 1.85, -6.5);
    for (let i = 0; i < 6; i++) wall.box('metal', 1.2, .08, .45, 6.6, 1.3 - (i + 1) * .5, -4.3 + i * .42);
    // Overhead gantry with hanging lamps.
    wall.box('steelDark', 22, .35, .4, 0, 5.8, -4).box('trim', .4, 7.8, .4, -10.6, 1.95, -4).box('trim', .4, 7.8, .4, 10.6, 1.95, -4);
    for (const x of [-6, -1.5, 3]) wall.box('trim', .04, .8, .04, x, 5.25, -4).box('steel', .9, .18, .4, x, 4.8, -4);
    sc.cluster(wall.build(null, 'facility-wall'), .15, 4);
    const doors = sc.cluster(group(null), .3, 4), doorL = group(doors), doorR = group(doors), gateGlow = sprite(doors, 0x8fdcff, 5, [GX, Y + 2.3, -11], .25);
    for (const [d, s] of [[doorL, -1], [doorR, 1]]) { const k = kit(); k.box('steel', 1.7, 4.6, .25, 0, 0, 0).box('yellow', 1.7, .3, .27, 0, 1.3, 0).box('yellow', 1.7, .3, .27, 0, -1.3, 0).box('trim', .12, 4.6, .27, -s * .79, 0, 0).box('ice', .5, .08, .27, -s * .4, .4, 0); k.build(d); d.position.set(GX + s * .85, Y + 2.3, -9); }
    // Crates and barrels.
    const props = kit();
    for (const [x, y, z, s, key] of [[-7.4, 0, 1.3, 1, 'wood'], [-6.3, 0, 1.6, .9, 'accent'], [-7, 1, 1.4, .8, 'wood'], [-8.2, 0, -.6, 1.1, 'paint'], [6.6, 0, 2.2, .9, 'wood'], [7.5, 0, 1.4, .7, 'accent']]) {
      const h = Y + s / 2 + y * .95; props.box(key, s, s, s, x, h, z).box('trim', s * 1.02, .08, s * 1.02, x, h + s * .42, z).box('trim', s * 1.02, .08, s * 1.02, x, h - s * .42, z);
    }
    for (const [x, z, key] of [[-5.2, -2.6, 'red'], [-4.6, -3.2, 'yellow'], [-5.6, -3.4, 'red'], [5.3, .2, 'yellow']]) props.cyl(key, .32, .32, .9, 12, x, Y + .45, z).cyl('trim', .33, .33, .08, 12, x, Y + .7, z).cyl('trim', .33, .33, .08, 12, x, Y + .2, z);
    sc.cluster(props.build(null, 'facility-props'), .4, 2.5);
    // Flickering lamps, rotating beacons, a sweeping searchlight.
    const lamps = sc.cluster(group(null), .5, 3), lampMeshes = [-6, -1.5, 3].map(x => { const m = new T.Mesh(keep(new T.BoxGeometry(.8, .05, .3)), mats.ice); m.position.set(x, 4.69, -4); m.raycast = noop; lamps.add(m); return { m, glow: sprite(lamps, 0x8fdcff, 1.6, [x, 4.6, -4], .5) }; });
    const cones = lampMeshes.map(l => { const b = beam(lamps, 0x8fdcff, .12, .25, 1.6); aim(b, l.m.position, V.set(l.m.position.x, Y, -2.5)); return b; });
    const beacons = [-6.3, -2.7].map((x, i) => { const r = group(lamps, [x, Y + 3.75, -8.6]); const k = kit(); k.cyl('trim', .16, .2, .15, 10, x, Y + 3.67, -8.6).build(lamps);
      sprite(r, 0xffa34a, .7, [0, .12, 0]); const b = beam(r, 0xffa34a, .5, .05, .9); b.rotation.z = Math.PI / 2; b.scale.y = 3.5; b.position.y = .12; return r; });
    const spotDisc = new T.Mesh(keep(new T.CircleGeometry(1.3, 32)), keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColor: { value: new T.Color(0xcfe9ff) } },
      vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 uColor;varying vec2 vP;void main(){float r=length(vP)/1.3;gl_FragColor=vec4(uColor*(1.-smoothstep(.55,1.,r))*.35,1.);}' })));
    spotDisc.rotation.x = -Math.PI / 2; spotDisc.raycast = noop; lamps.add(spotDisc); const spotBeam = beam(lamps, 0xcfe9ff, .16, .12, 1.25);
    // Patrol: a sentry walks the bay, a drone sweeps the catwalk, a mini robot fires on them.
    const actors = sc.cluster(group(null), .6, 2);
    const bot = (paint, visor) => { const r = group(actors), body = group(r, [0, .62, 0]), k = kit(); k.box(paint, .42, .46, .3, 0, 0, 0).box('trim', .44, .08, .32, 0, -.2, 0).box(paint, .38, .3, .32, 0, .4, 0).box(visor, .3, .08, .05, 0, .42, .17).cyl('trim', .03, .03, .2, 6, .12, .65, 0);
      k.build(body); const legs = [-1, 1].map(s => { const l = group(r, [s * .12, .42, 0]), kk = kit(); kk.box('trim', .1, .36, .12, 0, -.18, 0).box(paint, .14, .08, .2, 0, -.38, .03); kk.build(l); return l; });
      const arms = [-1, 1].map(s => { const a = group(body, [s * .27, .12, 0]), kk = kit(); kk.box('trim', .08, .3, .08, 0, -.12, 0); kk.build(a); return a; }); return { r, body, legs, arms }; };
    const sentry = bot('purple', 'redGlow'), shooter = bot('yellow', 'ice'); shooter.r.position.set(5.6, 1.36, -5.4); shooter.r.scale.setScalar(1.1);
    const gun = kit(); gun.box('trim', .08, .08, .36, 0, -.25, .15).build(shooter.arms[0]); shooter.arms[0].rotation.x = -1.35;
    const drone = group(actors), droneRing = group(drone); { const k = kit(); k.ball('purple', .28, 1).box('redGlow', .14, .06, .05, 0, 0, .27); k.build(drone); const kr = kit(); kr.ring('trim', .45, .04, 20, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 4; i++) kr.cyl('steel', .12, .12, .03, 8, Math.cos(i * 1.57) * .45, .05, Math.sin(i * 1.57) * .45); kr.build(droneRing); }
    const droneScan = beam(actors, 0xff5a4a, .3, .02, .5);
    const shots = Array.from({ length: 6 }, () => { const m = new T.Mesh(keep(new T.BoxGeometry(.06, .06, .45)), mats.ice); m.visible = false; m.raycast = noop; actors.add(m); return { m, t: 9, from: new T.Vector3(), to: new T.Vector3(), target: null }; });
    const sparks = pool(actors, 18, 0x9fe4ff, true), steam = pool(actors, 18, 0x9aa3ad, false);
    sc.mote = motes(g, 200, [22, 9, 16], [0, 2, -3], 0xbfe6ff, 24);
    let shotIndex = -1, steamClock = 0, hitFlinch = 0, gateOpened = false;
    sc.animate = (t, dt, ev, p) => {
      // The gate stays shut on the plateau (just cycling its locks) and slides open as the camera leaves for it.
      const leave = smooth(.648, .66, p), gc = t % 7, peek = smooth(2, 2.6, gc) * (1 - smooth(3.6, 4.4, gc)) * .12, open = Math.max(leave, peek);
      doorL.position.x = GX - .85 - open * 1.7; doorR.position.x = GX + .85 + open * 1.7; gateGlow.material.opacity = .25 + .75 * open;
      if (gc > 2 && gc - dt <= 2) ev.push({ name: 'warning', intensity: .05, pan: -.2 });
      if (leave > .02 && !gateOpened) { gateOpened = true; ev.push({ name: 'shift', intensity: .3, pan: 0 }); } if (leave < .01) gateOpened = false;
      lampMeshes.forEach((l, i) => { const on = i === 1 ? (Math.sin(t * 37) + Math.sin(t * 11.3) > -.9 ? 1 : .08) : (Math.sin(t * 29 + i * 5) + Math.sin(t * 5.1 + i) > -1.75 ? 1 : .15); l.m.visible = on > .5; l.glow.material.opacity = .5 * on; cones[i].material.uniforms.uAlpha.value = .12 * on; });
      beacons.forEach((b, i) => { b.rotation.y = t * 2.4 + i * Math.PI; });
      const sx = Math.sin(t * .33) * 5.5, sz = -3 + Math.sin(t * .51) * 2.6; spotDisc.position.set(sx, Y + .03, sz); aim(spotBeam, V.set(sx * .6, 5.6, -4), spotDisc.position);
      // Sentry: walks left and right along the bay.
      const wx = -3.4 + Math.sin(t * .45) * 3.4, dir = Math.cos(t * .45) >= 0 ? 1 : -1; sentry.r.position.set(wx, Y, -5.5);
      sentry.r.rotation.y = THREE_DAMP(sentry.r.rotation.y, dir * Math.PI / 2, dt * 6); const step = Math.sin(t * 7);
      sentry.legs[0].rotation.x = step * .5; sentry.legs[1].rotation.x = -step * .5; sentry.arms[0].rotation.x = -step * .4; sentry.arms[1].rotation.x = step * .4; sentry.body.position.y = .62 + Math.abs(step) * .03;
      hitFlinch = Math.max(0, hitFlinch - dt * 4); sentry.body.rotation.z = Math.sin(t * 40) * .15 * hitFlinch;
      drone.position.set(2.5 + Math.sin(t * .37) * 3, 2.3 + Math.sin(t * 1.3) * .18, -7.3); droneRing.rotation.y = t * 9; drone.rotation.y = Math.sin(t * .37 + 1.57) * .8;
      aim(droneScan, drone.position, V.set(drone.position.x + Math.sin(t * 2) * .8, Y, drone.position.z + 1.2)); droneScan.material.uniforms.uTime.value = t;
      // The mini robot tracks the sentry and fires in pairs.
      const tx = sentry.r.position.x - shooter.r.position.x, tz = sentry.r.position.z - shooter.r.position.z; shooter.r.rotation.y = Math.atan2(tx, tz);
      shooter.legs[0].rotation.x = shooter.legs[1].rotation.x = 0; shooter.body.position.y = .62 + Math.sin(t * 2) * .01;
      const si = Math.floor(t / .7); if (si !== shotIndex) { shotIndex = si; if (si % 3 < 2) { const s = shots.find(x => x.t >= 1) || shots[0]; s.t = 0; shooter.arms[0].updateWorldMatrix(true, false);
        s.from.set(0, -.25, .35); shooter.arms[0].localToWorld(s.from); actors.worldToLocal(s.from); s.to.set(sentry.r.position.x, Y + .9, sentry.r.position.z); if (si % 3 === 0) ev.push({ name: 'plasma', intensity: .05, pan: .4 }); } }
      for (const s of shots) { if (s.t >= 1) { s.m.visible = false; continue; } s.t += dt / .28; s.m.visible = true; s.m.position.lerpVectors(s.from, s.to, Math.min(1, s.t)); s.m.lookAt(actors.localToWorld(W.copy(s.to)));
        if (s.t >= 1) { hitFlinch = 1; for (let i = 0; i < 4; i++) sparks.spawn(s.to, W.set(rr(-1.5, 1.5), rr(0, 2), rr(-1.5, 1.5)), .35, [.15, .45], 1); } }
      sparks.update(dt);
      steamClock -= dt; if (steamClock < 0) { steamClock = .22; for (const [x, z] of [[-5.6, 1.4], [4.6, .8]]) steam.spawn(V.set(x + rr(-.1, .1), Y + .1, z), W.set(rr(-.1, .1), rr(.6, 1), rr(-.1, .1)), 2.2, [.3, 1.6], .22); }
      steam.update(dt);
    };
  }

  // ---------- 3. Toy park ----------
  {
    const sc = stage('park', locations.car), g = sc.g, Y = -1.72;
    const land = kit();
    for (const s of [-1, 1]) { land.box('green', 15, .3, 92, s * 11.1, Y - .17, -36).box('cream', .25, .12, 92, s * 3.7, Y - .04, -36); }
    for (let i = 0; i < 160; i++) { const s = rand() < .5 ? -1 : 1, x = s * rr(4.2, 18), z = rr(-58, 8); land.box(['yellow', 'white', 'red', 'lilac'][i % 4], .07, .03, .07, x, Y - .01, z); }
    sc.cluster(land.build(null, 'park-land'), 0, 1.5);
    // Drift pad with a block tower the jeep keeps knocking over.
    const P0 = new T.Vector3(6.4, Y, -6), RAD = 1.55;
    const pad = kit(); pad.cyl('asphalt', 2.45, 2.45, .06, 40, P0.x, Y + .02, P0.z);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; if (i % 2) pad.box('white', .05, .02, .3, P0.x + Math.cos(a) * 2.25, Y + .06, P0.z + Math.sin(a) * 2.25, 0, -a, 0); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + .2; pad.cone('accent', .12, .32, 8, P0.x + Math.cos(a) * 2.75, Y + .16, P0.z + Math.sin(a) * 2.75).box('white', .17, .05, .17, P0.x + Math.cos(a) * 2.75, Y + .025, P0.z + Math.sin(a) * 2.75); }
    sc.cluster(pad.build(null, 'park-pad'), .2, 2);
    // Town: little houses facing the road, trees, a billboard and a Ferris wheel.
    const town = kit(), spots = [];
    for (let i = 0; i < 12; i++) {
      const s = i % 2 ? 1 : -1, x = s * rr(8.5, 15), z = -8 - Math.floor(i / 2) * 6 - rr(0, 2.5), w = rr(1.6, 2.3), h = rr(1.2, 1.9), d = rr(1.6, 2.2);
      if ((s < 0 && z > -20) || (s > 0 && z > -12)) continue; spots.push([x, z, 2]);
      const body = ['peach', 'mint', 'sky', 'cream', 'white', 'lilac'][i % 6], face = -s;
      town.box(body, w, h, d, x, Y + h / 2, z, 0, 0, 0).cone(i % 3 ? 'roof' : 'roofBrown', Math.max(w, d) * .78, .95, 4, x, Y + h + .47, z, 0, Math.PI / 4, 0);
      town.box('wood', .05, .7, .42, x + face * w / 2, Y + .35, z).box('warm', .05, .34, .34, x + face * w / 2, Y + h * .62, z + d * .28).box('warm', .05, .34, .34, x + face * w / 2, Y + h * .62, z - d * .28);
      if (i % 3 === 0) town.box('trim', .25, .5, .25, x + w * .25, Y + h + .6, z - d * .2);
    }
    spots.push([P0.x, P0.z, 3.2], [-13, -31, 5], [-8.5, -15, 2.4], [-5.8, -4.5, 1.6], [9.6, -2.6, 1]);
    let trees = 0;
    for (let tries = 0; tries < 400 && trees < 46; tries++) {
      const s = rand() < .5 ? -1 : 1, x = s * rr(4.4, 18), z = rr(-56, 6); if (spots.some(([a, b, r]) => Math.hypot(x - a, z - b) < r + .6)) continue;
      trees++; const sz = rr(.7, 1.25), pine = rand() < .35;
      town.cyl('bark', .07 * sz, .09 * sz, .55 * sz, 6, x, Y + .27 * sz, z);
      if (pine) town.cone('greenDark', .5 * sz, 1.3 * sz, 7, x, Y + 1.1 * sz, z); else town.ball(rand() < .5 ? 'leaf' : 'green', .48 * sz, 0, x, Y + .85 * sz, z, rand(), rand(), 0);
    }
    for (const z of [1.6, -11.6, -21.5, -31.4, -41.3]) for (const s of [-1, 1]) town.cyl('trim', .05, .06, 2.4, 6, s * 4.6, Y + 1.2, z).box('trim', .5, .05, .05, s * 4.4, Y + 2.38, z).ball('warm', .11, 1, s * 4.18, Y + 2.3, z);
    town.box('trim', .12, 2.4, .12, -10, Y + 1.2, -15).box('trim', .12, 2.4, .12, -7, Y + 1.2, -15).box('accent', 3.4, .14, .2, -8.5, Y + 3.25, -15);
    town.box('trim', .08, 1.1, .08, -5, Y + .55, 1).box('accent', .7, .45, .05, -5, Y + 1.15, 1.03);
    for (const [x, z, n] of [[-5.4, -3.5, 3], [-6.2, -5.5, 4], [9.6, -2.6, 3]]) for (let i = 0; i < n; i++) town.box(['red', 'yellow', 'paint', 'mint'][i % 4], .42, .42, .42, x + (i % 2) * .05, Y + .21 + i * .42, z, 0, i * .3, 0);
    sc.cluster(town.build(null, 'park-town'), .25, 4);
    const signTex = (() => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = 512; c.height = 176; const x = c.getContext('2d'); if (!x) return null;
      x.fillStyle = '#fff3dc'; x.fillRect(0, 0, 512, 176); x.fillStyle = '#2a6fc4'; x.fillRect(0, 140, 512, 36); x.fillStyle = '#f0a92c'; x.fillRect(0, 0, 512, 16);
      x.fillStyle = '#593724'; x.font = "900 80px 'Avenir Next','Helvetica Neue',Arial,sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('HEYBOX PARK', 256, 80);
      const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t; })();
    const sign = new T.Mesh(keep(new T.PlaneGeometry(3.2, 1.1)), keep(new T.MeshBasicMaterial({ map: signTex, color: 0xdddddd }))); sign.position.set(-8.5, Y + 2.55, -14.88); sign.raycast = noop; sc.cluster(sign, .4, 4);
    const ferris = sc.cluster(group(null, [-13, Y, -31]), .35, 6), wheel = group(ferris, [0, 4.8, 0]); { const k = kit();
      for (const s of [-1, 1]) { k.box('trim', .18, 5.4, .18, -1.4, 2.5, s * .6, 0, 0, -.28).box('trim', .18, 5.4, .18, 1.4, 2.5, s * .6, 0, 0, .28); } k.cyl('accent', .3, .3, 1.5, 10, 0, 4.8, 0, Math.PI / 2).box('red', 4.4, .3, 1.8, 0, .15, 0); k.build(ferris); }
    { const k = kit(); k.ring('red', 4, .1, 48, 0, 0, .55).ring('red', 4, .1, 48, 0, 0, -.55).ring('cream', 2.6, .06, 40, 0, 0, .55);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box('trim', .07, 4, .07, Math.cos(a) * 2, Math.sin(a) * 2, .55, 0, 0, a - Math.PI / 2).box('trim', .07, 4, .07, Math.cos(a) * 2, Math.sin(a) * 2, -.55, 0, 0, a - Math.PI / 2); }
      k.build(wheel); }
    const gondolas = Array.from({ length: 10 }, (_, i) => { const o = group(wheel), k = kit(); k.box(['paint', 'accent', 'mint', 'red', 'yellow'][i % 5], .6, .5, .7, 0, -.4, 0).box('trim', .66, .06, .76, 0, -.12, 0).box('trim', .04, .3, .04, 0, .05, 0); k.build(o); return o; });
    const rimLights = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return sprite(wheel, 0xffd38a, .55, [Math.cos(a) * 4, Math.sin(a) * 4, .62]); });
    // The drifting jeep.
    const drift = sc.cluster(group(null), .5, 2), jeep = group(drift); { const k = kit();
      k.box('red', .56, .24, 1, 0, .26, 0).box('cream', .5, .22, .5, 0, .48, .08).box('ice', .46, .14, .04, 0, .5, -.18).box('trim', .58, .05, 1.02, 0, .16, 0).box('trim', .6, .1, .12, 0, .2, -.52);
      for (const [x, z] of [[-.3, -.33], [.3, -.33], [-.3, .33], [.3, .33]]) k.cyl('trim', .14, .14, .12, 10, x, .14, z, 0, 0, Math.PI / 2); k.cyl('trim', .13, .13, .1, 10, 0, .32, .55, Math.PI / 2).box('warm', .1, .06, .03, -.18, .28, -.51).box('warm', .1, .06, .03, .18, .28, -.51); k.build(jeep); }
    const blockMats = ['red', 'yellow', 'paint', 'mint', 'cream', 'accent', 'purple', 'red'], blockGeo = keep(new T.BoxGeometry(.26, .26, .26)), BA = Math.PI * .5;
    const towerAt = new T.Vector3(P0.x + Math.cos(BA) * (RAD + .1), Y, P0.z + Math.sin(BA) * (RAD + .1));
    const blocks = blockMats.map((key, i) => { const m = new T.Mesh(blockGeo, mats[key]); m.raycast = noop; drift.add(m); const home = new T.Vector3(towerAt.x + (i % 2 - .5) * .27, Y + .18 + Math.floor(i / 2) * .26, towerAt.z + ((i >> 1) % 2 - .5) * .1);
      m.position.copy(home); return { m, home, v: new T.Vector3(), w: new T.Vector3(), from: new T.Vector3(), q: new T.Quaternion() }; });
    const smoke = pool(drift, 26, 0xd9d4cc, false), dust = pool(drift, 12, 0xffe1a8, true), qId = new T.Quaternion();
    sc.mote = motes(g, 220, [30, 6, 40], [0, 1, -14], 0xffd9a8, 22);
    let lastLap = 0, hitAt = -9, puff = 0;
    sc.animate = (t, dt, ev) => {
      wheel.rotation.z = t * .18; gondolas.forEach((o, i) => { const a = i / 10 * Math.PI * 2; o.position.set(Math.cos(a) * 4, Math.sin(a) * 4, 0); o.rotation.z = -wheel.rotation.z; });
      rimLights.forEach((l, i) => { l.material.opacity = .45 + .55 * (.5 + .5 * Math.sin(t * 3 - i * .8)); });
      // Jeep: a constant counter-clockwise power slide, nose tucked in, kicking up smoke.
      const a = t * 1.45; jeep.position.set(P0.x + Math.cos(a) * RAD, Y + .05, P0.z + Math.sin(a) * RAD); jeep.rotation.set(0, Math.PI - a - .6, .06);
      puff -= dt; if (puff < 0) { puff = .06; jeep.updateMatrix(); for (const x of [-.3, .3]) smoke.spawn(V.set(x, .1, .35).applyMatrix4(jeep.matrix), W.set(rr(-.2, .2), rr(.2, .5), rr(-.2, .2)), 1.4, [.2, .9], .38); }
      smoke.update(dt); dust.update(dt);
      const lap = Math.floor((a - BA) / (Math.PI * 2)); if (lap !== lastLap) { lastLap = lap; hitAt = t; ev.push({ name: 'collision', intensity: .18, pan: -.5 });
        const tan = W.set(-Math.sin(a), 0, Math.cos(a)); for (const b of blocks) { U.subVectors(b.m.position, P0).setY(0).normalize(); b.v.copy(U).multiplyScalar(rr(.8, 2.2)).addScaledVector(tan, rr(1.2, 2.6)).setY(rr(1.6, 3.2)); b.w.set(rr(-9, 9), rr(-9, 9), rr(-9, 9)); }
        for (let i = 0; i < 6; i++) dust.spawn(towerAt, V.set(rr(-1, 1), rr(.3, 1), rr(-1, 1)), .5, [.2, .7], .7); }
      const since = t - hitAt;
      for (const b of blocks) {
        if (since < 2.6) { b.v.y -= 9.8 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
          if (b.m.position.y < Y + .15) { b.m.position.y = Y + .15; b.v.y = Math.abs(b.v.y) * .3; b.v.x *= .55; b.v.z *= .55; b.w.multiplyScalar(.5); }
          b.from.copy(b.m.position); b.q.copy(b.m.quaternion); }
        else { const u = smooth(2.6, 3.3, since); b.m.position.lerpVectors(b.from, b.home, u); b.m.position.y += Math.sin(Math.PI * u) * .5; b.m.quaternion.slerpQuaternions(b.q, qId, u); }
      }
    };
  }
  function THREE_DAMP(a, b, k) { return a + (b - a) * Math.min(1, k); }

  // ---------- Chapter gates ----------
  // Ship -> robot: concentric rings of dark stone blocks around a glowing core of motes.
  // As the camera nears they turn against each other, split along their seams, tilt open
  // like petals, and the core flares as the camera passes through the centre.
  const gate = group(root, [-1.2, .7, -160]); gate.name = 'chapter-ring-gate'; gate.visible = false;
  const stone = keep(new T.MeshStandardMaterial({ color: 0x1b1d21, roughness: .72, metalness: .05, flatShading: true, emissive: 0x0b2733, emissiveIntensity: 0 }));
  const blockGeo = keep(new T.BoxGeometry(1, 1, 1)), rings = [];
  for (let k = 0; k < 4; k++) {
    const R = 2.4 + k * 1.05, n = 14 + k * 5, ringGroup = group(gate), mesh = new T.InstancedMesh(blockGeo, stone, n);
    mesh.raycast = noop; mesh.frustumCulled = false; ringGroup.add(mesh);
    const seam = new T.Mesh(keep(new T.TorusGeometry(R, .05, 6, 96)), keep(new T.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })));
    seam.raycast = noop; ringGroup.add(seam);
    rings.push({ R, n, g: ringGroup, mesh, seam, dir: k % 2 ? -1 : 1, size: [2 * Math.PI * R / n * .9, .62 + k * .06, .7 + k * .12], jit: Array.from({ length: n }, () => rand()) });
  }
  const coreN = 420, corePos = new Float32Array(coreN * 3), coreSeed = new Float32Array(coreN * 4);
  for (let i = 0; i < coreN; i++) coreSeed.set([rand(), rand(), rand(), rand()], i * 4);
  const coreGeo = keep(new T.BufferGeometry()); coreGeo.setAttribute('position', new T.BufferAttribute(corePos, 3)); coreGeo.setAttribute('aSeed', new T.BufferAttribute(coreSeed, 4));
  const coreMat = keep(new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uOpen: { value: 0 }, uView: { value: 800 } },
    vertexShader: `attribute vec4 aSeed;uniform float uTime,uAlpha,uOpen,uView;varying float vA;void main(){
      float a=aSeed.x*6.2832+uTime*(.4+aSeed.y*1.2),b=acos(aSeed.z*2.-1.),r=(.25+1.5*pow(aSeed.w,.6))*(1.+uOpen*2.2);
      vec3 p=vec3(sin(b)*cos(a),sin(b)*sin(a),cos(b)*.45)*r;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((.05+aSeed.y*.05)*uView*projectionMatrix[1][1]/max(.5,-mv.z),1.,7.);vA=uAlpha*(.4+.6*sin(uTime*2.+aSeed.x*40.)*sin(uTime*2.+aSeed.x*40.))*(1.-aSeed.w*.5)*smoothstep(.6,3.,-mv.z);}`,
    fragmentShader: 'varying float vA;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(.62,.9,1.)*vA*(1.-smoothstep(.05,.5,r)),1.);}' }));
  const core = new T.Points(coreGeo, coreMat); core.frustumCulled = false; core.raycast = noop; gate.add(core);
  const coreGlow = sprite(gate, 0x8fdcff, 6, [0, 0, -.2], 0), coreFlash = sprite(gate, 0xd8f4ff, 3, [0, 0, 0], 0), gateLight = new T.PointLight(0x8fdcff, 0, 18, 1.6); gate.add(gateLight);
  const gm = new T.Matrix4(), gq = new T.Quaternion(), gp = new T.Vector3(), gs = new T.Vector3(), ge = new T.Euler();
  let gateSounded = false;
  function updateGate(p, t, view, ev) {
    const show = smooth(.44, .468, p) * (1 - smooth(.515, .53, p)); gate.visible = show > .001; if (!gate.visible) { gateSounded = false; return; }
    const charge = smooth(.455, .5, p), split = smooth(.488, .512, p), pass = Math.exp(-(((p - .506) / .006) ** 2));
    for (const [k, r] of rings.entries()) {
      r.g.rotation.set(split * r.dir * (.55 + k * .12), split * -r.dir * (.3 + k * .1), r.dir * (t * (.08 + k * .03) + charge * (1.2 + k * .4)));
      r.g.position.z = split * (k - 1.5) * 1.6; r.g.scale.setScalar(Math.max(.001, show) * (1 + split * k * .06));
      for (let i = 0; i < r.n; i++) {
        const a = i / r.n * Math.PI * 2, j = r.jit[i], R = r.R * (1 + split * (.35 + j * .5)) + Math.sin(t * 1.3 + i) * .03;
        gp.set(Math.cos(a) * R, Math.sin(a) * R, split * (j - .5) * 2.4);
        gq.setFromEuler(ge.set(split * (j - .5) * 2, split * (j - .3) * 1.5, a + Math.PI / 2 + split * (j - .5)));
        gs.set(r.size[0] * (1 - .25 * split), r.size[1], r.size[2]); r.mesh.setMatrixAt(i, gm.compose(gp, gq, gs));
      }
      r.mesh.instanceMatrix.needsUpdate = true; r.seam.material.opacity = (.25 + 1.4 * charge) * (1 - split * .7) * show; r.seam.scale.setScalar(1 + split * .45);
    }
    stone.emissiveIntensity = .2 + 1.1 * charge; coreMat.uniforms.uTime.value = t; coreMat.uniforms.uAlpha.value = show * (.45 + .9 * charge); coreMat.uniforms.uOpen.value = split; coreMat.uniforms.uView.value = view;
    coreGlow.material.opacity = show * (.35 + .65 * charge) * (1 - split * .5); coreGlow.scale.setScalar(5 + 4 * charge + 10 * split);
    coreFlash.material.opacity = pass; coreFlash.scale.setScalar(2 + 14 * pass); gateLight.intensity = show * (2 + 10 * charge + 40 * pass);
    if (p > .5 && !gateSounded) { gateSounded = true; ev.push({ name: 'warp', intensity: .45, pan: 0 }); } if (p < .48) gateSounded = false;
  }
  // Car -> room: a little jeep sets off down the road ahead of the camera and drives in the front door.
  const lead = group(root); lead.name = 'chapter-lead-jeep'; lead.visible = false; lead.scale.setScalar(1.7);
  const leadBody = group(lead), leadWheels = [];
  { const k = kit(); k.box('red', .56, .24, 1, 0, .26, 0).box('cream', .5, .22, .5, 0, .48, .08).box('ice', .46, .14, .04, 0, .5, -.18).box('trim', .58, .05, 1.02, 0, .16, 0).box('trim', .6, .1, .12, 0, .2, -.52)
      .cyl('trim', .13, .13, .1, 10, 0, .32, .55, Math.PI / 2).box('warm', .1, .06, .03, -.18, .28, -.51).box('warm', .1, .06, .03, .18, .28, -.51).box('redGlow', .1, .06, .03, -.2, .3, .51).box('redGlow', .1, .06, .03, .2, .3, .51); k.build(leadBody);
    for (const [x, z] of [[-.3, -.33], [.3, -.33], [-.3, .33], [.3, .33]]) { const w = group(lead, [x, .14, z]), kw = kit(); kw.cyl('trim', .14, .14, .12, 10, 0, 0, 0, 0, 0, Math.PI / 2).box('cream', .13, .05, .05, 0, 0, 0); kw.build(w); leadWheels.push(w); } }
  const leadLamp = sprite(lead, 0xffd38a, .9, [0, .28, -.7], 0), leadTrail = pool(root, 18, 0xd9d4cc, false);
  let leadPuff = 0, leadSounded = false;
  function updateLead(p, t, dt, ev) {
    const go = smooth(.866, .93, p), show = smooth(.858, .872, p) * (1 - smooth(.928, .936, p)); lead.visible = show > .001;
    leadTrail.update(dt); if (!lead.visible) { if (p < .86) leadSounded = false; return; }
    const z = -343 - go * 71, wob = Math.sin(go * 14) * .25 * (1 - go);
    lead.position.set(2 + wob, -1.94 + Math.abs(Math.sin(t * 9)) * .015, z); lead.rotation.set(0, Math.cos(go * 14) * .1 * (1 - go), 0); lead.scale.setScalar(1.7 * Math.max(.001, show));
    leadWheels.forEach(w => { w.rotation.x = -go * 160; }); leadLamp.material.opacity = .8 * show;
    leadPuff -= dt; if (leadPuff < 0 && go > .02 && go < .95) { leadPuff = .05; for (const x of [-.4, .4]) leadTrail.spawn(V.set(lead.position.x + x, -1.85, z + .9), W.set(rr(-.3, .3), rr(.3, .7), rr(.5, 1.5)), 1.1, [.3, 1.4], .3); }
    if (go > .01 && !leadSounded) { leadSounded = true; ev.push({ name: 'horn', intensity: .25, pan: 0 }); }
  }


  // fades: per-scene visibility 0..1. Returns sound cues for the host.
  const events = [];
  function update({ fades = [0, 0, 0], focus = [false, false, false], progress = 0, time = 0, dt = 0, reduced = false, view = 800 }) {
    events.length = 0;
    updateGate(progress, reduced ? 0 : time, view, reduced ? [] : events); updateLead(progress, reduced ? 0 : time, reduced ? 0 : Math.min(.05, dt), reduced ? [] : events);
    scenes.forEach((sc, i) => {
      const f = clamp(fades[i]); sc.fade = f; sc.g.visible = f > .001; if (!sc.g.visible) return;
      for (const c of sc.clusters) { const k = smooth(c.delay, c.delay + .45, f * 1.45); c.o.visible = k > .001; c.o.position.y = c.y - (1 - k) * (1 - k) * c.drop; c.o.scale.copy(c.s).multiplyScalar(Math.max(.001, k)); }
      if (sc.mote) { sc.mote.uniforms.uAlpha.value = f * .8; sc.mote.uniforms.uTime.value = reduced ? 0 : time; }
      sc.animate(reduced ? 0 : time, reduced ? 0 : Math.min(.05, dt), focus[i] && !reduced ? events : [], progress);
    });
    return events;
  }
  return { update, dispose() { scenes.forEach(sc => sc.g.removeFromParent()); own.forEach(r => r.dispose?.()); own.clear(); } };
}
