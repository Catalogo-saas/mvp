import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;

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

export async function uploadPublicObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  if (!bucket) {
    throw new Error("Missing S3_BUCKET");
  }

  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType
    })
  );

  const baseUrl = process.env.PUBLIC_FILE_BASE_URL;
  if (!baseUrl) {
    return `${process.env.S3_ENDPOINT}/${bucket}/${input.key}`;
  }

  return `${baseUrl.replace(/\/$/, "")}/${input.key}`;
}

export async function deletePublicObject(key: string) {
  if (!bucket) {
    throw new Error("Missing S3_BUCKET");
  }

  await getStorageClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
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
