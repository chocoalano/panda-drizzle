import { describe, expect, it } from "bun:test";

import {
  DEFAULT_SEEDER_FAKER_LOCALE,
  DEFAULT_SEEDER_FAKER_REF_DATE,
  DEFAULT_SEEDER_FAKER_SEED,
  resolveSeederFakerConfig,
} from "../../config/seeder";

describe("seederConfig", () => {
  it("resolves deterministic Faker defaults from config", () => {
    const config = resolveSeederFakerConfig({
      seed: `${DEFAULT_SEEDER_FAKER_SEED}`,
      refDate: DEFAULT_SEEDER_FAKER_REF_DATE,
      locale: DEFAULT_SEEDER_FAKER_LOCALE,
    });

    expect(config).toEqual({
      seed: DEFAULT_SEEDER_FAKER_SEED,
      refDate: new Date(DEFAULT_SEEDER_FAKER_REF_DATE),
      locale: DEFAULT_SEEDER_FAKER_LOCALE,
    });
  });

  it("normalizes supported Faker locale aliases", () => {
    expect(resolveSeederFakerConfig({ locale: "id-ID" }).locale).toBe("id_ID");
    expect(resolveSeederFakerConfig({ locale: "en-US" }).locale).toBe("en");
  });
});
