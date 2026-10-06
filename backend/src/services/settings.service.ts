import { DEFAULT_PLANS, Plan, PlanConfig, TOOLS, ToolDefinition, ToolId } from '../config/tools';
import { Setting } from '../models/Setting';

export interface SystemSettings {
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  supportChatEnabled: boolean;
}
export interface ToolOverride { credits?: number; plan?: Plan; enabled?: boolean }

const DEFAULT_SYSTEM: SystemSettings = { registrationEnabled: true, maintenanceMode: false, supportChatEnabled: true };

interface Snapshot {
  plans: Record<Plan, PlanConfig>;
  tools: Record<string, ToolOverride>;
  system: SystemSettings;
  at: number;
}
let cache: Snapshot | null = null;
const TTL = 30_000;

export const invalidateSettings = () => { cache = null; };

const load = async (): Promise<Snapshot> => {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const rows = await Setting.find({ key: { $in: ['plans', 'tools', 'system'] } }).lean();
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value as any]));
  cache = {
    plans: {
      free: { ...DEFAULT_PLANS.free, ...(byKey.plans?.free || {}), id: 'free' },
      pro: { ...DEFAULT_PLANS.pro, ...(byKey.plans?.pro || {}), id: 'pro' },
    },
    tools: byKey.tools || {},
    system: { ...DEFAULT_SYSTEM, ...(byKey.system || {}) },
    at: Date.now(),
  };
  return cache;
};

export const getPlans = async () => (await load()).plans;
export const getPlan = async (p: Plan) => (await load()).plans[p];
export const getSystem = async () => (await load()).system;

export const resolveTool = (def: ToolDefinition, o?: ToolOverride): ToolDefinition & { enabled: boolean } => ({
  ...def,
  credits: o?.credits ?? def.credits,
  plan: o?.plan ?? def.plan,
  enabled: o?.enabled ?? true,
});

export const getTools = async () => {
  const snap = await load();
  return TOOLS.map((t) => resolveTool(t, snap.tools[t.id]));
};
export const getToolConfig = async (id: ToolId | string) => {
  const snap = await load();
  const def = TOOLS.find((t) => t.id === id);
  return def ? resolveTool(def, snap.tools[def.id]) : undefined;
};

export const saveSetting = async (key: string, value: unknown) => {
  await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
  invalidateSettings();
};
export const rawSetting = async (key: string) => (await Setting.findOne({ key }).lean())?.value;
