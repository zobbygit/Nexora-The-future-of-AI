import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { badRequest } from '../utils/errors';

export const validateBody = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    const issue = r.error.issues[0];
    return next(badRequest(issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input.', 'VALIDATION_ERROR', r.error.flatten().fieldErrors));
  }
  req.body = r.data;
  next();
};

export const parseInput = <T extends ZodTypeAny>(schema: T, data: unknown): z.output<T> => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw badRequest(issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input.', 'VALIDATION_ERROR', r.error.flatten().fieldErrors);
  }
  return r.data;
};
