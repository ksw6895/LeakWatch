import { Module } from '@nestjs/common';

import { ReportsModule } from '../reports/reports.module';
import { ShopsController } from './shops.controller';

@Module({
  imports: [ReportsModule],
  controllers: [ShopsController],
})
export class ShopsModule {}
