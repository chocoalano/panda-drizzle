import { describe, expect, it } from "bun:test";

import {
  normalizeStorageDisk,
  normalizeStorageUrl,
  positiveInteger,
  storageConfig,
  storageRoot,
} from "../../config/storage";
import { normalizeStorageVisibility } from "../../app/Support/Storage";

describe("storageConfig", () => {
  it("defines Laravel-style local, public, and S3 disks", () => {
    expect(storageConfig.defaultDisk).toBe("local");
    expect(storageConfig.disks.local).toMatchObject({
      driver: "local",
      visibility: "private",
    });
    expect(storageConfig.disks.public).toMatchObject({
      driver: "local",
      url: "/storage",
      visibility: "public",
    });
    expect(storageConfig.disks.s3).toMatchObject({
      driver: "s3",
      temporaryUrlExpiresIn: 300,
      useAcl: true,
      visibility: "private",
    });
  });

  it("normalizes disk names and visibility values", () => {
    expect(normalizeStorageDisk("PUBLIC")).toBe("public");
    expect(normalizeStorageDisk("s3")).toBe("s3");
    expect(normalizeStorageDisk("unknown")).toBe("local");
    expect(normalizeStorageVisibility("PUBLIC")).toBe("public");
    expect(normalizeStorageVisibility("hidden")).toBe("private");
  });

  it("normalizes roots, URLs, and positive integer values", () => {
    expect(storageRoot("storage/app/private", "fallback")).toContain(
      "storage/app/private"
    );
    expect(normalizeStorageUrl("https://cdn.example.com///")).toBe(
      "https://cdn.example.com"
    );
    expect(normalizeStorageUrl("   ")).toBeUndefined();
    expect(positiveInteger("60", 300)).toBe(60);
    expect(positiveInteger("-1", 300)).toBe(300);
  });
});
