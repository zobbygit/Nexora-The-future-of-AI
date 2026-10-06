export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (msg = 'Please sign in to continue.', code = 'UNAUTHORIZED') => new AppError(401, code, msg);
export const forbidden = (msg = 'You do not have access to this resource.', code = 'FORBIDDEN') => new AppError(403, code, msg);
export const notFound = (msg = 'Not found.', code = 'NOT_FOUND') => new AppError(404, code, msg);
export const conflict = (msg: string, code = 'CONFLICT') => new AppError(409, code, msg);
