import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { CreateDocumentUploadDto } from './documents.dto';
import { DocumentsService } from './documents.service';

@Controller('shops/:shopId/documents')
export class ShopDocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Param('shopId') shopId: string) {
    return this.documentsService.listDocuments(auth.orgId, shopId);
  }

  @Post()
  create(
    @AuthContext() auth: RequestAuthContext,
    @Param('shopId') shopId: string,
    @Body() body: CreateDocumentUploadDto,
  ) {
    const params: {
      orgId: string;
      shopId: string;
      userId: string;
      fileName: string;
      mimeType: string;
      byteSize: number;
      sha256: string;
      vendorHint?: string;
    } = {
      orgId: auth.orgId,
      shopId,
      userId: auth.userId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      byteSize: body.byteSize,
      sha256: body.sha256,
    };

    if (body.vendorHint) {
      params.vendorHint = body.vendorHint;
    }

    return this.documentsService.createDocumentUpload(params);
  }
}
