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
  // Endereços de trabalho e alternativo. As 10 colunas de texto vieram com o suporte a
  // múltiplos endereços no portal; as 4 de coordenada, com o agente de recomendação (sem
  // lat/lng não há distância nem desvio de rota). Todas precisam estar aqui: num banco
  // que já existia, o CREATE TABLE IF NOT EXISTS do schema.sql não as adicionaria, e a
  // primeira gravação falharia com "no such column".
  { tabela: 'responsavel', coluna: 'trabalho_cep', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'trabalho_bairro', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'trabalho_logradouro', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'trabalho_numero', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'trabalho_complemento', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'trabalho_latitude', definicao: 'REAL' },
  { tabela: 'responsavel', coluna: 'trabalho_longitude', definicao: 'REAL' },
  { tabela: 'responsavel', coluna: 'alternativo_cep', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'alternativo_bairro', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'alternativo_logradouro', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'alternativo_numero', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'alternativo_complemento', definicao: 'TEXT' },
  { tabela: 'responsavel', coluna: 'alternativo_latitude', definicao: 'REAL' },
  { tabela: 'responsavel', coluna: 'alternativo_longitude', definicao: 'REAL' },
];

for (const { tabela, coluna, definicao } of colunasAdicionadas) {
  const existentes = db.query(`PRAGMA table_info(${tabela})`).all() as Array<{ name: string }>;
  if (existentes.length > 0 && !existentes.some((c) => c.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    console.log(`[migrate] coluna ${tabela}.${coluna} adicionada`);
  }
}

/**
 * `endereco_responsavel` chegou a existir nesta branch como tabela separada para os
 * endereços de trabalho/alternativo, antes de a `main` resolver o mesmo problema com
 * colunas em `responsavel`. Ficamos com o modelo da `main`; esta linha remove a tabela
 * órfã para não sobrarem duas representações do mesmo dado no schema. Ela nunca chegou
 * a `main` nem a produção — só guardou dado de teste local.
 */
db.exec('DROP TABLE IF EXISTS endereco_responsavel');

console.log('[migrate] schema aplicado com sucesso');
