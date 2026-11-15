import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const envPath = path.join(repoRoot, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function resolveE2eDatabaseUrl() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL manquant pour dériver la base E2E.');
  }
  if (process.env.E2E_DATABASE_URL) {
    return process.env.E2E_DATABASE_URL;
  }
  const u = new URL(devUrl);
  const devDb = u.pathname.replace(/^\//, '');
  const e2eDb = process.env.E2E_DB_NAME || 'residence_blue_e2e';
  if (e2eDb === devDb) {
    throw new Error(`La base E2E (${e2eDb}) doit être distincte de la base de développement (${devDb}).`);
  }
  u.pathname = `/${e2eDb}`;
  return u.toString();
}

const e2eDatabaseUrl = resolveE2eDatabaseUrl();
const e2ePort = String(process.env.E2E_API_PORT || 3001);
const e2eWebPort = String(process.env.E2E_WEB_PORT || 4201);

const childEnv = {
  ...process.env,
  DATABASE_URL: e2eDatabaseUrl,
  PORT: e2ePort,
  CORS_ORIGIN: `http://localhost:${e2eWebPort},http://127.0.0.1:${e2eWebPort}`,
};

// Peupler la base E2E séparée avant de démarrer l'API de test
execFileSync(
  process.execPath,
  ['./node_modules/ts-node/dist/bin.js', '--project', 'apps/api/tsconfig.json', 'apps/api/prisma/seed.ts'],
  { cwd: repoRoot, env: childEnv, stdio: 'inherit' },
);

const apiChild = spawn(process.execPath, ['apps/api/dist/main.js'], {
  cwd: repoRoot,
  env: childEnv,
  stdio: 'inherit',
});

const shutdown = (signal) => {
  if (!apiChild.killed) {
    apiChild.kill(signal);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
apiChild.on('exit', (code) => process.exit(code ?? 0));
