import { Bug, CheckCircle2, Code2, FileText, GraduationCap, Lightbulb, Loader2, Plus, RefreshCw, Sparkles, Trash2, Wand2, Wrench, PenLine, Bot, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Tabs, Textarea } from '@/components/ui/primitives';
import { OutputPanel, Placeholder, RecentRuns, ToolShell } from '@/components/tools/ToolShell';
import { useBootstrap } from '@/hooks/useApp';
import { useToolRun } from '@/hooks/useToolRun';
import { api } from '@/lib/api';
import type { Artifact } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/store/ui';

export const useResult = (toolId: string) => {
  const run = useToolRun();
  const { data } = useBootstrap();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  useEffect(() => { if (run.result?.artifact) setArtifact(run.result.artifact); }, [run.result]);
  return { ...run, artifact, setArtifact, credits: data?.tools.find((t) => t.id === toolId)?.credits ?? 0 };
};

// ── AI Writer ────────────────────────────────────────────
const TYPES = [['blog', 'Blog post'], ['email', 'Email'], ['essay', 'Essay'], ['social', 'Social posts'], ['story', 'Story'], ['product', 'Product copy'], ['speech', 'Speech'], ['summary', 'Summary']] as const;
export function Writer() {
  const r = useResult('writer');
  const [f, setF] = useState({ prompt: '', writingType: 'blog', tone: 'professional', length: 'medium', language: 'English' });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = () => { if (f.prompt.trim().length < 3) return toast.error('Add a prompt', 'Tell the writer what to write about.'); void r.run('/tools/writer', f); };
  return (
    <ToolShell id="writer">
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <div className="surface space-y-5 p-5 sm:p-6">
            <Field label="What should I write?"><Textarea value={f.prompt} onChange={(e) => set('prompt', e.target.value)} placeholder="e.g. A launch announcement for our new analytics dashboard, aimed at product teams…" maxLength={6000} className="min-h-[150px]" /></Field>
            <div><p className="mb-2 text-[13px] font-semibold text-fg-soft">Writing type</p><div className="flex flex-wrap gap-2">{TYPES.map(([id, label]) => <button key={id} onClick={() => set('writingType', id)} aria-pressed={f.writingType === id} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition', f.writingType === id ? 'border-violet-400/70 bg-violet-500/20 text-white' : 'border-white/10 text-fg-mute hover:border-white/25 hover:text-fg')}>{label}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">


             <Field label="Tone">
  <Select value={f.tone} onChange={(e) => set('tone', e.target.value)}>
    {['professional', 'friendly', 'persuasive', 'casual', 'formal', 'witty'].map((t) => (
      <option key={t} value={t} style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>
        {t[0].toUpperCase() + t.slice(1)}
      </option>
    ))}
  </Select>
</Field>
<Field label="Length">
  <Select value={f.length} onChange={(e) => set('length', e.target.value)}>
    <option value="short" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Short</option>
    <option value="medium" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Medium</option>
    <option value="long" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Long</option>
  </Select>
</Field>
            </div>
       <Field label="Language">
  <Select value={f.language} onChange={(e) => set('language', e.target.value)}>
    {['English', 'Hindi', 'Bengali', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese'].map((l) => (
      <option key={l} value={l} style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>{l}</option>
    ))}
  </Select>
</Field>

            <Button size="lg" className="w-full" onClick={submit} loading={r.running}><Sparkles className="h-4 w-4" />{r.state === 'done' ? 'Regenerate' : 'Generate'} · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="writer" />
        </div>
        <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} label="Drafting" idle={<Placeholder icon={<PenLine className="h-6 w-6" />} title="Your draft appears here" body="Describe what you need on the left. You can edit the result, then copy, download, export as PDF or share it." />} />
      </div>
    </ToolShell>
  );
}

