import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';

@Controller('shops')
export class ShopsController {
  constructor(@Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext) {
    return this.tenantPrisma.listShops(auth.orgId);
  }

  @Get(':shopId')
  async get(@AuthContext() auth: RequestAuthContext, @Param('shopId') shopId: string) {
    const shop = await this.tenantPrisma.getShop(auth.orgId, shopId);
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }
    return shop;
  }
}
