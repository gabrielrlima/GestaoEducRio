import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DATABASE_PATH = process.env.DATABASE_PATH ?? 'data/app.db';
const SEED_SNAPSHOT_PATH = new URL('../../data/seed/unidades-seed.db', import.meta.url).pathname;

function hasUnidades(path: string): boolean {
  try {
    const db = new Database(path, { readonly: true });
    const row = db.query('SELECT COUNT(*) AS n FROM unidade').get() as { n: number };
    db.close();
    return row.n > 0;
  } catch {
    // arquivo não existe, ou existe mas ainda não tem a tabela `unidade` (schema nunca aplicado)
    return false;
  }
}

if (existsSync(DATABASE_PATH) && hasUnidades(DATABASE_PATH)) {
  console.log('[bootstrap] banco já semeado em', DATABASE_PATH, '— preservando dados (volume persistente)');
} else {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  copyFileSync(SEED_SNAPSHOT_PATH, DATABASE_PATH);
  console.log(
    '[bootstrap] banco ausente ou sem unidades — copiado o snapshot de unidades/vagas para',
    DATABASE_PATH
  );
}
