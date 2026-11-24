import { execFileSync, spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SECRET_KEYS = [
  'TURNSTILE_SECRET_KEY',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'AUTH_FROM_EMAIL',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'PADDLE_CLIENT_TOKEN',
  'PADDLE_PRICE_ID',
  'CF_AI_GATEWAY',
] as const;

const devVarsPath = resolve(import.meta.dirname, '..', '.dev.vars');
const hadExistingDevVars = existsSync(devVarsPath);
let createdDevVars = false;

function lookupSecret(key: string): string | null {
  try {
    const value = execFileSync('secret-tool', ['lookup', 'app', 'codebook', 'key', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return value || null;
  } catch {
    return null;
  }
}

function cleanup() {
  if (createdDevVars && existsSync(devVarsPath)) {
    try {
      unlinkSync(devVarsPath);
    } catch {
      // ignore cleanup errors
    }
    createdDevVars = false;
  }
}

if (!hadExistingDevVars) {
  const lines: string[] = [];
  for (const key of SECRET_KEYS) {
    const value = lookupSecret(key);
    if (value !== null) {
      lines.push(`${key}=${value}`);
    }
  }

  if (lines.length > 0) {
    writeFileSync(devVarsPath, `${lines.join('\n')}\n`, { mode: 0o600 });
    createdDevVars = true;
    console.log(`[dev] Loaded ${lines.length} secret(s) from libsecret into temporary .dev.vars`);
  }
}

process.on('exit', cleanup);

const viteBin = resolve(import.meta.dirname, '..', 'node_modules', '.bin', 'vite');
const child = spawn(viteBin, process.argv.slice(2), {
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
