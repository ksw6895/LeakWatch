import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';

import { RateLimiterService } from '../../common/rate-limiter.service';
import { AuthContext, RequireRoles } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';
import { BillingService } from '../billing/billing.service';
import { QueueService } from '../documents/queue.service';
import { UpdateActionRequestDto } from './update-action-request.dto';

@Controller()
export class ActionsController {
  constructor(
    @Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(RateLimiterService) private readonly rateLimiter: RateLimiterService,
  ) {}

  @Get('action-requests')
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.tenantPrisma.listActionRequests(auth.orgId, shopId ?? auth.shopId);
  }

  @Get('action-requests/:id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const actionRequest = await this.tenantPrisma.getActionRequest(auth.orgId, id);
    if (!actionRequest) {
      throw new NotFoundException('Action request not found');
    }
    return actionRequest;
  }

  @Patch('action-requests/:id')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async updateDraft(
    @AuthContext() auth: RequestAuthContext,
    @Param('id') id: string,
    @Body() body: UpdateActionRequestDto,
  ) {
    const updated = await this.tenantPrisma.updateActionDraft(auth.orgId, id, {
      ...(body.toEmail !== undefined ? { toEmail: body.toEmail } : {}),
      ...(body.ccEmails !== undefined ? { ccEmails: body.ccEmails } : {}),
      ...(body.subject !== undefined ? { subject: body.subject } : {}),
      ...(body.bodyMarkdown !== undefined ? { bodyMarkdown: body.bodyMarkdown } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Draft action request not found');
    }

    return updated;
  }

  @Post('action-requests/:id/approve')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async approveByActionRequestId(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const approveRate = this.rateLimiter.consume(`action-approve:${auth.orgId}`, 10, 60);
    if (!approveRate.allowed) {
      throw new ForbiddenException('RATE_LIMIT_EXCEEDED_ACTION_APPROVE');
    }

    const entitlement = await this.billingService.canSendEmail(auth.orgId, auth.shopId);
    if (!entitlement.allowed) {
      throw new ForbiddenException('EMAIL_LIMIT_EXCEEDED');
    }

    const approved = await this.tenantPrisma.approveActionRequest(auth.orgId, id, auth.userId);
    if (!approved) {
      throw new NotFoundException('Action request not found');
    }

    await this.queueService.enqueueSendEmail(approved.actionRun.id);
    await this.billingService.incrementUsage(auth.orgId, auth.shopId, 'emails_sent', 1);

    return approved;
  }

  @Post('actions/:findingId/approve')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async approve(@AuthContext() auth: RequestAuthContext, @Param('findingId') findingId: string) {
    const actionRequest = await this.tenantPrisma.approveActionForFinding(
      auth.orgId,
      findingId,
      auth.userId,
    );

    if (!actionRequest) {
      throw new NotFoundException('Finding not found');
    }

    return actionRequest;
  }
}
