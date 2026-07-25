import { describe, expect, it } from "bun:test";

import {
  consoleConfig,
  generatorAliases,
  generatorCommands,
  generatorDefinitions,
} from "../../config/console";

describe("consoleConfig", () => {
  it("keeps Laravel-style generator paths in config", () => {
    expect(consoleConfig.generators.controller).toEqual({
      command: "make:controller",
      directory: "app/Http/Controllers",
      suffix: "Controller",
    });
    expect(consoleConfig.generators.model.directory).toBe("app/Models");
    expect(consoleConfig.generators.policy).toEqual({
      command: "make:policy",
      directory: "app/Policies",
      suffix: "Policy",
    });
    expect(consoleConfig.generators.seeder.directory).toBe("database/seeders");
  });

  it("derives generator commands from configured definitions", () => {
    expect(generatorDefinitions).toBe(consoleConfig.generators);
    expect(generatorAliases["make:console"]).toBe("command");
    expect(generatorCommands).toContain("make:console");
    expect(generatorCommands).toContain("make:model");
    expect(generatorCommands).toContain("make:policy");
    expect(generatorCommands).toContain("make:test");
  });
});
