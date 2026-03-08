import { execSync } from "node:child_process";

const ports = [3000, 4000, 5173, 5174];

function killWindowsBackendNodeProcesses() {
  const commands = [
    "Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {",
    "  $cmd = (Get-CimInstance Win32_Process -Filter \"ProcessId = $($_.Id)\" -ErrorAction SilentlyContinue).CommandLine",
    "  if ($cmd -and ($cmd -like '*backend\\server.js*' -or $cmd -like '*backend/server.js*')) {",
    "    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue",
    "    Write-Output \"[free-dev-ports] Terminated backend process PID $($_.Id)\"",
    "  }",
    "}"
  ].join(" ");

  try {
    const output = execSync(`powershell -NoProfile -Command "${commands}"`, {
      stdio: ["ignore", "pipe", "ignore"]
    }).toString();

    if (output.trim()) {
      process.stdout.write(output);
    }
  } catch {
    // ignore
  }
}

function sleep(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // intentional spin-wait for short cleanup delays
  }
}

function isWindowsPortInUse(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function killWindowsPort(port) {
  let output = "";
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return;
  }

  const pids = new Set();
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    });

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: ["ignore", "ignore", "ignore"] });
      console.log(`[free-dev-ports] Freed port ${port} by terminating PID ${pid}`);
    } catch {
      // ignore
    }
  }
}

function killUnixPort(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9`, { stdio: ["ignore", "ignore", "ignore"] });
    console.log(`[free-dev-ports] Freed port ${port}`);
  } catch {
    // ignore
  }
}

for (const port of ports) {
  if (process.platform === "win32") {
    killWindowsBackendNodeProcesses();
    // Retry cleanup because Windows may keep ports briefly in TIME_WAIT.
    for (let attempt = 0; attempt < 5; attempt++) {
      killWindowsPort(port);
      if (!isWindowsPortInUse(port)) {
        break;
      }
      sleep(150);
    }
  } else {
    killUnixPort(port);
  }
}

console.log("[free-dev-ports] Port cleanup complete.");
