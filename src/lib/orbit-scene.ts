import * as THREE from 'three';

/** Procedural armillary sculpture; isolated from real plugin data. */
export function mountOrbit(host: HTMLElement, onReady: (ready: boolean) => void): () => void {
  const canvas = document.createElement('canvas');
  let context: WebGL2RenderingContext | null = null;
  try { context = canvas.getContext('webgl2', {alpha:true,antialias:true}); } catch { /* Keep the SVG. */ }
  if (!context) return () => {};
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true}); } catch { return () => {}; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28,1,.1,30);
  camera.position.set(0,.8,5.9); camera.lookAt(0,0,0);
  const assembly = new THREE.Group(); scene.add(assembly);
  const geometry = new THREE.IcosahedronGeometry(.48,0);
  const core = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x1a625b,emissive:0x0e493c,emissiveIntensity:.6,metalness:.7,roughness:.24,flatShading:true}));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0x9affe3,transparent:true,opacity:.88}));
  core.add(edges); assembly.add(core);
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(.24),new THREE.MeshBasicMaterial({color:0xbaffeb,wireframe:true,transparent:true,opacity:.65}));
  core.add(inner);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const paint=glowCanvas.getContext('2d');
  let glowTexture: THREE.CanvasTexture | undefined;
  if(paint){
    const glow=paint.createRadialGradient(64,64,0,64,64,64);
    glow.addColorStop(0,'rgba(112,240,211,.5)');glow.addColorStop(.35,'rgba(55,173,161,.16)');glow.addColorStop(1,'rgba(20,80,87,0)');
    paint.fillStyle=glow;paint.fillRect(0,0,128,128);glowTexture=new THREE.CanvasTexture(glowCanvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.7}));
    sprite.scale.set(2.5,2.5,1);scene.add(sprite);
  }
  const rings: {group:THREE.Group;bead:THREE.Mesh;radius:number;speed:number}[]=[];
  [1.15,1.82,2.42].forEach((radius,index)=>{
    const group=new THREE.Group();group.rotation.set(1.05+index*.18,index*.17,.12-index*.3);
    const color=index===1?0x9babff:0x70f0d3;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.006,5,144),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5-index*.06}));
    const arc=new THREE.EllipseCurve(0,0,radius,radius,index*1.7,index*1.7+.62,false,0);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc.getPoints(40)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.95}));
    const bead=new THREE.Mesh(new THREE.SphereGeometry(.034+index*.012,12,8),new THREE.MeshBasicMaterial({color:index===1?0xc4cbff:0xbaffeb}));
    group.add(ring,line,bead);assembly.add(group);rings.push({group,bead,radius,speed:.16+index*.045});
  });
  const marks:number[]=[];
  for(let i=0;i<72;i++){
    const angle=i/72*Math.PI*2,outer=2.59,inner=i%6===0?2.48:2.54;
    marks.push(Math.cos(angle)*inner,0,Math.sin(angle)*inner,Math.cos(angle)*outer,0,Math.sin(angle)*outer);
  }
  const ticks=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(marks,3)),new THREE.LineBasicMaterial({color:0x6a92a9,transparent:true,opacity:.25}));
  ticks.rotation.z=-.12;scene.add(ticks);
  scene.add(new THREE.AmbientLight(0xc5fff1,1.8));
  const light=new THREE.PointLight(0x7bffe2,20);light.position.set(1.5,3,3);scene.add(light);
  const rim=new THREE.PointLight(0x829eff,12);rim.position.set(-3,.5,-1);scene.add(rim);
  host.appendChild(canvas);
  let frame=0,last=0,time=0,visible=true,disposed=false;
  function draw(now:number):void {
    frame=0;if(disposed||!visible||document.hidden)return;
    if(now-last>=32){
      const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
      core.rotation.y=time*.18;core.rotation.z=time*.055;inner.rotation.y=-time*.3;
      rings.forEach(({group,bead,radius,speed},index)=>{
        group.rotation.z+=dt*.018*(index%2?-1:1);
        bead.position.set(Math.cos(time*speed+index*2)*radius,Math.sin(time*speed+index*2)*radius,0);
      });
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(draw);
  }
  function resume():void { if(!frame&&visible&&!document.hidden&&!disposed){last=performance.now();frame=requestAnimationFrame(draw);} }
  function pause():void {cancelAnimationFrame(frame);frame=0;}
  function resize():void {
    if(disposed)return;
    const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.render(scene,camera);onReady(true);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)resume();else pause();});intersection.observe(host);
  const visibility=():void=>{if(document.hidden)pause();else resume();};
  const lost=(event:Event):void=>{event.preventDefault();pause();onReady(false);};
  canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
  resize();resume();
  return ()=>{
    disposed=true;pause();observer.disconnect();intersection.disconnect();
    document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);
    scene.traverse(object=>{
      if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){
        object.geometry.dispose();
        const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());
      }
    });
    glowTexture?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  };
}
