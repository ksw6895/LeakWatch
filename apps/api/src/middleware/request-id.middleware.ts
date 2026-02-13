import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

type RequestWithRequestId = Request & {
  requestId?: string;
};

export function requestIdMiddleware(req: RequestWithRequestId, res: Response, next: NextFunction) {
  const existing = req.headers['x-request-id'];
  const headerValue = Array.isArray(existing) ? existing[0] : existing;
  const requestId = (typeof headerValue === 'string' && headerValue.trim()) || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
