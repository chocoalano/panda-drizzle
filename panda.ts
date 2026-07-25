#!/usr/bin/env bun
import { handleConsole } from "./app/Console/Kernel";

const result = await handleConsole(Bun.argv.slice(2));

process.exit(result.exitCode);
