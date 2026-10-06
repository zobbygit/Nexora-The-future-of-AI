import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';

export const AuthLayout = ({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) => (
  <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
    <div className="aurora" />
    <div className="relative w-full max-w-[440px]">
      <Link to="/" className="mb-8 flex justify-center" aria-label="Nexora home"><Logo /></Link>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="glass-strong grain relative rounded-[1.75rem] p-7 sm:p-9">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-fg-mute">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
      {footer && <div className="mt-6 text-center text-sm text-fg-mute">{footer}</div>}
    </div>
  </div>
);
