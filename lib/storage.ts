import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET;

function requireBucket() {
  if (!bucket) {
    throw new Error("Missing S3_BUCKET");
  }
  return bucket;
}

export function getPublicObjectUrl(key: string) {
  const currentBucket = requireBucket();
  const baseUrl = process.env.PUBLIC_FILE_BASE_URL;
  if (!baseUrl) {
    return `${process.env.S3_ENDPOINT}/${currentBucket}/${key}`;
  }

  return `${baseUrl.replace(/\/$/, "")}/${key}`;
}

export function getStorageClient() {
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("Missing S3-compatible storage configuration");
  }

  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });
}

export async function createPresignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: input.key,
    ContentType: input.contentType
  });

  return getSignedUrl(getStorageClient(), command, { expiresIn: input.expiresIn ?? 300 });
}

export async function inspectObject(key: string) {
  const response = await getStorageClient().send(
    new HeadObjectCommand({ Bucket: requireBucket(), Key: key })
  );

  return {
    contentLength: response.ContentLength ?? 0,
    contentType: response.ContentType ?? "",
    etag: response.ETag
  };
}

export async function readObjectPrefix(key: string, byteCount = 16) {
  const response = await getStorageClient().send(
    new GetObjectCommand({
      Bucket: requireBucket(),
      Key: key,
      Range: `bytes=0-${Math.max(0, byteCount - 1)}`
    })
  );
  if (!response.Body) {
    throw new Error("Missing object body");
  }
  return response.Body.transformToByteArray();
}

export async function copyPublicObject(input: {
  sourceKey: string;
  destinationKey: string;
  contentType: string;
  sourceEtag?: string;
}) {
  const currentBucket = requireBucket();
  await getStorageClient().send(
    new CopyObjectCommand({
      Bucket: currentBucket,
      Key: input.destinationKey,
      CopySource: `${currentBucket}/${input.sourceKey}`,
      CopySourceIfMatch: input.sourceEtag,
      MetadataDirective: "REPLACE",
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable"
    })
  );
  return getPublicObjectUrl(input.destinationKey);
}

export async function deletePublicObject(key: string) {
  const currentBucket = requireBucket();

  await getStorageClient().send(
    new DeleteObjectCommand({
      Bucket: currentBucket,
      Key: key
    })
  );
}

export function getPublicObjectKeyFromUrl(fileUrl: string) {
  const baseUrl = process.env.PUBLIC_FILE_BASE_URL?.replace(/\/$/, "");
  if (baseUrl && fileUrl.startsWith(`${baseUrl}/`)) {
    return decodeURIComponent(fileUrl.slice(baseUrl.length + 1));
  }

  if (!process.env.S3_ENDPOINT || !bucket) {
    return null;
  }

  try {
    const parsedFileUrl = new URL(fileUrl);
    const parsedEndpointUrl = new URL(process.env.S3_ENDPOINT);
    if (parsedFileUrl.origin !== parsedEndpointUrl.origin) {
      return null;
    }

    const prefix = `/${bucket}/`;
    if (!parsedFileUrl.pathname.startsWith(prefix)) {
      return null;
    }

    return decodeURIComponent(parsedFileUrl.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}
