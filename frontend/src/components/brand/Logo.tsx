import { cn } from '@/lib/utils';

export const LogoMark = ({ className, id = 'lg' }: { className?: string; id?: string }) => (
  <svg viewBox="0 0 48 48" className={cn('h-8 w-8', className)} fill="none" aria-hidden>
    <defs>
      <linearGradient id={`${id}-a`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#c4b5fd" /><stop offset=".55" stopColor="#7c5cff" /><stop offset="1" stopColor="#4f8bff" /></linearGradient>
    </defs>
    <rect x="3" y="3" width="42" height="42" rx="13" fill="#0d1020" stroke={`url(#${id}-a)`} strokeWidth="1.5" />
    <path d="M15 34V14l18 20V14" stroke={`url(#${id}-a)`} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo = ({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) => (
  <span className={cn('inline-flex items-center gap-2.5 font-extrabold tracking-tight', className)}>
    <LogoMark className={size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'} />
    <span className={size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl'}>Nexora</span>
  </span>
);
