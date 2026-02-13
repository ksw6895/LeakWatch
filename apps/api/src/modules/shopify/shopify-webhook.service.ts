import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyWebhookHmac } from '@leakwatch/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/env';

@Injectable()
export class ShopifyWebhookService {
  private readonly env = getApiEnv();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async handleUninstall(params: {
    signature: string | undefined;
    shopDomain: string | undefined;
    rawBody: Buffer;
  }) {
    const signature = params.signature;
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!verifyWebhookHmac(params.rawBody, signature, this.env.SHOPIFY_API_SECRET)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const shopDomain = params.shopDomain;
    if (!shopDomain) {
      throw new BadRequestException('Missing shop domain header');
    }

    await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({ where: { shopifyDomain: shopDomain } });
      if (!shop) {
        return;
      }

      await tx.shop.update({
        where: { id: shop.id },
        data: { uninstalledAt: new Date() },
      });

      await tx.shopifyToken.deleteMany({ where: { shopId: shop.id } });

      await tx.auditLog.create({
        data: {
          orgId: shop.orgId,
          shopId: shop.id,
          action: 'shopify.app_uninstalled',
          targetType: 'Shop',
          targetId: shop.id,
          metaJson: { shopDomain },
        },
      });
    });

    return { ok: true };
  }

  async handleShopUpdate(params: {
    signature: string | undefined;
    shopDomain: string | undefined;
    rawBody: Buffer;
  }) {
    const signature = params.signature;
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!verifyWebhookHmac(params.rawBody, signature, this.env.SHOPIFY_API_SECRET)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const shopDomain = params.shopDomain;
    if (!shopDomain) {
      throw new BadRequestException('Missing shop domain header');
    }

    let payload: {
      name?: string;
      currency?: string;
      iana_timezone?: string;
    };
    try {
      payload = JSON.parse(params.rawBody.toString('utf8')) as {
        name?: string;
        currency?: string;
        iana_timezone?: string;
      };
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({ where: { shopifyDomain: shopDomain } });
      if (!shop) {
        return;
      }

      const currency = payload.currency?.trim().toUpperCase();
      const timezone = payload.iana_timezone?.trim();
      const displayName = payload.name?.trim();

      await tx.shop.update({
        where: { id: shop.id },
        data: {
          ...(displayName ? { displayName } : {}),
          ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency } : {}),
          ...(timezone && timezone.length >= 2 ? { timezone } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: shop.orgId,
          shopId: shop.id,
          action: 'shopify.shop_updated',
          targetType: 'Shop',
          targetId: shop.id,
          metaJson: {
            shopDomain,
            displayName: displayName ?? null,
            currency: currency ?? null,
            timezone: timezone ?? null,
          },
        },
      });
    });

    return { ok: true };
  }
}
