import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestWithAuth } from '../auth/auth.types';

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordWriteRequest(req: RequestWithAuth) {
    const auth = req.auth;
    if (!auth) {
      return;
    }

    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return;
    }

    const targetId = (req.params as Record<string, string | undefined>)?.id ?? null;
    const routePath = (req.route as { path?: string } | undefined)?.path ?? req.path;

    await this.prisma.auditLog.create({
      data: {
        orgId: auth.orgId,
        shopId: auth.shopId,
        userId: auth.userId,
        action: `${method} ${routePath}`,
        targetType: req.baseUrl || 'unknown',
        targetId,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        metaJson: {
          query: req.query,
          bodyKeys:
            req.body && typeof req.body === 'object' ? Object.keys(req.body as Record<string, unknown>) : [],
        },
      },
    });
  }
}
