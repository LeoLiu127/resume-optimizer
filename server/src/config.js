import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(SERVER_ROOT, '.env');
  if (!existsSync(envPath)) {
    return;
  }
  dotenv.config({ path: envPath });
}

loadEnv();

function bool(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

function int(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: int(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY || '',
    baseUrl: (process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1').replace(/\/+$/, ''),
    model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
    timeout: int(process.env.MINIMAX_TIMEOUT, 60000),
  },
  invite: {
    codeLength: int(process.env.INVITE_CODE_LENGTH, 10),
    tokenTtlDays: int(process.env.TOKEN_TTL_DAYS, 30),
    inviteOnly: bool(process.env.INVITE_ONLY, true),
  },
  paths: {
    serverRoot: SERVER_ROOT,
    dbFile: resolve(SERVER_ROOT, 'data', 'app.db'),
  },
};

export function isMiniMaxConfigured() {
  const { apiKey } = config.minimax;
  return Boolean(apiKey) && !/^请替换|^eyJhbGciOi\.\.\./.test(apiKey);
}
