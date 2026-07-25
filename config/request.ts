import { env, envBoolean } from "./env";

export const requestConfig = {
  maxBodyBytes: positiveInteger(env("REQUEST_MAX_BODY_BYTES"), 1_048_576),
  rejectChunkedBodies: envBoolean("REQUEST_REJECT_CHUNKED_BODIES", true),
  rejectInvalidContentLength: envBoolean(
    "REQUEST_REJECT_INVALID_CONTENT_LENGTH",
    true
  ),
  // Chunked bodies are rejected, so a declared Content-Length is what actually
  // frames the body. Requiring it is what makes maxBodyBytes a real limit
  // instead of an advisory header check.
  requireContentLength: envBoolean("REQUEST_REQUIRE_CONTENT_LENGTH", true),
};

export type RequestConfig = typeof requestConfig;

export function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
