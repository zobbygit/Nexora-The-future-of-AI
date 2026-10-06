import {
  Bot, BarChart3, Clapperboard, Code2, Eraser, FileSearch, FileText, ImagePlus, Mic, PenLine, ScanText, Volume2, Wand2, type LucideIcon,
} from 'lucide-react';

export type Category = 'Write' | 'Audio' | 'Vision' | 'Documents' | 'Generate & Automate';

export interface ToolMeta {
  id: string; name: string; path: string; category: Category; icon: LucideIcon; blurb: string; short: string;
  /** Tailwind gradient classes for the icon tile. */
  tile: string; glow: string; free: boolean;
}

/** Presentation metadata. Prices, plan access and credit costs always come from the server. */
export const TOOL_META: ToolMeta[] = [
  { id: 'writer', name: 'AI Writer', path: 'writer', category: 'Write', icon: PenLine, blurb: 'Create high-quality content for blogs, emails, and more.', short: 'Create high-quality content', tile: 'from-violet-500 to-indigo-500', glow: '#7c5cff', free: true },
  { id: 'resume', name: 'Resume & Cover AI', path: 'resume', category: 'Write', icon: FileText, blurb: 'Craft professional resumes and cover letters.', short: 'Craft resumes & cover letters', tile: 'from-rose-500 to-orange-400', glow: '#fb7185', free: true },
  { id: 'code', name: 'Code Assistant', path: 'code', category: 'Write', icon: Code2, blurb: 'Write, debug and explain code.', short: 'Write, debug & explain', tile: 'from-teal-400 to-emerald-500', glow: '#2dd4bf', free: true },
  { id: 'tts', name: 'Text → Speech', path: 'text-to-speech', category: 'Audio', icon: Volume2, blurb: 'Convert text to natural voice.', short: 'Convert text to voice', tile: 'from-sky-500 to-blue-500', glow: '#38bdf8', free: false },
  { id: 'stt', name: 'Speech → Text', path: 'speech-to-text', category: 'Audio', icon: Mic, blurb: 'Transcribe audio to text.', short: 'Transcribe audio', tile: 'from-blue-500 to-cyan-400', glow: '#22d3ee', free: false },
  { id: 'image-to-text', name: 'Image → Text', path: 'image-to-text', category: 'Vision', icon: ScanText, blurb: 'Extract text from images.', short: 'Extract text from images', tile: 'from-sky-400 to-indigo-500', glow: '#60a5fa', free: false },
  { id: 'background-remover', name: 'Background Remover', path: 'background-remover', category: 'Vision', icon: Eraser, blurb: 'Remove backgrounds instantly.', short: 'Remove backgrounds', tile: 'from-emerald-400 to-teal-500', glow: '#34d399', free: false },
  { id: 'image-enhancer', name: 'Image Enhancer', path: 'image-enhancer', category: 'Vision', icon: Wand2, blurb: 'Improve image quality with AI.', short: 'Improve image quality', tile: 'from-teal-400 to-green-500', glow: '#2dd4bf', free: false },
  { id: 'pdf', name: 'PDF AI', path: 'pdf', category: 'Documents', icon: FileSearch, blurb: 'Summarize, analyze and chat with PDFs.', short: 'Summarize & analyze', tile: 'from-orange-400 to-amber-500', glow: '#fb923c', free: true },
  { id: 'data-analyzer', name: 'Data Analyzer', path: 'data-analyzer', category: 'Documents', icon: BarChart3, blurb: 'Analyze and visualize your data.', short: 'Analyze & visualize', tile: 'from-fuchsia-500 to-violet-500', glow: '#d946ef', free: false },
  { id: 'text-to-image', name: 'Text → Image', path: 'text-to-image', category: 'Generate & Automate', icon: ImagePlus, blurb: 'Generate stunning images from text.', short: 'Turn ideas into visuals', tile: 'from-rose-500 to-pink-500', glow: '#f43f5e', free: false },
  { id: 'video-to-text', name: 'Video → Text', path: 'video-to-text', category: 'Generate & Automate', icon: Clapperboard, blurb: 'Extract text and transcripts from videos.', short: 'Transcribe videos', tile: 'from-indigo-500 to-violet-600', glow: '#818cf8', free: false },
  { id: 'agent', name: 'AI Agent', path: 'agent', category: 'Generate & Automate', icon: Bot, blurb: 'Your personal AI assistant for complex tasks.', short: 'Handle complex tasks', tile: 'from-purple-500 to-fuchsia-500', glow: '#a855f7', free: true },
];

export const TOOL_BY_ID = Object.fromEntries(TOOL_META.map((t) => [t.id, t])) as Record<string, ToolMeta>;
export const CATEGORIES: Category[] = ['Write', 'Audio', 'Vision', 'Documents', 'Generate & Automate'];
export const toolPath = (id: string) => `/app/tools/${TOOL_BY_ID[id]?.path ?? id}`;
export const toolName = (id: string) => TOOL_BY_ID[id]?.name ?? id;
