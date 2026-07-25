import { Faker, en, id_ID, type LocaleDefinition } from "@faker-js/faker";

import {
  resolveSeederFakerConfig,
  type SeederFakerConfig,
  type SeederFakerLocale,
  type SeederFakerOptions,
} from "../../../config/seeder";

export {
  DEFAULT_SEEDER_FAKER_LOCALE,
  DEFAULT_SEEDER_FAKER_REF_DATE,
  DEFAULT_SEEDER_FAKER_SEED,
  resolveSeederFakerConfig,
  seederConfig,
  type SeederFakerConfig,
  type SeederFakerLocale,
  type SeederFakerOptions,
} from "../../../config/seeder";

export type SeederContext = SeederFakerConfig & {
  faker: Faker;
  now: Date;
};

export type SeederFactory<TRecord> = (
  context: SeederContext,
  index: number
) => TRecord;

export function createSeederFaker(config: SeederFakerConfig) {
  const faker = new Faker({
    locale: localeDefinitions(config.locale),
    seed: config.seed,
  });

  faker.setDefaultRefDate(config.refDate);

  return faker;
}

export function createSeederContext(
  options: SeederFakerOptions = {}
): SeederContext {
  const config = resolveSeederFakerConfig(options);
  const faker = createSeederFaker(config);

  return {
    ...config,
    faker,
    now: new Date(config.refDate),
  };
}

export function makeSeederRecords<TRecord>(
  factory: SeederFactory<TRecord>,
  count: number,
  context?: SeederContext
) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Seeder record count must be a non-negative integer.");
  }

  const seederContext = context ?? createSeederContext();

  return Array.from({ length: count }, (_, index) => factory(seederContext, index));
}

export function summarizeSeederContext(context: SeederContext) {
  return {
    seed: context.seed,
    locale: context.locale,
    refDate: context.refDate.toISOString(),
  };
}

function localeDefinitions(locale: SeederFakerLocale): LocaleDefinition[] {
  if (locale === "id_ID") {
    return [id_ID, en];
  }

  return [en];
}
