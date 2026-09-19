"use client";

import imageCompression from "browser-image-compression";

import {
  GIF_MAX_BYTES,
  IMAGE_MAX_DIMENSION,
  imageMimeTypes,
  STATIC_IMAGE_MAX_INPUT_BYTES,
  STATIC_IMAGE_MAX_OUTPUT_BYTES,
  type ImageReference,
  type ImageMimeType,
  type UploadFailureReport,
  type ImageUploadScope
} from "./image-upload-contract";

const acceptedMimeTypes = new Set<string>(imageMimeTypes);
const GENERIC_UPLOAD_ERROR = "No pudimos subir las imágenes. Revisá tu conexión e intentá nuevamente.";
const MAX_OPTIMIZATION_CONCURRENCY = 3;
const MAX_UPLOAD_CONCURRENCY = 4;
const MAX_PRESIGN_BATCH_SIZE = 6;

type DirectUploadTask = {
  scope: ImageUploadScope;
  file: File;
};

type PreparedUpload = DirectUploadTask & {
  file: File;
};

type PresignedUpload = {
  uploadUrl: string;
  pendingKey: string;
};

const optimizedImages = new WeakMap<File, Promise<File>>();
const uploadedImages = new WeakMap<File, Map<ImageUploadScope, Promise<ImageReference>>>();
const optimizationQueue: Array<() => void> = [];
let activeOptimizations = 0;

export class ImageUploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImageUploadError";
  }
}

export function getImageUploadErrorMessage(error: unknown) {
  return error instanceof ImageUploadError ? error.message : null;
}

function megabytes(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}

export function validateSelectedImage(file: File) {
  if (!acceptedMimeTypes.has(file.type)) {
    return "Formato no soportado. Usá JPG, PNG, WebP o GIF.";
  }
  const limit = file.type === "image/gif" ? GIF_MAX_BYTES : STATIC_IMAGE_MAX_INPUT_BYTES;
  if (file.size > limit) {
    return `La imagen no puede superar ${megabytes(limit)} MB.`;
  }
  return null;
}

function runOptimization<T>(operation: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeOptimizations += 1;
      void operation()
        .then(resolve, reject)
        .finally(() => {
          activeOptimizations -= 1;
          optimizationQueue.shift()?.();
        });
    };

    if (activeOptimizations < MAX_OPTIMIZATION_CONCURRENCY) {
      start();
    } else {
      optimizationQueue.push(start);
    }
  });
}

async function optimizeImageUncached(file: File) {
  const validationError = validateSelectedImage(file);
  if (validationError) throw new ImageUploadError(validationError);
  if (file.type === "image/gif") return file;

  let optimized: File;
  try {
    optimized = await imageCompression(file, {
      fileType: "image/webp",
      maxSizeMB: 2,
      maxWidthOrHeight: IMAGE_MAX_DIMENSION,
      preserveExif: false,
      useWebWorker: true
    });
  } catch (error) {
    console.error("[image-upload] Browser optimization failed", error);
    throw new ImageUploadError("No pudimos preparar una de las imágenes. Probá con otro archivo.", { cause: error });
  }
  if (optimized.size > STATIC_IMAGE_MAX_OUTPUT_BYTES) {
    throw new ImageUploadError("No pudimos reducir una de las imágenes al tamaño permitido.");
  }
  return new File([optimized], file.name.replace(/\.[^.]+$/, "") + ".webp", {
    type: "image/webp",
    lastModified: file.lastModified
  });
}

export function optimizeImage(file: File) {
  const cached = optimizedImages.get(file);
  if (cached) return cached;

  const optimization = runOptimization(() => optimizeImageUncached(file));
  optimizedImages.set(file, optimization);
  void optimization.catch(() => {
    if (optimizedImages.get(file) === optimization) optimizedImages.delete(file);
  });
  return optimization;
}

async function requestUploads(tasks: PreparedUpload[]) {
  let response: Response;
  try {
    response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploads: tasks.map(({ scope, file }) => ({ scope, contentType: file.type, size: file.size }))
      })
    });
  } catch (error) {
    console.error("[image-upload] Presign request failed", error);
    throw new ImageUploadError(GENERIC_UPLOAD_ERROR, { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      throw new ImageUploadError("Tu sesión venció. Volvé a ingresar e intentá nuevamente.");
    }
    if (response.status === 400 && typeof data?.error === "string") {
      throw new ImageUploadError(data.error);
    }
    throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
  }
  if (!Array.isArray(data?.uploads) || data.uploads.length !== tasks.length) {
    console.error("[image-upload] Presign response was invalid");
    throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
  }
  return data.uploads as PresignedUpload[];
}

