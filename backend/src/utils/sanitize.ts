import { NextFunction, Request, Response } from 'express';

/** Strips Mongo operators ($…) and dotted keys from untrusted objects (in place). */
export const stripOperators = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    value.forEach(stripOperators);
    return value;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) delete obj[key];
      else stripOperators(obj[key]);
    }
  }
  return value;
};

export const mongoSanitize = (req: Request, _res: Response, next: NextFunction) => {
  stripOperators(req.body);
  stripOperators(req.params);
  stripOperators(req.query);
  next();
};

/** Escape user input before using it inside a RegExp. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remove control characters and clamp length for free-text fields. */
export const cleanText = (s: string, max = 20000) =>
  Array.from(s)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return !(c <= 8 || c === 11 || c === 12 || (c >= 14 && c <= 31) || c === 127);
    })
    .join('')
    .slice(0, max);
