import { Clapperboard, Eraser, ImagePlus, Link2, Mic, ScanText, Sparkles, Square, Volume2, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Select, Tabs, Textarea, Input } from '@/components/ui/primitives';
import { BeforeAfter, ImageViewer } from '@/components/tools/Viewers';
import { FileDrop, OutputPanel, Placeholder, RecentRuns, ToolShell } from '@/components/tools/ToolShell';
import { fileUrl } from '@/lib/api';
import { cn, copyText, formatDate } from '@/lib/utils';
import { toast } from '@/store/ui';
import { useResult } from './TextTools';

const formOf = (file: File, extra: Record<string, string> = {}) => { const f = new FormData(); Object.entries(extra).forEach(([k, v]) => v && f.append(k, v)); f.append('file', file); return f; };
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── Text → Speech ────────────────────────────────────────
const VOICES = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['zh', 'Chinese'], ['jp', 'Japanese'], ['kr', 'Korean']];
export function TextToSpeech() {
  const r = useResult('tts');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('en');
  const [speed, setSpeed] = useState(1);
  const submit = () => { if (text.trim().length < 2) return toast.error('Add some text', 'Type what you want spoken.'); void r.run('/tools/tts', { text, voice, speed }); };
  return (
    <ToolShell id="tts">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <div className="surface p-5 sm:p-6"><Field label="Text"><Textarea className="min-h-[260px] text-[15px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste what you want spoken…" maxLength={3000} /></Field><p className="mt-2 text-right text-xs text-fg-mute">{text.length}/3000</p></div>
          <RecentRuns tool="tts" />
        </div>
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Field label="Voice"><Select value={voice} onChange={(e) => setVoice(e.target.value)}>{VOICES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select></Field>
            <Field label={`Speed · ${speed.toFixed(1)}×`} hint="Playback speed is applied in the player."><input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-violet-500" aria-label="Speed" /></Field>
            <Button size="lg" className="w-full" onClick={submit} loading={r.running}><Volume2 className="h-4 w-4" />Generate speech · {r.credits} credits</Button>
          </div>
          <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Synthesizing voice" idle={<Placeholder icon={<Volume2 className="h-6 w-6" />} title="Your audio appears here" body="Generate speech to get a player with download and share." />}>
            {r.artifact && <SpeedPlayer src={fileUrl(r.artifact.url)} rate={speed} />}
          </OutputPanel>
        </div>
      </div>
    </ToolShell>
  );
}
const SpeedPlayer = ({ src, rate }: { src: string; rate: number }) => {
  const a = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (a.current) a.current.playbackRate = rate; }, [rate, src]);
  return <audio ref={a} src={src} controls className="w-full" onPlay={() => { if (a.current) a.current.playbackRate = rate; }} />;
};

