export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
/** Socket.IO needs the API's own origin (it cannot go through a Vercel rewrite). Falls back to API_URL. */
export const SOCKET_URL: string = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.replace(/\/+$/, '') || API_URL;