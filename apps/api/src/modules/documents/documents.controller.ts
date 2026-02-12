import { Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';

import { AuthContext } from '../auth/auth.decorators';
import type { RequestAuthContext } from '../auth/auth.types';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Get()
  list(@AuthContext() auth: RequestAuthContext, @Query('shopId') shopId?: string) {
    return this.documentsService.listDocuments(auth.orgId, shopId ?? auth.shopId);
  }

  @Get(':id')
  async get(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const document = await this.documentsService.getDocument(auth.orgId, id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  @Post(':documentId/versions/:versionId/complete')
  async completeVersion(
    @AuthContext() auth: RequestAuthContext,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    const completed = await this.documentsService.completeDocumentUpload({
      orgId: auth.orgId,
      documentId,
      versionId,
    });

    if (!completed) {
      throw new NotFoundException('Document version not found');
    }

    return completed;
  }

  // Backward compatibility for step-03 sample endpoint.
  @Post(':id/complete')
  async completeLatest(@AuthContext() auth: RequestAuthContext, @Param('id') id: string) {
    const completed = await this.documentsService.completeLatestDocumentUpload({
      orgId: auth.orgId,
      documentId: id,
    });

    if (!completed) {
      throw new NotFoundException('Document not found');
    }

    return completed;
  }
}
