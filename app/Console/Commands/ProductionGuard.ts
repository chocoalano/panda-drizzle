import { isProductionEnvironment } from "../../../config/app";

export type ForceableCommandOptions = {
  args?: string[];
  force?: boolean;
};

export function hasForceFlag(options: ForceableCommandOptions = {}) {
  return (
    options.force === true ||
    options.args?.includes("--force") === true ||
    options.args?.includes("--yes") === true
  );
}

export function assertProductionCommandAllowed(
  command: string,
  environment: string,
  options: ForceableCommandOptions = {}
) {
  if (isProductionEnvironment(environment) && !hasForceFlag(options)) {
    throw new Error(
      `Refusing to run ${command} in production without --force.`
    );
  }
}
