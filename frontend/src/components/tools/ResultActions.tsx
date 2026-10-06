import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, FileDown, Heart, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/primitives';
import { ShareModal } from '@/components/shared/ShareModal';
import { api, fileUrl } from '@/lib/api';
import type { Artifact } from '@/lib/types';
import { copyText, downloadBlob, downloadText, errorMessage, slug } from '@/lib/utils';
import { toast } from '@/store/ui';

const TEXTY = ['text', 'code', 'resume', 'response'];

export const ResultActions = ({ artifact, onDeleted, onChange, compact }: { artifact: Artifact; onDeleted?: () => void; onChange?: (a: Artifact) => void; compact?: boolean }) => {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const owner = artifact.role === 'owner';
  const canEdit = artifact.role !== 'viewer';
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['artifacts'] }); qc.invalidateQueries({ queryKey: ['history'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const fav = useMutation({ mutationFn: async () => (await api.patch(`/artifacts/${artifact.id}`, { favorite: !artifact.favorite })).data.artifact as Artifact, onSuccess: (a) => { onChange?.(a); invalidate(); toast.success(a.favorite ? 'Added to favorites' : 'Removed from favorites'); }, onError: (e) => toast.error('Could not update', errorMessage(e)) });
  const del = useMutation({ mutationFn: async () => api.delete(`/artifacts/${artifact.id}`), onSuccess: () => { setConfirm(false); invalidate(); toast.success('Deleted'); onDeleted?.(); }, onError: (e) => toast.error('Could not delete', errorMessage(e)) });
  const pdf = useMutation({ mutationFn: async () => (await api.get(`/artifacts/${artifact.id}/export/pdf`, { responseType: 'blob' })).data as Blob, onSuccess: (b) => { downloadBlob(b, `${slug(artifact.title)}.pdf`); done(); }, onError: () => toast.error('PDF export failed', 'Please try again.') });

  const done = () => { void api.post(`/artifacts/${artifact.id}/downloaded`).catch(() => undefined); };
const download = async () => {
  try {
    if (artifact.content && TEXTY.includes(artifact.kind)) {
      downloadText(
        artifact.content,
        `${slug(artifact.title)}.md`,
        'text/markdown'
      );
      return done();
    }

    if (artifact.kind === 'data') {
      downloadText(
        artifact.content || '{}',
        `${slug(artifact.title)}.json`,
        'application/json'
      );
      return done();
    }

    // Cloudinary file — do NOT send credentials
    const res = await fetch(fileUrl(artifact.url));

    if (!res.ok) throw new Error();

    const ext =
      (artifact.mimeType || '')
        .split('/')[1]
        ?.replace('svg+xml', 'svg')
        .replace('mpeg', 'mp3')
        .replace('jpeg', 'jpg') || 'bin';

    downloadBlob(
      await res.blob(),
      `${slug(artifact.title)}.${ext}`
    );

    done();
  } catch {
    toast.error('Download failed', 'Please try again.');
  }
};

  const canCopy = !!artifact.content && (TEXTY.includes(artifact.kind));
  const pdfAble = !!artifact.content && [...TEXTY, 'data'].includes(artifact.kind);
  const sz = compact ? 'sm' : 'md';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Result actions">
        {canCopy && <Button variant="secondary" size={sz} onClick={async () => { if (await copyText(artifact.content!)) { setCopied(true); toast.success('Copied to clipboard'); setTimeout(() => setCopied(false), 1600); } }}>{copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}Copy</Button>}
        {artifact.canDownload && <Button variant="secondary" size={sz} onClick={download}><Download className="h-4 w-4" />Download</Button>}
        {pdfAble && artifact.canDownload && <Button variant="secondary" size={sz} onClick={() => pdf.mutate()} loading={pdf.isPending}><FileDown className="h-4 w-4" />PDF</Button>}
        {owner && <Button variant="secondary" size={sz} onClick={() => setShare(true)}><Share2 className="h-4 w-4" />Share</Button>}
        {owner && <Button variant="secondary" size={sz} onClick={() => fav.mutate()} aria-pressed={artifact.favorite}><Heart className={`h-4 w-4 ${artifact.favorite ? 'fill-rose-400 text-rose-400' : ''}`} />{artifact.favorite ? 'Favorited' : 'Favorite'}</Button>}
        {owner && <Button variant="ghost" size={sz} className="text-bad hover:!bg-bad/10 hover:!text-bad" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" />Delete</Button>}
        {!owner && !canEdit && <span className="text-xs text-fg-mute">View only</span>}
      </div>
      {owner && <ShareModal artifactId={artifact.id} title={artifact.title} open={share} onClose={() => setShare(false)} />}
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={() => del.mutate()} loading={del.isPending} danger title="Delete this item?" body="It will be removed from your workspace and from anyone you shared it with. This cannot be undone." confirmLabel="Delete" />
    </>
  );
};
