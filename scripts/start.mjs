#!/usr/bin/env node
/**
 * start: production panel + worker birlikte.
 */
import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function prefix(label) {
  return (chunk) => {
    process.stdout.write(
      chunk
        .toString()
        .split("\n")
        .filter(Boolean)
        .map((line) => `[${label}] ${line}`)
        .join("\n") + "\n",
    );
  };
}

function spawnChild(name, command, args) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout.on("data", prefix(name));
  child.stderr.on("data", prefix(name));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[${name}] exited unexpectedly (code ${code}).`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnChild("panel", "npx", ["next", "start"]);
spawnChild("worker", "npx", ["tsx", "src/worker/index.ts"]);

setInterval(() => {}, 60_000);
