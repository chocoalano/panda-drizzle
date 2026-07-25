import { appConfig } from "./config/app";
import { createApp } from "./bootstrap/app";

const port = appConfig.port;
const app = createApp().listen(port);

console.log(
  `Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
