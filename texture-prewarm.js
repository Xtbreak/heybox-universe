// Best-effort GPU uploads for host-owned, borrowed textures. This queue never
// changes texture settings, clones assets, closes images, or disposes resources.
export function createTexturePrewarm({renderer,isActive=()=>true,onError=()=>{}}) {
  const queue=[],seen=new WeakSet();
  let idle=null,generation=0,disposed=false;
  const canRun=()=>!disposed&&isActive();
  function cancel(){
    generation++;
    if(idle!==null)globalThis.cancelIdleCallback?.(idle);
    idle=null;
  }
  // Called once after the host's rendered frame. There is no second RAF loop,
  // and no idle callback chain that could upload the whole pack in one frame.
  function update(){
    if(!canRun()){cancel();return;}
    if(!queue.length||idle!==null)return;
    const token=generation;
    const upload=()=>{
      if(token!==generation)return;
      idle=null;
      if(!canRun())return;
      const texture=queue.shift();
      if(texture){try{renderer.initTexture(texture);}catch(error){onError(error);}}
    };
    if(typeof globalThis.requestIdleCallback==='function'&&typeof globalThis.cancelIdleCallback==='function')idle=globalThis.requestIdleCallback(upload,{timeout:100});
    else upload();
  }
  function texture(value){
    if(disposed||!value?.isTexture||seen.has(value)||typeof renderer.initTexture!=='function')return;
    seen.add(value);queue.push(value);
  }
  function model(root){
    if(disposed)return;
    root?.traverse?.(node=>{
      for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
        if(!material)continue;
        for(const value of Object.values(material))texture(value);
        for(const uniform of Object.values(material.uniforms||{})){
          const values=Array.isArray(uniform?.value)?uniform.value:[uniform?.value];
          for(const value of values)texture(value);
        }
      }
    });
  }
  function pack(value){
    if(disposed||!value)return;
    for(const set of Object.values(value.textures||{}))for(const tx of Object.values(set||{}))texture(tx);
    for(const tx of value.treeImpostors||[])texture(tx);
    for(const object of Object.values(value))if(object?.isObject3D)model(object);
  }
  return {
    model,pack,update,
    sync(){if(!canRun())cancel();},
    get pending(){return queue.length;},
    dispose(){if(disposed)return;disposed=true;cancel();queue.length=0;}
  };
}
