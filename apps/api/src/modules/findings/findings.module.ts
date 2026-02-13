import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { DocumentsModule } from '../documents/documents.module';
import { FindingsController } from './findings.controller';

@Module({
  imports: [DocumentsModule, BillingModule],
  controllers: [FindingsController],
})
export class FindingsModule {}
