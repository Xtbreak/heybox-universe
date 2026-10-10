// Host-owned coastal assets, shared read-only across repeat driving visits.
export function createEnvironmentAssets({THREE, loader, disposeModel, anisotropy=4}) {
  const pack={textures:{},treeImpostors:[]}, models=new Set(),textures=new Set();
  const textureLoader=new THREE.TextureLoader();let pending=null,disposed=false,ready=false;
  async function model(key,file){if(pack[key])return;const gltf=await loader.loadAsync(new URL(`./models/environment/${file}?v=coast-perf10`,import.meta.url).href);if(disposed){disposeModel(gltf.scene);return;}models.add(gltf.scene);pack[key]=gltf.scene;}
  async function texture(target,key,file,srgb,repeat=true){if(target[key])return;const tx=await textureLoader.loadAsync(new URL(`./models/environment/${file}?v=coast-perf10`,import.meta.url).href);if(disposed){tx.dispose();tx.source?.data?.close?.();return;}tx.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;tx.wrapS=tx.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;tx.anisotropy=anisotropy;tx.needsUpdate=true;textures.add(tx);target[key]=tx;}
  async function load(){if(disposed)return pack;if(ready)return pack;if(pending)return pending;pending=(async()=>{
    const tasks=Object.entries({coastalFactory:'coastal-factory.glb',coastalFacade:'coastal-facade.glb',coastalTree:'coastal-tree.glb',coastalTreeMid:'coastal-tree-mid.glb'}).map(([key,file])=>model(key,file));
    for(const [kind,prefix,metres]of [['asphalt','asphalt_02',3],['grass','grass_ground',2.51],['rock','rock_face_03',2.7],['plaster','white_plaster_rough_01',1],['paving','rectangular_paving',2],['slate','roof_slates_02',3]]){
      const set=pack.textures[kind] ||= {metres};
      for(const [key,suffix,srgb]of [['map','diff',true],['normalMap','nor_gl',false]])tasks.push(texture(set,key,`${prefix}_${suffix}_1k.jpg`,srgb));
    }
    pack.textures.ground=pack.textures.grass;pack.textures.cliff=pack.textures.rock;
    tasks.push(texture(pack.treeImpostors,0,'coastal-tree-impostor-front.png',true,false),texture(pack.treeImpostors,1,'coastal-tree-impostor-side.png',true,false));
    const results=await Promise.allSettled(tasks);if(disposed)return pack;const failures=results.filter(r=>r.status==='rejected');if(failures.length)throw new AggregateError(failures.map(r=>r.reason),'Coastal assets could not finish loading');ready=true;return pack;
  })();try{return await pending;}finally{pending=null;}}
  function dispose(){if(disposed)return;disposed=true;disposeModel({traverse:visit=>models.forEach(model=>model.traverse(visit))});textures.forEach(tx=>{tx.dispose();tx.source?.data?.close?.();});models.clear();textures.clear();}
  return {load,dispose};
}