// ── Resume & Cover ───────────────────────────────────────
type Edu = { school: string; degree: string; period: string; details: string }; type Exp = { company: string; role: string; period: string; details: string }; type Proj = { name: string; stack: string; details: string };
export function Resume() {
  const r = useResult('resume');
  const [mode, setMode] = useState<'resume' | 'cover'>('resume');
  const [p, setP] = useState({ name: '', email: '', phone: '', location: '', links: '', headline: '', summary: '' });
  const [edu, setEdu] = useState<Edu[]>([{ school: '', degree: '', period: '', details: '' }]);
  const [exp, setExp] = useState<Exp[]>([{ company: '', role: '', period: '', details: '' }]);
  const [proj, setProj] = useState<Proj[]>([]);
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [jd, setJd] = useState('');
  const [style, setStyle] = useState('modern');
  const [improve, setImprove] = useState(true);
  const [sec, setSec] = useState('personal');
  const upd = <T,>(arr: T[], set: (v: T[]) => void, i: number, k: keyof T, v: string) => set(arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = () => {
    if (!p.name.trim()) { setSec('personal'); return toast.error('Add your name', 'Your name is required.'); }
    const clean = <T extends Record<string, string>>(a: T[], key: keyof T) => a.filter((x) => x[key].trim()).map((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v.trim())));
    void r.run('/tools/resume', { mode, personal: Object.fromEntries(Object.entries(p).filter(([, v]) => v.trim())), education: clean(edu, 'school'), experience: clean(exp, 'company'), projects: clean(proj, 'name'), skills: skills.split(',').map((s) => s.trim()).filter(Boolean), targetRole: role || undefined, jobDescription: jd || undefined, style, improve });
  };
  const Row = ({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) => <div className="relative space-y-3 rounded-2xl border border-line bg-white/[0.025] p-4">{onRemove && <button onClick={onRemove} className="absolute right-3 top-3 text-fg-faint transition hover:text-bad" aria-label="Remove entry"><Trash2 className="h-4 w-4" /></button>}{children}</div>;
  return (
  <ToolShell id="resume">
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[440px_1fr]">
      {/* Left column — form */}
      <div className="min-w-0 space-y-4">
        {/* Top-level Resume/Cover tabs — scroll horizontally if needed */}
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <Tabs
              tabs={[{ id: 'resume', label: 'Resume builder' }, { id: 'cover', label: 'Cover letter' }]}
              value={mode}
              onChange={(v) => setMode(v as any)}
            />
          </div>
        </div>

        <div className="surface min-w-0 space-y-4 p-4 sm:p-5">
          {/* Section tabs — horizontal scroll on mobile so all 5 are reachable */}
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="min-w-max">
              <Tabs
                tabs={[
                  { id: 'personal', label: 'Personal' },
                  { id: 'education', label: 'Education' },
                  { id: 'experience', label: 'Experience' },
                  { id: 'projects', label: 'Projects' },
                  { id: 'skills', label: 'Skills' },
                ]}
                value={sec}
                onChange={setSec}
              />
            </div>
          </div>

          {sec === 'personal' && (
            <div className="min-w-0 space-y-3">
              <Field label="Full name">
                <Input className="min-w-0 w-full" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
              </Field>
              {/* Two-column on sm+; stacked on phones so long values have room */}
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <Input className="min-w-0 w-full" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input className="min-w-0 w-full" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
                </Field>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Location">
                  <Input className="min-w-0 w-full" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} />
                </Field>
                <Field label="Links">
                  <Input
                    className="min-w-0 w-full"
                    value={p.links}
                    placeholder="github.com/you"
                    onChange={(e) => setP({ ...p, links: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Headline">
                <Input
                  className="min-w-0 w-full"
                  value={p.headline}
                  placeholder="Full-stack developer"
                  onChange={(e) => setP({ ...p, headline: e.target.value })}
                />
              </Field>
              <Field label="Summary">
                <Textarea
                  className="min-h-[90px] min-w-0 w-full"
                  value={p.summary}
                  onChange={(e) => setP({ ...p, summary: e.target.value })}
                />
              </Field>
            </div>
          )}

          {sec === 'education' && (
            <div className="min-w-0 space-y-3">
              {edu.map((x, i) => (
                <Row key={i} onRemove={edu.length > 1 ? () => setEdu(edu.filter((_, j) => j !== i)) : undefined}>
                  <Field label="School">
                    <Input className="min-w-0 w-full" value={x.school} onChange={(e) => upd(edu, setEdu, i, 'school', e.target.value)} />
                  </Field>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Degree">
                      <Input className="min-w-0 w-full" value={x.degree} onChange={(e) => upd(edu, setEdu, i, 'degree', e.target.value)} />
                    </Field>
                    <Field label="Period">
                      <Input
                        className="min-w-0 w-full"
                        value={x.period}
                        placeholder="2022 – 2026"
                        onChange={(e) => upd(edu, setEdu, i, 'period', e.target.value)}
                      />
                    </Field>
                  </div>
                </Row>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setEdu([...edu, { school: '', degree: '', period: '', details: '' }])}>
                <Plus className="h-4 w-4" />Add education
              </Button>
            </div>
          )}

          {sec === 'experience' && (
            <div className="min-w-0 space-y-3">
              {exp.map((x, i) => (
                <Row key={i} onRemove={exp.length > 1 ? () => setExp(exp.filter((_, j) => j !== i)) : undefined}>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Company">
                      <Input className="min-w-0 w-full" value={x.company} onChange={(e) => upd(exp, setExp, i, 'company', e.target.value)} />
                    </Field>
                    <Field label="Role">
                      <Input className="min-w-0 w-full" value={x.role} onChange={(e) => upd(exp, setExp, i, 'role', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Period">
                    <Input className="min-w-0 w-full" value={x.period} onChange={(e) => upd(exp, setExp, i, 'period', e.target.value)} />
                  </Field>
                  <Field label="What you did">
                    <Textarea
                      className="min-h-[90px] min-w-0 w-full"
                      value={x.details}
                      onChange={(e) => upd(exp, setExp, i, 'details', e.target.value)}
                    />
                  </Field>
                </Row>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setExp([...exp, { company: '', role: '', period: '', details: '' }])}>
                <Plus className="h-4 w-4" />Add experience
              </Button>
            </div>
          )}

          {sec === 'projects' && (
            <div className="min-w-0 space-y-3">
              {proj.map((x, i) => (
                <Row key={i} onRemove={() => setProj(proj.filter((_, j) => j !== i))}>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Project">
                      <Input className="min-w-0 w-full" value={x.name} onChange={(e) => upd(proj, setProj, i, 'name', e.target.value)} />
                    </Field>
                    <Field label="Stack">
                      <Input className="min-w-0 w-full" value={x.stack} onChange={(e) => upd(proj, setProj, i, 'stack', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Details">
                    <Textarea
                      className="min-h-[80px] min-w-0 w-full"
                      value={x.details}
                      onChange={(e) => upd(proj, setProj, i, 'details', e.target.value)}
                    />
                  </Field>
                </Row>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setProj([...proj, { name: '', stack: '', details: '' }])}>
                <Plus className="h-4 w-4" />Add project
              </Button>
            </div>
          )}

          {sec === 'skills' && (
            <Field label="Skills" hint="Comma separated">
              <Textarea
                className="min-h-[90px] min-w-0 w-full"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, Node.js, MongoDB, TypeScript"
              />
            </Field>
          )}
        </div>

        <div className="surface min-w-0 space-y-4 p-4 sm:p-5">
          <Field label="Target role">
            <Input
              className="min-w-0 w-full"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Software Engineer"
            />
          </Field>
          <Field label="Job description (optional)" hint="Used to tailor the wording.">
            <Textarea
              className="min-h-[80px] min-w-0 w-full"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </Field>

          {/* Format + AI improvement — stacked on mobile, side-by-side on sm+ */}
          <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <Field label="Format">
              <Select className="min-w-0 w-full" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="modern" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Modern</option>
                <option value="classic" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Classic</option>
                <option value="minimal" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>Minimal</option>
              </Select>
            </Field>
            <label className="flex min-w-0 items-center gap-2 pb-2.5 text-sm text-fg-soft">
              <input
                type="checkbox"
                checked={improve}
                onChange={(e) => setImprove(e.target.checked)}
                className="accent-violet-500"
              />
              <span className="truncate">AI improvement</span>
            </label>
          </div>

          <Button size="lg" className="w-full" onClick={submit} loading={r.running}>
            <Wand2 className="h-4 w-4" />
            Create {mode === 'resume' ? 'resume' : 'cover letter'} · {r.credits} credits
          </Button>
        </div>

        <RecentRuns tool="resume" />
      </div>

      {/* Right column — output */}
      <div className="min-w-0">
        <OutputPanel
          {...r}
          artifact={r.artifact}
          onArtifact={r.setArtifact}
          onDeleted={() => { r.setArtifact(null); r.reset(); }}
          label="Building"
          editable={false}
          idle={
            <Placeholder
              icon={<FileText className="h-6 w-6" />}
              title="Your document preview"
              body="Fill in the sections and generate. You will get a clean, ATS-friendly document you can export as PDF."
            />
          }
        />
      </div>
    </div>
  </ToolShell>
);
}

// ── Code Assistant ───────────────────────────────────────
const MODES = [['explain', 'Explain', Lightbulb], ['debug', 'Debug', Bug], ['improve', 'Improve', Sparkles], ['generate', 'Generate', Code2], ['refactor', 'Refactor', Wrench]] as const;
const LANGS = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c++', 'c#', 'php', 'sql', 'bash', 'html/css'];
export function CodeAssistant() {
  const r = useResult('code');
  const [mode, setMode] = useState<(typeof MODES)[number][0]>('explain');
  const [language, setLanguage] = useState('typescript');
  const [code, setCode] = useState('');
  const [instructions, setInstructions] = useState('');
  const submit = () => {
    if (mode === 'generate' ? instructions.trim().length < 3 && code.trim().length < 3 : code.trim().length < 3) return toast.error(mode === 'generate' ? 'Describe what to generate' : 'Paste some code first');
    void r.run('/tools/code', { mode, language, code, instructions });
  };
  const lines = code.split('\n').length;
return (
  <ToolShell id="code">
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-4">
        {/* Mode buttons — horizontal scroll on tiny screens instead of an awkward wrap */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {MODES.map(([id, label, I]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-bold transition',
                mode === id
                  ? 'border-teal-400/60 bg-teal-400/15 text-white'
                  : 'border-white/10 text-fg-mute hover:text-fg',
              )}
            >
              <I className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Code editor card */}
        <div className="min-w-0 overflow-hidden rounded-3xl border border-line bg-ink-900">
          {/* Window chrome — dots stay put, select clamps its width */}
          <div className="flex items-center justify-between gap-2 border-b border-line bg-white/[0.03] px-3 py-2.5 sm:px-4">
            <div className="flex shrink-0 gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-400/70" />
              <span className="h-3 w-3 rounded-full bg-amber-400/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Language"
              className="min-w-0 max-w-[140px] rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1 font-mono text-xs outline-none"
            >
              {LANGS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          {/* Line numbers + textarea */}
          <div className="flex min-w-0">
            <div
              aria-hidden
              className="hidden shrink-0 select-none border-r border-line bg-white/[0.02] px-3 py-4 text-right font-mono text-xs leading-6 text-fg-faint sm:block"
            >
              {Array.from({ length: Math.min(Math.max(lines, 14), 200) }, (_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder={mode === 'generate' ? '// Optional: paste existing code for context' : '// Paste your code here'}
              aria-label="Code"
              className="min-h-[240px] min-w-0 w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-6 outline-none placeholder:text-fg-faint sm:min-h-[340px] sm:p-4"
            />
          </div>
        </div>

        <Field label={mode === 'generate' ? 'What should it do?' : 'Extra instructions (optional)'}>
          <Textarea
            className="min-h-[80px]"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={mode === 'generate' ? 'A debounce hook with cancel support…' : 'Focus on performance…'}
          />
        </Field>

        <Button size="lg" className="w-full" onClick={submit} loading={r.running}>
          <Code2 className="h-4 w-4" />
          {MODES.find((m) => m[0] === mode)![1]} code · {r.credits} credits
        </Button>

        <RecentRuns tool="code" />
      </div>

      {/* Output — wrapped so it can shrink below content width */}
      <div className="min-w-0">
        <OutputPanel
          {...r}
          artifact={r.artifact}
          onArtifact={r.setArtifact}
          onDeleted={() => { r.setArtifact(null); r.reset(); }}
          label="Reading code"
          idle={
            <Placeholder
              icon={<Code2 className="h-6 w-6" />}
              title="Analysis appears here"
              body="Choose a mode, add your code and run. Code blocks in the result have one-click copy."
            />
          }
        />
      </div>
    </div>
  </ToolShell>
);
}

// ── AI Agent ─────────────────────────────────────────────
interface Step { id: number; label: string; tool: string; status: string; detail?: string }
export function Agent() {
  const r = useResult('agent');
  const [goal, setGoal] = useState('');
  const [doc, setDoc] = useState('');
  const { data: docs } = useQuery({ queryKey: ['pdf-docs'], queryFn: async () => (await api.get('/tools/pdf/documents')).data.documents as { id: string; name: string; status: string }[] });
  const live = r.status;
  const out = r.result?.generation.output as { answer?: string; steps?: Step[] } | undefined;
  const timeline = ['Thinking…', 'Using PDF AI…', 'Analyzing document…', 'Creating draft…', 'Creating summary…'];
  const submit = () => { if (goal.trim().length < 5) return toast.error('Describe your goal', 'Give the agent a little more detail.'); void r.run('/tools/agent', { goal, documentId: doc || undefined }); };
  return (
    <ToolShell id="agent">
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <div className="surface space-y-4 p-5 sm:p-6">
            <Field label="Your goal"><Textarea className="min-h-[150px]" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Summarise the attached report and draft three follow-up questions for the team." maxLength={3000} /></Field>
          <Field label="Attach a PDF (optional)" hint={docs?.length ? undefined : 'Upload one in PDF AI first.'}>
  <Select value={doc} onChange={(e) => setDoc(e.target.value)}>
    <option value="" style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>No document</option>
    {docs?.filter((d) => d.status === 'ready').map((d) => (
      <option key={d.id} value={d.id} style={{ backgroundColor: '#1c1c1e', color: '#ffffff' }}>
        {d.name}
      </option>
    ))}
  </Select>
</Field>
            <Button size="lg" className="w-full" onClick={submit} loading={r.running}><Bot className="h-4 w-4" />Run agent · {r.credits} credits</Button>
          </div>
          <RecentRuns tool="agent" />
        </div>
        <div className="space-y-4">
          <div className="surface p-5 sm:p-6">
            <p className="label mb-4">Execution</p>
            <ol className="space-y-3">
              {r.state === 'idle' && ['Goal received', 'Plan the work', 'Use tools', 'Final answer'].map((s) => <li key={s} className="flex items-center gap-3 text-sm text-fg-faint"><Circle className="h-4 w-4" />{s}</li>)}
              {r.state === 'running' && <><li className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-4 w-4 text-ok" />Goal received</li><li className="flex items-center gap-3 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin text-violet-300" />{timeline.includes(live) ? live : `${live}…`}</li></>}
              {r.state === 'done' && out?.steps?.map((s) => <li key={s.id} className="flex items-start gap-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /><span><b>{s.label}</b> <span className="text-fg-mute">· {s.tool}</span>{s.detail && <span className="block text-xs text-fg-mute">{s.detail}</span>}</span></li>)}
              {r.state === 'error' && <li className="text-sm text-bad">{r.error?.message}</li>}
            </ol>
            {r.state === 'error' && <Button className="mt-4" variant="secondary" size="sm" onClick={r.retry}><RefreshCw className="h-4 w-4" />Retry</Button>}
          </div>
          {r.state === 'done' && r.artifact && <OutputPanel {...r} artifact={r.artifact} onArtifact={r.setArtifact} onDeleted={() => { r.setArtifact(null); r.reset(); }} idle={null} />}
          {r.state === 'idle' && <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-fg-mute"><GraduationCap className="mx-auto mb-3 h-6 w-6 text-violet-300" />Only safe, high-level status is shown here — never the model’s private reasoning. <Link to="/app/tools/pdf" className="font-semibold text-violet-300">Open PDF AI</Link></div>}
        </div>
      </div>
    </ToolShell>
  );
}
