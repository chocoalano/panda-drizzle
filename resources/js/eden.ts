import { treaty } from "@elysia/eden";

import type { ApiApp } from "../../api";
import { edenConfig } from "../../config/eden";

export const defaultEdenBaseUrl = edenConfig.defaultBaseUrl;

export type EdenDomain = string | ApiApp;

export function createEdenClient(domain: EdenDomain = defaultEdenBaseUrl) {
  return treaty<ApiApp>(domain);
}
