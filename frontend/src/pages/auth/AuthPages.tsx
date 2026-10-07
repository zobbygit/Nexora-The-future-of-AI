import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Copy, Download, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { copyText, downloadText, errorMessage } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { AuthLayout } from './AuthLayout';

const password = z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');

const PasswordInput = ({ reg, placeholder = 'Your password', autoComplete }: { reg: object; placeholder?: string; autoComplete?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} placeholder={placeholder} autoComplete={autoComplete} className="pr-11" {...reg} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-fg-mute transition hover:bg-white/10 hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

const FormError = ({ msg }: { msg: string }) => msg ? <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-sm text-bad" role="alert">{msg}</motion.p> : null;

export function Login() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const setUser = useAuth((s) => s.setUser);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })) });
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try {
      const { data } = await api.post('/auth/login', v);
      setUser(data.user);
      nav(data.user.onboardingCompleted ? (loc.state?.from || '/app') : '/onboarding', { replace: true });
    } catch (e) { setErr(errorMessage(e)); }
  });
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your workspace." footer={<>New to Nexora? <Link to="/register" className="font-semibold text-violet-300 hover:text-violet-200">Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="Email" error={errors.email?.message}><Input type="email" placeholder="you@company.com" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput reg={register('password')} autoComplete="current-password" /></Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-[13px] font-semibold text-violet-300 hover:text-violet-200">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in <ArrowRight className="h-4 w-4" /></Button>
      </form>
    </AuthLayout>
  );
}

const registerSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), phone: z.string().max(20).optional(), password });

