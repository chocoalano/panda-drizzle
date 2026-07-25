import { isAbsolute, resolve } from "node:path";

import type { LocalStorageDiskConfig } from "../app/Support/Storage/LocalStorageDisk";
import type { S3StorageDiskConfig } from "../app/Support/Storage/S3StorageDisk";
import { normalizeStorageVisibility } from "../app/Support/Storage/StorageDisk";
import { env, envBoolean } from "./env";

export type StorageDiskName = "local" | "public" | "s3";

export type StorageDiskConfig = LocalStorageDiskConfig | S3StorageDiskConfig;

export type StorageConfig = {
  defaultDisk: string;
  disks: Record<string, StorageDiskConfig>;
};

const s3Region = env("AWS_DEFAULT_REGION", "us-east-1");
const defaultS3Endpoint = `https://s3.${s3Region}.amazonaws.com`;

export const storageConfig: StorageConfig = {
  defaultDisk: normalizeStorageDisk(env("FILESYSTEM_DISK", "local")),
  disks: {
    local: {
      driver: "local",
      root: storageRoot(env("STORAGE_LOCAL_ROOT"), "storage/app/private"),
      visibility: "private",
    },
    public: {
      driver: "local",
      root: storageRoot(env("STORAGE_PUBLIC_ROOT"), "storage/app/public"),
      url: normalizeStorageUrl(env("STORAGE_PUBLIC_URL", "/storage")),
      visibility: "public",
    },
    s3: {
      accessKeyId: env("AWS_ACCESS_KEY_ID"),
      bucket: env("AWS_BUCKET"),
      cdnUrl: normalizeStorageUrl(env("AWS_CDN_URL", env("STORAGE_CDN_URL"))),
      driver: "s3",
      endpoint: normalizeStorageUrl(env("AWS_ENDPOINT", defaultS3Endpoint)) ??
        defaultS3Endpoint,
      forcePathStyle: envBoolean("AWS_USE_PATH_STYLE_ENDPOINT"),
      region: s3Region,
      secretAccessKey: env("AWS_SECRET_ACCESS_KEY"),
      sessionToken: env("AWS_SESSION_TOKEN") || undefined,
      temporaryUrlExpiresIn: positiveInteger(
        env("AWS_TEMPORARY_URL_EXPIRES"),
        300
      ),
      useAcl: envBoolean("AWS_USE_ACL", true),
      visibility: normalizeStorageVisibility(env("AWS_VISIBILITY"), "private"),
    },
  },
};

export type FilesystemConfig = typeof storageConfig;

export function normalizeStorageDisk(
  value: string | undefined,
  fallback: StorageDiskName = "local"
): StorageDiskName {
  const disk = value?.trim().toLowerCase();

  return disk === "local" || disk === "public" || disk === "s3"
    ? disk
    : fallback;
}

export function storageRoot(value: string | undefined, fallback: string) {
  const root = value?.trim() || fallback;

  return isAbsolute(root) ? resolve(root) : resolve(process.cwd(), root);
}

export function normalizeStorageUrl(value: string | undefined) {
  const url = value?.trim();

  return url ? url.replace(/\/+$/, "") : undefined;
}

export function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
