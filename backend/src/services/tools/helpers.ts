import { ChatMessage } from '../providers';
import { SAFETY_PREAMBLE, fenceUntrusted } from '../../utils/promptGuard';

export const sys = (role: string, extra = ''): ChatMessage => ({
  role: 'system',
  content: `${role}\n${extra}\n${SAFETY_PREAMBLE}`.trim(),
});
export const user = (content: string): ChatMessage => ({ role: 'user', content });
export const fence = fenceUntrusted;

export const firstLine = (t: string, fallback: string, max = 70) => {
  const line = t.replace(/^#+\s*/, '').split('\n').find((l) => l.trim()) || fallback;
  return line.replace(/[*_`#>]/g, '').trim().slice(0, max) || fallback;
};

export const stripJsonFence = (t: string) => t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

export const ASPECT: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 }, '16:9': { width: 1344, height: 768 }, '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 }, '3:4': { width: 896, height: 1152 },
};
