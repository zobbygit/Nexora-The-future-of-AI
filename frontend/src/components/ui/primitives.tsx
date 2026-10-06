import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { Button } from './Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn('field', className)} {...p} />);
Input.displayName = 'Input';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn('field min-h-[120px] resize-y leading-6', className)} {...p} />);
Textarea.displayName = 'Textarea';
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn('field cursor-pointer appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%238b90a8%27 stroke-width=%272%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} {...p}>{children}</select>
));
Select.displayName = 'Select';

export const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-[13px] font-semibold text-fg-soft">{label}</span>
    {children}
    {error ? <span className="block text-xs text-bad">{error}</span> : hint ? <span className="block text-xs text-fg-faint">{hint}</span> : null}
  </label>
);

export const Badge = ({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'pro' | 'ok' | 'warn' | 'bad' | 'info'; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide',
    tone === 'pro' && 'border-amber-400/50 bg-amber-400/10 text-amber-300', tone === 'ok' && 'border-ok/30 bg-ok/10 text-ok',
    tone === 'warn' && 'border-warn/30 bg-warn/10 text-warn', tone === 'bad' && 'border-bad/30 bg-bad/10 text-bad',
    tone === 'info' && 'border-sky2/30 bg-sky2/10 text-sky2', tone === 'neutral' && 'border-white/10 bg-white/[0.05] text-fg-soft', className)}>{children}</span>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('relative overflow-hidden rounded-xl bg-white/[0.05]', className)}><div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" style={{ transform: 'translateX(-100%)' }} /></div>
);

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-violet-300', className)} />;

export const EmptyState = ({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-300">{icon}</div>
    <h3 className="text-base font-bold">{title}</h3>
    {body && <p className="mt-1.5 max-w-sm text-sm text-fg-mute">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center rounded-3xl border border-bad/20 bg-bad/[0.04] px-6 py-10 text-center">
    <AlertTriangle className="mb-3 h-7 w-7 text-bad" />
    <p className="max-w-md text-sm text-fg-soft">{message}</p>
    {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
  </div>
);

export const Tooltip = ({ label, children, side = 'right' }: { label: string; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) => (
  <TooltipPrimitive.Root delayDuration={120}>
    <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content side={side} sideOffset={10} className="z-[100] rounded-lg border border-white/10 bg-ink-600 px-2.5 py-1.5 text-xs font-semibold text-fg shadow-xl animate-in fade-in">
        {label}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>
);
export const TooltipProvider = TooltipPrimitive.Provider;

export const Modal = ({ open, onClose, title, description, children, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; width?: string }) => (
  <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount>
            <motion.div className={cn('glass-strong fixed left-1/2 top-1/2 z-[81] max-h-[88vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl p-6', width)}
              initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-46%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.97, x: '-50%', y: '-48%' }} transition={{ type: 'spring', stiffness: 340, damping: 30 }}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div><DialogPrimitive.Title className="text-lg font-bold">{title}</DialogPrimitive.Title>
                  {description ? <DialogPrimitive.Description className="mt-1 text-sm text-fg-mute">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}</div>
                <DialogPrimitive.Close className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-mute transition hover:bg-white/10 hover:text-fg" aria-label="Close"><X className="h-4 w-4" /></DialogPrimitive.Close>
              </div>
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  </DialogPrimitive.Root>
);

export const ConfirmModal = ({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean; loading?: boolean }) => (
  <Modal open={open} onClose={onClose} title={title} width="max-w-md">
    <p className="text-sm leading-6 text-fg-soft">{body}</p>
    <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></div>
  </Modal>
);

export const Pagination = ({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) => {
  if (pages <= 1) return null;
  const items: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i); else if (items[items.length - 1] !== '…') items.push('…');
  return (
    <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
      {items.map((it, i) => it === '…' ? <span key={`e${i}`} className="px-1 text-fg-faint">…</span> : (
        <button key={it} onClick={() => onChange(it)} aria-current={it === page ? 'page' : undefined}
          className={cn('h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition', it === page ? 'bg-violet-600 text-white shadow-glow' : 'text-fg-mute hover:bg-white/[0.07] hover:text-fg')}>{it}</button>
      ))}
      <Button variant="secondary" size="icon" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
    </nav>
  );
};

export const Tabs = ({ tabs, value, onChange, className }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void; className?: string }) => (
  <div role="tablist" className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-white/[0.03] p-1', className)}>
    {tabs.map((t) => (
      <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
        className={cn('relative whitespace-nowrap rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition', value === t.id ? 'text-white' : 'text-fg-mute hover:text-fg')}>
        {value === t.id && <motion.span layoutId={`tab-${tabs.map((x) => x.id).join('')}`} className="absolute inset-0 rounded-xl bg-violet-600/80 shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
        <span className="relative">{t.label}{t.count !== undefined && <span className="ml-1.5 opacity-70">{t.count}</span>}</span>
      </button>
    ))}
  </div>
);

export const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={cn('relative h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-violet-400/50 bg-violet-600' : 'border-white/10 bg-white/10')}>
    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', checked ? 'left-[22px]' : 'left-0.5')} />
  </button>
);

export const Toaster = () => {
  const { toasts, dismiss } = useUi();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
            className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl p-3.5">
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" /> : t.kind === 'error' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bad" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.title}</p>{t.body && <p className="mt-0.5 line-clamp-3 text-[13px] text-fg-mute">{t.body}</p>}</div>
            <button onClick={() => dismiss(t.id)} className="text-fg-faint transition hover:text-fg" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
