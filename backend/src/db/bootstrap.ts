import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DATABASE_PATH = process.env.DATABASE_PATH ?? 'data/app.db';
const SEED_SNAPSHOT_PATH = new URL('../../data/seed/unidades-seed.db', import.meta.url).pathname;

if (existsSync(DATABASE_PATH)) {
  console.log('[bootstrap] banco já existe em', DATABASE_PATH, '— preservando dados (volume persistente)');
} else {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  copyFileSync(SEED_SNAPSHOT_PATH, DATABASE_PATH);
  console.log('[bootstrap] banco não existia — copiado o snapshot de unidades/vagas para', DATABASE_PATH);
}
