import { spawn } from "node:child_process";
import path from "node:path";

const modes = new Set(process.argv.slice(2));
const includeStatic = modes.has("--with-static");

const processes = [];
let shuttingDown = false;

function start(name, command, args, color) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env
  });

  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`${prefix} ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`${prefix} ${chunk}`);
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(`${prefix} exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });

  processes.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const viteBin = path.resolve("node_modules", "vite", "bin", "vite.js");
const httpServerBin = path.resolve("node_modules", "http-server", "bin", "http-server");

start("react", process.execPath, [viteBin], "34");
if (includeStatic) {
  start("static", process.execPath, [httpServerBin, "frontend", "-p", "5174", "-c-1"], "36");
}
start("api", process.execPath, ["backend/server.js"], "32");
