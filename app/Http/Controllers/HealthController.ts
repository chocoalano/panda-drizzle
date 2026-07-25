import { appConfig } from "../../../config/app";
import type { HealthCheckRequest } from "../Requests/HealthCheckRequest";

export type HealthResponse = {
  status: "ok";
  service: string;
  checkedAt: string;
};

export type ErrorResponse = {
  message: string;
};

export type ControllerResponse<TBody> = {
  status: number;
  body: TBody;
};

export class HealthController {
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly serviceName = appConfig.name
  ) {}

  show(
    request: HealthCheckRequest
  ): ControllerResponse<HealthResponse | ErrorResponse> {
    if (!request.authorize()) {
      return {
        status: 403,
        body: {
          message: "Forbidden",
        },
      };
    }

    if (!request.acceptsJson()) {
      return {
        status: 406,
        body: {
          message: "Client must accept application/json",
        },
      };
    }

    return {
      status: 200,
      body: {
        status: "ok",
        service: this.serviceName,
        checkedAt: this.now().toISOString(),
      },
    };
  }
}

export function makeHealthController() {
  return new HealthController();
}
