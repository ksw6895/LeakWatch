import { Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ReportPeriod } from '@prisma/client';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.reportsService.listReports(auth.orgId, shopId ?? auth.shopId);
  }

  @Get(':id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const report = await this.reportsService.getReport(auth.orgId, id);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  @Post('generate')
  generate(
    @AuthContext() auth: RequestAuthContext,
    @Query('shopId') shopId?: string,
    @Query('period') period?: string,
    @Query('force') force?: string,
  ) {
    const targetPeriod =
      period?.toUpperCase() === 'WEEKLY' ? ReportPeriod.WEEKLY : ReportPeriod.MONTHLY;
    const forceReplace = force === '1' || force?.toLowerCase() === 'true';
    return this.reportsService.enqueueGenerate(auth.orgId, shopId ?? auth.shopId, targetPeriod, {
      force: forceReplace,
    });
  }
}
