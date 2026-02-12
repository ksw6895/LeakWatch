import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';

import { QueueService } from '../documents/queue.service';
import { AuthContext, RequireRoles } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';
import { CreateActionRequestDto } from './create-action-request.dto';

@Controller('findings')
export class FindingsController {
  constructor(
    @Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
  ) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.tenantPrisma.listFindings(auth.orgId, shopId ?? auth.shopId);
  }

  @Get(':id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const finding = await this.tenantPrisma.getFinding(auth.orgId, id);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }

  @Post(':findingId/dismiss')
  async dismiss(@AuthContext() auth: RequestAuthContext, @Param('findingId') findingId: string) {
    const finding = await this.tenantPrisma.dismissFinding(auth.orgId, findingId);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }

  @Post(':findingId/actions')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async createActionDraft(
    @AuthContext() auth: RequestAuthContext,
    @Param('findingId') findingId: string,
    @Body() body: CreateActionRequestDto,
  ) {
    const actionRequest = await this.tenantPrisma.createActionDraft({
      orgId: auth.orgId,
      shopId: auth.shopId,
      findingId,
      userId: auth.userId,
      type: body.type,
      toEmail: body.toEmail,
      ...(body.ccEmails ? { ccEmails: body.ccEmails } : {}),
    });

    if (!actionRequest) {
      throw new NotFoundException('Finding not found');
    }

    await this.queueService.enqueueEvidencePack(actionRequest.id);
    return actionRequest;
  }
}
