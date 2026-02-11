import { Module } from '@nestjs/common';

import { ShopifyController } from './shopify.controller';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyAuthStateStore } from './shopify-auth-state.store';
import { ShopifyWebhookService } from './shopify-webhook.service';

@Module({
  controllers: [ShopifyController],
  providers: [ShopifyAuthStateStore, ShopifyAuthService, ShopifyWebhookService],
  exports: [ShopifyAuthService],
})
export class ShopifyModule {}
