import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import pino from "pino";

import { loggerConfig, type LoggerConfig } from "../../../config/logger";
import { safeRequestUrl } from "../../../config/sanitization";

export type FrameworkErrorLogContext = {
  code: string;
  error: unknown;
  request?: Request;
  status: number;
};

export type FrameworkLogger = {
  error(payload: object, message: string): void;
  flush?(): void;
};

let frameworkLogger: FrameworkLogger | undefined;

export function createPinoErrorLogger(config: LoggerConfig = loggerConfig) {
  mkdirSync(dirname(config.errorFile), {
    recursive: true,
  });

  return pino(
    {
      level: config.level,
      name: config.name,
      redact: {
        paths: config.redactPaths,
      },
      serializers: {
        err: (value) => value,
      },
    },
    pino.destination({
      dest: config.errorFile,
      sync: config.sync,
    })
  );
}

export function getFrameworkLogger() {
  frameworkLogger ??= createPinoErrorLogger();

  return frameworkLogger;
}

export function setFrameworkLogger(logger: FrameworkLogger | undefined) {
  frameworkLogger = logger;
}

export function logFrameworkError(
  context: FrameworkErrorLogContext,
  logger: FrameworkLogger = getFrameworkLogger()
) {
  logger.error(
    buildFrameworkErrorLog(context, {
      includeStack: loggerConfig.includeStack,
    }),
    "Framework error detected."
  );
  logger.flush?.();
}

export function buildFrameworkErrorLog(
  context: FrameworkErrorLogContext,
  options: { includeStack?: boolean } = {}
) {
  return {
    code: context.code,
    err: serializeError(context.error, options),
    event: "framework.error",
    request: context.request ? serializeRequest(context.request) : undefined,
    status: context.status,
  };
}

export function serializeError(
  error: unknown,
  options: { includeStack?: boolean } = {}
) {
  if (error instanceof Error) {
    const serialized: {
      cause: unknown;
      message: string;
      stack?: string;
      type: string;
    } = {
      cause: serializeCause(error.cause),
      message: error.message,
      type: error.name,
    };

    if (options.includeStack) {
      serialized.stack = error.stack;
    }

    return serialized;
  }

  return {
    message: String(error),
    type: typeof error,
  };
}

export function serializeRequest(request: Request) {
  const url = safeRequestUrl(request.url);

  return {
    method: request.method,
    path: url.path,
    query: url.query,
    url: url.url,
  };
}

function serializeCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      message: cause.message,
      type: cause.name,
    };
  }

  return cause;
}
