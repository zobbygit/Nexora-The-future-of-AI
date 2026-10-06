import type { ReactNode } from 'react';
export default function ReactMarkdown({ children }: { children: ReactNode }) { return <div data-testid="markdown">{children}</div>; }
