import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * The hero centerpiece: a faceted glass monolith that turns toward the cursor.
 * Pure SVG + transforms, so it stays sharp and cheap.
 */
export const Prism = ({ className }: { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 16 }), sy = useSpring(my, { stiffness: 60, damping: 16 });
  const rotateY = useTransform(sx, [-1, 1], [-16, 16]);
  const rotateX = useTransform(sy, [-1, 1], [10, -10]);
  const shineX = useTransform(sx, [-1, 1], ['20%', '80%']);

  useEffect(() => {
    const move = (e: PointerEvent) => { mx.set((e.clientX / window.innerWidth) * 2 - 1); my.set((e.clientY / window.innerHeight) * 2 - 1); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [mx, my]);

  return (
    <div ref={ref} className={className} style={{ perspective: 1100 }}>
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }} className="relative animate-floaty">
        <svg viewBox="0 0 400 380" className="w-full drop-shadow-[0_40px_80px_rgba(91,59,214,0.55)]" aria-hidden>
          <defs>
            <linearGradient id="pf-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cfc4ff" stopOpacity=".95" /><stop offset="1" stopColor="#7c5cff" stopOpacity=".55" /></linearGradient>
            <linearGradient id="pf-left" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d55f5" stopOpacity=".85" /><stop offset="1" stopColor="#1a1450" stopOpacity=".95" /></linearGradient>
            <linearGradient id="pf-right" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f8bff" stopOpacity=".8" /><stop offset="1" stopColor="#241a6b" stopOpacity=".95" /></linearGradient>
            <radialGradient id="pf-core" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="#b9a8ff" stopOpacity=".55" /><stop offset="1" stopColor="#7c5cff" stopOpacity="0" /></radialGradient>
            <filter id="pf-blur"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <ellipse cx="200" cy="336" rx="150" ry="20" fill="#5b3bd6" opacity=".35" filter="url(#pf-blur)" />
          <path d="M200 40 L332 112 L200 184 L68 112 Z" fill="url(#pf-top)" stroke="#e9e3ff" strokeOpacity=".55" strokeWidth="1.2" />
          <path d="M68 112 L200 184 L200 328 L68 254 Z" fill="url(#pf-left)" stroke="#a99bff" strokeOpacity=".45" strokeWidth="1.2" />
          <path d="M332 112 L200 184 L200 328 L332 254 Z" fill="url(#pf-right)" stroke="#8fb4ff" strokeOpacity=".45" strokeWidth="1.2" />
          <path d="M200 40 L200 184 M68 112 L200 184 L332 112" stroke="#fff" strokeOpacity=".22" strokeWidth="1" fill="none" />
          <circle cx="200" cy="184" r="70" fill="url(#pf-core)" />
          <path d="M178 208V160l44 48V160" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".92" />
          <path d="M96 128 L200 188" stroke="#fff" strokeOpacity=".18" strokeWidth="14" strokeLinecap="round" />
        </svg>
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-40 mix-blend-screen blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgba(124,92,255,0.7), transparent)', left: shineX, translateX: '-50%', width: '70%' }} />
      </motion.div>
    </div>
  );
};
