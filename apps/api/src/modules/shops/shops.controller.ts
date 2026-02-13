import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';

import { AuthContext, RequireRoles } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { InstalledAppsSyncDto } from './installed-apps-sync.dto';
import { UpdateShopSettingsDto } from './update-shop-settings.dto';

@Controller('shops')
export class ShopsController {
  constructor(
    @Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService,
    @Inject(ReportsService) private readonly reportsService: ReportsService,
  ) {}

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

  @Get(':shopId/findings')
  listFindings(@AuthContext() auth: RequestAuthContext, @Param('shopId') shopId: string) {
    return this.tenantPrisma.listFindings(auth.orgId, shopId);
  }

  @Get(':shopId/summary')
  summary(@AuthContext() auth: RequestAuthContext, @Param('shopId') shopId: string) {
    return this.reportsService.getSummary(auth.orgId, shopId);
  }

  @Get(':shopId/settings')
  async getSettings(@AuthContext() auth: RequestAuthContext, @Param('shopId') shopId: string) {
    const settings = await this.tenantPrisma.getShopSettings(auth.orgId, shopId);
    if (!settings) {
      throw new NotFoundException('Shop not found');
    }
    return settings;
  }

  @Patch(':shopId/settings')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER)
  async updateSettings(
    @AuthContext() auth: RequestAuthContext,
    @Param('shopId') shopId: string,
    @Body() body: UpdateShopSettingsDto,
  ) {
    const updated = await this.tenantPrisma.updateShopSettings(
      auth.orgId,
      shopId,
      auth.userId,
      body,
    );
    if (!updated) {
      throw new NotFoundException('Shop not found');
    }
    return updated;
  }

  @Post(':shopId/installed-apps/sync')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async syncInstalledApps(
    @AuthContext() auth: RequestAuthContext,
    @Param('shopId') shopId: string,
    @Body() body: InstalledAppsSyncDto,
  ) {
    const synced = await this.tenantPrisma.syncInstalledAppsSnapshot({
      orgId: auth.orgId,
      shopId,
      userId: auth.userId,
      installedApps: body.installedApps,
      ...(body.source ? { source: body.source } : {}),
    });
    if (!synced) {
      throw new NotFoundException('Shop not found');
    }
    return synced;
  }
}
