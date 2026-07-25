import {
  StorageError,
  contentsToUint8Array,
  joinStorageUrl,
  normalizeStoragePath,
  type StorageContents,
  type StorageDisk,
  type StoragePutOptions,
  type StorageVisibility,
} from "./StorageDisk";
import {
  buildS3ObjectUrl,
  presignS3Url,
  signS3Request,
  type S3SigningConfig,
} from "./S3Signer";

export type S3StorageDiskConfig = S3SigningConfig & {
  cdnUrl?: string;
  driver: "s3";
  temporaryUrlExpiresIn: number;
  useAcl: boolean;
  visibility: StorageVisibility;
};

export type StorageFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export class S3StorageDisk implements StorageDisk {
  constructor(
    private readonly config: S3StorageDiskConfig,
    private readonly fetcher: StorageFetch = fetch,
    private readonly now: () => Date = () => new Date()
  ) {
    const missing = [
      ["AWS_ACCESS_KEY_ID", config.accessKeyId],
      ["AWS_SECRET_ACCESS_KEY", config.secretAccessKey],
      ["AWS_BUCKET", config.bucket],
      ["AWS_DEFAULT_REGION", config.region],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new StorageError(`S3 disk is missing configuration: ${missing.join(", ")}`);
    }
  }

  async put(
    path: string,
    contents: StorageContents,
    options: StoragePutOptions = {}
  ) {
    const normalizedPath = normalizeStoragePath(path);
    const visibility = options.visibility ?? this.config.visibility;
    const body = await contentsToUint8Array(contents);
    const headers: Record<string, string> = {
      ...metadataHeaders(options.metadata),
    };

    if (options.contentType) {
      headers["content-type"] = safeS3HeaderValue(options.contentType);
    }

    if (this.config.useAcl) {
      headers["x-amz-acl"] = visibility === "public" ? "public-read" : "private";
    }

    const response = await this.request("PUT", normalizedPath, {
      body,
      headers,
    });

    await ensureS3Response(response, "put", normalizedPath);

    return {
      contentType: options.contentType,
      path: normalizedPath,
      size: body.byteLength,
      visibility,
    };
  }

  async get(path: string) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request("GET", normalizedPath);

    await ensureS3Response(response, "get", normalizedPath);

    return new Uint8Array(await response.arrayBuffer());
  }

  async text(path: string) {
    return new TextDecoder().decode(await this.get(path));
  }

  async exists(path: string) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request("HEAD", normalizedPath);

    if (response.status === 404) {
      return false;
    }

    await ensureS3Response(response, "head", normalizedPath);

    return true;
  }

  async delete(path: string) {
    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request("DELETE", normalizedPath);

    if (response.status === 404) {
      return false;
    }

    await ensureS3Response(response, "delete", normalizedPath);

    return true;
  }

  url(path: string) {
    const normalizedPath = normalizeStoragePath(path);

    if (this.config.cdnUrl) {
      return joinStorageUrl(this.config.cdnUrl, normalizedPath);
    }

    return buildS3ObjectUrl(this.config, normalizedPath).toString();
  }

  async temporaryUrl(path: string, expiresInSeconds = this.config.temporaryUrlExpiresIn) {
    return presignS3Url(this.config, {
      expiresInSeconds,
      now: this.now(),
      path: normalizeStoragePath(path),
    });
  }

  async visibility(path: string) {
    const normalizedPath = normalizeStoragePath(path);

    // Without ACLs there is no per-object visibility to read back; the bucket
    // policy governs access, so the configured default is the honest answer.
    if (!this.config.useAcl) {
      return this.config.visibility;
    }

    const response = await this.request("GET", normalizedPath, {
      query: {
        acl: "",
      },
    });

    await ensureS3Response(response, "acl", normalizedPath);

    return parseS3AclVisibility(await response.text());
  }

  async setVisibility(path: string, visibility: StorageVisibility) {
    if (!this.config.useAcl) {
      throw new StorageError("S3 visibility changes require AWS_USE_ACL=true.");
    }

    const normalizedPath = normalizeStoragePath(path);
    const response = await this.request("PUT", normalizedPath, {
      headers: {
        "x-amz-acl": visibility === "public" ? "public-read" : "private",
      },
      query: {
        acl: "",
      },
    });

    await ensureS3Response(response, "acl", normalizedPath);
  }

  private request(
    method: string,
    path: string,
    options: {
      body?: Uint8Array;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    } = {}
  ) {
    const signed = signS3Request(this.config, {
      body: options.body,
      headers: options.headers,
      method,
      now: this.now(),
      path,
      query: options.query,
    });

    return this.fetcher(signed.url, {
      // A Uint8Array is a valid BodyInit; the lib types only accept the
      // ArrayBuffer-backed variant, not the generic ArrayBufferLike one.
      body: options.body as BodyInit | undefined,
      headers: signed.headers,
      method,
    });
  }
}

/**
 * An object is public when its ACL grants READ to the AllUsers group; every
 * other grant combination (owner-only, authenticated-users, ...) is private.
 */
export function parseS3AclVisibility(body: string): StorageVisibility {
  const grants = body.match(/<Grant>[\s\S]*?<\/Grant>/g) ?? [];
  const isPublic = grants.some(
    (grant) =>
      grant.includes("http://acs.amazonaws.com/groups/global/AllUsers") &&
      /<Permission>\s*(READ|FULL_CONTROL)\s*<\/Permission>/.test(grant)
  );

  return isPublic ? "public" : "private";
}

function metadataHeaders(metadata: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      `x-amz-meta-${safeMetadataKey(key)}`,
      safeS3HeaderValue(value),
    ])
  );
}

function safeMetadataKey(key: string) {
  const normalized = key.trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9_.-]{0,127}$/.test(normalized)) {
    throw new StorageError(`Invalid S3 metadata key: ${key}`);
  }

  return normalized;
}

function safeS3HeaderValue(value: string) {
  if (/[\r\n]/.test(value)) {
    throw new StorageError("Invalid S3 header value.");
  }

  return value;
}

async function ensureS3Response(response: Response, action: string, path: string) {
  if (response.ok) {
    return;
  }

  throw new StorageError(
    `S3 ${action} failed for ${path}: ${response.status} ${await response.text()}`,
    "S3_REQUEST_FAILED"
  );
}
