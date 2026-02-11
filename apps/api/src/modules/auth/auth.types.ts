import type { Request } from 'express';
import type { OrgRole } from '@prisma/client';

export type RequestAuthContext = {
  orgId: string;
  shopId: string;
  userId: string;
  roles: OrgRole[];
  shopDomain: string;
};

export type RequestWithAuth = Request & {
  auth?: RequestAuthContext;
  rawBody?: Buffer;
};
