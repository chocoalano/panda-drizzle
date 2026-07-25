import {
  chmod,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import {
  StorageError,
  StorageFileNotFoundError,
  contentsToUint8Array,
  joinStorageUrl,
  normalizeStoragePath,
  type StorageContents,
  type StorageDisk,
  type StoragePutOptions,
  type StorageVisibility,
} from "./StorageDisk";

export type LocalStorageDiskConfig = {
  driver: "local";
  root: string;
  url?: string;
  visibility: StorageVisibility;
};

const fileModes = {
  private: 0o600,
  public: 0o644,
} satisfies Record<StorageVisibility, number>;

const directoryModes = {
  private: 0o700,
  public: 0o755,
} satisfies Record<StorageVisibility, number>;

export class LocalStorageDisk implements StorageDisk {
  private readonly root: string;

  constructor(private readonly config: LocalStorageDiskConfig) {
    this.root = resolve(config.root);
  }

  async put(
    path: string,
    contents: StorageContents,
    options: StoragePutOptions = {}
  ) {
    const visibility = options.visibility ?? this.config.visibility;
    const storagePath = this.resolvePath(path);
    const bytes = await contentsToUint8Array(contents);

    await mkdir(dirname(storagePath.absolutePath), {
      mode: directoryModes[visibility],
      recursive: true,
    });
    await writeFile(storagePath.absolutePath, bytes);
    await chmod(storagePath.absolutePath, fileModes[visibility]);

    return {
      contentType: options.contentType,
      path: storagePath.path,
      size: bytes.byteLength,
      visibility,
    };
  }

  async get(path: string) {
    const storagePath = this.resolvePath(path);

    try {
      return await readFile(storagePath.absolutePath);
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new StorageFileNotFoundError(storagePath.path);
      }

      throw error;
    }
  }

  async text(path: string) {
    return new TextDecoder().decode(await this.get(path));
  }

  async exists(path: string) {
    return stat(this.resolvePath(path).absolutePath)
      .then(() => true)
      .catch((error) => {
        if (isMissingFileError(error)) {
          return false;
        }

        throw error;
      });
  }

  async delete(path: string) {
    const storagePath = this.resolvePath(path);

    try {
      await rm(storagePath.absolutePath);

      return true;
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }

      throw error;
    }
  }

  url(path: string) {
    const storagePath = this.resolvePath(path);

    if (!this.config.url) {
      throw new StorageError("This local disk does not expose a public URL.");
    }

    return joinStorageUrl(this.config.url, storagePath.path);
  }

  async temporaryUrl(path: string) {
    if (this.config.visibility !== "public") {
      throw new StorageError(
        "Temporary URLs are only supported by remote disks or public local disks."
      );
    }

    return this.url(path);
  }

  async visibility(path: string) {
    const mode = (await stat(this.resolvePath(path).absolutePath)).mode;

    return mode & 0o004 ? "public" : "private";
  }

  async setVisibility(path: string, visibility: StorageVisibility) {
    await chmod(this.resolvePath(path).absolutePath, fileModes[visibility]);
  }

  private resolvePath(path: string) {
    const normalizedPath = normalizeStoragePath(path);
    const absolutePath = resolve(this.root, normalizedPath);
    const relativePath = relative(this.root, absolutePath);

    if (
      relativePath.startsWith("..") ||
      isAbsolute(relativePath) ||
      relativePath.length === 0
    ) {
      throw new StorageError(`Path escapes the storage root: ${path}`);
    }

    return {
      absolutePath,
      path: normalizedPath,
    };
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
