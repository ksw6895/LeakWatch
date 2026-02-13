import { Body, Controller, Inject, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';

type EventPayload = {
  name: string;
  properties?: Record<string, unknown>;
  occurredAt?: string;
};

@Controller('events')
export class EventsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post()
  async ingest(@AuthContext() auth: RequestAuthContext, @Body() body: EventPayload) {
    const properties = JSON.parse(JSON.stringify(body.properties ?? {})) as Prisma.InputJsonValue;

    await this.prisma.auditLog.create({
      data: {
        orgId: auth.orgId,
        shopId: auth.shopId,
        userId: auth.userId,
        action: 'FRONTEND_EVENT_TRACKED',
        targetType: 'frontend_event',
        targetId: body.name,
        metaJson: {
          name: body.name,
          properties,
          occurredAt: body.occurredAt ?? new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true };
  }
}
