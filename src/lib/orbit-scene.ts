import * as THREE from 'three';

/** Called only after a desktop/motion check and a dynamic import. */
export function mountOrbit(host: HTMLElement, onReady: (ready: boolean) => void): () => void {
  const canvas = document.createElement('canvas');
  let context: WebGL2RenderingContext | null = null;
  try { context = canvas.getContext('webgl2', { alpha: true, antialias: true }); } catch { /* SVG poster stays visible. */ }
  if (!context) return () => {};
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true }); } catch { return () => {}; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
  camera.position.set(0, 1.9, 7);
  camera.lookAt(0, 0, 0);
  const assembly = new THREE.Group();
  scene.add(assembly);
  const geometry = new THREE.IcosahedronGeometry(.53, 0);
  const core = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x28756c, metalness: .65, roughness: .32, flatShading: true }));
  core.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x70f0d3, transparent: true, opacity: .75 })));
  assembly.add(core);
  const rings: THREE.Group[] = [];
  [1.14, 1.75, 2.32].forEach((radius, index) => {
    const group = new THREE.Group();
    group.rotation.set(.65 + index * .35, .15 + index * .2, .25 - index * .4);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .007, 6, 128), new THREE.MeshBasicMaterial({ color: index === 1 ? 0x879fff : 0x70f0d3, transparent: true, opacity: .5 }));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(.038 + index * .012, 10, 8), new THREE.MeshBasicMaterial({ color: index === 1 ? 0xa5b9ff : 0xa1ffe7 }));
    bead.position.set(radius, 0, 0);
    group.add(ring, bead); assembly.add(group); rings.push(group);
  });
  scene.add(new THREE.AmbientLight(0xc0ffed, 1.5));
  const light = new THREE.PointLight(0x70f0d3, 26); light.position.set(2, 3, 4); scene.add(light);
  host.appendChild(canvas);
  let frame = 0;
  let visible = true;
  let disposed = false;
  let last = 0;
  let time = 0;
  function draw(now: number): void {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    if (now - last >= 32) {
      const dt = Math.min((now - last) / 1000, .05); last = now; time += dt;
      core.rotation.y = time * .16; core.rotation.z = time * .07;
      rings.forEach((ring, index) => { ring.rotation.z += dt * .025 * (index % 2 ? -1 : 1); ring.children[1].position.set(Math.cos(time * (.18 + index * .04) + index * 2) * (1.14 + [0,.61,1.18][index]), Math.sin(time * (.18 + index * .04) + index * 2) * (1.14 + [0,.61,1.18][index]), 0); });
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(draw);
  }
  function resume(): void { if (!frame && visible && !document.hidden && !disposed) { last = performance.now(); frame = requestAnimationFrame(draw); } }
  function pause(): void { cancelAnimationFrame(frame); frame = 0; }
  function resize(): void {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.render(scene, camera); onReady(true);
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); else pause(); }); intersection.observe(host);
  const visibility = (): void => { if (document.hidden) pause(); else resume(); };
  const lost = (event: Event): void => { event.preventDefault(); pause(); onReady(false); };
  canvas.addEventListener('webglcontextlost', lost);
  document.addEventListener('visibilitychange', visibility);
  resize(); resume();
  return () => {
    disposed = true; pause(); observer.disconnect(); intersection.disconnect();
    document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', lost);
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose());
      }
    });
    renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  };
}
