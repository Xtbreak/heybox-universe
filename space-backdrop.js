// Procedural only: no image downloads, volume textures or extra render targets.
export function createSpaceBackdrop({ THREE:T, root }) {
  const resources=new Set(),own=r=>(resources.add(r),r);
  const group=new T.Group();group.name='ultra-nebula-and-parallax-stars';root.add(group);
  const uniforms={uTime:{value:0},uProgress:{value:0},uAspect:{value:1},uPointer:{value:new T.Vector2()},uDepth:{value:0}};
  const nebulaMat=own(new T.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.9999,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime,uProgress,uAspect;uniform vec2 uPointer;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.12+1.7;a*=.5;}return n;}
      void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.)*3.5+uPointer*.035;
        float cloud=fbm(p+vec2(uTime*.009,uProgress*2.));float wisps=fbm(p*2.3+cloud*2.-uTime*.012);
        float density=pow(clamp(cloud*wisps*1.8-.23,0.,1.),1.8);
        float tint=smoothstep(.47,.72,uProgress)*(1.-smoothstep(.76,.9,uProgress));
        vec3 color=mix(vec3(.06,.35,.72),vec3(.55,.09,.51),tint);
        color=mix(color,vec3(.61,.27,.1),smoothstep(.80,1.,uProgress)*.5);
        float title=.25+.75*smoothstep(.24,.67,length((vUv-vec2(.40,.55))*vec2(1.,1.4)));
        gl_FragColor=vec4(color*density*.7,title*.75);
      }`
  }));
  const nebula=new T.Mesh(own(new T.PlaneGeometry(2,2)),nebulaMat);nebula.frustumCulled=false;nebula.renderOrder=-20;nebula.raycast=()=>{};group.add(nebula);
  let seed=22931;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const data=new Float32Array(4800*3);for(let i=0;i<4800;i++)data.set([rand(),rand(),i%3],i*3);
  const starGeo=own(new T.BufferGeometry());starGeo.setAttribute('position',new T.BufferAttribute(data,3));
  const starMat=own(new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime,uDepth,uAspect;uniform vec2 uPointer;varying float vLight;
      void main(){float layer=position.z+1.;vec2 p=fract(position.xy+uPointer*.005*layer+vec2(uDepth*.00017*layer,uTime*.0008*layer));
      gl_Position=vec4(p*2.-1.,.9998,1.);gl_PointSize=.7+layer*.5;vLight=.13+position.x*.36;}`,
    fragmentShader:`varying float vLight;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;
      gl_FragColor=vec4(vec3(.5,1.15,1.65),(1.-smoothstep(.06,.5,r))*vLight);}`
  }));
  const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=-19;stars.raycast=()=>{};group.add(stars);
  group.visible=false;
  return {
    update({quality,progress,time,reduced,width,height,pointerX=0,pointerY=0,desktop=true,cameraZ=0}){
      group.visible=quality==='ultra';if(!group.visible)return;
      uniforms.uTime.value=reduced?0:time;uniforms.uProgress.value=progress;uniforms.uAspect.value=width/Math.max(1,height);
      uniforms.uPointer.value.set(desktop&&!reduced?pointerX:0,desktop&&!reduced?pointerY:0);uniforms.uDepth.value=reduced?0:cameraZ;
    },
    setQuality:value=>{group.visible=value==='ultra';},
    dispose(){group.removeFromParent();resources.forEach(r=>r.dispose());resources.clear();}
  };
}
