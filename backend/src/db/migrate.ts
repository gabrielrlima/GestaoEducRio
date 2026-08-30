import { db } from './client';

const schemaPath = new URL('./schema.sql', import.meta.url);
const schema = await Bun.file(schemaPath).text();

db.exec(schema);

console.log('[migrate] schema aplicado com sucesso');
