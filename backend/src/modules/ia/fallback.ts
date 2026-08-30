interface Candidata {
  unidadeId: string;
  nome: string;
  distanciaKm: number | null;
  mesmoBairro: boolean;
  vagasDisponiveis: number;
}

/** Gera o texto "porque" por template determinístico — usado quando a IA falha/expira. */
export function explicacaoFallback(candidata: Candidata): string {
  if (candidata.distanciaKm != null) {
    return `Fica a ${candidata.distanciaKm.toFixed(1)} km de casa, com ${candidata.vagasDisponiveis} vaga(s) disponível(is).`;
  }
  if (candidata.mesmoBairro) {
    return `Fica no seu bairro, com ${candidata.vagasDisponiveis} vaga(s) disponível(is).`;
  }
  return `Tem ${candidata.vagasDisponiveis} vaga(s) disponível(is) no grupamento/turno escolhido.`;
}

export function resumoFallback(candidatas: Candidata[]): string {
  if (candidatas.length === 0) return 'Não encontramos unidades com vaga disponível para esses filtros.';
  return `Encontramos ${candidatas.length} unidade(s) — ordenadas por proximidade e disponibilidade de vaga.`;
}
