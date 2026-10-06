import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Camera, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Avatar } from '@/components/layout/AppShell';
import { RecoveryCodeCard } from '@/pages/auth/AuthPages';
import { Button } from '@/components/ui/Button';
import { Field, Input, Modal, Tabs } from '@/components/ui/primitives';
import { Card, PageHeader, SectionTitle } from '@/components/shared/Bits';
import { api, fileUrl } from '@/lib/api';
import { errorMessage, formatDate } from '@/lib/utils';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';

const pw = z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'profile';
  const fileIn = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [recPw, setRecPw] = useState('');
  const [recOpen, setRecOpen] = useState(false);

  const info = useForm<{ name: string; phone: string; email: string }>({ resolver: zodResolver(z.object({ name: z.string().trim().min(2, 'Enter your name'), phone: z.string().max(20), email: z.string().email('Enter a valid email') })), defaultValues: { name: user?.name, phone: user?.phone, email: user?.email } });
  const pass = useForm<{ currentPassword: string; newPassword: string; confirm: string }>({ resolver: zodResolver(z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: pw, confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })) });

  const saveInfo = info.handleSubmit(async (v) => { try { const { data } = await api.patch('/profile', v); setUser(data.user); toast.success('Profile updated'); info.reset(v); } catch (e) { toast.error('Could not save', errorMessage(e)); } });
  const savePass = pass.handleSubmit(async (v) => { try { await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }); toast.success('Password changed', 'Other devices have been signed out.'); pass.reset(); } catch (e) { toast.error('Could not change password', errorMessage(e)); } });
  const avatar = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append('file', f); return (await api.post('/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data.avatarUrl as string; },
    onSuccess: (u) => { if (user) setUser({ ...user, avatarUrl: u }); toast.success('Profile picture updated'); }, onError: (e) => toast.error('Upload failed', errorMessage(e)),
  });
  const recover = useMutation({ mutationFn: async () => (await api.post('/auth/recovery-code', { password: recPw })).data.recoveryCode as string, onSuccess: (c) => { setRecOpen(false); setRecPw(''); setCode(c); }, onError: (e) => toast.error('Could not generate', errorMessage(e)) });
  const remove = useMutation({ mutationFn: async () => api.delete('/account', { data: { password: delPw } }), onSuccess: async () => { await logout(); nav('/', { replace: true }); toast.success('Account deleted'); }, onError: (e) => toast.error('Could not delete account', errorMessage(e)) });

  if (code) return <RecoveryCodeCard code={code} saved={saved} setSaved={setSaved} cta="Done" onContinue={() => { setCode(null); setSaved(false); toast.success('New recovery code saved'); }} />;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Profile" subtitle="Manage your account details and security." />
      <Tabs className="mb-6" tabs={[{ id: 'profile', label: 'Profile' }, { id: 'security', label: 'Security' }, { id: 'account', label: 'Account' }]} value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} />
      {tab === 'profile' && (
        <div className="space-y-6">
          <Card className="flex flex-wrap items-center gap-6">
            <div className="relative"><Avatar name={user?.name} url={user?.avatarUrl ? fileUrl(user.avatarUrl) : ''} size={92} />
              <button onClick={() => fileIn.current?.click()} aria-label="Upload profile picture" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-violet-600 shadow-glow transition hover:bg-violet-500 active:scale-95">{avatar.isPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Camera className="h-4 w-4" />}</button>
              <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) avatar.mutate(f); e.target.value = ''; }} aria-label="Profile picture file" /></div>
            <div><p className="text-xl font-extrabold">{user?.name}</p><p className="text-sm text-fg-mute">{user?.email}</p><p className="mt-1 text-xs text-fg-faint">PNG, JPG or WebP · up to 4 MB</p></div>
          </Card>
          <Card><SectionTitle>Personal information</SectionTitle>
            <form onSubmit={saveInfo} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Name" error={info.formState.errors.name?.message}><Input {...info.register('name')} /></Field>
              <Field label="Phone" error={info.formState.errors.phone?.message}><Input type="tel" {...info.register('phone')} /></Field>
              <div className="sm:col-span-2"><Field label="Email" hint="No verification email is sent." error={info.formState.errors.email?.message}><Input type="email" {...info.register('email')} /></Field></div>
              <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={info.formState.isSubmitting} disabled={!info.formState.isDirty}>Save changes</Button></div>
            </form></Card>
        </div>)}
      {tab === 'security' && (
        <div className="space-y-6">
          <Card><SectionTitle>Change password</SectionTitle>
            <form onSubmit={savePass} className="grid max-w-md gap-4" noValidate>
              <Field label="Current password" error={pass.formState.errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...pass.register('currentPassword')} /></Field>
              <Field label="New password" error={pass.formState.errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...pass.register('newPassword')} /></Field>
              <Field label="Confirm new password" error={pass.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...pass.register('confirm')} /></Field>
              <div><Button type="submit" loading={pass.formState.isSubmitting}><ShieldCheck className="h-4 w-4" />Update password</Button></div>
            </form></Card>
          <Card><SectionTitle>Recovery code</SectionTitle><p className="max-w-xl text-sm text-fg-mute">Your recovery code resets your password if you forget it. Generating a new one invalidates the old one.</p><Button className="mt-4" variant="secondary" onClick={() => setRecOpen(true)}><KeyRound className="h-4 w-4" />Generate new recovery code</Button></Card>
        </div>)}
      {tab === 'account' && (
        <div className="space-y-6">
          <Card><SectionTitle>Account information</SectionTitle>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">{[['User ID', user?.id], ['Plan', user?.plan === 'pro' ? 'Pro' : 'Free'], ['Member since', formatDate(user?.createdAt)], ['Status', user?.isActive ? 'Active' : 'Deactivated']].map(([k, v]) => <div key={k as string} className="rounded-2xl border border-line bg-white/[0.03] px-4 py-3"><dt className="text-xs text-fg-mute">{k}</dt><dd className="mt-0.5 break-all font-semibold">{v}</dd></div>)}</dl></Card>
          <Card className="border-bad/20"><SectionTitle>Delete account</SectionTitle><p className="max-w-xl text-sm text-fg-mute">Permanently deletes your account, files, history and shared items. This cannot be undone.</p><Button className="mt-4" variant="danger" onClick={() => setDelOpen(true)}><Trash2 className="h-4 w-4" />Delete my account</Button></Card>
        </div>)}
      <Modal open={recOpen} onClose={() => setRecOpen(false)} title="Confirm your password" description="We need your password before creating a new recovery code."><form onSubmit={(e) => { e.preventDefault(); recover.mutate(); }} className="space-y-4"><Input type="password" value={recPw} onChange={(e) => setRecPw(e.target.value)} placeholder="Password" autoFocus aria-label="Password" /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRecOpen(false)}>Cancel</Button><Button type="submit" loading={recover.isPending} disabled={!recPw}>Generate</Button></div></form></Modal>
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account?" description="Enter your password to confirm. Everything you own will be erased."><form onSubmit={(e) => { e.preventDefault(); remove.mutate(); }} className="space-y-4"><Input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Password" aria-label="Password" /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button><Button type="submit" variant="danger" loading={remove.isPending} disabled={!delPw}>Delete forever</Button></div></form></Modal>
    </div>
  );
}
