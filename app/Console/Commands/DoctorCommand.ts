import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

export type DoctorStatus = "pass" | "fail";

export type DoctorCheck = {
  details?: string[];
  message: string;
  name: string;
  status: DoctorStatus;
};

export type DoctorResult = {
  checks: DoctorCheck[];
  passed: boolean;
};

export type DoctorCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type DoctorCommandRunner = (
  command: string[],
  options: { cwd: string }
) => Promise<DoctorCommandResult>;

export type DoctorOptions = {
  cwd?: string;
  runCommand?: DoctorCommandRunner;
};

const requiredFiles = [
  "index.ts",
  "api.ts",
  "panda.ts",
  "bootstrap/app.ts",
  "bootstrap/exceptions.ts",
  "bootstrap/middleware.ts",
  "bootstrap/providers.ts",
  "routes/api.ts",
  "config/app.ts",
  "config/auth.ts",
  "config/broadcasting.ts",
  "config/console.ts",
  "config/cors.ts",
  "config/database.ts",
  "config/env.ts",
  "config/logger.ts",
  "config/mail.ts",
  "config/middleware.ts",
  "config/notifications.ts",
  "config/policies.ts",
  "config/providers.ts",
  "config/queue.ts",
  "config/csrf.ts",
  "config/rateLimit.ts",
  "config/request.ts",
  "config/sanitization.ts",
  "config/security.ts",
  "config/seeder.ts",
  "config/storage.ts",
  "config/telemetry.ts",
  "config/Database/client.ts",
  "config/Database/connections.ts",
  "config/Database/schema.ts",
  "config/drizzle/meta/_journal.json",
  "app/Policies/Policy.ts",
  "app/Console/Commands/DatabaseMigrateFreshCommand.ts",
  "app/Console/Commands/DatabaseMigrateResetCommand.ts",
  "app/Console/Commands/DatabaseMigrateRollbackCommand.ts",
  "app/Console/Commands/DatabaseSchemaResetter.ts",
  "app/Console/Commands/QueueWorkCommand.ts",
  "app/Providers/BroadcastServiceProvider.ts",
  "app/Providers/MailServiceProvider.ts",
  "app/Providers/NotificationServiceProvider.ts",
  "app/Providers/QueueServiceProvider.ts",
  "app/Support/Broadcasting/BroadcastManager.ts",
  "app/Support/Broadcasting/Broadcaster.ts",
  "app/Support/Broadcasting/index.ts",
  "app/Support/Mail/MailManager.ts",
  "app/Support/Mail/MailMessage.ts",
  "app/Support/Mail/SmtpTransport.ts",
  "app/Support/Mail/index.ts",
  "app/Support/Notifications/Notification.ts",
  "app/Support/Notifications/NotificationDispatcher.ts",
  "app/Support/Notifications/index.ts",
  "app/Support/Queue/Job.ts",
  "app/Support/Queue/QueueManager.ts",
  "app/Support/Queue/index.ts",
  "app/Support/Storage/LocalStorageDisk.ts",
  "app/Support/Storage/S3Signer.ts",
  "app/Support/Storage/S3StorageDisk.ts",
  "app/Support/Storage/StorageDisk.ts",
  "app/Support/Storage/StorageManager.ts",
  "app/Support/Logging/index.ts",
  "app/Support/Logging/PinoLogger.ts",
  "app/Support/HttpError.ts",
] as const;

const forbiddenPaths = [
  "database/client.ts",
  "database/schema.ts",
  "database/connections.ts",
  "database/seeders/faker.ts",
  "database/seeders/runner.ts",
  "database/seeders/Seeder.ts",
  "database/seeders/index.ts",
  "database/migrations/meta",
  "database/migrations/mysql",
  "database/migrations/postgresql",
  "database/migrations/sqlite",
  "app/Database",
  "app/Models/mysql",
  "app/Models/postgresql",
  "app/Models/sqlite",
  "app/Models/schema.ts",
] as const;

const envAllowedPrefixes = [
  "config/",
  "drizzle.config.ts",
  "tests/",
] as const;

const envAllowedFiles = [
  "app/Console/Commands/DoctorCommand.ts",
] as const;

export class DoctorCommand {
  readonly signature = "doctor";
  readonly description = "Audit framework structure, rules, and code health.";

