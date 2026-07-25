import {
  storageConfig,
  type StorageConfig,
  type StorageDiskConfig,
} from "../../../config/storage";
import { LocalStorageDisk } from "./LocalStorageDisk";
import { S3StorageDisk } from "./S3StorageDisk";
import { StorageError, type StorageDisk } from "./StorageDisk";

export class StorageManager {
  private readonly resolvedDisks = new Map<string, StorageDisk>();

  constructor(private readonly config: StorageConfig = storageConfig) {}

  disk(name = this.config.defaultDisk): StorageDisk {
    const config = this.config.disks[name];

    if (!config) {
      throw new StorageError(`Storage disk is not configured: ${name}`);
    }

    if (!this.resolvedDisks.has(name)) {
      this.resolvedDisks.set(name, this.makeDisk(config));
    }

    return this.resolvedDisks.get(name) as StorageDisk;
  }

  put(...args: Parameters<StorageDisk["put"]>) {
    return this.disk().put(...args);
  }

  get(...args: Parameters<StorageDisk["get"]>) {
    return this.disk().get(...args);
  }

  text(...args: Parameters<StorageDisk["text"]>) {
    return this.disk().text(...args);
  }

  exists(...args: Parameters<StorageDisk["exists"]>) {
    return this.disk().exists(...args);
  }

  delete(...args: Parameters<StorageDisk["delete"]>) {
    return this.disk().delete(...args);
  }

  url(...args: Parameters<StorageDisk["url"]>) {
    return this.disk().url(...args);
  }

  temporaryUrl(...args: Parameters<StorageDisk["temporaryUrl"]>) {
    return this.disk().temporaryUrl(...args);
  }

  setVisibility(...args: Parameters<StorageDisk["setVisibility"]>) {
    return this.disk().setVisibility(...args);
  }

  visibility(...args: Parameters<StorageDisk["visibility"]>) {
    return this.disk().visibility(...args);
  }

  private makeDisk(config: StorageDiskConfig) {
    if (config.driver === "local") {
      return new LocalStorageDisk(config);
    }

    return new S3StorageDisk(config);
  }
}

export const storage = new StorageManager();

export function disk(name?: string) {
  return storage.disk(name);
}
