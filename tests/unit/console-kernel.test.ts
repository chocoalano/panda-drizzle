import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleConsole, renderCommandList } from "../../app/Console/Kernel";

describe("renderCommandList", () => {
  it("lists make commands", () => {
    const output = renderCommandList();

    expect(output).toContain("db:generate");
    expect(output).toContain("db:migrate");
    expect(output).toContain("db:migrate:fresh");
    expect(output).toContain("db:migrate:rollback");
    expect(output).toContain("db:migrate:reset");
    expect(output).toContain("db:seed");
    expect(output).toContain("doctor");
    expect(output).toContain("queue:work");
    expect(output).toContain("make:console");
    expect(output).toContain("make:controller");
    expect(output).toContain("make:migration");
    expect(output).toContain("make:model");
    expect(output).toContain("make:policy");
    expect(output).toContain("make:test");
  });
});

describe("handleConsole command registration", () => {
  it("runs a registered command from the console registry", async () => {
    const output: string[] = [];
    const result = await handleConsole(["report", "--force"], {
      commands: [
        {
          signature: "report",
          handle: (stdout) => stdout("report executed."),
        },
      ],
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output.join("\n")).toContain("report executed.");
  });

  it("lists registered commands so generated commands are discoverable", async () => {
    const output: string[] = [];

    await handleConsole(["list"], {
      commands: [
        {
          signature: "report",
          description: "Builds a report.",
          handle: () => {},
        },
      ],
      stdout: (message) => output.push(message),
    });

    expect(output.join("\n")).toContain("report - Builds a report.");
  });

  it("reports an unknown command that was never registered", async () => {
    const errors: string[] = [];
    const result = await handleConsole(["report"], {
      commands: [],
      stdout: () => {},
      stderr: (message) => errors.push(message),
    });

    expect(result.exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Unknown command: report");
  });
});

describe("handleConsole", () => {
  it("prints the command list", async () => {
    const output: string[] = [];
    const result = await handleConsole(["list"], {
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output.join("\n")).toContain("Available commands");
  });

  it("generates files through make commands", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "patshop-console-"));
    const output: string[] = [];

    try {
      const result = await handleConsole(["make:controller", "User"], {
        cwd,
        stdout: (message) => output.push(message),
      });

      expect(result.exitCode).toBe(0);
      expect(output[0]).toContain("UserController.ts");
      expect(
        await Bun.file(
          join(cwd, "app/Http/Controllers/UserController.ts")
        ).exists()
      ).toBe(true);
    } finally {
      await rm(cwd, {
        recursive: true,
        force: true,
      });
    }
  });

  it("runs the database seed command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:seed"], {
      seedCommand: {
        signature: "db:seed",
        handle(stdout) {
          stdout("seeded");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["seeded"]);
  });

  it("runs the doctor command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["doctor"], {
      doctorCommand: {
        signature: "doctor",
        handle(stdout) {
          stdout("healthy");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["healthy"]);
  });

  it("runs the queue worker command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["queue:work", "--max-jobs=5"], {
      queueWorkCommand: {
        signature: "queue:work",
        handle(stdout, _stderr, options) {
          stdout(`worked ${options.args?.join(" ")}`);
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["worked --max-jobs=5"]);
  });

  it("runs the database generate command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:generate"], {
      generateCommand: {
        signature: "db:generate",
        handle(stdout) {
          stdout("generated");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["generated"]);
  });

  it("runs the database migrate command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:migrate"], {
      migrateCommand: {
        signature: "db:migrate",
        handle(stdout) {
          stdout("migrated");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["migrated"]);
  });

  it("runs the database migrate fresh command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:migrate:fresh", "--seed"], {
      migrateFreshCommand: {
        signature: "db:migrate:fresh",
        handle(stdout, _stderr, options) {
          stdout(`fresh ${options.args?.join(" ")}`);
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["fresh --seed"]);
  });

  it("runs the database migrate rollback command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:migrate:rollback"], {
      migrateRollbackCommand: {
        signature: "db:migrate:rollback",
        handle(stdout) {
          stdout("rolled back");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["rolled back"]);
  });

  it("runs the database migrate reset command", async () => {
    const output: string[] = [];
    const result = await handleConsole(["db:migrate:reset"], {
      migrateResetCommand: {
        signature: "db:migrate:reset",
        handle(stdout) {
          stdout("reset");
        },
      },
      stdout: (message) => output.push(message),
    });

    expect(result.exitCode).toBe(0);
    expect(output).toEqual(["reset"]);
  });
});
