import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LocalStorageDisk,
  S3StorageDisk,
  StorageError,
  StorageManager,
} from "../../app/Support/Storage";
import type { StorageConfig } from "../../config/storage";

describe("StorageManager", () => {
  it("resolves and caches configured disks", async () => {
    const root = await mkdtemp(join(tmpdir(), "patshop-storage-"));
    const config: StorageConfig = {
      defaultDisk: "public",
      disks: {
        public: {
          driver: "local",
          root,
          url: "/storage",
          visibility: "public",
        },
        s3: {
          accessKeyId: "access-key",
          bucket: "patshop",
          driver: "s3",
          endpoint: "https://s3.example.test",
          region: "ap-southeast-1",
          secretAccessKey: "secret-key",
          temporaryUrlExpiresIn: 300,
          useAcl: true,
          visibility: "private",
        },
      },
    };
    const manager = new StorageManager(config);

    try {
      expect(manager.disk()).toBeInstanceOf(LocalStorageDisk);
      expect(manager.disk()).toBe(manager.disk("public"));
      expect(manager.disk("s3")).toBeInstanceOf(S3StorageDisk);

      await manager.put("hello.txt", "world");
      await expect(manager.text("hello.txt")).resolves.toBe("world");
      expect(manager.url("hello.txt")).toBe("/storage/hello.txt");
    } finally {
      await rm(root, {
        force: true,
        recursive: true,
      });
    }
  });

  it("rejects unknown disks", () => {
    const manager = new StorageManager({
      defaultDisk: "missing",
      disks: {},
    });

    expect(() => manager.disk()).toThrow(StorageError);
  });
});
