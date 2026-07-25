import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { AppServiceProvider } from "../../app/Providers/AppServiceProvider";
import { appConfig } from "../../config/app";

describe("AppServiceProvider", () => {
  it("returns the app during register and boot", () => {
    const app = new Elysia();
    const provider = new AppServiceProvider();

    expect(provider.register(app)).toBe(app);
    expect(provider.boot(app)).toBe(app);
  });
});
