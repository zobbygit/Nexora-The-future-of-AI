export type Plan = 'free' | 'pro';
export interface User {
  id: string; name: string; email: string; phone: string; avatarUrl: string; plan: Plan; isActive: boolean; credits: number;
  creditsResetAt?: string; onboardingCompleted: boolean; onboarding: { useCases: string[]; building: string[]; goals: string[] }; createdAt: string;
}
export interface ToolInfo { id: string; name: string; category: string; plan: Plan; credits: number; enabled: boolean; locked: boolean }
export interface Bootstrap {
  user: User; credits: number; resetsAt?: string; unreadNotifications: number; unreadChat?: number; tools: ToolInfo[];
  plans: Record<Plan, { id: Plan; name: string; priceInr: number; creditsPerPeriod: number; period: 'day' | 'month' }>;
}
export interface Artifact {
  id: string; title: string; kind: 'text' | 'pdf' | 'image' | 'audio' | 'video' | 'code' | 'resume' | 'data' | 'response' | 'file';
  tool?: string; mimeType?: string; content?: string; url?: string; size: number; meta?: Record<string, any>; favorite: boolean; tags: string[];
  source: 'generated' | 'upload'; ownerId: string; role: 'owner' | 'editor' | 'viewer'; canDownload: boolean; createdAt: string; updatedAt: string;
}
export interface Generation {
  id: string; tool: string; title: string; input?: any; output?: any; provider?: string; model?: string; status: 'completed' | 'failed';
  creditsUsed: number; artifactId?: string; latency?: number; error?: string; fallbackUsed: boolean; favorite: boolean; createdAt: string;
}
export interface RunResult { generation: Generation; artifact: Artifact | null; creditsRemaining: number; creditCost: number }
export interface NotificationItem { id: string; type: string; title: string; body: string; link?: string; read: boolean; createdAt: string }