  constructor(private readonly doctor = runFrameworkDoctor) {}

  async handle(
    stdout: (message: string) => void = console.log,
    _stderr: (message: string) => void = console.error,
    options: { cwd?: string } = {}
  ) {
    const result = await this.doctor({
      cwd: options.cwd,
    });

    for (const line of formatDoctorResult(result)) {
      stdout(line);
    }

    if (!result.passed) {
      throw new Error("Framework doctor detected failures.");
    }

    return result;
  }
}

export async function runFrameworkDoctor(
  options: DoctorOptions = {}
): Promise<DoctorResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const runCommand = options.runCommand ?? runProcessCommand;
  const checks = [
    await checkRequiredFiles(cwd),
    await checkForbiddenPaths(cwd),
    await checkRoutesDirectory(cwd),
    await checkIndexEntrypoint(cwd),
    await checkModelDirectory(cwd),
    await checkMigrationsDirectory(cwd),
    await checkSeedersDirectory(cwd),
    await checkDirectEnvironmentAccess(cwd),
    await checkRouteBoundaries(cwd),
    await checkPolicyDirectory(cwd),
    await checkPolicyConfiguration(cwd),
    await checkStorageDirectory(cwd),
    await checkStorageConfiguration(cwd),
    await checkLoggingSupport(cwd),
    await checkLoggingConfiguration(cwd),
    await checkSecurityHardening(cwd),
    await checkRequestValidation(cwd),
    await checkDatabaseConsoleSupport(cwd),
    await checkRealtimeCommunicationSupport(cwd),
    await checkGeneratedSupportPaths(cwd),
    await checkTypecheckGate(cwd),
    await checkTypecheck(cwd, runCommand),
    await checkTestSuite(cwd, runCommand),
  ];

  return {
    checks,
    passed: checks.every((check) => check.status === "pass"),
  };
}

export function formatDoctorResult(result: DoctorResult) {
  const lines = [
    "Framework Doctor",
    result.passed ? "Status: PASS" : "Status: FAIL",
    "",
  ];

  for (const check of result.checks) {
    lines.push(`${check.status === "pass" ? "PASS" : "FAIL"} ${check.name}`);
    lines.push(`  ${check.message}`);

    for (const detail of check.details ?? []) {
      lines.push(`  - ${detail}`);
    }
  }

  return lines;
}

async function checkRequiredFiles(cwd: string): Promise<DoctorCheck> {
  const missing = [];

  for (const path of requiredFiles) {
    if (!(await pathExists(cwd, path))) {
      missing.push(path);
    }
  }

  return makeCheck({
    details: missing,
    failMessage: "Missing required framework files.",
    name: "Required framework files",
    passMessage: "All required framework files exist.",
  });
}

async function checkForbiddenPaths(cwd: string): Promise<DoctorCheck> {
  const existing = [];

  for (const path of forbiddenPaths) {
    if (await pathExists(cwd, path)) {
      existing.push(path);
    }
  }

  return makeCheck({
    details: existing,
    failMessage: "Forbidden legacy framework paths exist.",
    name: "Forbidden framework paths",
    passMessage: "No forbidden legacy framework paths exist.",
  });
}

async function checkRoutesDirectory(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "routes"));
  const invalid = files
    .map((file) => relativePath(cwd, file))
    .filter((file) => file !== "routes/api.ts");

  return makeCheck({
    details: invalid,
    failMessage: "Only routes/api.ts may define API routes.",
    name: "Route entrypoint",
    passMessage: "routes/api.ts is the only route entrypoint.",
  });
}

async function checkIndexEntrypoint(cwd: string): Promise<DoctorCheck> {
  const source = await readText(join(cwd, "index.ts"));
  const forbidden = [];

  if (source.includes("new Elysia")) {
    forbidden.push("index.ts must not instantiate Elysia directly.");
  }

  if (source.includes("routes/api")) {
    forbidden.push("index.ts must not import routes/api.ts directly.");
  }

  if (!source.includes("./bootstrap/app")) {
    forbidden.push("index.ts must boot through bootstrap/app.ts.");
  }

  return makeCheck({
    details: forbidden,
    failMessage: "index.ts violates the framework boot contract.",
    name: "Standalone server entrypoint",
    passMessage: "index.ts only boots the composed app.",
  });
}

