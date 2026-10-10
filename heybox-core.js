/**
 * An original volumetric interpretation of the 小黑盒 / Heybox app mark.
 * Reference: official Google Play icon, package com.max.xiaoheihe.
 * The two silhouette shells are real bevelled extrusions, not a logo texture.
 * No remote assets, renderer, DOM, timers, or application state are owned here.
 */
export function createHeyboxCore({ THREE }) {
  const group = new THREE.Group();
  group.name = 'heybox-split-core';
  const owned = new Set(), keep = value => (owned.add(value), value);
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const ease = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const scale = .0104;
  const px = x => (x - 256) * scale, py = y => (256 - y) * scale;
  const physical = (color, options = {}) => keep(new THREE.MeshStandardMaterial({
    color, metalness: .86, roughness: .37, transparent: true, ...options
  }));
  const graphite = physical(0x353b40, { metalness: .78, roughness: .43 });
  const machined = physical(0x95a0a5, { metalness: .94, roughness: .31 });
  const titanium = physical(0x626e76, { metalness: .91, roughness: .34 });
  const dark = physical(0x141a20, { metalness: .72, roughness: .48 });
  const ivory = physical(0xd5e5e8, { metalness: .25, roughness: .35, emissive: 0xbcdfea, emissiveIntensity: .34 });
  const ice = physical(0xb5d1db, { metalness: .38, roughness: .29, emissive: 0x9dcced, emissiveIntensity: .24 });
  function mesh(geometry, material, parent = group, name = '') {
    const item = new THREE.Mesh(keep(geometry), material);
    item.name = name; parent.add(item); return item;
  }
  // Rounded corners follow the app silhouette. The second shell is its 180° pair.
  function markShape() {
    const shape = new THREE.Shape();
    const m = (x, y) => shape.moveTo(px(x), py(y));
    const l = (x, y) => shape.lineTo(px(x), py(y));
    const q = (a, b, c, d) => shape.quadraticCurveTo(px(a), py(b), px(c), py(d));
    m(228, 87); q(228, 80, 234, 84); l(387, 172); q(395, 176, 395, 184);
    l(395, 327); q(395, 335, 388, 339); l(346, 364); q(339, 368, 339, 360);
    l(339, 219); q(339, 211, 332, 207); l(291, 183); q(283, 178, 283, 186);
    l(283, 220); q(283, 228, 275, 228); l(236, 228); q(228, 228, 228, 220);
    shape.closePath(); return shape;
  }
  const shape = markShape();
  function extrude(depth, bevel, segments = 3, source = shape) {
    return new THREE.ExtrudeGeometry(source, {
      depth, steps: 1, curveSegments: 9, bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel, bevelSegments: segments,
      material: 0, extrudeMaterial: 1
    });
  }
  const bodyGeometry = keep(extrude(.43, .027, 4));
  const gasketGeometry = keep(extrude(.027, .009));
  const faceGeometry = keep(extrude(.073, .019, 4));
  const backGeometry = keep(extrude(.025, .010));
  const contour = shape.getPoints(10).map(point => new THREE.Vector3(point.x, point.y, 0));
  const seamGeometry = keep(new THREE.BufferGeometry().setFromPoints(contour));
  const seamMaterial = keep(new THREE.LineBasicMaterial({ color: 0x6e818d, transparent: true, opacity: .53 }));
  const halves = [];
  for (let index = 0; index < 2; index++) {
    const assembly = new THREE.Group(), shell = new THREE.Group();
    assembly.name = index === 0 ? 'upper-right-shell' : 'lower-left-shell';
    shell.rotation.z = index * Math.PI; assembly.add(shell); group.add(assembly);
    const body = new THREE.Mesh(bodyGeometry, [titanium, titanium]);
    body.name = 'machined-shell-depth'; body.position.z = -.33; shell.add(body);
    const back = new THREE.Mesh(backGeometry, [dark, titanium]);
    back.name = 'recessed-rear-cover'; back.position.z = -.354;
    back.scale.set(.977, .977, 1); shell.add(back);
    const gasket = new THREE.Mesh(gasketGeometry, [machined, machined]);
    gasket.name = 'silver-face-gasket'; gasket.position.z = .121; shell.add(gasket);
    const face = new THREE.Mesh(faceGeometry, [graphite, machined]);
    face.name = 'bevelled-graphite-face'; face.position.z = .17;
    face.scale.set(.977, .977, 1); shell.add(face);
    // Two continuous recessed parting lines explain the construction at oblique angles.
    for (const z of [-.18, -.11]) {
      const seam = new THREE.LineLoop(seamGeometry, seamMaterial);
      seam.name = 'circumferential-shell-seam'; seam.position.z = z;
      seam.scale.set(1.008, 1.008, 1); shell.add(seam);
    }
    // A restrained light guide follows only the return on the inside of each shell.
    const guideCurve = new THREE.CurvePath();
    const guidePoints = [[291, 177], [338, 204], [345, 215], [345, 340]]
      .map(([x, y]) => new THREE.Vector3(px(x), py(y), -.22));
    for (let j = 1; j < guidePoints.length; j++) guideCurve.add(new THREE.LineCurve3(guidePoints[j - 1], guidePoints[j]));
    mesh(new THREE.TubeGeometry(guideCurve, 20, .010, 5, false), ice, shell, 'recessed-inner-light-guide');
    halves.push(assembly);
  }
  // A true hollow throat: there is deliberately no central crystal or filled disc.
  const portal = new THREE.Group(); portal.name = 'hollow-hexagonal-throat';
  portal.position.z = -.65; group.add(portal);
  function roundedPolygon(path, radius, corner = .08, reverse = false) {
    const points = Array.from({ length: 6 }, (_, i) => {
      const angle = Math.PI / 2 + i * Math.PI / 3;
      return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    if (reverse) points.reverse();
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i + 5) % 6], current = points[i], next = points[(i + 1) % 6];
      const before = current.clone().lerp(prev, corner), after = current.clone().lerp(next, corner);
      if (!i) path.moveTo(before.x, before.y); else path.lineTo(before.x, before.y);
      path.quadraticCurveTo(current.x, current.y, after.x, after.y);
    }
    path.closePath(); return path;
  }
  function hexRing(outer, inner, depth, bevel, material, z, name) {
    const outline = roundedPolygon(new THREE.Shape(), outer);
    outline.holes.push(roundedPolygon(new THREE.Path(), inner, .08, true));
    const ring = mesh(extrude(depth, bevel, 3, outline), material, portal, name);
    ring.position.z = z; return ring;
  }
  hexRing(1.38, 1.205, .22, .018, [dark, titanium], -.18, 'hollow-load-bearing-rim');
  hexRing(1.295, 1.235, .018, .009, [machined, machined], .07, 'brushed-aperture-lip');
  hexRing(1.232, 1.209, .023, .006, [ivory, ivory], .033, 'ivory-aperture-light');
  hexRing(1.34, 1.211, .055, .012, [titanium, dark], -.49, 'second-recessed-rim');
  hexRing(1.217, 1.197, .018, .004, [ice, ice], -.44, 'deep-iceblue-light');
  // Optical falloff is small and additive. The opening remains transparent to the stars.
  const pixels = new Uint8Array(48 * 48 * 4);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const alpha = Math.pow(Math.max(0, 1 - Math.hypot(x - 23.5, y - 23.5) / 24), 3.5);
    pixels.set([190, 223, 232, Math.round(alpha * 255)], (y * 48 + x) * 4);
  }
  const glowMap = keep(new THREE.DataTexture(pixels, 48, 48)); glowMap.needsUpdate = true;
  const glowMaterial = keep(new THREE.SpriteMaterial({ map: glowMap, color: 0xbad5df, transparent: true,
    opacity: .055, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glow = new THREE.Sprite(glowMaterial); glow.name = 'subtle-interior-radiance';
  glow.position.z = -.5; glow.scale.set(3.1, 3.1, 1); portal.add(glow);
  const fadeMaterials=[];for(const resource of owned)if(resource.isMaterial)fadeMaterials.push([resource,resource.opacity]);
  let disposed = false;
  function update(openFraction = 0, time = 0, { reduced = false, opacity = 1 } = {}) {
    const alpha=clamp(opacity);for(const [material,base] of fadeMaterials){material.opacity=base*alpha;material.depthWrite=alpha>.995 && !material.isSpriteMaterial;}
    const open = clamp(openFraction), t = reduced || !Number.isFinite(time) ? 0 : time;
    const travel = ease(.025, .98, open), reveal = ease(.04, .52, open);
    for (let index = 0; index < halves.length; index++) {
      const sign = index === 0 ? 1 : -1, half = halves[index];
      half.position.set(sign * travel * 2.08, sign * travel * .90, travel * (.13 + index * .13));
      half.rotation.set(-sign * travel * .075, sign * travel * .16, -sign * travel * .035);
    }
    portal.visible = open > .012;
    portal.scale.setScalar(.60 + reveal * .62);
    portal.position.z = -.65 - travel * .46;
    portal.rotation.z = (reduced ? 0 : Math.sin(t * .17) * .008) * reveal;
    ivory.emissiveIntensity = .28 + reveal * .38;
    ice.emissiveIntensity = .19 + reveal * .24;
    glowMaterial.opacity = alpha * (.020 + reveal * .042) * (reduced ? 1 : 1 + Math.sin(t * .6) * .025);
  }
  function dispose() {
    if (disposed) return; disposed = true; group.removeFromParent();
    for (const resource of owned) resource.dispose?.(); owned.clear();
  }
  update(0, 0);
  return { group, update, dispose };
}
