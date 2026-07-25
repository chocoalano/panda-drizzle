import { AuthorizationError } from "../app/Support/Policy";
import {
  logFrameworkError,
  type FrameworkLogger,
} from "../app/Support/Logging";
import { isHttpError } from "../app/Support/HttpError";
import { appConfig } from "../config/app";

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ExceptionResponse = {
  status: number;
  body: {
    message: string;
    error?: string;
    errors?: ValidationIssue[];
  };
};

export type RenderExceptionOptions = {
  logger?: FrameworkLogger;
  request?: Request;
};

export function renderException(
  code: string | number,
  error: unknown,
  options: RenderExceptionOptions = {}
): ExceptionResponse {
  const response = exceptionResponse(String(code), error);

  logFrameworkError(
    {
      code: String(code),
      error,
      request: options.request,
      status: response.status,
    },
    options.logger
  );

  return response;
}

function exceptionResponse(code: string, error: unknown): ExceptionResponse {
  if (error instanceof AuthorizationError) {
    return {
      status: error.status,
      body: {
        message: error.message,
      },
    };
  }

  if (code === "NOT_FOUND") {
    return {
      status: 404,
      body: {
        message: "Route not found",
      },
    };
  }

  const validationIssues = validationIssuesFrom(code, error);

  // Must precede isHttpError: Elysia's ValidationError already carries status
  // 422, and its `message` is a raw JSON dump rather than a readable string.
  if (validationIssues) {
    return {
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: validationIssues,
      },
    };
  }

  if (isHttpError(error)) {
    return {
      status: error.status,
      body: {
        message: error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      message: "Internal server error",
      error: appConfig.debug ? exceptionMessage(error) : undefined,
    },
  };
}

/**
 * Normalizes the two validation shapes this framework can raise: Zod errors from
 * request/controller classes, and Elysia's own `VALIDATION` schema errors.
 * Returns undefined when the error is not a validation failure.
 */
export function validationIssuesFrom(
  code: string,
  error: unknown
): ValidationIssue[] | undefined {
  if (isZodError(error)) {
    return error.issues.map((issue) => ({
      field: formatIssuePath(issue.path),
      message: issue.message,
    }));
  }

  if (code !== "VALIDATION") {
    return undefined;
  }

  return elysiaValidationIssues(error) ?? [
    {
      field: "",
      message: "Request validation failed.",
    },
  ];
}

function isZodError(
  error: unknown
): error is Error & { issues: Array<{ path: PropertyKey[]; message: string }> } {
  return (
    error instanceof Error &&
    error.name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function elysiaValidationIssues(error: unknown) {
  const all = (error as { all?: unknown } | null)?.all;

  if (!Array.isArray(all)) {
    return undefined;
  }

  const issues = all
    .filter(
      (issue): issue is { path?: string; message?: string; summary?: string } =>
        typeof issue === "object" && issue !== null
    )
    .map((issue) => ({
      field: String(issue.path ?? "").replace(/^\//, "").replace(/\//g, "."),
      message: issue.summary ?? issue.message ?? "Invalid value.",
    }));

  return issues.length > 0 ? issues : undefined;
}

function formatIssuePath(path: PropertyKey[]) {
  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : String(segment)
    )
    .join(".")
    .replace(/\.\[/g, "[");
}

export function exceptionMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}
