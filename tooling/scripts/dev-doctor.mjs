import net from 'node:net';

const checks = [];

const push = (name, ok, detail, required = true) => {
  checks.push({ name, ok, detail, required });
};

const checkHttp = async (name, url, required = true) => {
  try {
    const res = await fetch(url);
    push(name, res.ok, `${url} -> ${res.status}`, required);
  } catch (error) {
    push(name, false, `${url} -> ${error.message}`, required);
  }
};

const checkPort = (name, port, required = true) =>
  new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1500);

    socket.once('connect', () => {
      push(name, true, `localhost:${port} is reachable`, required);
      socket.destroy();
      resolve();
    });

    socket.once('timeout', () => {
      push(name, false, `localhost:${port} timed out`, required);
      socket.destroy();
      resolve();
    });

    socket.once('error', () => {
      push(name, false, `localhost:${port} is not reachable`, required);
      resolve();
    });

    socket.connect(port, 'localhost');
  });

await checkPort('Frontend Port', 5173, true);
await checkPort('Backend Port', 4000, true);
await checkPort('Redis Port', 6379, false);

await checkHttp('Frontend HTTP', 'http://localhost:5173', true);
await checkHttp('Backend Health', 'http://localhost:4000/api/health', true);

const requiredFailures = checks.filter((c) => c.required && !c.ok);

console.log('Rally Forge Dev Doctor');
console.log('----------------------');
for (const c of checks) {
  const marker = c.ok ? 'PASS' : c.required ? 'FAIL' : 'WARN';
  console.log(`${marker} ${c.name}: ${c.detail}`);
}

if (requiredFailures.length > 0) {
  console.error('\nDoctor found required failures.');
  process.exit(1);
}

console.log('\nDoctor check passed.');
