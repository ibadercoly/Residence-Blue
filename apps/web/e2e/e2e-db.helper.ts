import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const rootEnv = path.join(repoRoot, '.env');

function loadEnvMap(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(rootEnv)) return out;
  for (const rawLine of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const dotEnv = loadEnvMap();

export function getE2eBaseUrl(): string {
  return process.env.E2E_BASE_URL || 'http://localhost:4201';
}

export function getE2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) {
    return process.env.E2E_DATABASE_URL;
  }
  const devUrl = process.env.DATABASE_URL || dotEnv.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL manquant pour résoudre la base E2E.');
  }
  const parsed = new URL(devUrl);
  const devDb = parsed.pathname.replace(/^\//, '');
  const e2eDb = process.env.E2E_DB_NAME || 'residence_blue_e2e';
  if (e2eDb === devDb) {
    throw new Error(
      `Sécurité E2E : E2E_DB_NAME (${e2eDb}) ne peut pas être identique à la base de développement (${devDb}).`,
    );
  }
  parsed.pathname = `/${e2eDb}`;
  return parsed.toString();
}

export function getE2eEnv(): NodeJS.ProcessEnv {
  const nodePaths = [
    path.join(repoRoot, 'node_modules'),
    path.join(repoRoot, 'apps/api/node_modules'),
    path.join(repoRoot, 'apps/web/node_modules'),
  ].join(path.delimiter);
  return {
    ...dotEnv,
    ...process.env,
    DATABASE_URL: getE2eDatabaseUrl(),
    NODE_PATH: nodePaths,
  };
}

export function execE2eNodeScript(script: string): string {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    env: getE2eEnv(),
    encoding: 'utf8',
  }).trim();
}
