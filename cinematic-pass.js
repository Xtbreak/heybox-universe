import { ShaderPass } from './vendor/ShaderPass.js';
import { Vector2, Vector3 } from './vendor/three.module.js';

const clamp = x => Math.max(0, Math.min(1, x));
export function riftEnvelope(progress, start = .66, end = .77) {
  const p = clamp((progress - start) / (end - start));
  return Math.sin(Math.PI * p) ** .65;
}

// Linear HDR input, before OutputPass. Ten radial taps share a single shader.
export function createCinematicPass() {
  const pass = new ShaderPass({
    name: 'Journey cinematic optics',
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 },
      uSpeed: { value: 0 }, uCharge: { value: 0 }, uMotion: { value: 1 },
      uImpact: { value: 0 }, uAge: { value: 9 }, uFlash: { value: 0 },
      uCenter: { value: new Vector2(.5, .5) }, uPointer:{value:new Vector2(.5,.5)},uField:{value:0}
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime,uAspect,uSpeed,uCharge,uMotion,uImpact,uAge,uFlash,uField;
      uniform vec2 uCenter,uPointer;varying vec2 vUv;
      float grain(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      vec2 bound(vec2 p){return clamp(p,vec2(.001),vec2(.999));}
      void main(){
        vec2 d=vUv-.5;float edge=dot(d,d);
        vec2 uv=.5+d*(1.+edge*.035*uMotion);
        vec2 field=uv-uPointer;uv+=field*exp(-dot(field,field)*45.)*.013*uField*uMotion;
        float shake=step(uAge,.25)*(1.-clamp(uAge/.25,0.,1.))*uImpact*uMotion;
        uv+=vec2(sin(uAge*187.),cos(uAge*139.))*.0022*shake;
        vec2 wave=(uv-uCenter)*vec2(uAspect,1.);float radius=length(wave);
        float shell=exp(-pow((radius-uAge*1.75)/.025,2.))*uImpact*uMotion;
        uv+=wave/max(.001,radius)/vec2(uAspect,1.)*shell*.018;
        vec2 radial=uv-.5;float blur=uSpeed*.026*uMotion;
        vec3 color=texture2D(tDiffuse,bound(uv)).rgb;
        if(blur>.0001){
          color=vec3(0.);
          for(int i=0;i<10;i++)color+=texture2D(tDiffuse,bound(uv-radial*blur*float(i))).rgb;
          color*=.1;
        }
        float split=(.0007+uSpeed*.007+uImpact*.014)*edge*uMotion;
        color.r=texture2D(tDiffuse,bound(uv+radial*split)).r;
        color.b=texture2D(tDiffuse,bound(uv-radial*split)).b;
        color*=1.-smoothstep(.08,.48,edge)*(.25+uCharge*.4);
        color+=(grain(vUv*vec2(1920.,1080.)+floor(uTime*24.))-.5)*.009;
        color=mix(color,vec3(3.),uFlash*uMotion*.85);
        gl_FragColor=vec4(max(color,vec3(0.)),1.);
      }`
  });
  pass.enabled = false;
  const projected = new Vector3();
  let speed = 0, age = 9, exitFlash = 9;
  pass.burst = (center, camera) => {
    camera.updateMatrixWorld(true);
    projected.copy(center).project(camera);
    pass.uniforms.uCenter.value.set(clamp(projected.x * .5 + .5), clamp(projected.y * .5 + .5));
    age = 0;
  };
  pass.flash = () => { exitFlash = 0; };
  pass.resetMotion = () => { speed = 0; age = exitFlash = 9; };
  pass.advance = (dt, { velocity = 0, rift = 0, charge = 0, reduced = false, pointerX=0, pointerY=0, field=false } = {}) => {
    age += dt; exitFlash += dt;
    const target = reduced ? 0 : Math.max(clamp(Math.abs(velocity) / 2400), rift * clamp(Math.abs(velocity) / 500));
    speed += (target - speed) * (1 - Math.exp(-dt * 11));
    const u = pass.uniforms;
    u.uTime.value += reduced ? 0 : dt;
    u.uSpeed.value = reduced ? 0 : speed;
    u.uCharge.value = charge; u.uMotion.value = reduced ? 0 : 1;
    u.uPointer.value.set(pointerX*.5+.5,pointerY*.5+.5);u.uField.value=field&&!reduced?1:0;
    u.uAge.value = age;
    u.uImpact.value = reduced ? 0 : Math.max(0, 1 - age / .55);
    u.uFlash.value = reduced ? 0 : Math.max(0, 1 - Math.min(age, exitFlash) / .12);
  };
  pass.configure = (enabled, width, height) => {
    pass.enabled = enabled;
    pass.uniforms.uAspect.value = width / Math.max(1, height);
  };
  return pass;
}
