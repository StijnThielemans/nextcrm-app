import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";

export const logikalDrawingStore = {
  async put(key: string, body: Buffer, mime: string) {
    await minioClient.send(new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: body,
      ContentType: mime,
    }));
  },
  async remove(key: string) {
    await minioClient.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  },
  async read(key: string): Promise<Buffer> {
    const object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
    if (!object.Body) throw new Error("empty object");
    return Buffer.from(await object.Body.transformToByteArray());
  },
};
