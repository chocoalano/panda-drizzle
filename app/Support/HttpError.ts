export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class InvalidJsonRequestError extends HttpError {
  constructor(message = "Invalid JSON request body.") {
    super(message, 400);
    this.name = "InvalidJsonRequestError";
  }
}

export function isHttpError(error: unknown): error is Error & { status: number } {
  if (!(error instanceof Error) || !("status" in error)) {
    return false;
  }

  const status = (error as { status: unknown }).status;

  return (
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status < 600
  );
}
