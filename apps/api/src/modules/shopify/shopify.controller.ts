import {
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../auth/auth.decorators';
import type { RequestWithAuth } from '../auth/auth.types';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyWebhookService } from './shopify-webhook.service';

@Controller('shopify')
@Public()
export class ShopifyController {
  constructor(
    @Inject(ShopifyAuthService) private readonly shopifyAuthService: ShopifyAuthService,
    @Inject(ShopifyWebhookService) private readonly shopifyWebhookService: ShopifyWebhookService,
  ) {}

  @Get('auth/start')
  start(@Query('shop') shop: string, @Res() res: Response) {
    const { authorizeUrl } = this.shopifyAuthService.startAuth(shop);
    res.redirect(authorizeUrl);
  }

  @Get('auth/callback')
  async callback(
    @Query() query: Record<string, string | string[] | undefined>,
    @Res() res: Response,
  ) {
    const { shopDomain, host } = await this.shopifyAuthService.handleCallback(query);
    const appUrl = new URL('/app', process.env.SHOPIFY_APP_URL ?? 'http://localhost:3000');
    appUrl.searchParams.set('shop', shopDomain);
    if (host) {
      appUrl.searchParams.set('host', host);
    }

    res.redirect(appUrl.toString());
  }

  @Post('webhooks/app-uninstalled')
  async appUninstalled(
    @Req() req: RequestWithAuth,
    @Headers('x-shopify-hmac-sha256') signature: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
  ) {
    return this.shopifyWebhookService.handleUninstall({
      signature,
      shopDomain,
      rawBody: req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8'),
    });
  }
}
