import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LogOut, Share2, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ErrorState, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { PageHeader } from '@/components/shared/Bits';
import { ShareModal } from '@/components/shared/ShareModal';
import { api } from '@/lib/api';
import { errorMessage, timeAgo } from '@/lib/utils';
import { toast } from '@/store/ui';

interface Row { id: string; artifactId: string; permission: 'viewer' | 'editor'; canDownload: boolean; createdAt: string; user?: { name: string; email: string; avatarUrl: string }; artifact: { id: string; title: string; kind: string } | null }

export default function Collaboration() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('with');
  const [share, setShare] = useState<Row | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collab', 'overview'],
    queryFn: async () => (await api.get('/collaboration')).data as { sharedByMe: Row[]; sharedWithMe: Row[] },
  });
  const inv = () => qc.invalidateQueries({ queryKey: ['collab'] });
  const update = useMutation({
    mutationFn: async (v: { id: string; permission: string }) => api.patch(`/collaboration/${v.id}`, v),
    onSuccess: () => { inv(); toast.success('Permission updated'); },
    onError: (e) => toast.error('Update failed', errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => api.delete(`/collaboration/${id}`),
    onSuccess: () => { inv(); toast.success('Done'); },
    onError: (e) => toast.error('Failed', errorMessage(e)),
  });
  const rows = tab === 'with' ? data?.sharedWithMe : data?.sharedByMe;

  return (
    <div>
      <PageHeader title="Collaboration" subtitle="Share artifacts with other Nexora users and work on them together." />

      <Tabs
        className="mb-6"
        tabs={[
          { id: 'with', label: 'Shared with me', count: data?.sharedWithMe.length },
          { id: 'by', label: 'Shared by me', count: data?.sharedByMe.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !rows?.length ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={tab === 'with' ? 'Nothing shared with you yet' : 'You have not shared anything'}
          body={tab === 'with' ? 'When someone shares an artifact with you it will appear here.' : 'Open an item in your workspace and choose Share.'}
          action={tab === 'by' && <Button asChild><Link to="/app/workspace">Open workspace</Link></Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Top row on mobile: avatar + info */}
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <Avatar name={r.user?.name} url={r.user?.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/workspace?artifact=${r.artifactId}&scope=shared`}
                    className="block truncate font-bold transition hover:text-violet-300"
                  >
                    {r.artifact?.title}
                  </Link>
                  <p className="truncate text-xs text-fg-mute">
                    {tab === 'with' ? 'From' : 'With'} {r.user?.name} · {r.user?.email} · {timeAgo(r.createdAt)}
                  </p>
                </div>
              </div>

              {/* Actions: full-width row on mobile, inline on sm+ */}
              {tab === 'by' ? (
                <div className="flex items-center gap-2 sm:shrink-0">
                  <Select
                    value={r.permission}
                    onChange={(e) => update.mutate({ id: r.id, permission: e.target.value })}
                    className="!w-auto !py-2 text-sm"
                    aria-label={`Permission for ${r.user?.name}`}
                  >
                    <option value="viewer" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Viewer</option>
                    <option value="editor" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Editor</option>
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => setShare(r)} className="flex-1 sm:flex-none">
                    <Share2 className="h-4 w-4" />Manage
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 hover:!text-bad"
                    onClick={() => revoke.mutate(r.id)}
                    aria-label="Revoke access"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:shrink-0">
                  <Badge tone={r.permission === 'editor' ? 'info' : 'neutral'}>
                    {r.permission === 'editor' ? 'Can edit' : r.canDownload ? 'View & download' : 'View only'}
                  </Badge>
                  <Button asChild size="sm" variant="secondary" className="flex-1 sm:flex-none">
                    <Link to={`/app/workspace?artifact=${r.artifactId}&scope=shared`}>Open</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => revoke.mutate(r.id)}
                    aria-label="Leave"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {share && <ShareModal artifactId={share.artifactId} title={share.artifact?.title || ''} open onClose={() => setShare(null)} />}
    </div>
  );
}