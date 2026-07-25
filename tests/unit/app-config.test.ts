import { describe, expect, it } from "bun:test";

import {
  envBooleanValue,
  isProductionEnvironment,
  normalizeAppEnvironment,
  normalizeAppLocale,
  normalizeTimeZone,
  resolveAppDebug,
  resolvePort,
  toIntlLocale,
} from "../../config/app";

describe("normalizeAppEnvironment", () => {
  it("normalizes environment names", () => {
    expect(normalizeAppEnvironment(" Production ")).toBe("production");
    expect(normalizeAppEnvironment(undefined)).toBe("local");
    expect(isProductionEnvironment("production")).toBe(true);
    expect(isProductionEnvironment("local")).toBe(false);
  });
});

describe("resolveAppDebug", () => {
  it("defaults debug mode from APP_ENV and honors explicit APP_DEBUG", () => {
    expect(resolveAppDebug(undefined, "local")).toBe(true);
    expect(resolveAppDebug(undefined, undefined)).toBe(false);
    expect(resolveAppDebug(undefined, "production")).toBe(false);
    expect(resolveAppDebug("false", "local")).toBe(false);
    expect(resolveAppDebug("true", "production")).toBe(true);
  });

  it("normalizes boolean environment values", () => {
    expect(envBooleanValue("on")).toBe(true);
    expect(envBooleanValue("0")).toBe(false);
    expect(envBooleanValue(undefined, true)).toBe(true);
  });
});

describe("resolvePort", () => {
  it("uses a valid numeric port", () => {
    expect(resolvePort("8080")).toBe(8080);
  });

  it("falls back for missing or invalid ports", () => {
    expect(resolvePort(undefined, 4000)).toBe(4000);
    expect(resolvePort("invalid", 4000)).toBe(4000);
    expect(resolvePort("0", 4000)).toBe(4000);
  });
});

describe("normalizeAppLocale", () => {
  it("normalizes app locales to framework underscore format", () => {
    expect(normalizeAppLocale("id-ID")).toBe("id_ID");
    expect(normalizeAppLocale("id_ID")).toBe("id_ID");
    expect(normalizeAppLocale("en-US")).toBe("en_US");
  });

  it("converts framework locale values to Intl locale values", () => {
    expect(toIntlLocale("id_ID")).toBe("id-ID");
  });

  it("falls back for invalid locale values", () => {
    expect(normalizeAppLocale("not a locale", "id_ID")).toBe("id_ID");
  });
});

describe("normalizeTimeZone", () => {
  it("supports UCT as a UTC alias", () => {
    expect(normalizeTimeZone("UCT")).toBe("UTC");
  });

  it("accepts valid IANA time zones", () => {
    expect(normalizeTimeZone("Asia/Jakarta")).toBe("Asia/Jakarta");
  });

  it("falls back for invalid time zones", () => {
    expect(normalizeTimeZone("Mars/Base", "UTC")).toBe("UTC");
  });
});
