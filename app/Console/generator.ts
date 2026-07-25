import { basename, dirname, join, relative } from "node:path";
import { mkdir } from "node:fs/promises";

import {
  generatorAliases,
  generatorDefinitions,
  type GeneratorKind,
} from "../../config/console";

export {
  generatorAliases,
  generatorCommands,
  generatorDefinitions,
  type GeneratorKind,
} from "../../config/console";

export type GeneratorOptions = {
  cwd?: string;
  force?: boolean;
  testSuite?: "unit" | "feature" | "integration";
};

export type GeneratorArtifact = {
  className: string;
  filePath: string;
  kind: GeneratorKind;
  content: string;
};

export function generatorKindFromCommand(command: string) {
  const entry = Object.entries(generatorDefinitions).find(
    ([, definition]) => definition.command === command
  );

  return (
    (entry?.[0] as GeneratorKind | undefined) ??
    generatorAliases[command as keyof typeof generatorAliases]
  );
}

export function parseGeneratorArgs(args: string[]) {
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const values = args.filter((arg) => !arg.startsWith("--"));

  return {
    name: values[0],
    force: flags.has("--force"),
    testSuite: parseTestSuite(flags),
  };
}

export function buildArtifact(
  kind: GeneratorKind,
  name: string,
  options: GeneratorOptions = {}
): GeneratorArtifact {
  const className = normalizeClassName(name, generatorDefinitions[kind].suffix);
  const filePath = resolveArtifactPath(kind, name, className, options);

  return {
    className,
    filePath,
    kind,
    content: renderArtifact(kind, className, filePath, options),
  };
}

export async function generateArtifact(
  kind: GeneratorKind,
  name: string,
  options: GeneratorOptions = {}
) {
  const artifact = buildArtifact(kind, name, options);

  if (!options.force && (await Bun.file(artifact.filePath).exists())) {
    throw new Error(
      `${artifact.filePath} already exists. Re-run with --force to overwrite.`
    );
  }

  await mkdir(dirname(artifact.filePath), { recursive: true });
  await Bun.write(artifact.filePath, artifact.content);

  return artifact;
}

export function normalizeClassName(name: string, suffix = "") {
  const baseName = basename(name.replace(/\\/g, "/")).replace(/\.[^.]+$/, "");
  const className = baseName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  if (!className || !/^[A-Za-z][A-Za-z0-9]*$/.test(className)) {
    throw new Error(`Invalid artifact name: ${name}`);
  }

  return suffix && !className.endsWith(suffix) ? `${className}${suffix}` : className;
}

export function tableNameFromModel(className: string) {
  const snake = className
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

  if (snake.endsWith("y")) {
    return `${snake.slice(0, -1)}ies`;
  }

  if (snake.endsWith("s")) {
    return `${snake}es`;
  }

  return `${snake}s`;
}

export function variableNameFromClass(className: string) {
  return className.charAt(0).toLowerCase() + className.slice(1);
}

/** `bun run test:feature` targets `tests/features`, so the suite name is pluralized. */
export function testSuiteDirectory(
  suite: GeneratorOptions["testSuite"] = "unit"
) {
  return suite === "feature" ? "tests/features" : `tests/${suite}`;
}

/**
 * Bun only discovers `*.test.ts`, so the suite infix has to sit before it:
 * `tests/features/health.feature.test.ts`, `tests/unit/health.test.ts`.
 */
export function testFileName(
  className: string,
  suite: GeneratorOptions["testSuite"] = "unit"
) {
  const subject = toKebabCase(className.replace(/Test$/, "")) || "generated";
  const infix = suite === "unit" ? "" : `.${suite}`;

  return `${subject}${infix}.test.ts`;
}

function parseTestSuite(flags: Set<string>): NonNullable<GeneratorOptions["testSuite"]> {
  if (flags.has("--feature")) {
    return "feature";
  }

  if (flags.has("--integration")) {
    return "integration";
  }

  return "unit";
}

