import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { extractShopDomainFromDest } from '@leakwatch/shared';
import { jwtVerify } from 'jose';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/env';
import type { RequestAuthContext } from './auth.types';

@Injectable()
export class AuthContextService {
  private readonly env = getApiEnv();
  private readonly jwtSecret = new TextEncoder().encode(this.env.SHOPIFY_API_SECRET);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async fromShopifySessionToken(token: string): Promise<RequestAuthContext> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        audience: this.env.SHOPIFY_API_KEY,
      });

      const dest = payload.dest;
      const sub = payload.sub;
      if (typeof dest !== 'string' || typeof sub !== 'string') {
        throw new UnauthorizedException('Invalid session token payload');
      }

      const shopDomain = extractShopDomainFromDest(dest);
      const shop = await this.prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
      if (!shop || shop.uninstalledAt) {
        throw new UnauthorizedException('Shop is not installed');
      }

      const user = await this.prisma.user.upsert({
        where: { shopifyUserId: sub },
        create: {
          shopifyUserId: sub,
          displayName: typeof payload.name === 'string' ? payload.name : null,
        },
        update:
          typeof payload.name === 'string'
            ? {
                displayName: payload.name,
              }
            : {},
      });

      let membership = await this.prisma.membership.findUnique({
        where: { orgId_userId: { orgId: shop.orgId, userId: user.id } },
      });

      if (!membership) {
        const membershipCount = await this.prisma.membership.count({ where: { orgId: shop.orgId } });
        membership = await this.prisma.membership.create({
          data: {
            orgId: shop.orgId,
            userId: user.id,
            role: membershipCount === 0 ? OrgRole.OWNER : OrgRole.MEMBER,
          },
        });
      }

      return {
        orgId: shop.orgId,
        shopId: shop.id,
        userId: user.id,
        roles: [membership.role],
        shopDomain,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Shopify session token');
    }
  }
}
