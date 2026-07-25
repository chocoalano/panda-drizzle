import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildArtifact,
  generateArtifact,
  generatorKindFromCommand,
  normalizeClassName,
  tableNameFromModel,
  testFileName,
  testSuiteDirectory,
} from "../../app/Console/generator";

describe("console generator", () => {
  it("normalizes artifact class names", () => {
    expect(normalizeClassName("user", "Controller")).toBe("UserController");
    expect(normalizeClassName("UserController", "Controller")).toBe(
      "UserController"
    );
  });

  it("maps console commands to generator kinds", () => {
    expect(generatorKindFromCommand("make:model")).toBe("model");
    expect(generatorKindFromCommand("make:policy")).toBe("policy");
    expect(generatorKindFromCommand("make:console")).toBe("command");
    expect(generatorKindFromCommand("missing")).toBeUndefined();
  });

  it("derives table names from model names", () => {
    expect(tableNameFromModel("User")).toBe("users");
    expect(tableNameFromModel("ProductCategory")).toBe("product_categories");
  });

  it("names generated tests so Bun discovers them", () => {
    expect(testFileName("UserTest", "unit")).toBe("user.test.ts");
    expect(testFileName("UserTest", "feature")).toBe("user.feature.test.ts");
    expect(testFileName("UserTest", "integration")).toBe(
      "user.integration.test.ts"
    );
  });

  it("resolves suite directories to the folders the test scripts run", () => {
    expect(testSuiteDirectory("unit")).toBe("tests/unit");
    expect(testSuiteDirectory("feature")).toBe("tests/features");
    expect(testSuiteDirectory("integration")).toBe("tests/integration");
  });

  it("builds test artifacts in the discoverable suite path", () => {
    expect(buildArtifact("test", "User", { testSuite: "unit" }).filePath).toContain(
      "tests/unit/user.test.ts"
    );
    expect(
      buildArtifact("test", "User", { testSuite: "feature" }).filePath
    ).toContain("tests/features/user.feature.test.ts");
    expect(
      buildArtifact("test", "User", { testSuite: "integration" }).filePath
    ).toContain("tests/integration/user.integration.test.ts");
  });

  it("builds a controller artifact inside the current pattern", () => {
    const artifact = buildArtifact("controller", "User");

    expect(artifact.className).toBe("UserController");
    expect(artifact.filePath).toContain("app/Http/Controllers/UserController.ts");
    expect(artifact.content).toContain("export class UserController");
    expect(artifact.content).toContain('from "zod"');
    expect(artifact.content).toContain("userControllerIndexQuerySchema");
    expect(artifact.content).toContain("z.coerce.number()");
  });

  it("builds command artifacts with Zod option validation", () => {
    const artifact = buildArtifact("command", "SyncInventory");

    expect(artifact.filePath).toContain(
      "app/Console/Commands/SyncInventoryCommand.ts"
    );
    expect(artifact.content).toContain('from "zod"');
    expect(artifact.content).toContain("syncInventoryCommandOptionsSchema");
    expect(artifact.content).toContain("z.string().optional()");
  });

  it("keeps nested generator names inside the pattern folders", () => {
    const artifact = buildArtifact("controller", "Admin/User");

    expect(artifact.className).toBe("UserController");
    expect(artifact.filePath).toContain(
      "app/Http/Controllers/Admin/UserController.ts"
    );
  });

  it("builds model artifacts directly in the app model folder", () => {
    const artifact = buildArtifact("model", "User");

    expect(artifact.filePath).toContain("app/Models/User.ts");
    expect(artifact.content).toContain("userModel");
    expect(artifact.content).toContain('tableName: "users"');
  });

  it("builds policy artifacts with RBAC helper methods", () => {
    const artifact = buildArtifact("policy", "SystemSetting");

    expect(artifact.filePath).toContain("app/Policies/SystemSettingPolicy.ts");
    expect(artifact.content).toContain("export class SystemSettingPolicy");
    expect(artifact.content).toContain("PolicyContext");
    expect(artifact.content).toContain("userHasRole");
    expect(artifact.content).toContain("system-setting.view");
  });

  it("builds seeder artifacts with Faker support", () => {
    const artifact = buildArtifact("seeder", "User");

    expect(artifact.filePath).toContain("database/seeders/UserSeeder.ts");
    expect(artifact.content).toContain("implements Seeder");
    expect(artifact.content).toContain("SeederRunOptions");
    expect(artifact.content).toContain("createSeederContext");
    expect(artifact.content).toContain("makeSeederRecords");
    expect(artifact.content).toContain("faker.company.name()");
  });

  it("builds middleware artifacts with Zod header validation", () => {
    const artifact = buildArtifact("middleware", "Tenant");

    expect(artifact.filePath).toContain("app/Http/Middlewares/TenantMiddleware.ts");
    expect(artifact.content).toContain('from "zod"');
    expect(artifact.content).toContain("tenantMiddlewareHeadersSchema");
    expect(artifact.content).toContain("safeParse(headers)");
  });

  it("builds request artifacts with Zod body validation", () => {
    const artifact = buildArtifact("request", "StoreUser");

    expect(artifact.filePath).toContain("app/Http/Requests/StoreUserRequest.ts");
    expect(artifact.content).toContain('from "zod"');
    expect(artifact.content).toContain("storeUserRequestSchema");
    expect(artifact.content).toContain("async validate()");
    expect(artifact.content).toContain("safeValidate(input: unknown)");
    expect(artifact.content).toContain("InvalidJsonRequestError");
  });

  it("builds nested seeder imports relative to the seeder file", () => {
    const artifact = buildArtifact("seeder", "Demo/User");

    expect(artifact.filePath).toContain("database/seeders/Demo/UserSeeder.ts");
    expect(artifact.content).toContain('from "../../../config/Database/client"');
    expect(artifact.content).toContain(
      'from "../../../app/Support/Seeders/Seeder"'
    );
    expect(artifact.content).toContain(
      'from "../../../app/Support/Seeders/faker"'
    );
  });

  it("rejects traversal segments in nested generator names", () => {
    expect(() => buildArtifact("controller", "../User")).toThrow(
      "Invalid artifact name"
    );
  });

  it("writes generated files and protects existing files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "patshop-console-"));

    try {
      const artifact = await generateArtifact("request", "StoreUser", { cwd });

      expect(await Bun.file(artifact.filePath).exists()).toBe(true);
      expect(artifact.filePath).toContain("app/Http/Requests/StoreUserRequest.ts");
      await expect(
        generateArtifact("request", "StoreUser", { cwd })
      ).rejects.toThrow("already exists");
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });
});
