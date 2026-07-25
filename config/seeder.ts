import { appConfig, isProductionEnvironment } from "./app";
import { env, envBoolean } from "./env";

export type SeederFakerLocale = "en" | "id_ID";

export type SeederFakerOptions = {
  seed?: number | string;
  refDate?: Date | number | string;
  locale?: SeederFakerLocale | string;
};

export type SeederFakerConfig = {
  seed: number;
  refDate: Date;
  locale: SeederFakerLocale;
};

export const DEFAULT_SEEDER_FAKER_SEED = 20260716;
export const DEFAULT_SEEDER_FAKER_REF_DATE = "2026-01-01T00:00:00.000Z";
export const DEFAULT_SEEDER_FAKER_LOCALE: SeederFakerLocale = "id_ID";

export const seederConfig = {
  allowTargetSeeders: envBoolean(
    "SEEDER_ALLOW_TARGETS",
    !isProductionEnvironment(appConfig.env)
  ),
  faker: resolveSeederFakerConfig(),
};

export type SeederConfig = typeof seederConfig;

export function resolveSeederFakerConfig(
  options: SeederFakerOptions = {}
): SeederFakerConfig {
  return {
    seed: parseSeed(
      options.seed ?? env("SEEDER_FAKER_SEED", `${DEFAULT_SEEDER_FAKER_SEED}`)
    ),
    refDate: parseRefDate(
      options.refDate ?? env("SEEDER_FAKER_REF_DATE", DEFAULT_SEEDER_FAKER_REF_DATE)
    ),
    locale: normalizeLocale(
      options.locale ??
        env("SEEDER_FAKER_LOCALE", appConfig.locale || DEFAULT_SEEDER_FAKER_LOCALE)
    ),
  };
}

function normalizeLocale(locale: string): SeederFakerLocale {
  const normalized = locale.trim().replace("-", "_").toLowerCase();

  if (normalized === "id" || normalized === "id_id") {
    return "id_ID";
  }

  if (normalized === "en" || normalized === "en_us") {
    return "en";
  }

  throw new Error(`Unsupported seeder Faker locale: ${locale}`);
}

function parseSeed(seed: number | string) {
  const parsed = typeof seed === "number" ? seed : Number(seed);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid SEEDER_FAKER_SEED value: ${seed}`);
  }

  return parsed;
}

function parseRefDate(refDate: Date | number | string) {
  const date = refDate instanceof Date ? new Date(refDate) : new Date(refDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid SEEDER_FAKER_REF_DATE value: ${refDate}`);
  }

  return date;
}
