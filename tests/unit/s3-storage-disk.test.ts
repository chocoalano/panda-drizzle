import { describe, expect, it } from "bun:test";

import { S3StorageDisk, StorageError } from "../../app/Support/Storage";
import { parseS3AclVisibility } from "../../app/Support/Storage/S3StorageDisk";
import { clampS3PresignExpiry } from "../../app/Support/Storage/S3Signer";
import type { S3StorageDiskConfig } from "../../app/Support/Storage";

const config: S3StorageDiskConfig = {
  accessKeyId: "access-key",
  bucket: "patshop",
  cdnUrl: "https://cdn.example.test/assets",
  driver: "s3",
  endpoint: "https://s3.example.test",
  forcePathStyle: true,
  region: "ap-southeast-1",
  secretAccessKey: "secret-key",
  temporaryUrlExpiresIn: 300,
  useAcl: true,
  visibility: "private",
};

const publicAclBody = `<?xml version="1.0" encoding="UTF-8"?>
<AccessControlPolicy>
  <AccessControlList>
    <Grant>
      <Grantee xsi:type="CanonicalUser"><ID>owner</ID></Grantee>
      <Permission>FULL_CONTROL</Permission>
    </Grant>
    <Grant>
      <Grantee xsi:type="Group">
        <URI>http://acs.amazonaws.com/groups/global/AllUsers</URI>
      </Grantee>
      <Permission>READ</Permission>
    </Grant>
  </AccessControlList>
</AccessControlPolicy>`;

const privateAclBody = `<?xml version="1.0" encoding="UTF-8"?>
<AccessControlPolicy>
  <AccessControlList>
    <Grant>
      <Grantee xsi:type="CanonicalUser"><ID>owner</ID></Grantee>
      <Permission>FULL_CONTROL</Permission>
    </Grant>
  </AccessControlList>
</AccessControlPolicy>`;

describe("parseS3AclVisibility", () => {
  it("reads a public-read ACL as public", () => {
    expect(parseS3AclVisibility(publicAclBody)).toBe("public");
  });

  it("reads an owner-only ACL as private", () => {
    expect(parseS3AclVisibility(privateAclBody)).toBe("private");
  });

  it("treats an authenticated-users grant as private", () => {
    expect(
      parseS3AclVisibility(`<AccessControlPolicy><AccessControlList><Grant>
        <Grantee><URI>http://acs.amazonaws.com/groups/global/AuthenticatedUsers</URI></Grantee>
        <Permission>READ</Permission>
      </Grant></AccessControlList></AccessControlPolicy>`)
    ).toBe("private");
  });
});

describe("S3StorageDisk.visibility", () => {
  it("reports the object ACL rather than the configured default", async () => {
    const requests: string[] = [];
    const disk = new S3StorageDisk(
      config,
      async (input) => {
        requests.push(String(input));

        return new Response(publicAclBody, { status: 200 });
      },
      fixedClock
    );

    // Config default is "private"; the stored object is public-read.
    await expect(disk.visibility("avatars/user.txt")).resolves.toBe("public");
    expect(requests[0]).toContain("acl");
  });

  it("reports private objects as private", async () => {
    const disk = new S3StorageDisk(
      config,
      async () => new Response(privateAclBody, { status: 200 }),
      fixedClock
    );

    await expect(disk.visibility("avatars/user.txt")).resolves.toBe("private");
  });

  it("falls back to the configured default when ACLs are disabled", async () => {
    const disk = new S3StorageDisk(
      { ...config, useAcl: false, visibility: "public" },
      async () => {
        throw new Error("must not perform an ACL request");
      },
      fixedClock
    );

    await expect(disk.visibility("avatars/user.txt")).resolves.toBe("public");
  });

  it("raises a storage error when the ACL request fails", async () => {
    const disk = new S3StorageDisk(
      config,
      async () => new Response("denied", { status: 403 }),
      fixedClock
    );

    await expect(disk.visibility("avatars/user.txt")).rejects.toThrow(
      StorageError
    );
  });
});

