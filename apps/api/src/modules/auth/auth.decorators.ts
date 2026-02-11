import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@prisma/client';

import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import type { RequestWithAuth } from './auth.types';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequireRoles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);

export const AuthContext = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
  return req.auth;
});
