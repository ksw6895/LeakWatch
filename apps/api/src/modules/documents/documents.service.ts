import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { DocStatus } from '@prisma/client';

import { RateLimiterService } from '../../common/rate-limiter.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  PRESIGNED_URL_EXPIRES_SECONDS,
} from './documents.constants';
import { QueueService } from './queue.service';
import { StorageClient } from './storage/storage.client';

type CreateUploadParams = {
  orgId: string;
  shopId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  vendorHint?: string;
};

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageClient) private readonly storageClient: StorageClient,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(BillingService) private readonly billingService: BillingService,
    @Inject(RateLimiterService) private readonly rateLimiter: RateLimiterService,
  ) {}

  async listDocuments(orgId: string, shopId: string) {
    return this.prisma.document.findMany({
      where: { orgId, shopId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocument(orgId: string, documentId: string) {
    return this.prisma.document.findFirst({
      where: { orgId, id: documentId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async createDocumentUpload(params: CreateUploadParams) {
    const uploadRate = this.rateLimiter.consume(`upload:${params.orgId}`, 30, 60);
    if (!uploadRate.allowed) {
      throw new ForbiddenException('RATE_LIMIT_EXCEEDED_UPLOAD');
    }

    const entitlement = await this.billingService.canUpload(params.orgId, params.shopId);
    if (!entitlement.allowed) {
      throw new ForbiddenException('UPLOAD_LIMIT_EXCEEDED');
    }

    if (params.byteSize > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('FILE_TOO_LARGE');
    }

    if (
      !ALLOWED_UPLOAD_MIME_TYPES.includes(
        params.mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number],
      )
    ) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_MIME_TYPE');
    }

    const shop = await this.prisma.shop.findFirst({
      where: { id: params.shopId, orgId: params.orgId, uninstalledAt: null },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (!/^[a-fA-F0-9]{64}$/.test(params.sha256)) {
      throw new BadRequestException('INVALID_SHA256');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          orgId: params.orgId,
          shopId: params.shopId,
          createdByUserId: params.userId,
          vendorHint: params.vendorHint ?? null,
        },
      });

      const safeFileName = sanitizeFileName(params.fileName) || 'invoice';
      const storageKey = `org/${params.orgId}/shop/${params.shopId}/documents/${document.id}/versions/1/${params.sha256}/${safeFileName}`;

      const version = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          mimeType: params.mimeType,
          fileName: params.fileName,
          byteSize: params.byteSize,
          sha256: params.sha256.toLowerCase(),
          storageKey,
          status: DocStatus.CREATED,
        },
      });

      return { document, version, storageKey };
    });

    const uploadUrl = await this.storageClient.presignPut({
      key: created.storageKey,
      contentType: params.mimeType,
      byteSize: params.byteSize,
      expiresSec: PRESIGNED_URL_EXPIRES_SECONDS,
    });

    await this.billingService.incrementUsage(params.orgId, params.shopId, 'uploads_created', 1);

    return {
      documentId: created.document.id,
      versionId: created.version.id,
      version: created.version.version,
      storageKey: created.storageKey,
      uploadUrl,
      expiresInSec: PRESIGNED_URL_EXPIRES_SECONDS,
    };
  }

  async completeDocumentUpload(params: { orgId: string; documentId: string; versionId: string }) {
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        id: params.versionId,
        documentId: params.documentId,
        document: {
          orgId: params.orgId,
        },
      },
      include: {
        document: true,
      },
    });

    if (!version) {
      return null;
    }

    await this.prisma.documentVersion.update({
      where: { id: version.id },
      data: {
        status: DocStatus.UPLOADED,
      },
    });

    const queuedJobId = await this.queueService.enqueueIngest(version.id);

    return {
      documentId: version.documentId,
      versionId: version.id,
      status: DocStatus.UPLOADED,
      queuedJobId,
    };
  }

  async completeLatestDocumentUpload(params: { orgId: string; documentId: string }) {
    const latestVersion = await this.prisma.documentVersion.findFirst({
      where: {
        documentId: params.documentId,
        document: {
          orgId: params.orgId,
        },
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!latestVersion) {
      return null;
    }

    return this.completeDocumentUpload({
      orgId: params.orgId,
      documentId: params.documentId,
      versionId: latestVersion.id,
    });
  }
}
