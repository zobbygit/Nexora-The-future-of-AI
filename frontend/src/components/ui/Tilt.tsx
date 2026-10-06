import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TiltProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  children: ReactNode; max?: number; lift?: number;
}

/** Cursor-driven 3D tilt with a light that tracks the pointer. Pure transform: no layout cost. */
export const Tilt = ({ children, className, max = 7, lift = 6, onMouseMove, onMouseLeave, ...rest }: TiltProps) => {
  const px = useMotionValue(0.5), py = useMotionValue(0.5);
  const spx = useSpring(px, { stiffness: 220, damping: 20 }), spy = useSpring(py, { stiffness: 220, damping: 20 });
  const rotateY = useTransform(spx, [0, 1], [-max, max]);
  const rotateX = useTransform(spy, [0, 1], [max, -max]);
  return (
    <motion.div
      className={cn('spot will-change-transform', className)}
      style={{ rotateX, rotateY, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      whileHover={{ y: -lift, transition: { duration: 0.25 } }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height);
        e.currentTarget.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
        onMouseMove?.(e);
      }}
      onMouseLeave={(e) => { px.set(0.5); py.set(0.5); onMouseLeave?.(e); }}
      {...(rest as object)}
    >
      {children}
    </motion.div>
  );
};
