import { useEffect, useRef, useState } from 'react';

/** A decorative scene. Real plugin observations always remain in the 2D chart. */
export function OrbitScene(): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    let generation = 0;
    let timer: number | undefined;
    const stop = (): void => { generation++; cleanup?.(); cleanup = undefined; setReady(false); };
    const start = (): void => {
      stop();
      if (cancelled || motion.matches || !desktop.matches || connection?.saveData) return;
      const current = generation;
      timer = window.setTimeout(() => {
        void import('../lib/orbit-scene').then(({ mountOrbit }) => {
          if (cancelled || current !== generation || motion.matches || !desktop.matches || !host.current) return;
          cleanup = mountOrbit(host.current, setReady);
        }).catch(() => setReady(false));
      }, 650);
    };
    const change = (): void => { window.clearTimeout(timer); start(); };
    start();
    motion.addEventListener('change', change); desktop.addEventListener('change', change);
    return () => { cancelled = true; window.clearTimeout(timer); cleanup?.(); motion.removeEventListener('change', change); desktop.removeEventListener('change', change); };
  }, []);
  return (
    <figure className="orbit-brand-scene" data-mode={ready ? 'webgl' : 'poster'} aria-label="ORBIT 轨道装置，装饰示意，不表示插件数据">
      <svg viewBox="0 0 400 150" role="presentation" aria-hidden="true">
        <defs><radialGradient id="orbit-glow"><stop stopColor="#70f0d3" stopOpacity=".17" /><stop offset="1" stopColor="#70f0d3" stopOpacity="0" /></radialGradient><linearGradient id="orbit-ring"><stop stopColor="#70f0d3" stopOpacity=".1" /><stop offset=".5" stopColor="#70f0d3" stopOpacity=".8" /><stop offset="1" stopColor="#879fff" stopOpacity=".2" /></linearGradient></defs>
        <ellipse cx="200" cy="70" rx="134" ry="68" fill="url(#orbit-glow)" />
        <g fill="none" stroke="url(#orbit-ring)"><ellipse cx="200" cy="70" rx="144" ry="38" transform="rotate(-16 200 70)" /><ellipse cx="200" cy="70" rx="106" ry="44" transform="rotate(23 200 70)" /><ellipse cx="200" cy="70" rx="80" ry="32" transform="rotate(-56 200 70)" /></g>
        <path d="m200 35 29 19-8 36-35 10-20-30 16-29z M200 35l-14 65m43-46-63 16m16-29 39 49" fill="#173f43" fillOpacity=".7" stroke="#70f0d3" strokeOpacity=".7" />
        <circle cx="313" cy="37" r="4" fill="#70f0d3" /><circle cx="121" cy="43" r="2.5" fill="#91b4ff" /><path d="M24 122h70m212 0h70" stroke="#223146" />
      </svg>
      <div ref={host} className="orbit-scene-canvas" aria-hidden="true" />
    </figure>
  );
}