async function checkModelDirectory(cwd: string): Promise<DoctorCheck> {
  const entries = await listEntries(join(cwd, "app/Models"));
  const invalid = [];

  for (const entry of entries) {
    const path = relativePath(cwd, entry.path);

    if (entry.isDirectory) {
      invalid.push(`${path} is a directory; app/Models must contain model files only.`);
      continue;
    }

    if (extname(entry.path) !== ".ts") {
      invalid.push(`${path} is not a TypeScript model file.`);
      continue;
    }

    const source = await readText(entry.path);

    if (source.includes("drizzle-orm/")) {
      invalid.push(`${path} imports Drizzle; dialect schema belongs in config/drizzle/schemas.`);
    }
  }

  return makeCheck({
    details: invalid,
    failMessage: "app/Models contains non-model or dialect schema files.",
    name: "Application models",
    passMessage: "app/Models contains application model files only.",
  });
}

async function checkMigrationsDirectory(cwd: string): Promise<DoctorCheck> {
  const entries = await listEntries(join(cwd, "database/migrations"));
  const invalid = [];

  for (const entry of entries) {
    const path = relativePath(cwd, entry.path);

    if (entry.isDirectory) {
      invalid.push(`${path} is a directory; migrations must be SQL files only.`);
      continue;
    }

    if (extname(entry.path) !== ".sql") {
      invalid.push(`${path} is not a SQL migration file.`);
    }
  }

  return makeCheck({
    details: invalid,
    failMessage: "database/migrations contains non-SQL artifacts.",
    name: "Migration directory",
    passMessage: "database/migrations contains SQL migration files only.",
  });
}

async function checkSeedersDirectory(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "database/seeders"));
  const invalid = files
    .map((file) => relativePath(cwd, file))
    .filter((file) => !file.endsWith("Seeder.ts"));

  return makeCheck({
    details: invalid,
    failMessage: "database/seeders contains non-seeder helper files.",
    name: "Seeder directory",
    passMessage: "database/seeders contains seeder classes only.",
  });
}

async function checkDirectEnvironmentAccess(cwd: string): Promise<DoctorCheck> {
  const files = await sourceFiles(cwd);
  const violations = [];

  for (const file of files) {
    const relativeFile = relativePath(cwd, file);

    if (
      envAllowedFiles.includes(relativeFile as (typeof envAllowedFiles)[number]) ||
      envAllowedPrefixes.some((prefix) => relativeFile.startsWith(prefix))
    ) {
      continue;
    }

    const source = await readText(file);

    if (/\b(Bun\.env|process\.env)\b/.test(source)) {
      violations.push(relativeFile);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Environment access must go through config files.",
    name: "Environment access",
    passMessage: "No direct environment access outside allowed config boundaries.",
  });
}

async function checkRouteBoundaries(cwd: string): Promise<DoctorCheck> {
  const source = await readText(join(cwd, "routes/api.ts"));
  const violations = [];

  if (source.includes("config/Database") || source.includes("drizzle-orm/")) {
    violations.push("routes/api.ts must not import database clients or Drizzle.");
  }

  if (source.includes("Bun.env") || source.includes("process.env")) {
    violations.push("routes/api.ts must not read environment values directly.");
  }

  if (
    source.includes("app/Policies") ||
    source.includes("Support/Authorization") ||
    source.includes("userHasRole") ||
    source.includes("userHasPermission")
  ) {
    violations.push(
      "routes/api.ts must not contain inline policy or RBAC logic; use config/policies.ts, requests, middleware, or controllers."
    );
  }

  return makeCheck({
    details: violations,
    failMessage: "routes/api.ts contains business or infrastructure concerns.",
    name: "Route boundaries",
    passMessage: "routes/api.ts stays within HTTP adaptation boundaries.",
  });
}

