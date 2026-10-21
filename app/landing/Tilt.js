'use client';

import { useRef } from 'react';

/* A card that tilts toward the pointer and catches a little light. */
export default function Tilt({ children, className = '', max = 9 }){
  const ref = useRef(null);
  const move = e => {
    const el = ref.current, r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${((px - .5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-(py - .5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(0)}%`); el.style.setProperty('--gy', `${(py * 100).toFixed(0)}%`);
  };
  const leave = () => { const s = ref.current.style; s.setProperty('--rx', '0deg'); s.setProperty('--ry', '0deg'); };
  return <div ref={ref} className={`lp-tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}
