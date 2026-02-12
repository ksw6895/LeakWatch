import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { buildAuthorizeUrl, encryptAesGcm, isValidShopDomain, verifyShopifyQueryHmac } from '@leakwatch/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/env';
import { ShopifyAuthStateStore } from './shopify-auth-state.store';

type OAuthCallbackQuery = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toShopifyHostParam(shopDomain: string): string {
  const encoded = Buffer.from(`${shopDomain}/admin`, 'utf8').toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

@Injectable()
export class ShopifyAuthService {
  private readonly env = getApiEnv();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ShopifyAuthStateStore) private readonly stateStore: ShopifyAuthStateStore,
  ) {}

  startAuth(shopDomainRaw: string) {
    const shop = shopDomainRaw.toLowerCase().trim();
    if (!isValidShopDomain(shop)) {
      throw new BadRequestException('Invalid shop domain');
    }

    const state = this.stateStore.createState();
    const redirectUri = `${this.env.API_BASE_URL}/v1/shopify/auth/callback`;
    const authorizeUrl = buildAuthorizeUrl({
      shop,
      clientId: this.env.SHOPIFY_API_KEY,
      scopes: this.env.SHOPIFY_SCOPES.split(',').map((scope) => scope.trim()),
      redirectUri,
      state,
    });

    return { authorizeUrl };
  }

  async handleCallback(query: OAuthCallbackQuery) {
    const shop = pickString(query.shop);
    const code = pickString(query.code);
    const state = pickString(query.state);

    if (!shop || !code || !state) {
      throw new BadRequestException('Missing callback parameters');
    }

    const host = pickString(query.host) ?? toShopifyHostParam(shop);

    if (!this.stateStore.consumeState(state)) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    if (!verifyShopifyQueryHmac(query, this.env.SHOPIFY_API_SECRET)) {
      throw new UnauthorizedException('Invalid OAuth hmac');
    }

    const tokenPayload = await this.exchangeCodeForToken(shop, code);

    const result = await this.prisma.$transaction(async (tx) => {
      const existingShop = await tx.shop.findUnique({ where: { shopifyDomain: shop } });
      const org =
        existingShop?.orgId
          ? await tx.organization.findUnique({ where: { id: existingShop.orgId } })
          : await tx.organization.create({ data: { name: shop.replace('.myshopify.com', '') } });

      if (!org) {
        throw new UnauthorizedException('Cannot resolve organization');
      }

      const persistedShop = await tx.shop.upsert({
        where: { shopifyDomain: shop },
        create: {
          orgId: org.id,
          shopifyDomain: shop,
          displayName: shop,
          installedAt: new Date(),
          uninstalledAt: null,
        },
        update: {
          installedAt: new Date(),
          uninstalledAt: null,
        },
      });

      await tx.shopifyToken.upsert({
        where: { shopId: persistedShop.id },
        create: {
          shopId: persistedShop.id,
          accessTokenEnc: encryptAesGcm(tokenPayload.accessToken, this.env.LW_ENCRYPTION_KEY_32B),
          scopes: tokenPayload.scope,
        },
        update: {
          accessTokenEnc: encryptAesGcm(tokenPayload.accessToken, this.env.LW_ENCRYPTION_KEY_32B),
          scopes: tokenPayload.scope,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId: persistedShop.orgId,
          shopId: persistedShop.id,
          action: 'auth.install_completed',
          targetType: 'Shop',
          targetId: persistedShop.id,
          metaJson: {
            shop,
            scopes: tokenPayload.scope,
          },
        },
      });

      return persistedShop;
    });

    return {
      shopId: result.id,
      shopDomain: result.shopifyDomain,
      host,
    };
  }

  private async exchangeCodeForToken(shop: string, code: string) {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.env.SHOPIFY_API_KEY,
        client_secret: this.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange code for token');
    }

    const json = (await response.json()) as { access_token?: string; scope?: string };
    if (!json.access_token) {
      throw new UnauthorizedException('Missing access token in Shopify response');
    }

    return {
      accessToken: json.access_token,
      scope: json.scope ?? this.env.SHOPIFY_SCOPES,
    };
  }
}
