import type { Server } from 'socket.io';

let io: Server | null = null;
export const setIo = (server: Server) => { io = server; };
export const getIo = () => io;

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  io?.to(`user:${userId}`).emit(event, payload);
};
export const emitToAdmins = (event: string, payload: unknown) => {
  io?.to('admins').emit(event, payload);
};
