import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from './auth.constants';
import type { RequestWithAuth } from './auth.types';

function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = req.auth;
    if (!auth) {
      return false;
    }

    const orgIdValues = [
      readString((req.params as Record<string, unknown>)?.orgId),
      readString((req.query as Record<string, unknown>)?.orgId),
      readString((req.body as Record<string, unknown>)?.orgId),
    ].filter(Boolean) as string[];

    const shopIdValues = [
      readString((req.params as Record<string, unknown>)?.shopId),
      readString((req.query as Record<string, unknown>)?.shopId),
      readString((req.body as Record<string, unknown>)?.shopId),
    ].filter(Boolean) as string[];

    if (orgIdValues.some((orgId) => orgId !== auth.orgId)) {
      throw new ForbiddenException('Cross-org access is not allowed');
    }

    if (shopIdValues.some((shopId) => shopId !== auth.shopId)) {
      throw new ForbiddenException('Cross-shop access is not allowed');
    }

    return true;
  }
}