describe("S3StorageDisk", () => {
  it("fails early when required S3 configuration is missing", () => {
    expect(
      () =>
        new S3StorageDisk({
          ...config,
          bucket: "",
        })
    ).toThrow(StorageError);
  });

  it("writes objects with signed requests and visibility ACLs", async () => {
    const requests: Array<{
      init?: RequestInit;
      input: RequestInfo | URL;
    }> = [];
    const disk = new S3StorageDisk(
      config,
      async (input, init) => {
        requests.push({ init, input });

        return new Response(null, {
          status: 200,
        });
      },
      fixedClock
    );

    await expect(
      disk.put("avatars/user.txt", "hello", {
        contentType: "text/plain",
        metadata: {
          owner: "7",
        },
        visibility: "public",
      })
    ).resolves.toEqual({
      contentType: "text/plain",
      path: "avatars/user.txt",
      size: 5,
      visibility: "public",
    });

    const request = requests[0];
    const headers = request?.init?.headers as Record<string, string>;

    expect(String(request?.input)).toBe(
      "https://s3.example.test/patshop/avatars/user.txt"
    );
    expect(request?.init?.method).toBe("PUT");
    expect(headers.authorization).toContain("AWS4-HMAC-SHA256");
    expect(headers["x-amz-acl"]).toBe("public-read");
    expect(headers["x-amz-meta-owner"]).toBe("7");
    expect(headers["content-type"]).toBe("text/plain");
  });

  it("reads, checks, and deletes S3 objects through signed requests", async () => {
    const methods: string[] = [];
    const disk = new S3StorageDisk(
      config,
      async (_input, init) => {
        methods.push(String(init?.method));

        if (init?.method === "GET") {
          return new Response("hello");
        }

        if (init?.method === "HEAD") {
          return new Response(null, {
            status: 404,
          });
        }

        return new Response(null, {
          status: 204,
        });
      },
      fixedClock
    );

    await expect(disk.text("avatars/user.txt")).resolves.toBe("hello");
    await expect(disk.exists("avatars/user.txt")).resolves.toBe(false);
    await expect(disk.delete("avatars/user.txt")).resolves.toBe(true);
    expect(methods).toEqual(["GET", "HEAD", "DELETE"]);
  });

  it("uses CDN URLs for public URLs and S3 signatures for temporary URLs", async () => {
    const disk = new S3StorageDisk(config, async () => new Response(), fixedClock);
    const temporaryUrl = await disk.temporaryUrl("private/report.pdf", 60);
    const clampedUrl = await disk.temporaryUrl("private/report.pdf", 999_999);

    expect(disk.url("images/pet.png")).toBe(
      "https://cdn.example.test/assets/images/pet.png"
    );
    expect(temporaryUrl).toContain(
      "https://s3.example.test/patshop/private/report.pdf"
    );
    expect(temporaryUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(temporaryUrl).toContain("X-Amz-Expires=60");
    expect(clampedUrl).toContain("X-Amz-Expires=604800");
    expect(temporaryUrl).toContain("X-Amz-Signature=");
    expect(clampS3PresignExpiry(0)).toBe(1);
  });

  it("rejects unsafe S3 metadata and content type headers", async () => {
    const disk = new S3StorageDisk(config, async () => new Response(), fixedClock);

    await expect(
      disk.put("avatars/user.txt", "hello", {
        metadata: {
          "bad:key": "1",
        },
      })
    ).rejects.toThrow(StorageError);
    await expect(
      disk.put("avatars/user.txt", "hello", {
        contentType: "text/plain\r\nx-amz-acl:public-read",
      })
    ).rejects.toThrow(StorageError);
  });

  it("updates object visibility through S3 ACLs", async () => {
    const requests: Array<{
      init?: RequestInit;
      input: RequestInfo | URL;
    }> = [];
    const disk = new S3StorageDisk(
      config,
      async (input, init) => {
        requests.push({ init, input });

        return new Response(null, {
          status: 200,
        });
      },
      fixedClock
    );

    await disk.setVisibility("avatars/user.txt", "private");

    const headers = requests[0]?.init?.headers as Record<string, string>;

    expect(String(requests[0]?.input)).toContain("?acl=");
    expect(headers["x-amz-acl"]).toBe("private");
  });
});

function fixedClock() {
  return new Date("2026-01-01T00:00:00.000Z");
}
