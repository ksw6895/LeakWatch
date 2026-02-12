import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { getWorkerEnv } from '../env';

export class R2StorageClient {
  private readonly env = getWorkerEnv();
  private readonly client = new S3Client({
    region: this.env.R2_REGION,
    endpoint: this.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: this.env.R2_ACCESS_KEY_ID,
      secretAccessKey: this.env.R2_SECRET_ACCESS_KEY,
    },
  });

  async getObject(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`FILE_DOWNLOAD_FAILED: ${key}`);
    }

    const uint8 = await response.Body.transformToByteArray();
    return Buffer.from(uint8);
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async exists(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.env.R2_BUCKET,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
