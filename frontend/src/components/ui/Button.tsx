import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { forwardRef, useRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background,box-shadow,border-color,color,opacity] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-[0_8px_28px_-8px_rgba(124,92,255,0.8),inset_0_1px_0_rgba(255,255,255,0.28)] hover:from-violet-400 hover:to-violet-600',
        light: 'bg-white text-ink shadow-[0_8px_30px_-10px_rgba(255,255,255,0.5)] hover:bg-violet-100',
        secondary: 'border border-white/10 bg-white/[0.05] text-fg hover:border-white/20 hover:bg-white/[0.09]',
        ghost: 'text-fg-soft hover:bg-white/[0.06] hover:text-fg',
        danger: 'border border-bad/30 bg-bad/10 text-bad hover:bg-bad/20',
        outline: 'border border-violet-500/40 text-violet-300 hover:bg-violet-500/10',
      },
      size: { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-[15px]', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean; asChild?: boolean; magnetic?: boolean;
}

/** Buttons lean toward the cursor (magnetic), press down, and pick up a cursor-following sheen. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, asChild, magnetic = true, onMouseMove, onMouseLeave, ...props }, ref) => {
    const x = useMotionValue(0), y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 }), sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });
    const el = useRef<HTMLElement | null>(null);
    const Comp: any = asChild ? Slot : motion.button;
    const canMagnet = magnetic && size !== 'icon' && !disabled;
    return (
      <Comp
        ref={(n: HTMLButtonElement | null) => { el.current = n; if (typeof ref === 'function') ref(n); else if (ref) (ref as any).current = n; }}
        className={cn(button({ variant, size }), 'overflow-hidden', className)}
        disabled={disabled || loading}
        style={asChild ? undefined : { x: sx, y: sy }}
        whileTap={asChild ? undefined : { scale: 0.96 }}
        onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`);
          if (canMagnet) { x.set((e.clientX - (r.left + r.width / 2)) * 0.18); y.set((e.clientY - (r.top + r.height / 2)) * 0.28); }
          onMouseMove?.(e);
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { x.set(0); y.set(0); onMouseLeave?.(e); }}
        {...props}
      >
        {asChild ? children : (<>
          <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
            style={{ background: 'radial-gradient(90px circle at var(--sx,50%) var(--sy,50%), rgba(255,255,255,0.22), transparent 70%)' }} />
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
        </>)}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
