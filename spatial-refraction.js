import { ShaderPass } from './vendor/ShaderPass.js';
import { Vector2, Vector3 } from './vendor/three.module.js';

// Samples the actual composed scene. It adds no luminous overlay or geometry.
export const spatialRefractionShader = {
  uniforms: {tDiffuse:{value:null},uCenter:{value:new Vector2(.5,.5)},uAspect:{value:1},uRadius:{value:.22},uStrength:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uCenter;uniform float uAspect,uRadius,uStrength;varying vec2 vUv;
void main(){vec2 d=(vUv-uCenter)*vec2(uAspect,1.);float r=length(d)/max(.05,uRadius);float envelope=(1.-smoothstep(.12,1.,r))*exp(-r*r*2.);vec2 direction=d/max(length(d),.0001)/vec2(uAspect,1.);vec2 bend=direction*(.0045*uStrength*envelope*sin(r*4.1));vec2 uv=clamp(vUv+bend,vec2(.001),vec2(.999));vec4 original=texture2D(tDiffuse,uv);float split=.00045*uStrength*envelope;original.r=texture2D(tDiffuse,clamp(uv+direction*split,vec2(.001),vec2(.999))).r;original.b=texture2D(tDiffuse,clamp(uv-direction*split,vec2(.001),vec2(.999))).b;gl_FragColor=original;}`
};
export function createSpatialRefraction(){
  const pass=new ShaderPass(spatialRefractionShader),projected=new Vector3();pass.enabled=false;
  pass.updateOptics=(state,camera,width,height,enabled=true)=>{
    const valid=enabled&&state?.center?.isVector3&&Number.isFinite(state.strength)&&state.strength>0;
    if(!valid){pass.enabled=false;pass.uniforms.uStrength.value=0;return;}
    camera.updateMatrixWorld(true);projected.copy(state.center).project(camera);
    if(!Number.isFinite(projected.x)||!Number.isFinite(projected.y)||projected.z< -1||projected.z>1||Math.abs(projected.x)>1.4||Math.abs(projected.y)>1.4){pass.enabled=false;return;}
    pass.uniforms.uCenter.value.set(projected.x*.5+.5,projected.y*.5+.5);
    pass.uniforms.uAspect.value=Math.max(.25,Math.min(4,width/Math.max(1,height)));
    pass.uniforms.uRadius.value=Math.max(.08,Math.min(.38,Number(state.radius)||.22));
    pass.uniforms.uStrength.value=Math.max(0,Math.min(1,state.strength));pass.enabled=true;
  };
  return pass;
}
