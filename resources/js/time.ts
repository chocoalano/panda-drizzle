import { appConfig, normalizeAppLocale, normalizeTimeZone } from "../../config/app";

export type TimestampFormatOptions = {
  locale?: string;
  timeZone?: string;
};

const monthNames = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  id_ID: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
} as const;

export function formatServiceTimestamp(
  value: string | null | undefined,
  options: TimestampFormatOptions = {}
) {
  if (!value) {
    return "Waiting for service";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid service timestamp";
  }

  const locale = normalizeAppLocale(options.locale ?? appConfig.locale);
  const timeZone = normalizeTimeZone(options.timeZone ?? appConfig.timeZone);
  const parts = timestampParts(date, timeZone);
  const month = monthName(Number(parts.month), locale);
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;

  if (locale.startsWith("id")) {
    return `${parts.day} ${month} ${parts.year} ${time} ${timeZone}`;
  }

  return `${month} ${parts.day}, ${parts.year} ${time} ${timeZone}`;
}

function timestampParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    day: parts.day ?? "01",
    hour: parts.hour ?? "00",
    minute: parts.minute ?? "00",
    month: parts.month ?? "01",
    second: parts.second ?? "00",
    year: parts.year ?? "1970",
  };
}

function monthName(month: number, locale: string) {
  const names = locale.startsWith("id") ? monthNames.id_ID : monthNames.en;

  return names[month - 1] ?? names[0];
}
