import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { PRESIGNED_URL_EXPIRES_SECONDS } from '../documents/documents.constants';
import { StorageClient } from '../documents/storage/storage.client';

@Injectable()
export class EvidenceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageClient) private readonly storageClient: StorageClient,
  ) {}

  async getDownloadUrl(orgId: string, actionRequestId: string) {
    const actionRequest = await this.prisma.actionRequest.findFirst({
      where: {
        id: actionRequestId,
        orgId,
      },
      select: {
        id: true,
        attachmentKey: true,
      },
    });

    if (!actionRequest?.attachmentKey) {
      return null;
    }

    const downloadUrl = await this.storageClient.presignGet(
      actionRequest.attachmentKey,
      PRESIGNED_URL_EXPIRES_SECONDS,
    );

    return {
      actionRequestId: actionRequest.id,
      attachmentKey: actionRequest.attachmentKey,
      downloadUrl,
      expiresInSec: PRESIGNED_URL_EXPIRES_SECONDS,
    };
  }
}
