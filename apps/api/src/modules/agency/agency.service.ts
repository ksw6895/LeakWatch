import { randomInt } from 'node:crypto';

import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { FindingStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

function makeConnectCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

@Injectable()
export class AgencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOrgShops(orgId: string) {
    return this.prisma.shop.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrgSummary(orgId: string) {
    const shopsCount = await this.prisma.shop.count({ where: { orgId, uninstalledAt: null } });
    const spend = await this.prisma.normalizedLineItem.aggregate({
      where: {
        shop: {
          orgId,
        },
      },
      _sum: { amount: true },
    });
    const potentialSavings = await this.prisma.leakFinding.aggregate({
      where: {
        orgId,
        status: {
          in: [FindingStatus.OPEN, FindingStatus.REOPENED],
        },
      },
      _sum: { estimatedSavingsAmount: true },
    });
    const topFindingsAcrossShops = await this.prisma.leakFinding.findMany({
      where: {
        orgId,
      },
      orderBy: [{ estimatedSavingsAmount: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        shopId: true,
        title: true,
        estimatedSavingsAmount: true,
        currency: true,
      },
    });

    return {
      shopsCount,
      totalSpend: spend._sum.amount ?? '0',
      potentialSavings: potentialSavings._sum.estimatedSavingsAmount ?? '0',
      topFindingsAcrossShops,
    };
  }

  async createConnectCode(orgId: string, createdByUserId: string) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    let code = makeConnectCode();

    for (let index = 0; index < 5; index += 1) {
      const exists = await this.prisma.connectCode.findUnique({ where: { code } });
      if (!exists) {
        break;
      }
      code = makeConnectCode();
    }

    const created = await this.prisma.connectCode.create({
      data: {
        orgId,
        code,
        expiresAt,
        createdByUserId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        userId: createdByUserId,
        action: 'AGENCY_CONNECT_CODE_CREATED',
        targetType: 'connect_code',
        targetId: created.id,
        metaJson: {
          expiresAt: created.expiresAt.toISOString(),
        },
      },
    });

    return created;
  }

  async attachShopToOrg(codeRaw: string, shopId: string, actorOrgId: string, actorUserId: string) {
    const code = codeRaw.trim();
    const connectCode = await this.prisma.connectCode.findUnique({
      where: {
        code,
      },
    });

    if (!connectCode) {
      throw new NotFoundException('Connect code not found');
    }

    if (connectCode.usedAt) {
      throw new UnauthorizedException('Connect code already used');
    }

    if (connectCode.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Connect code expired');
    }

    return this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({ where: { id: shopId } });
      if (!shop) {
        throw new NotFoundException('Shop not found');
      }

      if (shop.orgId !== actorOrgId) {
        throw new UnauthorizedException('Cannot attach shop outside current org scope');
      }

      const updatedShop = await tx.shop.update({
        where: {
          id: shop.id,
        },
        data: {
          orgId: connectCode.orgId,
        },
      });

      await tx.connectCode.update({
        where: {
          id: connectCode.id,
        },
        data: {
          usedAt: new Date(),
          usedByShopId: updatedShop.id,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: connectCode.orgId,
          shopId: updatedShop.id,
          userId: actorUserId,
          action: 'AGENCY_CONNECT_CODE_ATTACHED',
          targetType: 'shop',
          targetId: updatedShop.id,
          metaJson: {
            sourceOrgId: actorOrgId,
            targetOrgId: connectCode.orgId,
            connectCodeId: connectCode.id,
          },
        },
      });

      return updatedShop;
    });
  }
}
