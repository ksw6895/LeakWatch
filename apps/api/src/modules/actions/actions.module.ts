import { Module } from '@nestjs/common';

import { RateLimiterService } from '../../common/rate-limiter.service';
import { BillingModule } from '../billing/billing.module';
import { DocumentsModule } from '../documents/documents.module';
import { ActionsController } from './actions.controller';

@Module({
  imports: [DocumentsModule, BillingModule],
  controllers: [ActionsController],
  providers: [RateLimiterService],
})
export class ActionsModule {}
