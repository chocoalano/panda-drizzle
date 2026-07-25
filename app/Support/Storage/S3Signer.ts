import { createHash, createHmac } from "node:crypto";

export const MAX_S3_PRESIGN_EXPIRY_SECONDS = 604_800;

export type S3SigningConfig = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle?: boolean;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type S3SignRequestInput = {
  body?: Uint8Array;
  headers?: Record<string, string>;
  method: string;
  now?: Date;
  path: string;
  query?: Record<string, string>;
};

export function buildS3ObjectUrl(config: S3SigningConfig, path: string) {
  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => awsEncode(segment))
    .join("/");
  const endpoint = new URL(config.endpoint);

  if (config.forcePathStyle) {
    endpoint.pathname = joinUrlPath(endpoint.pathname, config.bucket, normalizedPath);

    return endpoint;
  }

  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = joinUrlPath(endpoint.pathname, normalizedPath);

  return endpoint;
}

export function signS3Request(
  config: S3SigningConfig,
  input: S3SignRequestInput
) {
  const now = input.now ?? new Date();
  const url = buildS3ObjectUrl(config, input.path);
  const payloadHash = input.body ? sha256Hex(input.body) : "UNSIGNED-PAYLOAD";
  const headers = normalizeHeaders({
    ...input.headers,
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": toAmzDate(now),
  });

  if (config.sessionToken) {
    headers["x-amz-security-token"] = config.sessionToken;
  }

  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value);
  }

  headers.authorization = buildAuthorizationHeader(config, {
    canonicalUri: canonicalUri(url.pathname),
    headers,
    method: input.method,
    now,
    payloadHash,
    query: Object.fromEntries(url.searchParams.entries()),
  });

  return {
    headers,
    url: url.toString(),
  };
}

export function presignS3Url(
  config: S3SigningConfig,
  input: {
    expiresInSeconds: number;
    method?: string;
    now?: Date;
    path: string;
  }
) {
  const now = input.now ?? new Date();
  const method = input.method ?? "GET";
  const url = buildS3ObjectUrl(config, input.path);
  const credentialScope = scope(now, config.region);
  const expiresInSeconds = clampS3PresignExpiry(input.expiresInSeconds);
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": toAmzDate(now),
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };

  if (config.sessionToken) {
    query["X-Amz-Security-Token"] = config.sessionToken;
  }

  const canonicalRequest = [
    method,
    canonicalUri(url.pathname),
    canonicalQuery(query),
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const signature = signString(
    config,
    now,
    sha256Hex(new TextEncoder().encode(canonicalRequest))
  );

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("X-Amz-Signature", signature);

  return url.toString();
}

export function clampS3PresignExpiry(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    return 1;
  }

  return Math.min(value, MAX_S3_PRESIGN_EXPIRY_SECONDS);
}

export function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function buildAuthorizationHeader(
  config: S3SigningConfig,
  input: {
    canonicalUri: string;
    headers: Record<string, string>;
    method: string;
    now: Date;
    payloadHash: string;
    query: Record<string, string>;
  }
) {
  const signedHeaders = Object.keys(input.headers).sort().join(";");
  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    canonicalQuery(input.query),
    canonicalHeaders(input.headers),
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const signature = signString(
    config,
    input.now,
    sha256Hex(new TextEncoder().encode(canonicalRequest))
  );

  return [
    "AWS4-HMAC-SHA256",
    `Credential=${config.accessKeyId}/${scope(input.now, config.region)}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
}

function signString(config: S3SigningConfig, now: Date, canonicalRequestHash: string) {
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    toAmzDate(now),
    scope(now, config.region),
    canonicalRequestHash,
  ].join("\n");

  return hmacHex(signingKey(config, now), stringToSign);
}

function signingKey(config: S3SigningConfig, now: Date) {
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp(now));
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");

  return hmac(serviceKey, "aws4_request");
}

function hmac(key: string | Uint8Array, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: string | Uint8Array, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalHeaders(headers: Record<string, string>) {
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value.trim().replace(/\s+/g, " ")}`)
    .join("\n")
    .concat("\n");
}

function canonicalQuery(query: Record<string, string>) {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join("&");
}

function canonicalUri(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => awsEncode(decodeURIComponent(segment)))
    .join("/");
}

function normalizeHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [
        normalizeHeaderName(key),
        normalizeHeaderValue(value),
      ])
  );
}

function normalizeHeaderName(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(normalized)) {
    throw new Error(`Unsafe S3 header name: ${value}`);
  }

  return normalized;
}

function normalizeHeaderValue(value: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error("Unsafe S3 header value.");
  }

  return value;
}

function scope(now: Date, region: string) {
  return `${dateStamp(now)}/${region}/s3/aws4_request`;
}

function dateStamp(now: Date) {
  return toAmzDate(now).slice(0, 8);
}

function joinUrlPath(...segments: string[]) {
  const path = segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .join("/");

  return `/${path}`;
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