export function Register() {
  const nav = useNavigate();
  const setUser = useAuth((s) => s.setUser);
  const [err, setErr] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  // Live value of the password field, used to render the strength meter.
  const password = watch('password') ?? '';

  // Score 0–4. Maps to: empty · Weak · Fair · Good · Strong.
  const strength = useMemo(() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (/^(.)\1+$/.test(password)) s = 1;                          // "aaaaaaaa"
    if (/^(1234|abcd|qwerty|password)/i.test(password)) s = Math.min(s, 1);
    if (password.length < 8) return 1;
    return (s <= 2 ? 1 : s === 3 ? 2 : s === 4 ? 3 : 4) as 0 | 1 | 2 | 3 | 4;
  }, [password]);

  const strengthMeta = [
    { label: '',        bar: 'bg-transparent',   text: 'text-fg-mute' },
    { label: 'Weak',    bar: 'bg-rose-500',      text: 'text-rose-300' },
    { label: 'Fair',    bar: 'bg-amber-400',     text: 'text-amber-300' },
    { label: 'Good',    bar: 'bg-sky-400',       text: 'text-sky-300' },
    { label: 'Strong',  bar: 'bg-emerald-400',   text: 'text-emerald-300' },
  ][strength];

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { const { data } = await api.post('/auth/register', v); setUser(data.user); setCode(data.recoveryCode); }
    catch (e) { setErr(errorMessage(e)); }
  });

  return (
    <AnimatePresence mode="wait">
      {code ? (
        <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <RecoveryCodeCard code={code} saved={saved} setSaved={setSaved} cta="Continue" onContinue={() => nav('/onboarding', { replace: true })} />
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0 }}>
          <AuthLayout title="Create your workspace" subtitle="Free forever. Upgrade only when you need more." footer={<>Already have an account? <Link to="/login" className="font-semibold text-violet-300 hover:text-violet-200">Sign in</Link></>}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError msg={err} />
              <Field label="Full name" error={errors.name?.message}><Input placeholder="Alex Morgan" autoComplete="name" {...register('name')} /></Field>
              <Field label="Email" error={errors.email?.message}><Input type="email" placeholder="you@company.com" autoComplete="email" {...register('email')} /></Field>
              <Field label="Phone (optional)" error={errors.phone?.message}><Input type="tel" placeholder="+91 98765 43210" autoComplete="tel" {...register('phone')} /></Field>

              <Field label="Password" hint="At least 8 characters with a letter and a number." error={errors.password?.message}>
                <PasswordInput reg={register('password')} placeholder="Create a password" autoComplete="new-password" />
                {password.length > 0 && (
                  <div className="mt-2 space-y-1.5" aria-live="polite">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-fg-mute">Password strength</span>
                      <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label}</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          initial={false}
                          animate={{ opacity: strength >= i ? 1 : 0.15 }}
                          transition={{ duration: 0.2 }}
                          className={`h-1.5 flex-1 rounded-full ${strength >= i ? strengthMeta.bar : 'bg-white/10'}`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] leading-snug text-fg-faint">
                      Use 8+ characters with a mix of uppercase, lowercase, numbers and a symbol.
                    </p>
                  </div>
                )}
              </Field>

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account <ArrowRight className="h-4 w-4" /></Button>
            </form>
          </AuthLayout>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const RecoveryCodeCard = ({ code, saved, setSaved, onContinue, cta }: { code: string; saved: boolean; setSaved: (v: boolean) => void; onContinue: () => void; cta: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <AuthLayout title="Save your recovery code" subtitle="This is the only way to reset your password without email. We show it once and never store it in readable form.">
      <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-5 text-center">
        <KeyRound className="mx-auto mb-3 h-6 w-6 text-violet-300" />
        <p className="select-all font-mono text-[22px] font-bold tracking-[0.14em] sm:text-2xl" data-testid="recovery-code">{code}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={async () => { if (await copyText(code)) { setCopied(true); setTimeout(() => setCopied(false), 1800); } }}>{copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</Button>
        <Button variant="secondary" onClick={() => downloadText(`Nexora recovery code\n\n${code}\n\nKeep this somewhere safe. It resets your password if you forget it.\n`, 'nexora-recovery-code.txt')}><Download className="h-4 w-4" />Download</Button>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-warn/10 px-3.5 py-3 text-[13px] text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Anyone with this code and your email can reset your password. Store it in a password manager.</p>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-fg-soft"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-violet-500" />I have saved my recovery code</label>
      <Button size="lg" className="mt-5 w-full" disabled={!saved} onClick={onContinue}>{cta} <ArrowRight className="h-4 w-4" /></Button>
    </AuthLayout>
  );
};

export function ForgotPassword() {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; recoveryCode: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), recoveryCode: z.string().min(8, 'Enter your recovery code') })) });
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { const { data } = await api.post('/auth/forgot-password', v); nav('/reset-password', { state: { token: data.resetToken } }); }
    catch (e) { setErr(errorMessage(e)); }
  });
  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and the recovery code you saved when you signed up." footer={<Link to="/login" className="font-semibold text-violet-300 hover:text-violet-200">Back to sign in</Link>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} /></Field>
        <Field label="Recovery code" error={errors.recoveryCode?.message}><Input placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono tracking-widest" autoComplete="off" {...register('recoveryCode')} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Verify code <ShieldCheck className="h-4 w-4" /></Button>
      </form>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: { token?: string } };
  const [err, setErr] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });
  if (!state?.token && !newCode) return <AuthLayout title="Reset link missing" subtitle="Start again from the forgot password page."><Button asChild className="w-full"><Link to="/forgot-password">Start again</Link></Button></AuthLayout>;
  if (newCode) return <RecoveryCodeCard code={newCode} saved={saved} setSaved={setSaved} cta="Go to sign in" onContinue={() => { toast.success('Password updated', 'Sign in with your new password.'); nav('/login', { replace: true }); }} />;
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { const { data } = await api.post('/auth/reset-password', { resetToken: state!.token, password: v.password }); setNewCode(data.recoveryCode); }
    catch (e) { setErr(errorMessage(e)); }
  });
  return (
    <AuthLayout title="Choose a new password" subtitle="You will get a fresh recovery code afterwards.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="New password" error={errors.password?.message}><PasswordInput reg={register('password')} placeholder="New password" autoComplete="new-password" /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput reg={register('confirm')} placeholder="Repeat password" autoComplete="new-password" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  );
}

export function AdminLogin() {
  const nav = useNavigate();
  const setAdmin = useAuth((s) => s.setAdmin);
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter the password') })) });
  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try { const { data } = await api.post('/admin/auth/login', v); setAdmin(data.admin); nav('/admin', { replace: true }); }
    catch (e) { setErr(errorMessage(e)); }
  });
  return (
    <AuthLayout title="Admin console" subtitle="Restricted area. Authorised administrators only." footer={<Link to="/" className="font-semibold text-violet-300 hover:text-violet-200">Back to Nexora</Link>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError msg={err} />
        <Field label="Admin email" error={errors.email?.message}><Input type="email" autoComplete="username" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput reg={register('password')} autoComplete="current-password" /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}><ShieldCheck className="h-4 w-4" />Sign in</Button>
      </form>
    </AuthLayout>
  );
}