async function checkPolicyDirectory(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "app/Policies"));
  const violations = [];

  for (const file of files) {
    const relativeFile = relativePath(cwd, file);

    if (extname(file) !== ".ts") {
      violations.push(`${relativeFile} is not a TypeScript policy file.`);
      continue;
    }

    if (basename(file) !== "Policy.ts" && !basename(file).endsWith("Policy.ts")) {
      violations.push(`${relativeFile} must be named *Policy.ts.`);
    }

    const source = await readText(file);

    if (source.includes("drizzle-orm/") || source.includes("config/Database")) {
      violations.push(`${relativeFile} must not import database infrastructure.`);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "app/Policies contains non-policy or infrastructure code.",
    name: "Policy directory",
    passMessage: "app/Policies contains policy files only.",
  });
}

async function checkPolicyConfiguration(cwd: string): Promise<DoctorCheck> {
  const source = await readText(join(cwd, "config/policies.ts"));
  const violations = [];

  if (!source.includes("policies:")) {
    violations.push("config/policies.ts must register policy classes.");
  }

  if (!source.includes("routePolicies:")) {
    violations.push("config/policies.ts must own route policy rules.");
  }

  if (!source.includes("userHeaders:")) {
    violations.push("config/policies.ts must define authenticated user headers.");
  }

  return makeCheck({
    details: violations,
    failMessage: "Policy configuration is incomplete.",
    name: "Policy configuration",
    passMessage: "Policy registry and route policy rules are configured.",
  });
}

async function checkStorageDirectory(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "app/Support/Storage"));
  const violations = [];

  for (const file of files) {
    const relativeFile = relativePath(cwd, file);

    if (extname(file) !== ".ts") {
      violations.push(`${relativeFile} is not a TypeScript storage support file.`);
      continue;
    }

    const source = await readText(file);

    if (/\b(Bun\.env|process\.env)\b/.test(source)) {
      violations.push(`${relativeFile} reads environment directly.`);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Storage support must stay in app/Support/Storage without direct environment access.",
    name: "Storage support",
    passMessage: "Storage support files are framework-compliant.",
  });
}

async function checkStorageConfiguration(cwd: string): Promise<DoctorCheck> {
  const source = await readText(join(cwd, "config/storage.ts"));
  const violations = [];

  for (const required of [
    "defaultDisk",
    "local:",
    "public:",
    "s3:",
    "visibility",
    "cdnUrl",
  ]) {
    if (!source.includes(required)) {
      violations.push(`config/storage.ts must define ${required}.`);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Storage configuration must define Laravel-style disks and visibility.",
    name: "Storage configuration",
    passMessage: "Storage disks, visibility, and CDN configuration are defined.",
  });
}

async function checkLoggingSupport(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "app/Support/Logging"));
  const violations = [];
  const exceptionSource = await readText(join(cwd, "bootstrap/exceptions.ts"));
  const loggerSource = await readText(join(cwd, "app/Support/Logging/PinoLogger.ts"));

  for (const file of files) {
    const relativeFile = relativePath(cwd, file);

    if (extname(file) !== ".ts") {
      violations.push(`${relativeFile} is not a TypeScript logging support file.`);
      continue;
    }

    const source = await readText(file);

    if (/\b(Bun\.env|process\.env)\b/.test(source)) {
      violations.push(`${relativeFile} reads environment directly.`);
    }
  }

  if (!exceptionSource.includes("logFrameworkError")) {
    violations.push("bootstrap/exceptions.ts must log every rendered framework error.");
  }

  if (!loggerSource.includes('from "pino"') || !loggerSource.includes("pino.destination")) {
    violations.push("PinoLogger.ts must use pino and pino.destination for file logging.");
  }

  return makeCheck({
    details: violations,
    failMessage: "Logging support must use Pino and be wired into framework exceptions.",
    name: "Pino error logging",
    passMessage: "Framework exceptions are written through the Pino logger.",
  });
}

async function checkLoggingConfiguration(cwd: string): Promise<DoctorCheck> {
  const source = await readText(join(cwd, "config/logger.ts"));
  const violations = [];

  for (const required of [
    "LOG_ERROR_FILE",
    "framework-errors.log",
    "LOG_LEVEL",
    "LOG_SYNC",
    "redactPaths",
  ]) {
    if (!source.includes(required)) {
      violations.push(`config/logger.ts must define ${required}.`);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Logger configuration must define the Pino error log file and safeguards.",
    name: "Logger configuration",
    passMessage: "Pino logger configuration is defined.",
  });
}

