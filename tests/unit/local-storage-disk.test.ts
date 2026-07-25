import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LocalStorageDisk,
  StorageError,
  StorageFileNotFoundError,
  StoragePathError,
} from "../../app/Support/Storage";

describe("LocalStorageDisk", () => {
  it("stores, reads, exposes visibility, and deletes files", async () => {
    const root = await mkdtemp(join(tmpdir(), "patshop-storage-"));
    const disk = new LocalStorageDisk({
      driver: "local",
      root,
      visibility: "private",
    });

    try {
      await expect(
        disk.put("avatars/user.txt", "hello", {
          contentType: "text/plain",
          visibility: "public",
        })
      ).resolves.toEqual({
        contentType: "text/plain",
        path: "avatars/user.txt",
        size: 5,
        visibility: "public",
      });

      await expect(disk.exists("avatars/user.txt")).resolves.toBe(true);
      await expect(disk.text("avatars/user.txt")).resolves.toBe("hello");
      await expect(disk.visibility("avatars/user.txt")).resolves.toBe("public");

      await disk.setVisibility("avatars/user.txt", "private");
      await expect(disk.visibility("avatars/user.txt")).resolves.toBe("private");
      await expect(disk.delete("avatars/user.txt")).resolves.toBe(true);
      await expect(disk.exists("avatars/user.txt")).resolves.toBe(false);
      await expect(disk.delete("avatars/user.txt")).resolves.toBe(false);
    } finally {
      await rm(root, {
        force: true,
        recursive: true,
      });
    }
  });

  it("generates public URLs for public local disks", async () => {
    const root = await mkdtemp(join(tmpdir(), "patshop-storage-"));
    const disk = new LocalStorageDisk({
      driver: "local",
      root,
      url: "https://cdn.example.test/storage",
      visibility: "public",
    });

    try {
      expect(disk.url("images/pet shop.png")).toBe(
        "https://cdn.example.test/storage/images/pet%20shop.png"
      );
      await expect(disk.temporaryUrl("images/pet shop.png")).resolves.toBe(
        "https://cdn.example.test/storage/images/pet%20shop.png"
      );
    } finally {
      await rm(root, {
        force: true,
        recursive: true,
      });
    }
  });

  it("rejects traversal paths and missing files", async () => {
    const root = await mkdtemp(join(tmpdir(), "patshop-storage-"));
    const disk = new LocalStorageDisk({
      driver: "local",
      root,
      visibility: "private",
    });

    try {
      expect(() => disk.url("../secret.txt")).toThrow(StoragePathError);
      await expect(disk.get("missing.txt")).rejects.toBeInstanceOf(
        StorageFileNotFoundError
      );
      await expect(disk.temporaryUrl("missing.txt")).rejects.toBeInstanceOf(
        StorageError
      );
    } finally {
      await rm(root, {
        force: true,
        recursive: true,
      });
    }
  });
});
