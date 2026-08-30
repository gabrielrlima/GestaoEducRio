import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

const DATABASE_PATH = process.env.DATABASE_PATH ?? 'data/app.db';
// Fora de data/ de propósito: em produção um volume é montado em cima de data/,
// o que esconderia qualquer arquivo colocado ali dentro da imagem em runtime.
const SEED_SNAPSHOT_PATH = new URL('../../seed-baseline/unidades-seed.db', import.meta.url).pathname;

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
  // Um -wal/-shm órfão de uma tentativa anterior (schema vazio) fica ao lado do
  // arquivo principal e é reaplicado por cima do snapshot recém-copiado na
  // próxima abertura em modo WAL — sem isso o banco volta a aparecer vazio.
  for (const suffix of ['-wal', '-shm', '-journal']) {
    rmSync(`${DATABASE_PATH}${suffix}`, { force: true });
  }
  copyFileSync(SEED_SNAPSHOT_PATH, DATABASE_PATH);
  console.log(
    '[bootstrap] banco ausente ou sem unidades — copiado o snapshot de unidades/vagas para',
    DATABASE_PATH
  );
}
