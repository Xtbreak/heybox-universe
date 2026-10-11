import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createHeyboxCore as createProceduralCore } from './heybox-core.js';

const DEFAULT_URL = new URL('./models/heybox-original-refined.glb', import.meta.url).href;
const loadDefault = url => new GLTFLoader().loadAsync(url);
const caches = new WeakMap();
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const ease = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const ringDepths = {
  'hollow-load-bearing-rim': -.18,
  'brushed-aperture-lip': .07,
  'ivory-aperture-light': .033,
  'second-recessed-rim': -.49,
  'deep-iceblue-light': -.44
};

function disposeSource(scene) {
  const resources = new Set(), images = new Set();
  scene?.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) {
        resources.add(value);
        if (value.source?.data?.close) images.add(value.source.data);
      }
    }
  });
  for (const resource of resources) resource.dispose?.();
  for (const image of images) image.close();
}

// A source is immutable and borrowed by live instances. Only its last borrower
// can release geometry/textures; instance materials are always independent.
function acquire(url, loader) {
  let cache = caches.get(loader);
  if (!cache) caches.set(loader, cache = new Map());
  let entry = cache.get(url);
  if (!entry) {
    entry = { users: 0, scene: null, released: false };
    cache.set(url, entry);
    entry.promise = Promise.resolve().then(() => loader(url)).then(asset => {
      const scene = asset?.scene || asset;
      if (!scene?.isObject3D) throw new Error('Refined Heybox GLB did not contain a scene');
      entry.scene = scene;
      if (entry.released) disposeSource(scene);
      return scene;
    });
  }
  entry.users++;
  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      if (--entry.users === 0) {
        entry.released = true;
        if (cache.get(url) === entry) cache.delete(url);
        if (entry.scene) disposeSource(entry.scene);
      }
    }
  };
}

/** Original full assembly refined in Blender. No renderer, DOM or timers owned.
 * loadAsset(url) is an optional dependency-injection hook returning a GLTF or
 * Object3D; its immutable resources are owned by the shared acquisition cache.
 * ready always settles to this API; status is loading/refined/fallback/disposed.
 * While loading we render nothing, rather than flash a different model.
 */
