import { db } from './client';

const schemaPath = new URL('./schema.sql', import.meta.url);
const schema = await Bun.file(schemaPath).text();

db.exec(schema);

/**
 * `schema.sql` só tem CREATE TABLE IF NOT EXISTS — colunas adicionadas depois que alguém
 * já rodou o migrate não chegariam num banco existente. Este bloco aplica ALTERs
 * idempotentes (checa a coluna antes) para não exigir apagar o app.db a cada mudança.
 */
const colunasAdicionadas: Array<{ tabela: string; coluna: string; definicao: string }> = [
  { tabela: 'ia_recomendacao_item', coluna: 'badge', definicao: 'TEXT' },
];

for (const { tabela, coluna, definicao } of colunasAdicionadas) {
  const existentes = db.query(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>;
  if (existentes.length > 0 && !existentes.some((c) => c.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    console.log(`[migrate] coluna ${tabela}.${coluna} adicionada`);
  }
}

console.log('[migrate] schema aplicado com sucesso');
