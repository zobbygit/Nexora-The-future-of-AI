import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { copyText } from '@/lib/utils';

const Pre = ({ children }: { children?: ReactNode }) => {
  const [ok, setOk] = useState(false);
  const text = (() => { const c = (children as any)?.props?.children; return typeof c === 'string' ? c : Array.isArray(c) ? c.join('') : ''; })();
  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button onClick={async () => { if (await copyText(text.replace(/\n$/, ''))) { setOk(true); setTimeout(() => setOk(false), 1600); } }} aria-label="Copy code"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink-700 text-fg-mute opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100">{ok ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}</button>
    </div>
  );
};

/** Renders Markdown safely (no raw HTML) with copyable code blocks. */
export const Markdown = ({ children }: { children: string }) => (
  <div className="prose-nx"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: Pre as any, a: ({ href, children: c }) => <a href={href} target="_blank" rel="noopener noreferrer">{c}</a> }}>{children}</ReactMarkdown></div>
);
