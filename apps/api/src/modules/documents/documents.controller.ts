import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { TenantPrismaService } from '../auth/tenant-prisma.service';

@Controller('documents')
export class DocumentsController {
  constructor(@Inject(TenantPrismaService) private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.tenantPrisma.listDocuments(auth.orgId, shopId ?? auth.shopId);
  }

  @Get(':id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const document = await this.tenantPrisma.getDocument(auth.orgId, id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  @Post()
  create(
    @AuthContext() auth: RequestAuthContext,
    @Body() body: { shopId?: string; vendorHint?: string },
  ) {
    const params: {
      orgId: string;
      shopId: string;
      createdByUserId: string;
      vendorHint?: string;
    } = {
      orgId: auth.orgId,
      shopId: body.shopId ?? auth.shopId,
      createdByUserId: auth.userId,
    };

    if (body.vendorHint) {
      params.vendorHint = body.vendorHint;
    }

    return this.tenantPrisma.createDocument({
      ...params,
    });
  }

  @Post(':id/complete')
  async complete(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const document = await this.tenantPrisma.completeDocument(auth.orgId, id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }
}