async function checkSecurityHardening(cwd: string): Promise<DoctorCheck> {
  const checks: Array<[string, string, string]> = [
    [
      "config/app.ts",
      "APP_ENV",
      "config/app.ts must own APP_ENV normalization.",
    ],
    [
      "config/app.ts",
      "APP_DEBUG",
      "config/app.ts must own APP_DEBUG normalization.",
    ],
    [
      "config/auth.ts",
      "assertBearerAuthConfiguration",
      "config/auth.ts must fail fast for missing production bearer auth.",
    ],
    [
      "config/cors.ts",
      "assertCorsConfiguration",
      "config/cors.ts must reject unsafe CORS credential combinations.",
    ],
    [
      "config/middleware.ts",
      "SecurityHeadersMiddleware",
      "Security headers middleware must be registered globally.",
    ],
    [
      "config/middleware.ts",
      "RateLimitMiddleware",
      "Rate limit middleware must be registered globally.",
    ],
    [
      "config/middleware.ts",
      "BodySizeLimitMiddleware",
      "Body size limit middleware must be registered globally.",
    ],
    [
      "config/middleware.ts",
      "CsrfMiddleware",
      "CSRF middleware must be registered globally.",
    ],
    [
      "config/policies.ts",
      "trustUserHeaders",
      "Policy config must make trusted user headers explicit.",
    ],
    [
      "config/policies.ts",
      "publicRoutes",
      "Policy config must define explicit public routes.",
    ],
    [
      "app/Support/Logging/PinoLogger.ts",
      "safeRequestUrl",
      "Framework logger must sanitize request URLs before writing logs.",
    ],
    [
      "package.json",
      "\"overrides\"",
      "package.json must include security overrides for vulnerable transitive dependencies.",
    ],
  ];
  const violations = [];
  const gitignore = await readText(join(cwd, ".gitignore"));
  const ignoresBaseEnv = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(".env");

  if (!ignoresBaseEnv) {
    violations.push(".gitignore must ignore the base .env file.");
  }

  for (const [file, expected, message] of checks) {
    const source = await readText(join(cwd, file));

    if (!source.includes(expected)) {
      violations.push(message);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Security hardening safeguards are incomplete.",
    name: "Security hardening",
    passMessage: "Security hardening safeguards are wired into the framework.",
  });
}

async function checkRequestValidation(cwd: string): Promise<DoctorCheck> {
  const files = await listFiles(join(cwd, "app/Http/Requests"));
  const violations = [];

  for (const file of files.filter((path) => path.endsWith(".ts"))) {
    const source = await readText(file);
    const relativeFile = relativePath(cwd, file);

    if (!source.includes('from "zod"') && !source.includes("from 'zod'")) {
      violations.push(`${relativeFile} does not import Zod.`);
    }

    if (!source.includes("authorize()")) {
      violations.push(`${relativeFile} does not expose authorize().`);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Request classes must expose authorization and Zod validation.",
    name: "Request validation",
    passMessage: "Request classes expose authorization and Zod validation.",
  });
}

async function checkRealtimeCommunicationSupport(cwd: string): Promise<DoctorCheck> {
  const checks: Array<[string, string, string]> = [
    [
      "routes/api.ts",
      ".ws(broadcastingConfig.websocket.path",
      "routes/api.ts must expose the configured realtime WebSocket endpoint.",
    ],
    [
      "config/providers.ts",
      "QueueServiceProvider",
      "QueueServiceProvider must be registered in config/providers.ts.",
    ],
    [
      "config/providers.ts",
      "MailServiceProvider",
      "MailServiceProvider must be registered in config/providers.ts.",
    ],
    [
      "config/providers.ts",
      "BroadcastServiceProvider",
      "BroadcastServiceProvider must be registered in config/providers.ts.",
    ],
    [
      "config/providers.ts",
      "NotificationServiceProvider",
      "NotificationServiceProvider must be registered in config/providers.ts.",
    ],
    [
      "config/queue.ts",
      "QUEUE_CONNECTION",
      "config/queue.ts must own queue connection configuration.",
    ],
    [
      "config/mail.ts",
      "MAIL_HOST",
      "config/mail.ts must own SMTP host configuration.",
    ],
    [
      "config/mail.ts",
      "MAIL_USERNAME",
      "config/mail.ts must own SMTP username configuration.",
    ],
    [
      "config/mail.ts",
      "MAIL_PASSWORD",
      "config/mail.ts must own SMTP password configuration.",
    ],
    [
      "config/broadcasting.ts",
      "BROADCAST_WS_PATH",
      "config/broadcasting.ts must own realtime WebSocket path configuration.",
    ],
    [
      "config/notifications.ts",
      "NOTIFICATIONS_QUEUE",
      "config/notifications.ts must own notification queue defaults.",
    ],
    [
      "app/Support/Notifications/NotificationDispatcher.ts",
      "queueManager.push",
      "NotificationDispatcher must dispatch queued notifications through the queue manager.",
    ],
    [
      "app/Console/Kernel.ts",
      "queue:work [--max-jobs=100]",
      "Console kernel must list the Laravel-style queue worker command.",
    ],
  ];
  const violations = [];

  for (const [file, expected, message] of checks) {
    const source = await readText(join(cwd, file));

    if (!source.includes(expected)) {
      violations.push(message);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Queue, mail, notifications, and realtime broadcasting support are incomplete.",
    name: "Realtime communication support",
    passMessage: "Queue, mail, notifications, and realtime broadcasting support are wired.",
  });
}