export function createHeyboxCore({ THREE, url = DEFAULT_URL, loadAsset = loadDefault, onReady } = {}) {
  const group = new THREE.Group();
  group.name = 'heybox-split-core';
  group.userData.refinedAssetURL = url;
  const ownedMaterials = new Set();
  const materialStates = [];
  const borrow = acquire(url, loadAsset);
  let status = 'loading', error = null, disposed = false, fallback = null;
  let model = null, halves = [], throat = null;
  let state = { open: 0, time: 0, reduced: false, opacity: 1, glow: 1 };
  const setStatus = value => { status = value; group.userData.coreAssetStatus = value; };
  setStatus(status);

  function apply() {
    if (disposed) return;
    if (fallback) {
      fallback.update(state.open, state.time, state);
      if(state.ultra){const lights=new Set();fallback.group.traverse(node=>{for(const m of Array.isArray(node.material)?node.material:[node.material])if(m?.emissive&&(m.emissive.r+m.emissive.g+m.emissive.b)>0)lights.add(m);});for(const m of lights)m.emissiveIntensity*=6.5;}
      return;
    }
    if (!model) return;
    const { open, reduced, opacity, ultra, glow } = state;
    const time = reduced ? 0 : state.time;
    const travel = ease(.025, .98, open), reveal = ease(.04, .52, open);
    for (let index = 0; index < halves.length; index++) {
      const sign = index === 0 ? 1 : -1;
      // Small phase offset gives the two mechanisms a deliberate sequence.
      // Closed and fully opened transforms remain exactly the original poses.
      const stagger = reduced ? 0 : .032 * Math.sin(Math.PI * travel) ** 2;
      const amount = clamp(travel + sign * stagger);
      halves[index].position.set(sign * amount * 2.08, sign * amount * .90, amount * (.13 + index * .13));
      halves[index].rotation.set(-sign * amount * .075, sign * amount * .16, -sign * amount * .035);
    }
    throat.visible = open > .012;
    throat.scale.setScalar(.60 + reveal * .62);
    throat.position.z = -.65 - travel * .46;
    throat.rotation.z = (reduced ? 0 : Math.sin(time * .17) * .008) * reveal;
    for (const item of materialStates) {
      const { material, alpha, depthWrite, emission, light } = item;
      material.opacity = alpha * opacity;
      material.depthWrite = depthWrite && opacity > .995;
      if (light) material.emissiveIntensity = emission * (ultra ? 6.5 + (reduced ? 0 : Math.sin(travel*Math.PI)**8*4) : 1) * (1 + reveal * .55) * (reduced ? 1 : 1 + Math.sin(time * .6) * .025 * reveal) * glow;
    }
  }

  function update(openFraction = 0, time = 0, { reduced = false, opacity = 1, ultra = false, glow = 1 } = {}) {
    state = { open: clamp(openFraction), time: Number.isFinite(time) ? time : 0, reduced: !!reduced, ultra: !!ultra, opacity: clamp(opacity), glow: Math.max(0, Number(glow) || 0) };
    apply();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    setStatus('disposed');
    group.removeFromParent();
    fallback?.dispose();
    for (const material of ownedMaterials) material.dispose();
    ownedMaterials.clear();
    materialStates.length = 0;
    group.clear(); model = null; halves = []; throat = null;
    borrow.release();
  }

  const api = { group, update, dispose, get status() { return status; }, get error() { return error; }, get model() { return model; }, ready: null };
  api.ready = borrow.promise.then(source => {
    if (disposed) return api;
    const clone = source.clone(true);
    const find = name => {
      let found = clone.getObjectByName(name);
      if (!found) clone.traverse(node => { if (!found && node.userData?.['Original component'] === name) found = node; });
      return found;
    };
    halves = [find('upper-right-shell'), find('lower-left-shell')];
    throat = find('hollow-hexagonal-throat');
    if (halves.some(half => !half) || !throat) throw new Error('Refined Heybox GLB is missing its independent mechanism groups');
    // Blender exports a hidden zero-scale parent and zero-scale ring children.
    // Restore original ring local transforms, including the lost Z offsets.
    for (const [name, z] of Object.entries(ringDepths)) {
      const ring = find(name);
      if (!ring) throw new Error(`Refined Heybox GLB is missing ${name}`);
      ring.position.set(0, 0, z); ring.quaternion.identity(); ring.scale.set(1, 1, 1); ring.visible = true;
      ring.updateMatrix();
    }
    const clones = new Map();
    clone.traverse(node => {
      if (!node.material) return;
      const own = original => {
        if (clones.has(original)) return clones.get(original);
        const material = original.clone();
        // GLTFLoader supplies linear PBR colors and non-color normal maps.
        // Do not re-convert colors, recompute bevel normals or flip texture axes.
        material.transparent = true;
        const light = !!material.emissive && (material.emissive.r + material.emissive.g + material.emissive.b > 0);
        materialStates.push({ material, alpha: original.opacity, depthWrite: original.depthWrite, emission: original.emissiveIntensity ?? 1, light });
        clones.set(original, material); ownedMaterials.add(material);
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
    });
    model = clone;
    apply(); // Pose and opacity are current BEFORE the first visible frame.
    group.add(model);
    setStatus('refined');
    return api;
  }).catch(reason => {
    if (disposed) return api;
    error = reason;
    for (const material of ownedMaterials) material.dispose();
    ownedMaterials.clear(); materialStates.length = 0;
    model = null; halves = []; throat = null;
    borrow.release();
    fallback = createProceduralCore({ THREE });
    fallback.update(state.open, state.time, state);
    group.add(fallback.group);
    setStatus('fallback');
    console.warn('[refined-heybox-core] Blender asset unavailable; using original assembly', reason);
    return api;
  });
  if (onReady) api.ready.then(() => { if (!disposed) onReady(api); }).catch(reason => console.warn('[refined-heybox-core] ready callback failed', reason));
  return api;
}
