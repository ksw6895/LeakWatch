import { Module } from '@nestjs/common';

import { RateLimiterService } from '../../common/rate-limiter.service';
import { BillingModule } from '../billing/billing.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { QueueService } from './queue.service';
import { ShopDocumentsController } from './shop-documents.controller';
import { StorageClient } from './storage/storage.client';

@Module({
  imports: [BillingModule],
  controllers: [DocumentsController, ShopDocumentsController],
  providers: [DocumentsService, StorageClient, QueueService, RateLimiterService],
  exports: [StorageClient, QueueService],
})
export class DocumentsModule {}
