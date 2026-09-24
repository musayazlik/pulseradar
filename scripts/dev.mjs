#!/usr/bin/env node
/**
 * dev/start koordinatörü: Next.js paneli ile tek worker'ı birlikte başlatır.
 * Kullanım: node scripts/dev.mjs [nextArgs...]
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] === "--production" ? "production" : "development";
const nextCmd = process.argv[2] === "--production" ? "start" : "dev";
const nextArgs = process.argv.slice(3);

// Depo kökü: sinyallerin doğrudan hedef sürece ulaşması için npx zinciri
// (npm exec -> tsx -> node) yerine gerçek binary'ler process.execPath ile açılır.
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
      console.error(`[${name}] beklenmedik şekilde çıktı (kod ${code}); tüm süreçler kapatılıyor.`);
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
  // Önce tüm çocukların çıkışı beklenir; 5 sn sonra kalanlar zorla öldürülür.
  // Çocuklar ölmeden çıkılırsa worker yetim kalır ve profili kilitli tutar.
  const killTimer = setTimeout(() => {
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {
        // süreç çoktan çıkmış olabilir
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
