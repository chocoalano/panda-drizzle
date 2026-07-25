export type GeneratorKind =
  | "command"
  | "controller"
  | "middleware"
  | "migration"
  | "model"
  | "policy"
  | "provider"
  | "request"
  | "seeder"
  | "test";

export type GeneratorDefinition = {
  command: string;
  directory: string;
  suffix: string;
};

export const consoleConfig = {
  generators: {
    command: {
      command: "make:command",
      directory: "app/Console/Commands",
      suffix: "Command",
    },
    controller: {
      command: "make:controller",
      directory: "app/Http/Controllers",
      suffix: "Controller",
    },
    middleware: {
      command: "make:middleware",
      directory: "app/Http/Middlewares",
      suffix: "Middleware",
    },
    migration: {
      command: "make:migration",
      directory: "database/migrations",
      suffix: "",
    },
    model: {
      command: "make:model",
      directory: "app/Models",
      suffix: "",
    },
    policy: {
      command: "make:policy",
      directory: "app/Policies",
      suffix: "Policy",
    },
    provider: {
      command: "make:provider",
      directory: "app/Providers",
      suffix: "ServiceProvider",
    },
    request: {
      command: "make:request",
      directory: "app/Http/Requests",
      suffix: "Request",
    },
    seeder: {
      command: "make:seeder",
      directory: "database/seeders",
      suffix: "Seeder",
    },
    test: {
      command: "make:test",
      directory: "tests/unit",
      suffix: "Test",
    },
  },
} satisfies {
  generators: Record<GeneratorKind, GeneratorDefinition>;
};

export const generatorDefinitions = consoleConfig.generators;

export const generatorAliases = {
  "make:console": "command",
} satisfies Record<string, GeneratorKind>;

export const generatorCommands = [
  ...Object.values(generatorDefinitions).map((definition) => definition.command),
  ...Object.keys(generatorAliases),
];

export type ConsoleConfig = typeof consoleConfig;
