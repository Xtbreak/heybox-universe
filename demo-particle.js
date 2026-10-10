// Digital Life / 数字生命体 — self-contained, scroll-directed GPU sculpture.
export function createDemo({ THREE: T, scene, camera, renderer, reduced = false }) {
  camera.position.set(0, 0, 8.2);
  camera.lookAt(0.15, 0, 0);
  camera.updateProjectionMatrix();
  const root = new T.Group();
  root.position.set(1.15, 0, 0);
  scene.add(root);
  const owned = [];
  const materials = [];
  const keep = g => { owned.push(g); return g; };
  const mat = m => { materials.push(m); return m; };
  let width = 1280, height = 800;
  let disposed = false;
  const uniforms = {
    uTime: { value: 0 }, uProgress: { value: 0 },
    uPointer: { value: new T.Vector2(10, 10) },
    uPixelRatio: { value: Math.min(renderer?.getPixelRatio?.() || 1, 2) },
    uHeight: { value: height }, uMotion: { value: reduced ? 0.15 : 1 },
    uEnergy: { value: 0 }, uOpacity: { value: 1 }
  };
  // Deterministic particles make module switches stable.
  let seed = 13871;
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  const N = reduced ? 20000 : 36000;
  const cube = new Float32Array(N * 3), fluid = new Float32Array(N * 3);
  const world = new Float32Array(N * 3), core = new Float32Array(N * 3);
  const info = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const j = i * 3, k = i * 4;
    const u = random(), v = random(), w = random();
    const face = i % 6;
    let x = (u * 2 - 1) * 1.43, y = (v * 2 - 1) * 1.43, z = (w * 2 - 1) * 1.43;
    if (face < 2) x = face ? 1.43 : -1.43;
    else if (face < 4) y = face === 3 ? 1.43 : -1.43;
    else z = face === 5 ? 1.43 : -1.43;
    // Sparse interior cells add depth rather than an opaque solid box.
    if (i % 9 === 0) { x *= w; y *= u; z *= v; }
    const cx = x * 0.88 + z * 0.475;
    const cz = -x * 0.475 + z * 0.88;
    cube[j] = cx; cube[j + 1] = y * 0.94 - cz * 0.34; cube[j + 2] = y * 0.34 + cz * 0.94;
    const a = u * Math.PI * 2, b = v * Math.PI * 2;
    // Asymmetric liquid torus: a braided, open-center sculpture, never a tunnel.
    const radius = 1.49 + Math.sin(a * 3) * 0.16;
    const tube = 0.45 + 0.09 * Math.cos(a * 2);
    const rr = radius + tube * Math.cos(b);
    fluid[j] = rr * Math.cos(a);
    fluid[j + 1] = rr * Math.sin(a) * 0.74 + tube * Math.sin(b) * 0.41;
    fluid[j + 2] = tube * Math.sin(b) * 0.9 - rr * Math.sin(a) * 0.35;
    // A spherical data-world with meridian/latitude concentrations.
    let longitude = a;
    let polar = Math.acos(2 * w - 1);
    if (i % 3 === 0) longitude = Math.round(longitude / (Math.PI / 18)) * (Math.PI / 18) + (v - 0.5) * 0.009;
    if (i % 3 === 1) polar = Math.round(polar / (Math.PI / 18)) * (Math.PI / 18) + (v - 0.5) * 0.009;
    const wr = 1.98 + 0.065 * Math.sin(longitude * 7 + polar * 9);
    world[j] = Math.sin(polar) * Math.cos(longitude) * wr;
    world[j + 1] = Math.cos(polar) * wr;
    world[j + 2] = Math.sin(polar) * Math.sin(longitude) * wr;
    const cr = i % 5 === 0 ? 0.87 + v * 0.16 : 1.36 + v * 0.68;
    const ca = a + Math.sin(b) * 0.23;
    core[j] = Math.cos(ca) * cr;
    core[j + 1] = Math.sin(ca) * cr * 0.66 + (w - 0.5) * 0.20;
    core[j + 2] = Math.sin(ca) * cr * 0.58 + (v - 0.5) * 0.21;
    info[k] = u; info[k + 1] = v; info[k + 2] = w; info[k + 3] = random();
  }
  const geometry = keep(new T.BufferGeometry());
  geometry.setAttribute('position', new T.BufferAttribute(cube, 3));
  geometry.setAttribute('aFluid', new T.BufferAttribute(fluid, 3));
  geometry.setAttribute('aWorld', new T.BufferAttribute(world, 3));
  geometry.setAttribute('aCore', new T.BufferAttribute(core, 3));
  geometry.setAttribute('aInfo', new T.BufferAttribute(info, 4));
  const vertexShader = `
    uniform float uTime, uProgress, uPixelRatio, uHeight, uMotion, uEnergy;
    uniform vec2 uPointer;
    attribute vec3 aFluid, aWorld, aCore;
    attribute vec4 aInfo;
    varying float vAlpha, vIce, vHot;
    mat2 rot(float a) { float s=sin(a), c=cos(a); return mat2(c,-s,s,c); }
    void main() {
      float stage=clamp(uProgress,0.,1.)*3.;
      float s1=smoothstep(0.05,0.98,stage);
      float s2=smoothstep(1.05,1.98,stage);
      float s3=smoothstep(2.05,2.98,stage);
      vec3 fluid=aFluid;
      fluid.xy=rot(uTime*.09*uMotion)*fluid.xy;
      fluid += normalize(aFluid+vec3(.001))*sin(aInfo.x*31.+uTime*1.2)*.035*uMotion;
      vec3 globe=aWorld;
      globe.xz=rot(uTime*.07*uMotion)*globe.xz;
      vec3 orbit=aCore;
      orbit.xz=rot(uTime*.10*uMotion)*orbit.xz;
      vec3 p=mix(position,fluid,s1);
      p=mix(p,globe,s2); p=mix(p,orbit,s3);
      float transition=sin(fract(stage)*3.14159265);
      p += vec3(sin(aInfo.x*42.+uTime*.3),cos(aInfo.y*37.),sin(aInfo.z*32.))*transition*.12;
      p.y += sin(uTime*.48)*.055*uMotion;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      vec4 clip=projectionMatrix*mv;
      vec2 delta=clip.xy/clip.w-uPointer;
      float influence=exp(-dot(delta,delta)*14.);
      vec2 away=normalize(delta+vec2(.0001));
      // A broad push, plus a traveling concentric wave through the living surface.
      float wave=sin(length(delta)*30.-uTime*4.)*.035*uMotion;
      float response=mix(.34,-.30,s1*(1.-s2));
      mv.xy += away*influence*(response+sign(response)*uEnergy*.18+wave);
      mv.z += influence*sin(uTime*2.+aInfo.x*6.28)*.14*uMotion;
      gl_Position=projectionMatrix*mv;
      float bright=step(.971,aInfo.w);
      float size=mix(1.05,2.3,aInfo.z)+bright*1.6;
      gl_PointSize=clamp(size*uPixelRatio*(uHeight/800.)*5.5/max(2.,-mv.z),.65,7.);
      vAlpha=(.24+.46*aInfo.y)*(1.-.27*s3)+bright*.35;
      vIce=smoothstep(.62,.96,aInfo.w)+influence*.3;
      vHot=bright;
    }
  `;
  const particleMaterial = mat(new T.ShaderMaterial({
    uniforms, vertexShader,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha,vIce,vHot;
      void main() {
        float r=length(gl_PointCoord-.5)*2.;
        if(r>1.) discard;
        float soft=exp(-r*r*4.8)*(1.-smoothstep(.55,1.,r));
        vec3 color=mix(vec3(.65,.78,.87),vec3(.14,.55,1.),clamp(vIce,0.,1.));
        color=mix(color,vec3(.9,.97,1.),vHot*.72);
        gl_FragColor=vec4(color,soft*vAlpha*uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  }));
  const points = new T.Points(geometry, particleMaterial);
  points.frustumCulled = false; root.add(points);

  // A subtle seam lattice makes the initial cube feel machined and precise.
  const linePositions = [];
  function addSegment(ax, ay, az, bx, by, bz) {
    for (const p of [[ax,ay,az],[bx,by,bz]]) {
      const xx=p[0]*.88+p[2]*.475, zz=-p[0]*.475+p[2]*.88;
      linePositions.push(xx,p[1]*.94-zz*.34,p[1]*.34+zz*.94);
    }
  }
  for (let i=0;i<=12;i++) {
    const a=-1.43+i*2.86/12;
    for (const f of [-1.43,1.43]) {
      addSegment(-1.43,a,f,1.43,a,f); addSegment(a,-1.43,f,a,1.43,f);
      addSegment(f,a,-1.43,f,a,1.43); addSegment(f,-1.43,a,f,1.43,a);
      addSegment(-1.43,f,a,1.43,f,a); addSegment(a,f,-1.43,a,f,1.43);
    }
  }
  const latticeGeometry=keep(new T.BufferGeometry());
  latticeGeometry.setAttribute('position',new T.Float32BufferAttribute(linePositions,3));
  const latticeMaterial=mat(new T.LineBasicMaterial({color:0x68b9ff,transparent:true,opacity:.075,depthWrite:false,blending:T.AdditiveBlending}));
  const lattice=new T.LineSegments(latticeGeometry,latticeMaterial);root.add(lattice);

  // Sculpted satin-metal nucleus. Geometry supplies broad highlights without assets.
  const nucleusGeometry=keep(new T.SphereGeometry(.75,96,64));
  const pos=nucleusGeometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
    const a=Math.atan2(z,x), p=Math.acos(Math.max(-1,Math.min(1,y/.75)));
    const r=1+.085*Math.sin(a*3+p*2)*Math.sin(p)*Math.sin(p)+.035*Math.cos(p*6);
    pos.setXYZ(i,x*r,y*r,z*r);
  }
  nucleusGeometry.computeVertexNormals();
  const nucleusMaterial=mat(new T.MeshPhysicalMaterial({
    color:0xaac1cf,metalness:.82,roughness:.23,clearcoat:.65,clearcoatRoughness:.22,
    transparent:true,opacity:0,emissive:0x041425,emissiveIntensity:.2
  }));
  const nucleus=new T.Mesh(nucleusGeometry,nucleusMaterial);root.add(nucleus);
  const lights = new T.Group(); root.add(lights);
  const key=new T.DirectionalLight(0xeef9ff,4.8);key.position.set(-3,4,5);lights.add(key);
  const fill=new T.DirectionalLight(0x1685ff,3.5);fill.position.set(3,-1,2);lights.add(fill);
  const rim=new T.DirectionalLight(0xffffff,4);rim.position.set(0,2,-4);lights.add(rim);
  lights.add(new T.AmbientLight(0x9bb5ce,.7));

  // Thin emissive ribbons wrap the nucleus, avoiding mechanical ring silhouettes.
  const ribbons=[];
  for(let n=0;n<5;n++){
    const curvePoints=[];
    for(let i=0;i<=256;i++){
      const a=i/256*Math.PI*2;
      const r=1.02+n*.15+.07*Math.sin(a*3+n);
      curvePoints.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r*.51+Math.sin(a*3+n)*.08,Math.sin(a)*r*.64));
    }
    const curve=new T.CatmullRomCurve3(curvePoints,true);
    const geo=keep(new T.TubeGeometry(curve,256,n===0?.011:.005,5,true));
    const material=mat(new T.MeshBasicMaterial({color:n%2?0x318eff:0xbdeaff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
    const mesh=new T.Mesh(geo,material);mesh.rotation.z=n*.38;mesh.rotation.y=n*.32;
    root.add(mesh);ribbons.push(mesh);
  }
  // Sparse isolated motes ground the sculpture in negative space.
  const dustN=420,dustArray=new Float32Array(dustN*3);
  for(let i=0;i<dustN;i++){
    dustArray[i*3]=(random()-.5)*11;
    dustArray[i*3+1]=(random()-.5)*7;
    dustArray[i*3+2]=-2-random()*4;
  }
  const dustGeometry=keep(new T.BufferGeometry());dustGeometry.setAttribute('position',new T.BufferAttribute(dustArray,3));
  const dustMaterial=mat(new T.PointsMaterial({color:0x91b9d9,size:.012,transparent:true,opacity:.26,sizeAttenuation:true,depthWrite:false,blending:T.AdditiveBlending}));
  const dust=new T.Points(dustGeometry,dustMaterial);root.add(dust);
  let previousX=0,previousY=0,energy=0;
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  function update({time=0,dt=1/60,progress=0,pointer={x:0,y:0}}={}){
    if(disposed)return;
    const p=Math.max(0,Math.min(1,progress));
    uniforms.uTime.value=time;uniforms.uProgress.value=p;
    uniforms.uPointer.value.set(pointer.x??0,pointer.y??0);
    const delta=Math.abs((pointer.x||0)-previousX)+Math.abs((pointer.y||0)-previousY);
    energy+=(Math.min(2,delta*12)-energy)*Math.min(1,dt*6);
    uniforms.uEnergy.value=energy;previousX=pointer.x||0;previousY=pointer.y||0;
    latticeMaterial.opacity=.07*(1-smooth(.015,.28,p));lattice.visible=latticeMaterial.opacity>.001;
    const reveal=smooth(.71,.94,p);
    nucleus.visible=reveal>.001;nucleusMaterial.opacity=reveal;
    const ns=.6+.4*reveal;nucleus.scale.setScalar(ns);
    nucleus.rotation.y=time*(reduced?.016:.13);nucleus.rotation.z=.12;
    for(let i=0;i<ribbons.length;i++){
      const ribbon=ribbons[i];ribbon.material.opacity=reveal*(i===0?.65:.36);
      ribbon.visible=reveal>.001;
      ribbon.rotation.z=i*.38+time*(reduced?.012:.065)*(i%2?1:-1);
    }
    // Keep hero position editorially stable; interaction is in the particle shader.
    root.rotation.y=(reduced?0:Math.sin(time*.16)*.045);
    dust.rotation.z=time*(reduced?.0005:.002);
  }
  function resize(w,h){
    width=Math.max(1,w);height=Math.max(1,h);uniforms.uHeight.value=height;
    uniforms.uPixelRatio.value=Math.min(renderer?.getPixelRatio?.()||1,2);
    const mobile=width/height<.82;
    root.position.set(mobile?.15:1.15,mobile?-.48:0,0);
    root.scale.setScalar(mobile?.79:1);
  }
  function dispose(){
    if(disposed)return;disposed=true;scene.remove(root);
    for(const g of owned)g.dispose();for(const m of materials)m.dispose();
    root.clear();
  }
  return {update,resize,dispose};
}
