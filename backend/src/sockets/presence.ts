const online = new Map<string, number>();
let adminCount = 0;

export const userConnected = (id: string) => online.set(id, (online.get(id) || 0) + 1);
export const userDisconnected = (id: string) => {
  const n = (online.get(id) || 1) - 1;
  if (n <= 0) online.delete(id); else online.set(id, n);
  return n <= 0;
};
export const isUserOnline = (id: string) => online.has(id);
export const onlineUserIds = () => [...online.keys()];
export const adminConnected = () => { adminCount++; };
export const adminDisconnected = () => { adminCount = Math.max(0, adminCount - 1); return adminCount === 0; };
export const isAdminOnline = () => adminCount > 0;
