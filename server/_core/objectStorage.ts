import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getObjectStorageClient() {
  const endpoint =
    process.env.S3_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);

  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId:
        process.env.S3_ACCESS_KEY_ID ||
        process.env.R2_ACCESS_KEY_ID ||
        "",
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ||
        process.env.R2_SECRET_ACCESS_KEY ||
        "",
    },
  });
}

export function getObjectStorageBucket() {
  return (
    process.env.S3_BUCKET ||
    process.env.R2_BUCKET ||
    process.env.R2_BUCKET_NAME ||
    ""
  );
}

export async function uploadPrivateJsonObject(params: {
  key: string;
  json: string;
}) {
  const bucket = getObjectStorageBucket();

  if (!bucket) {
    throw new Error("S3_BUCKET 또는 R2_BUCKET이 설정되지 않았습니다.");
  }

  const client = getObjectStorageClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.json,
      ContentType: "application/json; charset=utf-8",
    })
  );

  return {
    bucket,
    key: params.key,
  };
}
export async function createPrivateDownloadUrl(params: {
  key: string;
  expiresInSeconds?: number;
}) {
  const bucket = getObjectStorageBucket();

  if (!bucket) {
    throw new Error("S3_BUCKET 또는 R2_BUCKET이 설정되지 않았습니다.");
  }

  const client = getObjectStorageClient();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    }),
    {
      expiresIn: params.expiresInSeconds ?? 60 * 5,
    }
  );
}

export async function readPrivateTextObject(params: {
  key: string;
}) {
  const bucket = getObjectStorageBucket();

  if (!bucket) {
    throw new Error("S3_BUCKET 또는 R2_BUCKET이 설정되지 않았습니다.");
  }

  const client = getObjectStorageClient();

  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    })
  );

  const body = await result.Body?.transformToString("utf8");

  if (!body) {
    throw new Error("백업 파일을 읽을 수 없습니다.");
  }

  return body;
}

export async function deletePrivateObject(params: {
  key: string;
}) {
  const bucket = getObjectStorageBucket();

  if (!bucket) {
    throw new Error("S3_BUCKET 또는 R2_BUCKET이 설정되지 않았습니다.");
  }

  if (!params.key?.trim()) {
    return {
      bucket,
      key: params.key,
      deleted: false,
    };
  }

  const client = getObjectStorageClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: params.key,
    })
  );

  return {
    bucket,
    key: params.key,
    deleted: true,
  };
}