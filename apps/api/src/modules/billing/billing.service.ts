import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Plan, PlanStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type Limits = {
  uploads: number;
  emails: number;
  findings: number;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const PLAN_LIMITS: Record<Plan, Limits> = {
  FREE: { uploads: 3, emails: 0, findings: 3 },
  STARTER: { uploads: 50, emails: 10, findings: 1000 },
  PRO: { uploads: 200, emails: 50, findings: 1000 },
  AGENCY: { uploads: 500, emails: 200, findings: 5000 },
};

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrgPlan(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  getLimits(plan: Plan) {
    return PLAN_LIMITS[plan];
  }

  async getUsage(orgId: string, shopId: string, metric: string) {
    const day = startOfUtcDay(new Date());
    const usage = await this.prisma.usageCounter.findUnique({
      where: {
        orgId_shopId_day_metric: {
          orgId,
          shopId,
          day,
          metric,
        },
      },
    });
    return Number(usage?.value ?? BigInt(0));
  }

  async incrementUsage(orgId: string, shopId: string, metric: string, delta = 1) {
    if (delta <= 0) {
      return;
    }
    const day = startOfUtcDay(new Date());
    await this.prisma.usageCounter.upsert({
      where: {
        orgId_shopId_day_metric: {
          orgId,
          shopId,
          day,
          metric,
        },
      },
      create: {
        orgId,
        shopId,
        day,
        metric,
        value: BigInt(delta),
      },
      update: {
        value: {
          increment: BigInt(delta),
        },
      },
    });
  }

  async canUpload(orgId: string, shopId: string) {
    const org = await this.getOrgPlan(orgId);
    const limits = this.getLimits(org.plan);
    const used = await this.getUsage(orgId, shopId, 'uploads_created');
    return {
      allowed: used < limits.uploads,
      used,
      limit: limits.uploads,
      plan: org.plan,
    };
  }

  async canSendEmail(orgId: string, shopId: string) {
    const org = await this.getOrgPlan(orgId);
    const limits = this.getLimits(org.plan);
    const used = await this.getUsage(orgId, shopId, 'emails_sent');
    return {
      allowed: used < limits.emails,
      used,
      limit: limits.emails,
      plan: org.plan,
    };
  }

  async getCurrent(orgId: string, shopId: string) {
    const org = await this.getOrgPlan(orgId);
    const limits = this.getLimits(org.plan);
    const uploadsUsed = await this.getUsage(orgId, shopId, 'uploads_created');
    const emailsUsed = await this.getUsage(orgId, shopId, 'emails_sent');

    return {
      plan: org.plan,
      planStatus: org.planStatus,
      limits,
      usage: {
        uploads: uploadsUsed,
        emails: emailsUsed,
      },
    };
  }

  async subscribe(orgId: string, plan: Plan) {
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        plan,
        planStatus: PlanStatus.ACTIVE,
      },
    });

    return {
      plan: updated.plan,
      planStatus: updated.planStatus,
      confirmationUrl: `${process.env.SHOPIFY_APP_URL ?? 'http://localhost:3000'}/app/settings/billing?status=confirmed&plan=${plan}`,
    };
  }

  async processWebhook(body: { orgId?: string; plan?: Plan; planStatus?: PlanStatus }) {
    if (!body.orgId || !body.plan || !body.planStatus) {
      throw new NotFoundException('Invalid billing webhook payload');
    }

    const updated = await this.prisma.organization.update({
      where: { id: body.orgId },
      data: {
        plan: body.plan,
        planStatus: body.planStatus,
      },
    });

    return {
      ok: true,
      orgId: updated.id,
      plan: updated.plan,
      planStatus: updated.planStatus,
    };
  }
}