async function checkDatabaseConsoleSupport(cwd: string): Promise<DoctorCheck> {
  const checks: Array<[string, string, string]> = [
    [
      "app/Console/Kernel.ts",
      "db:migrate --seed",
      "Console kernel must list migrate --seed.",
    ],
    [
      "app/Console/Kernel.ts",
      "db:migrate:fresh [--seed]",
      "Console kernel must list migrate fresh.",
    ],
    [
      "app/Console/Kernel.ts",
      "db:migrate:rollback",
      "Console kernel must list migrate rollback.",
    ],
    [
      "app/Console/Kernel.ts",
      "db:migrate:reset",
      "Console kernel must list migrate reset.",
    ],
    [
      "app/Console/Kernel.ts",
      "db:seed [--class=SeederName|--file=SeederName]",
      "Console kernel must list targeted seeders.",
    ],
    [
      "app/Console/Commands/DatabaseMigrateCommand.ts",
      "hasSeedFlag",
      "DatabaseMigrateCommand must support --seed.",
    ],
    [
      "app/Console/Commands/DatabaseMigrateFreshCommand.ts",
      "resetDatabaseSchema",
      "DatabaseMigrateFreshCommand must reset schema before migrating.",
    ],
    [
      "app/Console/Commands/DatabaseMigrateRollbackCommand.ts",
      "resetDatabaseSchema",
      "DatabaseMigrateRollbackCommand must reset schema for rollback support.",
    ],
    [
      "app/Console/Commands/DatabaseMigrateResetCommand.ts",
      "resetDatabaseSchema",
      "DatabaseMigrateResetCommand must reset schema.",
    ],
    [
      "app/Console/Commands/DatabaseSeedCommand.ts",
      "parseSeederTarget",
      "DatabaseSeedCommand must support targeted seeders.",
    ],
  ];
  const violations = [];

  for (const [file, expected, message] of checks) {
    const source = await readText(join(cwd, file));

    if (!source.includes(expected)) {
      violations.push(message);
    }
  }

  return makeCheck({
    details: violations,
    failMessage: "Laravel-style database console support is incomplete.",
    name: "Database console support",
    passMessage: "Laravel-style database console commands are wired.",
  });
}

async function checkGeneratedSupportPaths(cwd: string): Promise<DoctorCheck> {
  const generator = await readText(join(cwd, "app/Console/generator.ts"));
  const violations = [];

  if (generator.includes("app/Database/client.ts")) {
    violations.push("Seeder generator points to app/Database instead of config/Database.");
  }

  if (!generator.includes('from "zod"')) {
    violations.push("Generator templates must include Zod validation where required.");
  }

  if (!generator.includes("renderPolicy") || !generator.includes("PolicyContext")) {
    violations.push("Generator must emit Laravel-style policy classes.");
  }

  return makeCheck({
    details: violations,
    failMessage: "Console generator emits artifacts that violate framework rules.",
    name: "Generator templates",
    passMessage: "Console generator emits framework-compliant artifacts.",
  });
}

