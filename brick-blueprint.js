// The drawing that comes before the stone (after igloo.inc's entrance): every brick of the box
// is traced as a white line drawing, spreading from the top like petals, with bright pen tips
// running along the edges; a loose triangulated net hangs in the dark around it. Then a scan
// plane sinks through the box: a glowing cross-section, above which the lines give way to
// solid bricks (brick-hero.js discards everything the scan has not reached yet).
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const LINE = `attribute vec3 aOther,aW;uniform float uDraw,uScan,uAlpha,uPx;varying float vA;varying vec3 vC;
float bpK(){return clamp((uDraw-aW.x)/.12,0.,1.);}`;

// boxes: [{ c: [x,y,z], h: [hx,hy,hz], fine }] in hero-anchor space; size: full box extents.
export function createBlueprint({ THREE: T, root, heroAnchor, center, boxes, size, keep, rand, draw, net: netTime }) {
  const apex = new T.Vector3(0, size.y / 2 + .3, 0), A = new T.Vector3(), B = new T.Vector3(), S = new T.Vector3();
  // Twelve edges per brick, each pointing away from the apex so the drawing spreads like petals.
  const edges = []; let far = 0;
  for (const { c, h, fine } of boxes) {
    const pt = m => [c[0] + (m & 1 ? h[0] : -h[0]), c[1] + (m & 2 ? h[1] : -h[1]), c[2] + (m & 4 ? h[2] : -h[2])];
    for (let m = 0; m < 8; m++) for (const bit of [1, 2, 4]) if (!(m & bit)) {
      A.set(...pt(m)); B.set(...pt(m | bit)); if (A.distanceTo(apex) > B.distanceTo(apex)) { S.copy(A); A.copy(B); B.copy(S); }
      const d = A.distanceTo(apex); far = Math.max(far, d); edges.push([A.toArray(), B.toArray(), d, fine ? 1 : 0]);
    }
  }
  const E = edges.length, wp = new Float32Array(E * 6), wo = new Float32Array(E * 6), ww = new Float32Array(E * 6), tp = new Float32Array(E * 3), to = new Float32Array(E * 3), tw = new Float32Array(E * 3);
  edges.forEach(([a, b, d, fine], e) => {
    const order = d / far * .8 + rand() * .12 + fine * .06;
    wp.set([...a, ...a], e * 6); wo.set([...b, ...b], e * 6); ww.set([order, 0, fine, order, 1, fine], e * 6);
    tp.set(a, e * 3); to.set(b, e * 3); tw.set([order, 1, fine], e * 3);
  });
  const geometry = (p, o, w) => { const g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aOther', new T.BufferAttribute(o, 3)); g.setAttribute('aW', new T.BufferAttribute(w, 3)); return g; };
  const lineUniforms = () => ({ uDraw: { value: 0 }, uScan: { value: 1e3 }, uAlpha: { value: 0 }, uPx: { value: 1 } });
  const lineMaterial = u => keep(new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: LINE + `\nvoid main(){float k=bpK();vec3 p=mix(position,aOther,k*aW.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      vA=uAlpha*step(.0001,k)*(1.-clamp((p.y-uScan)/.06,0.,1.))*mix(.6,.36,aW.z);vC=mix(vec3(.86,.93,1.),vec3(.55,.86,1.),aW.z);}`,
    fragmentShader: 'varying float vA;varying vec3 vC;void main(){gl_FragColor=vec4(vC*vA,vA);}' }));
  const tipMaterial = u => keep(new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: LINE + `\nvoid main(){float k=bpK();vec3 p=mix(position,aOther,k);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      float run=step(.0001,k)*(1.-step(.9999,k)),done=step(.9999,k)*exp(-max(0.,uDraw-aW.x-.12)*9.);
      vA=uAlpha*(run*1.7+done*1.1)*(1.-clamp((p.y-uScan)/.06,0.,1.))*(1.-aW.z*.5);vC=vec3(.9,.97,1.);gl_PointSize=(2.+1.5*run)*uPx;}`,
    fragmentShader: 'varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);float a=vA*(1.-smoothstep(.15,.5,r));gl_FragColor=vec4(vC*a,a);}' }));
  const wireU = lineUniforms();
  const wire = new T.LineSegments(geometry(wp, wo, ww), lineMaterial(wireU)), tips = new T.Points(geometry(tp, to, tw), tipMaterial(wireU));
  wire.name = 'brick-blueprint'; for (const o of [wire, tips]) { o.frustumCulled = false; o.raycast = () => {}; o.renderOrder = 5; heroAnchor.add(o); }

  // The net: a sparse triangulated web in the dark around the box, drawn in, then gone with the haze.
  const NODES = 64, nodes = [];
  for (let i = 0; i < NODES; i++) { const a = rand() * 6.2832, u = rand() * 2 - 1, r = 2.3 + Math.pow(rand(), 1.2) * 3.6, s = Math.sqrt(1 - u * u);
    nodes.push([Math.cos(a) * s * r, u * r * .45 + .5, Math.sin(a) * s * r * .9]); }
  const links = new Map();
  nodes.forEach((n, i) => nodes.map((m, j) => [j, Math.hypot(n[0] - m[0], n[1] - m[1], n[2] - m[2])]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 2)
    .forEach(([j]) => links.set(Math.min(i, j) + ':' + Math.max(i, j), [Math.min(i, j), Math.max(i, j)])));
  const L = [...links.values()], np = new Float32Array(L.length * 6), no = new Float32Array(L.length * 6), nw = new Float32Array(L.length * 6), seen = nodes.map(() => rand() * .7);
  L.forEach(([i, j], e) => { const order = Math.max(seen[i], seen[j]) * .9; np.set([...nodes[i], ...nodes[i]], e * 6); no.set([...nodes[j], ...nodes[j]], e * 6); nw.set([order, 0, 0, order, 1, 0], e * 6); });
  const dp = new Float32Array(NODES * 3), dw = new Float32Array(NODES * 3); nodes.forEach((n, i) => { dp.set(n, i * 3); dw.set([seen[i], 1, 0], i * 3); });
  const netU = lineUniforms();
  const net = new T.Group(); net.name = 'brick-blueprint-net'; net.position.copy(center); root.add(net);
  for (const o of [new T.LineSegments(geometry(np, no, nw), lineMaterial(netU)), new T.Points(geometry(dp, dp, dw), tipMaterial(netU))]) { o.frustumCulled = false; o.raycast = () => {}; net.add(o); }

  // The scan's cross-section: a lit slab sinking through the hollow box.
  const disc = new T.Mesh(keep(new T.PlaneGeometry(size.x + .1, size.z + .1).rotateX(-Math.PI / 2)), keep(new T.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uA;varying vec2 vUv;void main(){vec2 d=abs(vUv-.5)*2.;float m=max(d.x,d.y);
      float a=(smoothstep(.8,.99,m)*1.3+.25+.6*(1.-smoothstep(0.,.8,length(d))))*(1.-smoothstep(.985,1.,m))*uA;gl_FragColor=vec4(vec3(.8,.92,1.)*a,a);}` })));
  disc.name = 'brick-scan-disc'; disc.renderOrder = 6; disc.raycast = () => {}; heroAnchor.add(disc);

  function update({ since = 0, scan = 1e3, reduced = false, quality = 'standard', visible = true }) {
    const k = quality === 'ultra' ? 1.15 : 1, top = size.y / 2, px = Math.min(2, globalThis.devicePixelRatio || 1);
    wireU.uDraw.value = 1.08 * clamp((since - draw[0]) / (draw[1] - draw[0])); wireU.uScan.value = scan; wireU.uPx.value = px; wireU.uAlpha.value = reduced ? 0 : k;
    wire.visible = tips.visible = visible && !reduced && wireU.uDraw.value > 0 && scan > -top - .1;
    netU.uDraw.value = 1.08 * clamp((since - netTime[0]) / (netTime[1] - netTime[0])); netU.uPx.value = px;
    netU.uAlpha.value = reduced ? 0 : .3 * k * (1 - smooth(netTime[2], netTime[3], since));
    net.visible = visible && netU.uAlpha.value > .001 && netU.uDraw.value > 0; net.rotation.y = since * .045;
    disc.position.y = scan; disc.material.uniforms.uA.value = reduced ? 0 : smooth(top + .12, top - .03, scan) * (1 - smooth(-top + .12, -top - .04, scan));
    disc.visible = visible && disc.material.uniforms.uA.value > .001;
  }
  return { update, dispose() { for (const o of [wire, tips, disc, net]) o.removeFromParent(); } };
}
