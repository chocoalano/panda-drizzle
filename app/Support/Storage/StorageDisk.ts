export type StorageVisibility = "public" | "private";

export type StorageContents = ArrayBuffer | Blob | string | Uint8Array;

export type StoragePutOptions = {
  contentType?: string;
  metadata?: Record<string, string>;
  visibility?: StorageVisibility;
};

export type TemporaryUrlOptions = {
  expiresInSeconds?: number;
};

export type StoredFile = {
  contentType?: string;
  path: string;
  size?: number;
  visibility: StorageVisibility;
};

export interface StorageDisk {
  delete(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  get(path: string): Promise<Uint8Array>;
  put(
    path: string,
    contents: StorageContents,
    options?: StoragePutOptions
  ): Promise<StoredFile>;
  setVisibility(path: string, visibility: StorageVisibility): Promise<void>;
  temporaryUrl(path: string, expiresInSeconds?: number): Promise<string>;
  text(path: string): Promise<string>;
  url(path: string): string;
  visibility(path: string): Promise<StorageVisibility>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code = "STORAGE_ERROR"
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class StoragePathError extends StorageError {
  constructor(message: string) {
    super(message, "INVALID_STORAGE_PATH");
    this.name = "StoragePathError";
  }
}

export class StorageFileNotFoundError extends StorageError {
  constructor(path: string) {
    super(`Storage file not found: ${path}`, "FILE_NOT_FOUND");
    this.name = "StorageFileNotFoundError";
  }
}

export function normalizeStoragePath(path: string) {
  const normalized = path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    normalized.length === 0 ||
    normalized.some((segment) => segment === "." || segment === "..")
  ) {
    throw new StoragePathError(`Invalid storage path: ${path}`);
  }

  return normalized.join("/");
}

export async function contentsToUint8Array(contents: StorageContents) {
  if (typeof contents === "string") {
    return new TextEncoder().encode(contents);
  }

  if (contents instanceof Uint8Array) {
    return contents;
  }

  if (contents instanceof ArrayBuffer) {
    return new Uint8Array(contents);
  }

  return new Uint8Array(await contents.arrayBuffer());
}

export function normalizeStorageVisibility(
  value: string | undefined,
  fallback: StorageVisibility = "private"
): StorageVisibility {
  const visibility = value?.trim().toLowerCase();

  return visibility === "public" || visibility === "private"
    ? visibility
    : fallback;
}

export function joinStorageUrl(baseUrl: string, path: string) {
  const normalizedPath = normalizeStoragePath(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl.replace(/\/+$/, "")}/${normalizedPath}`;
}
