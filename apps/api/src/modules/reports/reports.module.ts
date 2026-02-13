import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DocumentsModule, BillingModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
