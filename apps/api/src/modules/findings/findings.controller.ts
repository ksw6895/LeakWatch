import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';

@Controller('findings')
export class FindingsController {
  constructor(@Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.tenantPrisma.listFindings(auth.orgId, shopId ?? auth.shopId);
  }

  @Get(':id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const finding = await this.tenantPrisma.getFinding(auth.orgId, id);
    if (!finding) {
      throw new NotFoundException('Finding not found');
    }
    return finding;
  }
}
