import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Modal, Select, Spinner } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import { toast } from '@/store/ui';
import { Avatar } from '@/components/layout/AppShell';

export const ShareModal = ({ artifactId, title, open, onClose }: { artifactId: string; title: string; open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const [ident, setIdent] = useState('');
  const [perm, setPerm] = useState<'viewer' | 'editor'>('viewer');
  const [canDl, setCanDl] = useState(true);
  const { data, isLoading } = useQuery({ queryKey: ['collab', 'artifact', artifactId], enabled: open, queryFn: async () => (await api.get(`/collaboration/artifact/${artifactId}`)).data.collaborators as any[] });
  const { data: suggestions } = useQuery({ queryKey: ['user-suggest', ident], enabled: open && ident.trim().length >= 3 && !ident.includes('@'), queryFn: async () => (await api.get('/collaboration/users', { params: { q: ident } })).data.users as any[], staleTime: 20_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['collab'] }); };
  const add = useMutation({
    mutationFn: async () => api.post('/collaboration', { artifactId, identifier: ident.trim(), permission: perm, canDownload: canDl }),
    onSuccess: () => { toast.success('Shared', `Access granted as ${perm}.`); setIdent(''); refresh(); }, onError: (e) => toast.error('Could not share', errorMessage(e)),
  });
  const update = useMutation({ mutationFn: async (v: { id: string; permission?: string; canDownload?: boolean }) => api.patch(`/collaboration/${v.id}`, v), onSuccess: refresh, onError: (e) => toast.error('Update failed', errorMessage(e)) });
  const revoke = useMutation({ mutationFn: async (id: string) => api.delete(`/collaboration/${id}`), onSuccess: () => { toast.success('Access removed'); refresh(); } });
  return (
    <Modal open={open} onClose={onClose} title="Share" description={`“${title}”`}>
      <form onSubmit={(e) => { e.preventDefault(); if (ident.trim().length >= 2) add.mutate(); }} className="space-y-3">
        <div className="relative">
          <Input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="Name or email of a Nexora user" aria-label="User name or email" autoComplete="off" />
          {!!suggestions?.length && <div className="glass-strong absolute inset-x-0 top-12 z-10 rounded-2xl p-1.5">{suggestions.map((u) => <button type="button" key={u.id} onClick={() => setIdent(u.email)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.07]"><Avatar name={u.name} url={u.avatarUrl} size={28} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{u.name}</span><span className="block truncate text-xs text-fg-mute">{u.email}</span></span></button>)}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
     <Select value={perm} onChange={(e) => setPerm(e.target.value as any)} className="!w-auto" aria-label="Permission">
  <option value="viewer" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Viewer — can read</option>
  <option value="editor" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Editor — can edit</option>
</Select>
          {perm === 'viewer' && <label className="flex items-center gap-2 text-sm text-fg-soft"><input type="checkbox" checked={canDl} onChange={(e) => setCanDl(e.target.checked)} className="accent-violet-500" />Allow download</label>}
          <Button type="submit" className="ml-auto" loading={add.isPending} disabled={ident.trim().length < 2}>Share</Button>
        </div>
      </form>
      <div className="mt-6"><p className="label mb-2">People with access</p>
        {isLoading ? <div className="grid place-items-center py-6"><Spinner /></div> : !data?.length ? <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-fg-mute">Only you have access.</p> :
          <ul className="space-y-2">{data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
              <Avatar name={c.user?.name} url={c.user?.avatarUrl} size={34} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.user?.name}</p><p className="truncate text-xs text-fg-mute">{c.user?.email}</p></div>
              <Select value={c.permission} onChange={(e) => update.mutate({ id: c.id, permission: e.target.value })} className="!w-auto !py-1.5 text-xs" aria-label={`Permission for ${c.user?.name}`}><option value="viewer">Viewer</option><option value="editor">Editor</option></Select>
              <button onClick={() => revoke.mutate(c.id)} className="grid h-9 w-9 place-items-center rounded-lg text-fg-mute transition hover:bg-bad/10 hover:text-bad" aria-label={`Remove ${c.user?.name}`}><Trash2 className="h-4 w-4" /></button>
            </li>))}</ul>}
      </div>
    </Modal>
  );
};
