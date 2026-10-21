'use client';

import { useEffect, useRef } from 'react';

/* Fades/lifts its children in once they scroll into view. Content is visible by default,
   so it still shows with JS off or reduced motion; the hidden start state is added on mount. */
export default function Reveal({ children, className = '', delay = 0 }){
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    el.classList.add('lp-pre');
    const io = new IntersectionObserver(([e]) => { if(e.isIntersecting){ el.classList.add('in'); io.disconnect(); } }, { threshold:.15, rootMargin:'0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className} style={{ transitionDelay:`${delay}ms` }}>{children}</div>;
}