function reportUploadFailure(report: UploadFailureReport) {
  void fetch("/api/uploads/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
    keepalive: true
  }).catch(() => null);
}

async function uploadPreparedImage(task: PreparedUpload, initialUpload: PresignedUpload): Promise<ImageReference> {
  const { scope, file } = task;
  const reportBase = {
    stage: "direct-upload",
    scope,
    contentType: file.type as ImageMimeType,
    size: file.size
  } as const;
  let upload = initialUpload;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
    } catch (error) {
      if (attempt === 0) {
        [upload] = await requestUploads([task]);
        continue;
      }
      console.error("[image-upload] Direct upload request failed", error);
      reportUploadFailure({ ...reportBase, reason: "network" });
      throw new ImageUploadError(GENERIC_UPLOAD_ERROR, { cause: error });
    }
    if (response.ok) return { kind: "pending", key: upload.pendingKey };
    if (attempt === 0 && response.status === 403) {
      [upload] = await requestUploads([task]);
      continue;
    }
    if (attempt === 1 || response.status !== 403) {
      console.error("[image-upload] Direct upload returned an error status", response.status);
      reportUploadFailure({ ...reportBase, reason: "http", status: response.status });
      throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
    }
  }

  throw new ImageUploadError(GENERIC_UPLOAD_ERROR);
}

async function uploadImagesDirectUncached(tasks: DirectUploadTask[]): Promise<ImageReference[]> {
  if (tasks.length === 0) return [];

  const prepared = await Promise.all(
    tasks.map(async ({ scope, file }) => ({ scope, file: await optimizeImage(file) }))
  );
  const batches = Array.from(
    { length: Math.ceil(prepared.length / MAX_PRESIGN_BATCH_SIZE) },
    (_, index) => prepared.slice(index * MAX_PRESIGN_BATCH_SIZE, (index + 1) * MAX_PRESIGN_BATCH_SIZE)
  );
  const uploads = (await Promise.all(batches.map(requestUploads))).flat();

  return mapWithConcurrency(prepared, MAX_UPLOAD_CONCURRENCY, (task, index) =>
    uploadPreparedImage(task, uploads[index])
  );
}

function getCachedUpload({ scope, file }: DirectUploadTask) {
  return uploadedImages.get(file)?.get(scope);
}

function cacheUpload(task: DirectUploadTask, upload: Promise<ImageReference>) {
  const uploadsForFile = uploadedImages.get(task.file) ?? new Map<ImageUploadScope, Promise<ImageReference>>();
  uploadsForFile.set(task.scope, upload);
  uploadedImages.set(task.file, uploadsForFile);
  void upload.catch(() => {
    if (uploadsForFile.get(task.scope) === upload) uploadsForFile.delete(task.scope);
  });
}

export function uploadImagesDirect(tasks: DirectUploadTask[]): Promise<ImageReference[]> {
  if (tasks.length === 0) return Promise.resolve([]);

  const references = new Array<Promise<ImageReference>>(tasks.length);
  const uncachedTasks: DirectUploadTask[] = [];
  const uncachedIndexes: number[] = [];

  tasks.forEach((task, index) => {
    const cached = getCachedUpload(task);
    if (cached) {
      references[index] = cached;
    } else {
      uncachedTasks.push(task);
      uncachedIndexes.push(index);
    }
  });

  if (uncachedTasks.length > 0) {
    const batch = uploadImagesDirectUncached(uncachedTasks);
    uncachedTasks.forEach((task, index) => {
      const upload = batch.then((results) => results[index]);
      references[uncachedIndexes[index]] = upload;
      cacheUpload(task, upload);
    });
  }

  return Promise.all(references);
}

export function prepareImageUploads(tasks: DirectUploadTask[]) {
  void uploadImagesDirect(tasks).catch(() => undefined);
}

export function prepareImageUpload(scope: ImageUploadScope, file: File) {
  prepareImageUploads([{ scope, file }]);
}

export async function uploadImageDirect(scope: ImageUploadScope, source: File): Promise<ImageReference> {
  const [reference] = await uploadImagesDirect([{ scope, file: source }]);
  return reference;
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let firstError: unknown;

  async function worker() {
    while (nextIndex < items.length && firstError === undefined) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  if (firstError !== undefined) {
    throw firstError;
  }
  return results;
}
