import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

import { getApiEnv } from '../../../config/env';

@Injectable()
export class StorageClient {
  private readonly env = getApiEnv();
  private readonly client = new S3Client({
    region: this.env.R2_REGION,
    endpoint: this.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: this.env.R2_ACCESS_KEY_ID,
      secretAccessKey: this.env.R2_SECRET_ACCESS_KEY,
    },
  });

  async presignPut(params: {
    key: string;
    contentType: string;
    byteSize: number;
    expiresSec: number;
  }) {
    const command = new PutObjectCommand({
      Bucket: this.env.R2_BUCKET,
      Key: params.key,
      ContentType: params.contentType,
      ContentLength: params.byteSize,
    });

    return getSignedUrl(this.client, command, { expiresIn: params.expiresSec });
  }

  async presignGet(key: string, expiresSec: number) {
    const command = new GetObjectCommand({
      Bucket: this.env.R2_BUCKET,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresSec });
  }

  async headObject(key: string) {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: key,
      }),
    );

    return response;
  }

  async getObject(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`R2 object not found for key: ${key}`);
    }

    const uint8 = await response.Body.transformToByteArray();
    return Buffer.from(uint8);
  }
}
