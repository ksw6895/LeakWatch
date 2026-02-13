import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Plan, PlanStatus } from '@prisma/client';

import { AuthContext, Public } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get('current')
  current(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.billingService.getCurrent(auth.orgId, shopId ?? auth.shopId);
  }

  @Post('subscribe')
  subscribe(@AuthContext() auth: RequestAuthContext, @Query('plan') plan?: string) {
    const targetPlan =
      plan?.toUpperCase() === Plan.PRO
        ? Plan.PRO
        : plan?.toUpperCase() === Plan.STARTER
          ? Plan.STARTER
          : Plan.FREE;
    return this.billingService.subscribe(auth.orgId, targetPlan);
  }

  @Public()
  @Post('webhooks')
  webhooks(@Body() body: { orgId?: string; plan?: Plan; planStatus?: PlanStatus }) {
    return this.billingService.processWebhook(body);
  }
}
