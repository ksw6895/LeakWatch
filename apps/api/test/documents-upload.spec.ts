import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { INGEST_DOCUMENT_JOB_NAME, INGESTION_QUEUE_NAME } from '@leakwatch/shared';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Documents upload flow', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let connection: IORedis;
  let queue: Queue;

  beforeAll(async () => {
    app = await createTestApp();

    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    queue = new Queue(INGESTION_QUEUE_NAME, { connection });
  });

  beforeEach(async () => {
    await resetDatabase();
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await queue.close();
    await connection.quit();
    await app.close();
    await prisma.$disconnect();
  });

  it('creates document upload and enqueues ingest job on complete', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Upload' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'upload.myshopify.com',
        installedAt: new Date(),
      },
    });

    const token = await createSessionToken({ sub: 'uploader-sub', shopDomain: shop.shopifyDomain });

    const createResponse = await request(app.getHttpServer())
      .post(`/v1/shops/${shop.id}/documents`)
      .set('authorization', `Bearer ${token}`)
      .send({
        fileName: 'invoice-march.pdf',
        mimeType: 'application/pdf',
        byteSize: 12000,
        sha256: 'a'.repeat(64),
        vendorHint: 'Acme Apps',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.documentId).toBeTruthy();
    expect(createResponse.body.versionId).toBeTruthy();
    expect(createResponse.body.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');

    const persistedVersion = await prisma.documentVersion.findUnique({
      where: {
        id: createResponse.body.versionId,
      },
    });

    expect(persistedVersion?.status).toBe('CREATED');

    const completeResponse = await request(app.getHttpServer())
      .post(
        `/v1/documents/${createResponse.body.documentId}/versions/${createResponse.body.versionId}/complete`,
      )
      .set('authorization', `Bearer ${token}`)
      .send({});

    expect(completeResponse.status).toBe(201);
    expect(completeResponse.body.status).toBe('UPLOADED');
    expect(completeResponse.body.queuedJobId).toBe(
      `${INGEST_DOCUMENT_JOB_NAME}-${createResponse.body.versionId}`,
    );

    const updatedVersion = await prisma.documentVersion.findUnique({
      where: { id: createResponse.body.versionId },
    });

    expect(updatedVersion?.status).toBe('UPLOADED');

    const queuedJob = await queue.getJob(
      `${INGEST_DOCUMENT_JOB_NAME}-${createResponse.body.versionId}`,
    );
    expect(queuedJob).toBeTruthy();
    expect(queuedJob?.name).toBe(INGEST_DOCUMENT_JOB_NAME);
    expect(queuedJob?.data?.documentVersionId).toBe(createResponse.body.versionId);
  });

  it('returns presigned download URL for document version', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Download' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'download.myshopify.com',
        installedAt: new Date(),
      },
    });

    const token = await createSessionToken({ sub: 'download-sub', shopDomain: shop.shopifyDomain });

    const createResponse = await request(app.getHttpServer())
      .post(`/v1/shops/${shop.id}/documents`)
      .set('authorization', `Bearer ${token}`)
      .send({
        fileName: 'invoice-download.pdf',
        mimeType: 'application/pdf',
        byteSize: 18000,
        sha256: 'd'.repeat(64),
      });

    expect(createResponse.status).toBe(201);

    const downloadResponse = await request(app.getHttpServer())
      .get(
        `/v1/documents/${createResponse.body.documentId}/versions/${createResponse.body.versionId}/download`,
      )
      .set('authorization', `Bearer ${token}`);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.body.documentId).toBe(createResponse.body.documentId);
    expect(downloadResponse.body.versionId).toBe(createResponse.body.versionId);
    expect(downloadResponse.body.downloadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(downloadResponse.body.fileName).toBe('invoice-download.pdf');
  });

  it('rejects unsupported mime type with 415', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Upload 2' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'upload2.myshopify.com',
        installedAt: new Date(),
      },
    });

    const token = await createSessionToken({
      sub: 'uploader-sub-2',
      shopDomain: shop.shopifyDomain,
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/shops/${shop.id}/documents`)
      .set('authorization', `Bearer ${token}`)
      .send({
        fileName: 'invoice.zip',
        mimeType: 'application/zip',
        byteSize: 1000,
        sha256: 'b'.repeat(64),
      });

    expect(response.status).toBe(415);
  });

  it('rejects oversized upload with 413', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Upload 3' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'upload3.myshopify.com',
        installedAt: new Date(),
      },
    });

    const token = await createSessionToken({
      sub: 'uploader-sub-3',
      shopDomain: shop.shopifyDomain,
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/shops/${shop.id}/documents`)
      .set('authorization', `Bearer ${token}`)
      .send({
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        byteSize: 25 * 1024 * 1024,
        sha256: 'c'.repeat(64),
      });

    expect(response.status).toBe(413);
  });
});
