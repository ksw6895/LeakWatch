import { Body, Controller, Get, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

import { AuthContext, RequireRoles } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { AttachConnectCodeDto } from './connect-code.dto';
import { AgencyService } from './agency.service';

@Controller()
export class AgencyController {
  constructor(@Inject(AgencyService) private readonly agencyService: AgencyService) {}

  @Get('orgs/:orgId/shops')
  listOrgShops(@AuthContext() auth: RequestAuthContext, @Param('orgId') orgId: string) {
    if (auth.orgId !== orgId) {
      throw new UnauthorizedException('Cross-org access denied');
    }
    return this.agencyService.listOrgShops(orgId);
  }

  @Get('orgs/:orgId/summary')
  summary(@AuthContext() auth: RequestAuthContext, @Param('orgId') orgId: string) {
    if (auth.orgId !== orgId) {
      throw new UnauthorizedException('Cross-org access denied');
    }
    return this.agencyService.getOrgSummary(orgId);
  }

  @Post('orgs/:orgId/connect-codes')
  @RequireRoles(OrgRole.OWNER, OrgRole.AGENCY_ADMIN)
  createConnectCode(@AuthContext() auth: RequestAuthContext, @Param('orgId') orgId: string) {
    if (auth.orgId !== orgId) {
      throw new UnauthorizedException('Cross-org access denied');
    }
    return this.agencyService.createConnectCode(orgId, auth.userId);
  }

  @Post('shops/:shopId/connect-code')
  @RequireRoles(OrgRole.OWNER, OrgRole.AGENCY_ADMIN)
  attachShop(@Param('shopId') shopId: string, @Body() body: AttachConnectCodeDto) {
    return this.agencyService.attachShopToOrg(body.code, shopId);
  }
}
