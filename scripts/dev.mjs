#!/usr/bin/env node
/**
 * dev/start coordinator: launches the Next.js panel together with a single worker.
 * Usage: node scripts/dev.mjs [nextArgs...]
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] === "--production" ? "production" : "development";
const nextCmd = process.argv[2] === "--production" ? "start" : "dev";
const nextArgs = process.argv.slice(3);

// Repo root: real binaries are opened with process.execPath so signals reach
// the target process directly, instead of the npx chain (npm exec -> tsx -> node).
const root = fileURLToPath(new URL("..", import.meta.url));
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");
const nextBin = path.join(root, "node_modules/next/dist/bin/next");

const children = [];
const exits = [];
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
      console.error(`[${name}] exited unexpectedly (code ${code}); shutting down all processes.`);
      shutdown(code ?? 1);
    }
  });
  exits.push(
    new Promise((resolve) => {
      child.on("exit", resolve);
    }),
  );
  children.push(child);
  return child;
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  // First wait for all children to exit; after 5 s the stragglers are force-killed.
  // Exiting before the children die leaves the worker orphaned holding its profile lock.
  const killTimer = setTimeout(() => {
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {
        // the process may have exited already
      }
    }
  }, 5000);
  await Promise.allSettled(exits);
  clearTimeout(killTimer);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnChild("panel", process.execPath, [nextBin, nextCmd, ...nextArgs]);
spawnChild("worker", process.execPath, [tsxCli, "src/worker/index.ts"]);

setInterval(() => {}, 60_000);