async function checkTypecheckGate(cwd: string): Promise<DoctorCheck> {
  const manifest = await readText(join(cwd, "package.json"));
  const violations = [];

  if (!manifest.includes('"typecheck"')) {
    violations.push("package.json must expose a typecheck script.");
  }

  if (!(await readText(join(cwd, "tsconfig.json"))).includes('"strict": true')) {
    violations.push("tsconfig.json must enable strict type checking.");
  }

  return makeCheck({
    details: violations,
    failMessage: "The TypeScript validation gate is not configured.",
    name: "Typecheck gate",
    passMessage: "A strict typecheck gate is configured.",
  });
}

async function checkTypecheck(
  cwd: string,
  runCommand: DoctorCommandRunner
): Promise<DoctorCheck> {
  const result = await runCommand(
    [Bun.argv[0] ?? "bun", "x", "tsc", "--noEmit"],
    {
      cwd,
    }
  );
  const details = [];

  if (result.exitCode !== 0) {
    details.push(`tsc --noEmit exited with code ${result.exitCode}.`);
    details.push(...failureOutputLines(result.stdout));
    details.push(...failureOutputLines(result.stderr));
  }

  return makeCheck({
    details,
    failMessage: "TypeScript reported type errors.",
    name: "Type diagnostics",
    passMessage: "tsc --noEmit passed.",
  });
}

async function checkTestSuite(
  cwd: string,
  runCommand: DoctorCommandRunner
): Promise<DoctorCheck> {
  const result = await runCommand([Bun.argv[0] ?? "bun", "test"], {
    cwd,
  });
  const details = [];

  if (result.exitCode !== 0) {
    details.push(`bun test exited with code ${result.exitCode}.`);
    details.push(...failureOutputLines(result.stdout));
    details.push(...failureOutputLines(result.stderr));
  }

  return makeCheck({
    details,
    failMessage: "bun test reported failures.",
    name: "Code diagnostics",
    passMessage: "bun test passed.",
  });
}

async function runProcessCommand(
  command: string[],
  options: { cwd: string }
): Promise<DoctorCommandResult> {
  const process = Bun.spawn(command, {
    cwd: options.cwd,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  return {
    exitCode,
    stderr,
    stdout,
  };
}

function makeCheck(input: {
  details: string[];
  failMessage: string;
  name: string;
  passMessage: string;
}): DoctorCheck {
  if (input.details.length > 0) {
    return {
      details: input.details,
      message: input.failMessage,
      name: input.name,
      status: "fail",
    };
  }

  return {
    message: input.passMessage,
    name: input.name,
    status: "pass",
  };
}

async function sourceFiles(cwd: string) {
  const roots = ["app", "bootstrap", "config", "database", "routes"];
  const files = [];

  for (const root of roots) {
    files.push(...(await listFiles(join(cwd, root))));
  }

  return files.filter((file) => [".ts", ".tsx", ".js", ".mjs"].includes(extname(file)));
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await listEntries(path);
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(...(await listFiles(entry.path)));
    } else {
      files.push(entry.path);
    }
  }

  return files;
}

async function listEntries(path: string) {
  try {
    const entries = await readdir(path, {
      withFileTypes: true,
    });

    return entries.map((entry) => ({
      isDirectory: entry.isDirectory(),
      path: join(path, entry.name),
    }));
  } catch {
    return [];
  }
}

async function pathExists(cwd: string, path: string) {
  return stat(join(cwd, path))
    .then(() => true)
    .catch(() => false);
}

async function readText(path: string) {
  return Bun.file(path).text().catch(() => "");
}

function relativePath(cwd: string, path: string) {
  return relative(cwd, path).replace(/\\/g, "/");
}

/**
 * Bun prints the failure summary and error detail at the end of its output, so
 * the tail is what explains a failing run. Keep a little head for context and
 * elide the middle rather than cutting the cause off.
 */
export function failureOutputLines(output: string, limit = 20) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());

  if (lines.length <= limit) {
    return lines;
  }

  const headCount = Math.floor(limit / 4);
  const tailCount = limit - headCount;

  return [
    ...lines.slice(0, headCount),
    `... ${lines.length - limit} more line(s) elided ...`,
    ...lines.slice(-tailCount),
  ];
}
