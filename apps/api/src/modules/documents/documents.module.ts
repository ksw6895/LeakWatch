import { Module } from '@nestjs/common';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { QueueService } from './queue.service';
import { ShopDocumentsController } from './shop-documents.controller';
import { StorageClient } from './storage/storage.client';

@Module({
  controllers: [DocumentsController, ShopDocumentsController],
  providers: [DocumentsService, StorageClient, QueueService],
  exports: [StorageClient, QueueService],
})
export class DocumentsModule {}
