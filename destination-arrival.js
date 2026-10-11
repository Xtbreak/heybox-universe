/** Short, owned portal-image reveal into the real, paused destination scene: the new
 * world grows outward from the centre of the frame behind a soft, glowing edge.
 * This module never advances a provider, requests control, or owns an RAF. */
export function createDestinationArrival({THREE:T,renderer,camera}) {
  const layer=new T.Scene(),screenCamera=new T.Camera();
  const material=new T.ShaderMaterial({
    uniforms:{image:{value:null},opacity:{value:1},phase:{value:0},strength:{value:0},worldKind:{value:0},aspect:{value:1},reveal:{value:0},tint:{value:new T.Color(0x8fdcff)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image;uniform float opacity;uniform float phase;uniform float strength;uniform float worldKind;uniform float aspect;uniform float reveal;uniform vec3 tint;varying vec2 vUv;
      void main(){
        vec2 q=vUv-.5;vec2 metric=q*vec2(aspect,1.);float r=length(metric);
        // Refraction samples the captured real frame. It begins and ends at zero,
        // rather than overlaying a bright fake lens or exposing a black edge.
        float envelope=sin(clamp(phase,0.,1.)*3.14159265)*strength;
        float edge=1.-smoothstep(.34,.69,length(q));vec2 flow;
        if(worldKind<.5)flow=q*(.65+.35*sin(r*19.-phase*7.));
        else if(worldKind<1.5)flow=vec2(sin(q.y*24.-phase*5.)*.22,q.y*.5);
        else flow=vec2(sin(q.y*9.+phase*3.)*.22,-.28*(1.-vUv.y));
        vec2 uv=clamp(vUv+flow*envelope*edge,vec2(.001),vec2(.999));
        // The opening: a wobbling circle from the centre; the old frame is pushed outward past it.
        float R=reveal*1.15*(1.+.035*sin(atan(metric.y,metric.x)*7.+phase*9.));float d=r-R;
        uv=clamp(.5+(uv-.5)*(1.-.22*reveal*smoothstep(.12,0.,d)),vec2(.001),vec2(.999));
        vec3 rgb=texture2D(image,uv).rgb;float keep=smoothstep(-.02,.06,d);
        rgb+=tint*(exp(-abs(d)*38.)*1.3+exp(-abs(d)*9.)*.25)*step(.001,reveal)*(1.-reveal*.6);
        gl_FragColor=vec4(rgb,opacity*max(keep,exp(-abs(d)*30.)*.85*step(.001,reveal)));
      }`,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false
  });
  const geometry=new T.PlaneGeometry(2,2),quad=new T.Mesh(geometry,material);quad.frustumCulled=false;quad.raycast=()=>{};layer.add(quad);
  let image=null,target=null,start=null,elapsed=0,duration=0,active=false,disposed=false,hold=false;
  const smooth=t=>(t=Math.max(0,Math.min(1,t)),t*t*(3-2*t));
  function releaseImage(){if(image){image.dispose();image=null;}material.uniforms.image.value=null;}
  function settle(){if(!target||hold)return;camera.position.copy(target.position);camera.quaternion.copy(target.quaternion);camera.fov=target.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function cancel({settleCamera=true}={}){if(settleCamera)settle();active=false;target=null;start=null;elapsed=0;material.uniforms.opacity.value=0;material.uniforms.strength.value=0;material.uniforms.phase.value=0;material.uniforms.reveal.value=0;hold=false;releaseImage();}
  function capture(){
    cancel();if(disposed)return false;
    // Copy the already composited portal frame, preserving its exact exposure and colour.
    // A capture failure degrades to the same camera settle without a black frame.
    try{const size=renderer.getDrawingBufferSize(new T.Vector2());material.uniforms.aspect.value=size.x/Math.max(1,size.y);image=new T.FramebufferTexture(size.x,size.y);renderer.copyFramebufferToTexture(image);material.uniforms.image.value=image;return true;}
    catch(error){releaseImage();console.warn('[arrival] frame dissolve unavailable',error);return false;}
  }
  // hold: overlay only (the caller owns the camera), e.g. the game frame opening onto the journey.
  function begin({world,reduced=false,hold:still=false,seconds}={}){
    if(disposed)return;hold=!!still;material.uniforms.tint.value.set(world==='car'?0xffc27a:world==='robot'?0x9ff0d6:0x8fdcff);target={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
    start={position:target.position.clone(),quaternion:target.quaternion.clone(),fov:target.fov};
    material.uniforms.worldKind.value=world==='helmet'?0:world==='robot'?1:2;material.uniforms.strength.value=reduced?0:.027;material.uniforms.phase.value=0;duration=seconds||(reduced?.22:world==='car'?1.1:.9);elapsed=0;active=true;material.uniforms.opacity.value=image?1:0;material.uniforms.reveal.value=0;
    if(!reduced&&image&&!hold){
      const forward=new T.Vector3(0,0,-1).applyQuaternion(target.quaternion);
      if(world==='car'){
        // Settle gently into the fixed diagonal toy view. The prior long forward
        // flight could cross the ground with this much closer provider camera.
        // Keep its exact aim and move only slightly back and upward.
        start.position.addScaledVector(forward,-1.8);start.position.y+=.8;
        start.fov=Math.min(45,target.fov+2);
      }else if(world==='helmet'){start.position.addScaledVector(forward,18);start.fov=66;}
      else start.fov=Math.max(52,target.fov-12); // Keep the FPS eye and its view-model together.
    }
    pose(0);
  }
  function pose(progress){if(hold)return;const t=smooth(progress);camera.position.lerpVectors(start.position,target.position,t);camera.quaternion.slerpQuaternions(start.quaternion,target.quaternion,t);camera.fov=start.fov+(target.fov-start.fov)*t;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  function update(dt){if(!active)return {active:false,done:false,progress:1};elapsed+=Math.max(0,Math.min(.1,Number(dt)||0));const progress=Math.min(1,elapsed/duration);pose(progress);material.uniforms.phase.value=progress;const e=progress*progress*(3-2*progress);material.uniforms.reveal.value=e;material.uniforms.opacity.value=1-smooth((progress-.82)/.18);if(progress>=1){settle();active=false;releaseImage();target=null;start=null;}return {active,done:progress>=1,progress};}
  function render(){if(!active||!image||material.uniforms.opacity.value<=0)return;const old=renderer.autoClear;try{renderer.autoClear=false;renderer.render(layer,screenCamera);}finally{renderer.autoClear=old;}}
  return {capture,begin,update,render,cancel,get active(){return active;},getState:()=>({active,elapsed,duration,hasImage:!!image}),dispose(){if(disposed)return;cancel();disposed=true;geometry.dispose();material.dispose();layer.clear();}};
}
