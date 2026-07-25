import { z } from "zod";

export const healthCheckRequestHeadersSchema = z
  .object({
    accept: z.string().optional(),
  })
  .passthrough();

export type HealthCheckRequestHeaders = z.infer<
  typeof healthCheckRequestHeadersSchema
>;

export class HealthCheckRequest {
  constructor(private readonly request: Request) {}

  authorize() {
    return true;
  }

  validate(): HealthCheckRequestHeaders {
    return healthCheckRequestHeadersSchema.parse(this.headers());
  }

  safeValidate(input: unknown = this.headers()) {
    return healthCheckRequestHeadersSchema.safeParse(input);
  }

  acceptsJson() {
    const accept = this.validate().accept;

    return (
      !accept ||
      accept.includes("*/*") ||
      accept.toLowerCase().includes("application/json")
    );
  }

  private headers() {
    return Object.fromEntries(this.request.headers.entries());
  }
}
