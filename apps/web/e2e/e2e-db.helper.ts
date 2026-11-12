import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '../../..');
const rootEnv = path.join(repoRoot, '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, quiet: true });
}

export function getE2eBaseUrl(): string {
  return process.env.E2E_BASE_URL || 'http://localhost:4201';
}

export function getE2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) {
    return process.env.E2E_DATABASE_URL;
  }
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL manquant dans .env pour résoudre la base E2E.');
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
  return {
    ...process.env,
    DATABASE_URL: getE2eDatabaseUrl(),
  };
}

export function execE2eNodeScript(script: string): string {
  const tmpFile = path.join(
    os.tmpdir(),
    `rb-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`,
  );
  fs.writeFileSync(tmpFile, script, 'utf8');
  try {
    return execFileSync(process.execPath, [tmpFile], {
      cwd: repoRoot,
      env: getE2eEnv(),
      encoding: 'utf8',
    }).trim();
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}
