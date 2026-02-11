import { Controller, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

import { AuthContext, RequireRoles } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';

@Controller('actions')
export class ActionsController {
  constructor(@Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService) {}

  @Post(':findingId/approve')
  @RequireRoles(OrgRole.OWNER, OrgRole.MEMBER, OrgRole.AGENCY_ADMIN)
  async approve(@AuthContext() auth: RequestAuthContext, @Param('findingId') findingId: string) {
    const actionRequest = await this.tenantPrisma.approveActionForFinding(
      auth.orgId,
      findingId,
      auth.userId,
    );

    if (!actionRequest) {
      throw new NotFoundException('Finding not found');
    }

    return actionRequest;
  }
}