function resolveArtifactPath(
  kind: GeneratorKind,
  name: string,
  className: string,
  options: GeneratorOptions
) {
  const cwd = options.cwd ?? process.cwd();
  const definition = generatorDefinitions[kind];
  const nestedDirectories = kind === "migration" ? [] : directorySegmentsFromName(name);

  if (kind === "migration") {
    return join(cwd, definition.directory, `${timestamp()}_${toMigrationName(className)}.sql`);
  }

  if (kind === "test") {
    const suite = options.testSuite ?? "unit";

    return join(
      cwd,
      testSuiteDirectory(suite),
      ...nestedDirectories,
      testFileName(className, suite)
    );
  }

  if (kind === "model") {
    return join(cwd, definition.directory, ...nestedDirectories, `${className}.ts`);
  }

  return join(cwd, definition.directory, ...nestedDirectories, `${className}.ts`);
}

function directorySegmentsFromName(name: string) {
  const segments = name
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Invalid artifact name: ${name}`);
  }

  return segments.slice(0, -1).map((segment) => normalizeClassName(segment, ""));
}

function renderArtifact(
  kind: GeneratorKind,
  className: string,
  filePath: string,
  options: GeneratorOptions
) {
  switch (kind) {
    case "command":
      return renderCommand(className);
    case "controller":
      return renderController(className);
    case "middleware":
      return renderMiddleware(className);
    case "migration":
      return renderMigration(className);
    case "model":
      return renderModel(className);
    case "policy":
      return renderPolicy(className, filePath, options.cwd ?? process.cwd());
    case "provider":
      return renderProvider(className);
    case "request":
      return renderRequest(className, filePath, options.cwd ?? process.cwd());
    case "seeder":
      return renderSeeder(className, filePath, options.cwd ?? process.cwd());
    case "test":
      return renderTest(className, filePath);
  }
}

function renderCommand(className: string) {
  const schemaName = `${variableNameFromClass(className)}OptionsSchema`;
  const signature = toKebabCase(className.replace(/Command$/, ""));

  return `import { z } from "zod";

// Register this command in bootstrap/console.ts so \`bun panda ${signature}\`
// can resolve it:
//
//   import { ${className} } from "../app/Console/Commands/${className}";
//   export const consoleCommands: ConsoleCommandConstructor[] = [..., ${className}];

export const ${schemaName} = z
  .object({
    cwd: z.string().optional(),
  })
  .passthrough();

export type ${className}Options = z.infer<typeof ${schemaName}>;

export class ${className} {
  readonly signature = "${toKebabCase(className.replace(/Command$/, ""))}";
  readonly description = "Describe the command.";

  async handle(
    stdout: (message: string) => void = console.log,
    _stderr: (message: string) => void = console.error,
    options: unknown = {}
  ) {
    const validated = ${schemaName}.parse(options);

    stdout(\`\${this.signature} executed.\`);

    return validated;
  }
}
`;
}

function renderController(className: string) {
  const schemaName = `${variableNameFromClass(className)}IndexQuerySchema`;
  const queryType = `${className}IndexQuery`;

  return `import { z } from "zod";

export const ${schemaName} = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(100).default(15),
  })
  .strict();

export type ${queryType} = z.infer<typeof ${schemaName}>;

export type ControllerResponse<TBody> = {
  status: number;
  body: TBody;
};

export class ${className} {
  index(input: unknown = {}): ControllerResponse<{
    data: unknown[];
    meta: ${queryType};
  }> {
    const query = ${schemaName}.parse(input);

    return {
      status: 200,
      body: {
        data: [],
        meta: query,
      },
    };
  }
}
`;
}

function renderMiddleware(className: string) {
  const schemaName = `${variableNameFromClass(className)}HeadersSchema`;

  return `import type { Elysia } from "elysia";
import { z } from "zod";

export const ${schemaName} = z
  .object({
    "x-request-id": z.string().trim().min(1).optional(),
  })
  .passthrough();

export class ${className} {
  handle(app: Elysia) {
    return app.onBeforeHandle(({ request, set }) => {
      const headers = Object.fromEntries(request.headers.entries());
      const result = ${schemaName}.safeParse(headers);

      if (!result.success) {
        set.status = 400;

        return {
          message: "Invalid request headers.",
          issues: result.error.issues,
        };
      }
    });
  }
}
`;
}

function renderMigration(className: string) {
  return `-- ${className}
-- Add SQL migration statements here.
`;
}

function renderModel(className: string) {
  const tableName = tableNameFromModel(className);
  const variableName = variableNameFromClass(className);

  return `export const ${variableName}Model = {
  tableName: "${tableName}",
} as const;

export type ${className} = {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type New${className} = Omit<${className}, "id">;
`;
}

function renderPolicy(className: string, filePath: string, cwd: string) {
  const policyImport = relativeImportPath(filePath, join(cwd, "app/Policies/Policy.ts"));
  const resource = toKebabCase(className.replace(/Policy$/, ""));

  return `import {
  allow,
  deny,
  userHasPermission,
  userHasRole,
  type PolicyContext,
  type PolicyUser,
} from "${policyImport}";

export class ${className} {
  viewAny({ user }: PolicyContext) {
    return this.can(user, "${resource}.view");
  }

  view({ user }: PolicyContext) {
    return this.can(user, "${resource}.view");
  }

  create({ user }: PolicyContext) {
    return this.can(user, "${resource}.create");
  }

  update({ user }: PolicyContext) {
    return this.can(user, "${resource}.update");
  }

  delete({ user }: PolicyContext) {
    return this.can(user, "${resource}.delete");
  }

  private can(user: PolicyUser | null | undefined, permission: string) {
    if (userHasRole(user, "admin") || userHasPermission(user, permission)) {
      return allow();
    }

    return deny(\`Missing permission: \${permission}\`);
  }
}
`;
}

function renderProvider(className: string) {
  return `import type { Elysia } from "elysia";

import type { ServiceProvider } from "./ServiceProvider";

export class ${className} implements ServiceProvider {
  register(app: Elysia) {
    return app;
  }

  boot(app: Elysia) {
    return app;
  }
}
`;
}

function renderRequest(className: string, filePath: string, cwd: string) {
  const schemaName = `${variableNameFromClass(className)}Schema`;
  const dataType = `${className}Data`;
  const requestErrorImport = relativeImportPath(
    filePath,
    join(cwd, "app/Support/HttpError.ts")
  );

  return `import { z } from "zod";

import { InvalidJsonRequestError } from "${requestErrorImport}";

export const ${schemaName} = z
  .object({
    name: z.string().trim().min(1),
  })
  .strict();

export type ${dataType} = z.infer<typeof ${schemaName}>;

export class ${className} {
  constructor(private readonly request: Request) {}

  authorize() {
    return true;
  }

  async validate(): Promise<${dataType}> {
    return ${schemaName}.parse(await this.body());
  }

  safeValidate(input: unknown) {
    return ${schemaName}.safeParse(input);
  }

  private async body() {
    if (!this.acceptsJson()) {
      return {};
    }

    try {
      return await this.request.json();
    } catch {
      throw new InvalidJsonRequestError();
    }
  }

  private acceptsJson() {
    return this.request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json");
  }
}
`;
}

function renderSeeder(className: string, filePath: string, cwd: string) {
  const clientImport = relativeImportPath(filePath, join(cwd, "config/Database/client.ts"));
  const fakerImport = relativeImportPath(
    filePath,
    join(cwd, "app/Support/Seeders/faker.ts")
  );
  const seederImport = relativeImportPath(
    filePath,
    join(cwd, "app/Support/Seeders/Seeder.ts")
  );

  return `import type { Database } from "${clientImport}";
import type { Seeder, SeederRunOptions } from "${seederImport}";
import {
  createSeederContext,
  makeSeederRecords,
} from "${fakerImport}";

export class ${className} implements Seeder {
  async run(_db: Database, options: SeederRunOptions = {}) {
    const context = options.context ?? createSeederContext();
    const records = makeSeederRecords(
      ({ faker }) => ({
        name: faker.company.name(),
      }),
      1,
      context
    );

    return records.length;
  }
}
`;
}

function renderTest(className: string, filePath: string) {
  const subject = normalizeClassName(className.replace(/test$/i, ""), "");

  return `import { describe, expect, it } from "bun:test";

describe("${subject}", () => {
  it("has a generated test placeholder", () => {
    expect("${dirname(filePath)}").toContain("tests");
  });
});
`;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toMigrationName(className: string) {
  return className
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
}

function relativeImportPath(fromFilePath: string, targetFilePath: string) {
  const importPath = relative(dirname(fromFilePath), targetFilePath)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");

  return importPath.startsWith(".") ? importPath : `./${importPath}`;
}
