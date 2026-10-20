import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function QuietHint({ children, text, className = '', placement = 'bottom', focusable = true }: {
  children: ReactNode; text: ReactNode; className?: string; placement?: 'bottom' | 'right'; focusable?: boolean;
}): JSX.Element {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const show = (): void => { window.clearTimeout(timer.current); setOpen(true); };
  const hide = (): void => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 110); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = (): void => {
      if (!anchor.current || !bubble.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const tooltip = bubble.current.getBoundingClientRect();
      let left = placement === 'right' ? rect.right + 12 : rect.left;
      let top = placement === 'right' ? rect.top + (rect.height - tooltip.height) / 2 : rect.bottom + 10;
      if (placement === 'bottom' && top + tooltip.height > innerHeight - 12) top = rect.top - tooltip.height - 10;
      left = Math.max(12, Math.min(left, innerWidth - tooltip.width - 12));
      top = Math.max(12, Math.min(top, innerHeight - tooltip.height - 12));
      setPosition({ left, top });
    };
    const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', key);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', key); };
  }, [open, placement]);
  return <>
    <span ref={anchor} className={'orbit-quiet-hint ' + className} tabIndex={focusable ? 0 : undefined}
      aria-describedby={open ? id : undefined} onMouseEnter={show} onMouseLeave={hide}
      onFocus={show} onBlur={hide} onPointerDown={event => { if (focusable && event.pointerType === 'touch') { event.preventDefault(); setOpen(previous => !previous); } }}>
      {children}
    </span>
    {open && createPortal(<div ref={bubble} id={id} role="tooltip" className="orbit-quiet-tooltip" style={position} onMouseEnter={show} onMouseLeave={hide}>{text}</div>, document.body)}
  </>;
}
