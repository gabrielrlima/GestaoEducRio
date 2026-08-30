import { randomUUID } from 'node:crypto';
import { db } from '../../db/client';
import { badRequest, notFound } from '../../lib/errors';
import { geocodeEndereco } from '../../lib/geocode';
import { getResponsavelById, type Responsavel } from './service';

export type TipoEndereco = 'moradia' | 'trabalho' | 'alternativo';

export interface EnderecoResponsavel {
  id: string;
  responsavel_id: string;
  tipo: TipoEndereco;
  rotulo: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  criado_em: string;
}

export interface CreateEnderecoInput {
  tipo: TipoEndereco;
  rotulo?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
}

/**
 * Endereço de moradia derivado dos campos do próprio `responsavel` — o cadastro principal
 * continua sendo a fonte da verdade da moradia (o portal preenche ele na etapa "Endereço"),
 * então em vez de duplicar a linha em `endereco_responsavel` e arriscar divergência,
 * sintetizamos ela na leitura. `endereco_responsavel` guarda só trabalho/alternativos.
 */
function moradiaSintetica(responsavel: Responsavel): EnderecoResponsavel {
  return {
    id: `moradia:${responsavel.id}`,
    responsavel_id: responsavel.id,
    tipo: 'moradia',
    rotulo: 'Moradia',
    cep: responsavel.cep,
    logradouro: responsavel.logradouro,
    numero: responsavel.numero,
    complemento: responsavel.complemento,
    bairro: responsavel.bairro,
    latitude: responsavel.latitude,
    longitude: responsavel.longitude,
    criado_em: responsavel.criado_em,
  };
}

/** Todos os endereços da família: moradia (do cadastro) + trabalho/alternativos. */
export function listEnderecos(responsavelId: string): EnderecoResponsavel[] {
  const responsavel = getResponsavelById(responsavelId);
  const extras = db
    .query('SELECT * FROM endereco_responsavel WHERE responsavel_id = $id ORDER BY tipo, criado_em')
    .all({ $id: responsavelId }) as EnderecoResponsavel[];

  return [moradiaSintetica(responsavel), ...extras];
}

export function getEnderecoPorTipo(responsavelId: string, tipo: TipoEndereco): EnderecoResponsavel | null {
  return listEnderecos(responsavelId).find((e) => e.tipo === tipo) ?? null;
}

/**
 * Cadastra trabalho ou endereço alternativo, geocodificando na hora (best-effort — sem
 * coordenada o endereço ainda serve pra comparação por bairro).
 * Moradia não entra aqui: use PATCH /responsaveis/:id.
 */
export async function createEndereco(
  responsavelId: string,
  input: CreateEnderecoInput
): Promise<EnderecoResponsavel> {
  getResponsavelById(responsavelId); // 404 se não existir

  if (input.tipo === 'moradia') {
    throw badRequest(
      'MORADIA_NO_CADASTRO',
      'O endereço de moradia é o do próprio cadastro — atualize via PATCH /responsaveis/:id'
    );
  }

  // Só faz sentido um endereço de trabalho; um novo substitui o anterior.
  if (input.tipo === 'trabalho') {
    db.query("DELETE FROM endereco_responsavel WHERE responsavel_id = $id AND tipo = 'trabalho'").run({
      $id: responsavelId,
    });
  }

  const coordenadas = await geocodeEndereco({
    logradouro: input.logradouro,
    numero: input.numero,
    bairro: input.bairro,
    cep: input.cep,
  });

  const id = randomUUID();
  db.query(
    `INSERT INTO endereco_responsavel
       (id, responsavel_id, tipo, rotulo, cep, logradouro, numero, complemento, bairro, latitude, longitude)
     VALUES ($id, $responsavelId, $tipo, $rotulo, $cep, $logradouro, $numero, $complemento, $bairro, $latitude, $longitude)`
  ).run({
    $id: id,
    $responsavelId: responsavelId,
    $tipo: input.tipo,
    $rotulo: input.rotulo ?? (input.tipo === 'trabalho' ? 'Trabalho' : 'Endereço alternativo'),
    $cep: input.cep ?? null,
    $logradouro: input.logradouro ?? null,
    $numero: input.numero ?? null,
    $complemento: input.complemento ?? null,
    $bairro: input.bairro ?? null,
    $latitude: coordenadas?.latitude ?? null,
    $longitude: coordenadas?.longitude ?? null,
  });

  const criado = db.query('SELECT * FROM endereco_responsavel WHERE id = $id').get({ $id: id }) as EnderecoResponsavel;
  return criado;
}

export function deleteEndereco(responsavelId: string, enderecoId: string): void {
  const resultado = db
    .query('DELETE FROM endereco_responsavel WHERE id = $id AND responsavel_id = $responsavelId')
    .run({ $id: enderecoId, $responsavelId: responsavelId });

  if (resultado.changes === 0) {
    throw notFound('ENDERECO_NAO_ENCONTRADO', `Endereço ${enderecoId} não encontrado para esse responsável`);
  }
}
