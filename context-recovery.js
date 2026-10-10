// One bounded recovery attempt per host. A new host is never allowed to revive
// an obsolete navigation or retain a renderer created after its owner expired.
export function createContextRecovery({create,dispose=host=>host?.dispose(),fallback,status=()=>{},timeout=15000}) {
 let phase='idle',generation=0,source=null,snapshot=null,timer=null,candidate=null,controller=null;
 const release=host=>{try{dispose(host);}catch(error){console.warn('[context-recovery] teardown failed',error);}};
 const clear=()=>{clearTimeout(timer);timer=null;};
 function fail(error){if(phase==='failed'||phase==='disposed')return;clear();generation++;phase='failed';controller?.abort();release(candidate);candidate=null;release(source);source=null;status('failed');fallback(error,snapshot);}
 return {
  get phase(){return phase;},
  lost(host,saved){
   if(phase==='lost')return;
   if(phase!=='idle'){if(phase==='rebuilding')fail(new Error('Context lost during reconstruction'));return;}
   source=host;snapshot=saved;phase='lost';status('lost');if(saved?.captureError){fail(new Error(saved.captureError));return;}timer=setTimeout(()=>fail(new Error('Graphics recovery timed out')),timeout);
  },
  async restored(){
   if(phase!=='lost')return;phase='rebuilding';status('rebuilding');const token=++generation;controller=new AbortController();release(source);source=null;
   const current=()=>['rebuilding','idle'].includes(phase)&&token===generation;
   try{
    const host=await create(snapshot,{current,signal:controller.signal,register(value){if(!current()){release(value);return false;}candidate=value;return true;}});
    if(!current()){release(host);return;}
    candidate=host;clear();phase='idle';candidate=null;snapshot=null;status('ready',host);
   }catch(error){if(current())fail(error);}
  },
  cancelResume(){if(snapshot)snapshot.resumeWorld=null;candidate?.action?.('exit');},
  fail,
  dispose(){if(phase==='disposed')return;clear();generation++;phase='disposed';controller?.abort();release(candidate);release(source);candidate=source=snapshot=null;}
 };
}