// ── Transcription (Speech/Video) ─────────────────────────
const Transcript = ({ text, segments }: { text: string; segments?: { start: number; end: number; text: string }[] }) => (
  <div className="space-y-4">
    {segments?.length ? <ol className="max-h-[440px] space-y-1 overflow-y-auto pr-1">{segments.map((s, i) => <li key={i} className="flex gap-3 rounded-xl px-3 py-2 transition hover:bg-white/[0.04]"><span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-violet-300">{fmtTime(s.start)}</span><span className="text-[15px] leading-7">{s.text}</span></li>)}</ol>
      : <p className="whitespace-pre-wrap text-[15px] leading-7">{text}</p>}
    <button onClick={async () => { if (await copyText(text)) toast.success('Transcript copied'); }} className="text-xs font-semibold text-violet-300 hover:text-violet-200">Copy plain text</button>
  </div>
);

export function SpeechToText() {
  const r = useResult('stt');
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState('upload');
  const [lang, setLang] = useState('');
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  useEffect(() => () => { clearInterval(timer.current); mr.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec_ = new MediaRecorder(stream); chunks.current = [];
      rec_.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec_.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setFile(new File([new Blob(chunks.current, { type: rec_.mimeType })], 'recording.webm', { type: rec_.mimeType })); };
      rec_.start(); mr.current = rec_; setRec(true); setSecs(0); timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch { toast.error('Microphone unavailable', 'Allow microphone access in your browser, or upload a file instead.'); }
  };
  const stop = () => { mr.current?.stop(); clearInterval(timer.current); setRec(false); };
  const out = r.result?.generation.output as { text: string; segments?: any[] } | undefined;
  return (
    <ToolShell id="stt">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Tabs tabs={[{ id: 'upload', label: 'Upload audio' }, ...(canRecord ? [{ id: 'record', label: 'Record' }] : [])]} value={tab} onChange={(v) => { setTab(v); setFile(null); }} />
            {tab === 'upload' ? <FileDrop accept="audio/*,video/webm,.mp3,.wav,.m4a,.ogg,.flac,.webm" file={file} onFile={setFile} hint="MP3, WAV, M4A, OGG, FLAC or WebM · up to 25 MB" preview="audio" /> : (
              <div className="rounded-2xl border border-line bg-white/[0.03] p-6 text-center">
                <Pulse active={rec}><button onClick={rec ? stop : start} aria-label={rec ? 'Stop recording' : 'Start recording'} className={cn('mx-auto grid h-20 w-20 place-items-center rounded-full transition active:scale-95', rec ? 'bg-bad shadow-[0_0_0_10px_rgba(248,113,113,0.15)]' : 'bg-gradient-to-b from-violet-500 to-violet-600 shadow-glow')}>{rec ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}</button></Pulse>
                <p className="mt-4 font-mono text-2xl font-bold">{fmtTime(secs)}</p><p className="mt-1 text-xs text-fg-mute">{rec ? 'Recording… tap to stop' : file ? 'Recording ready — review below' : 'Tap to start recording'}</p>
                {file && !rec && <audio className="mt-4 w-full" controls src={URL.createObjectURL(file)} />}
              </div>)}
            <Field label="Spoken language" hint="Leave on Auto-detect unless results look off."><Select value={lang} onChange={(e) => setLang(e.target.value)}><option value="">Auto-detect</option><option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option></Select></Field>
            <Button size="lg" className="w-full" disabled={!file || rec} onClick={() => file && r.run('/tools/stt', formOf(file, { language: lang }))} loading={r.running}><Mic className="h-4 w-4" />Transcribe · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="stt" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Transcribing" idle={<Placeholder icon={<Mic className="h-6 w-6" />} title="Transcript appears here" body="Upload or record audio. You can copy, download, export as PDF or share the transcript." />}>
          {out && <Transcript text={out.text} segments={out.segments} />}
        </OutputPanel>
      </div>
    </ToolShell>
  );
}
const Pulse = ({ active, children }: { active: boolean; children: React.ReactNode }) => <div className={cn('mx-auto w-fit rounded-full', active && 'animate-pulse')}>{children}</div>;

export function VideoToText() {
  const r = useResult('video-to-text');
  const [file, setFile] = useState<File | null>(null);
  const out = r.result?.generation.output as { text: string; segments?: any[] } | undefined;
  return (
    <ToolShell id="video-to-text">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <FileDrop accept="video/mp4,video/webm,.mp4,.webm" file={file} onFile={setFile} hint="MP4 or WebM · up to 25 MB" preview="video" />
            <Button size="lg" className="w-full" disabled={!file} onClick={() => file && r.run('/tools/video-to-text', formOf(file))} loading={r.running}><Clapperboard className="h-4 w-4" />Extract transcript · {r.credits} credits</Button>
            {r.running && <p className="text-center text-xs text-fg-mute">Longer videos take a little while. Keep this tab open.</p>}
          </div>
          <RecentRuns tool="video-to-text" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Processing video" idle={<Placeholder icon={<Clapperboard className="h-6 w-6" />} title="Transcript with timestamps" body="Upload a short video. Timestamps appear when the provider returns them." />}>
          {out && <Transcript text={out.text} segments={out.segments} />}
        </OutputPanel>
      </div>
    </ToolShell>
  );
}

// ── Image → Text ─────────────────────────────────────────
export function ImageToText() {
  const r = useResult('image-to-text');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState('extract');
  const [src, setSrc] = useState('file');
  const [url, setUrl] = useState('');
  const go = () => {
    if (src === 'url') { if (!/^https?:\/\//i.test(url)) return toast.error('Enter a valid image URL'); return r.run('/tools/image-to-text', { mode, imageUrl: url }); }
    if (file) void r.run('/tools/image-to-text', formOf(file, { mode }));
  };
  return (
    <ToolShell id="image-to-text">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Tabs tabs={[{ id: 'file', label: 'Upload' }, { id: 'url', label: 'From URL' }]} value={src} onChange={setSrc} />
            {src === 'file' ? <FileDrop accept="image/png,image/jpeg,image/webp" file={file} onFile={setFile} hint="PNG, JPG or WebP · up to 8 MB" preview="image" /> : <Field label="Image URL" hint="Must be a public http(s) image."><div className="relative"><Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-mute" /><Input className="pl-10" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/receipt.png" /></div></Field>}
            <Field label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="extract">Extract text (OCR)</option><option value="describe">Describe the image</option></Select></Field>
            <Button size="lg" className="w-full" disabled={src === 'file' ? !file : !url} onClick={go} loading={r.running}><ScanText className="h-4 w-4" />{mode === 'extract' ? 'Extract text' : 'Describe'} · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="image-to-text" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Reading image" idle={<Placeholder icon={<ScanText className="h-6 w-6" />} title="Extracted text appears here" body="Upload an image and the AI will read what is in it." />} />
      </div>
    </ToolShell>
  );
}

// ── Background remover / Enhancer ────────────────────────
const ImageTool = ({ id, accept, label, icon, extra, buildRun, idleBody, transparent, extraState }: { id: string; accept: string; label: string; icon: React.ReactNode; extra?: React.ReactNode; buildRun: (f: File, run: (p: string, b: unknown) => Promise<unknown>) => void; idleBody: string; transparent?: boolean; extraState?: unknown }) => {
  const r = useResult(id);
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState('');
  useEffect(() => { if (!file) { setBefore(''); return; } const u = URL.createObjectURL(file); setBefore(u); return () => URL.revokeObjectURL(u); }, [file]);
  void extraState;
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <div className="surface space-y-5 p-5 sm:p-6">
          <FileDrop accept={accept} file={file} onFile={(f) => { setFile(f); r.reset(); }} hint="PNG, JPG or WebP · up to 8 MB" preview="image" />
          {extra}
          <Button size="lg" className="w-full" disabled={!file} onClick={() => file && buildRun(file, r.run)} loading={r.running}>{icon}{label} · {r.credits} credits</Button>
        </div>
        <RecentRuns tool={id} />
      </div>
      <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label={label} idle={<Placeholder icon={icon} title="Before & after" body={idleBody} />}>
        {r.artifact && before && <div className="space-y-3"><BeforeAfter before={before} after={fileUrl(r.artifact.url)} transparent={transparent} /><p className="text-center text-xs text-fg-mute">Drag the handle to compare · {r.result?.generation.createdAt && formatDate(r.result.generation.createdAt)}</p></div>}
        {r.artifact && !before && <ImageViewer src={fileUrl(r.artifact.url)} alt={r.artifact.title} checker={transparent} />}
      </OutputPanel>
    </div>
  );
};

export function BackgroundRemover() {
  return <ToolShell id="background-remover"><ImageTool id="background-remover" accept="image/png,image/jpeg,image/webp" label="Remove background" icon={<Eraser className="h-4 w-4" />} idleBody="Upload an image. The result is a transparent PNG you can compare with the original." transparent buildRun={(f, run) => void run('/tools/background-remover', formOf(f))} /></ToolShell>;
}

export function ImageEnhancer() {
  const [scale, setScale] = useState('2');
  return (
    <ToolShell id="image-enhancer">
      <ImageTool id="image-enhancer" accept="image/png,image/jpeg,image/webp" label="Enhance image" icon={<Wand2 className="h-4 w-4" />} idleBody="Upscale and sharpen your image, then compare before and after."
        extra={<Field label="Upscale" hint="Output is capped at 4096 px on the longest side."><div className="grid grid-cols-2 gap-2">{['2', '4'].map((s) => <button key={s} type="button" onClick={() => setScale(s)} aria-pressed={scale === s} className={cn('rounded-xl border py-2.5 text-sm font-bold transition', scale === s ? 'border-violet-400/70 bg-violet-500/20' : 'border-white/10 text-fg-mute hover:text-fg')}>{s}×</button>)}</div></Field>}
        buildRun={(f, run) => void run('/tools/image-enhancer', formOf(f, { scale }))} extraState={scale} />
    </ToolShell>
  );
}

// ── Text → Image ─────────────────────────────────────────
const RATIOS = [['1:1', 'Square', 'h-8 w-8'], ['16:9', 'Wide', 'h-6 w-10'], ['9:16', 'Tall', 'h-10 w-6'], ['4:3', 'Landscape', 'h-7 w-9'], ['3:4', 'Portrait', 'h-9 w-7']] as const;
const STYLES = ['none', 'photographic', 'cinematic', 'illustration', '3d', 'minimal'];
export function TextToImage() {
  const r = useResult('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [style, setStyle] = useState('none');
  const [negative, setNegative] = useState('');
  const go = () => { if (prompt.trim().length < 3) return toast.error('Describe your image', 'Add a few words about what you want to see.'); void r.run('/tools/text-to-image', { prompt, aspectRatio: ratio, style, negative: negative || undefined }); };
  return (
    <ToolShell id="text-to-image">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Field label="Prompt"><Textarea className="min-h-[130px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A quiet futuristic workspace at dusk, soft violet light, cinematic…" maxLength={1500} /></Field>
            <div><p className="mb-2 text-[13px] font-semibold text-fg-soft">Aspect ratio</p><div className="grid grid-cols-5 gap-2">{RATIOS.map(([id, l, sz]) => <button key={id} onClick={() => setRatio(id)} aria-pressed={ratio === id} aria-label={`${l} ${id}`} className={cn('flex flex-col items-center gap-2 rounded-xl border py-3 text-[11px] font-bold transition', ratio === id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-white/10 text-fg-mute hover:text-fg')}><span className={cn('rounded-md border-2 border-current', sz)} />{id}</button>)}</div></div>
            <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((s) => <option key={s} value={s}>{s === 'none' ? 'None' : s === '3d' ? '3D render' : s[0].toUpperCase() + s.slice(1)}</option>)}</Select></Field>
            <Field label="Avoid (optional)"><Input value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="text, watermark, blur" maxLength={300} /></Field>
            <Button size="lg" className="w-full" onClick={go} loading={r.running}><ImagePlus className="h-4 w-4" />{r.state === 'done' ? 'Regenerate' : 'Generate'} · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="text-to-image" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Generating image" idle={<div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(124,92,255,0.12),transparent_60%)] p-8 text-center"><div><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-violet-300"><Sparkles className="h-7 w-7" /></div><p className="font-bold">Your image will appear here</p><p className="mt-1.5 text-sm text-fg-mute">Pick an aspect ratio and style, then generate.</p></div></div>} />
      </div>
    </ToolShell>
  );
}
