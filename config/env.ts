export function env(key: string, fallback = "") {
  return bunEnv(key) ?? processEnv(key) ?? fallback;
}

export function envBoolean(key: string, fallback = false) {
  const value = env(key);

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function bunEnv(key: string) {
  return typeof Bun === "undefined" ? undefined : Bun.env[key];
}

function processEnv(key: string) {
  return typeof process === "undefined" ? undefined : process.env[key];
}
