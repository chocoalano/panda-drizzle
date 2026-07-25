import { describe, expect, it } from "bun:test";

import type { ConsoleCommand } from "../../app/Console/Kernel";
import {
  assertUniqueSignatures,
  consoleCommands,
  registerConsoleCommands,
} from "../../bootstrap/console";

function makeCommand(signature: string): ConsoleCommand {
  return {
    signature,
    handle() {},
  };
}

describe("consoleCommands", () => {
  it("registers the framework runtime commands", () => {
    const signatures = registerConsoleCommands().map(
      (command) => command.signature
    );

    expect(signatures).toContain("doctor");
    expect(signatures).toContain("db:generate");
    expect(signatures).toContain("db:migrate");
    expect(signatures).toContain("db:migrate:fresh");
    expect(signatures).toContain("db:migrate:rollback");
    expect(signatures).toContain("db:migrate:reset");
    expect(signatures).toContain("db:seed");
    expect(signatures).toContain("queue:work");
  });

  it("registers every listed constructor", () => {
    expect(registerConsoleCommands()).toHaveLength(consoleCommands.length);
  });
});

describe("registerConsoleCommands", () => {
  it("instantiates provided command constructors", () => {
    class ReportCommand implements ConsoleCommand {
      readonly signature = "report";
      handle() {}
    }

    expect(registerConsoleCommands([ReportCommand])).toEqual([
      expect.any(ReportCommand),
    ]);
  });
});

describe("assertUniqueSignatures", () => {
  it("accepts distinct signatures", () => {
    const commands = [makeCommand("a"), makeCommand("b")];

    expect(assertUniqueSignatures(commands)).toBe(commands);
  });

  it("rejects a duplicate signature so shadowed commands are caught early", () => {
    expect(() =>
      assertUniqueSignatures([makeCommand("report"), makeCommand("report")])
    ).toThrow("Duplicate console command signature: report");
  });
});
