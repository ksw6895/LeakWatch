import { Controller, Get, Inject, Query } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';

@Controller('reports')
export class ReportsController {
  constructor(@Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.tenantPrisma.listReports(auth.orgId, shopId ?? auth.shopId);
  }
}
