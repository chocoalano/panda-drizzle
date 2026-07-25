import { describe, expect, it } from "bun:test";

import {
  DoctorCommand,
  failureOutputLines,
  formatDoctorResult,
  runFrameworkDoctor,
} from "../../app/Console/Commands/DoctorCommand";

describe("runFrameworkDoctor", () => {
  it("passes when framework rules and diagnostics pass", async () => {
    const result = await runFrameworkDoctor({
      runCommand: async () => ({
        exitCode: 0,
        stderr: "",
        stdout: "ok",
      }),
    });

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.name)).toContain(
      "Migration directory"
    );
    expect(result.checks.map((check) => check.name)).toContain(
      "Code diagnostics"
    );
    expect(result.checks.map((check) => check.name)).toContain(
      "Security hardening"
    );
    expect(result.checks.map((check) => check.name)).toContain(
      "Realtime communication support"
    );
    expect(result.checks.map((check) => check.name)).toContain(
      "Database console support"
    );
  });

  it("reports the configured typecheck gate", async () => {
    const result = await runFrameworkDoctor({
      runCommand: async () => ({
        exitCode: 0,
        stderr: "",
        stdout: "ok",
      }),
    });

    expect(
      result.checks.find((check) => check.name === "Typecheck gate")
    ).toMatchObject({
      status: "pass",
    });
    expect(
      result.checks.find((check) => check.name === "Type diagnostics")
    ).toMatchObject({
      status: "pass",
    });
  });

  it("fails when type diagnostics fail", async () => {
    const result = await runFrameworkDoctor({
      runCommand: async (command) => ({
        exitCode: command.includes("tsc") ? 2 : 0,
        stderr: command.includes("tsc")
          ? "app/x.ts(1,1): error TS2322: Type 'string' is not assignable."
          : "",
        stdout: "",
      }),
    });
    const check = result.checks.find((item) => item.name === "Type diagnostics");

    expect(result.passed).toBe(false);
    expect(check?.status).toBe("fail");
    expect(check?.details).toContain(
      "app/x.ts(1,1): error TS2322: Type 'string' is not assignable."
    );
  });

  it("fails when code diagnostics fail", async () => {
    const result = await runFrameworkDoctor({
      runCommand: async () => ({
        exitCode: 1,
        stderr: "failure",
        stdout: "",
      }),
    });

    expect(result.passed).toBe(false);
    expect(
      result.checks.find((check) => check.name === "Code diagnostics")
    ).toMatchObject({
      status: "fail",
    });
  });
});

describe("failureOutputLines", () => {
  it("keeps short output intact", () => {
    expect(failureOutputLines("a\n\nb\n")).toEqual(["a", "b"]);
  });

  it("keeps the tail, where the real cause is reported", () => {
    const output = [
      ...Array.from({ length: 40 }, (_, index) => `noise ${index}`),
      "error: Failed to bind WebSocket port (EPERM)",
      "1 fail",
    ].join("\n");
    const lines = failureOutputLines(output);

    expect(lines).toContain("error: Failed to bind WebSocket port (EPERM)");
    expect(lines).toContain("1 fail");
    expect(lines[0]).toBe("noise 0");
    expect(lines.some((line) => line.includes("more line(s) elided"))).toBe(true);
    expect(lines).toHaveLength(21);
  });
});

describe("runFrameworkDoctor diagnostics detail", () => {
  it("surfaces the failing tail of bun test output", async () => {
    const result = await runFrameworkDoctor({
      runCommand: async () => ({
        exitCode: 1,
        stderr: [
          ...Array.from({ length: 40 }, (_, index) => `noise ${index}`),
          "error: listen EPERM 0.0.0.0:0",
        ].join("\n"),
        stdout: "",
      }),
    });
    const check = result.checks.find((item) => item.name === "Code diagnostics");

    expect(check?.status).toBe("fail");
    expect(check?.details).toContain("error: listen EPERM 0.0.0.0:0");
  });
});

describe("DoctorCommand", () => {
  it("prints a doctor report", async () => {
    const output: string[] = [];
    const command = new DoctorCommand(async () => ({
      checks: [
        {
          message: "All good.",
          name: "Example",
          status: "pass",
        },
      ],
      passed: true,
    }));

    await command.handle((message) => output.push(message));

    expect(output.join("\n")).toContain("Framework Doctor");
    expect(output.join("\n")).toContain("Status: PASS");
  });
});

describe("formatDoctorResult", () => {
  it("formats failed checks with details", () => {
    expect(
      formatDoctorResult({
        checks: [
          {
            details: ["database/migrations/meta"],
            message: "Forbidden path exists.",
            name: "Forbidden framework paths",
            status: "fail",
          },
        ],
        passed: false,
      })
    ).toEqual([
      "Framework Doctor",
      "Status: FAIL",
      "",
      "FAIL Forbidden framework paths",
      "  Forbidden path exists.",
      "  - database/migrations/meta",
    ]);
  });
});
