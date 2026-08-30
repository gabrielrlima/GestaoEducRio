import { buscarCandidatas, type CandidataEnriquecida, type PerfilFamilia } from './features';
import { BADGES, type RecomendacaoFinal } from './tools';

/**
 * Recomendação determinística, sem chamar a Claude API. É o que responde quando a chave
 * não está configurada, a API falha ou o loop expira — a demo nunca quebra por causa da IA.
 *
 * Usa exatamente as mesmas features do agente (mesmas distâncias, mesmo histórico), então
 * a diferença entre os dois caminhos é só a qualidade do texto e do arranjo das 5 opções,
 * não a qualidade dos dados.
 */

type Badge = (typeof BADGES)[number];

/** Igual a `RecomendacaoFinal`, mas admite lista vazia (o schema do agente exige >= 1). */
export type RecomendacaoDeterministica = Omit<RecomendacaoFinal, 'recomendacoes'> & {
  recomendacoes: RecomendacaoFinal['recomendacoes'];
};

const km = (valor: number) => `${valor.toFixed(1).replace('.', ',')} km`;

/** Parágrafo por template, na mesma voz do agente: sempre 2-3 frases com números reais. */
function explicar(c: CandidataEnriquecida): string {
  const frases: string[] = [];
  const d = c.distancias;

  if (d.enderecoMaisProximo === 'trabalho' && d.trabalhoKm != null) {
    frases.push(`Fica a ${km(d.trabalhoKm)} do seu trabalho`);
  } else if (d.moradiaKm != null) {
    frases.push(`Fica a ${km(d.moradiaKm)} da sua casa`);
  } else if (d.mesmoBairroMoradia) {
    frases.push('Fica no seu bairro');
  } else {
    frases.push(`Fica em ${c.bairro}`);
  }

  if (d.desvioRotaCasaTrabalhoKm != null && d.desvioRotaCasaTrabalhoKm <= 2) {
    frases[0] += ` e praticamente no seu caminho para o trabalho (${km(d.desvioRotaCasaTrabalhoKm)} de desvio por dia)`;
  }
  frases[0] += '.';

  frases.push(`Tem ${c.disponibilidade.vagasDisponiveis} vaga(s) aberta(s) no momento.`);

  const h = c.disponibilidade.historico;
  if (h) {
    frases.push(
      `Historicamente, ${h.chanceHistoricaConvocacaoPct}% de quem se inscreveu aqui chegou a ser convocado nos últimos ${h.anosCobertos} processos — disponibilidade ${h.classeDisponibilidade} para a região.`
    );
  }

  const texto = frases.join(' ');
  return texto.length > 400 ? `${texto.slice(0, 397)}...` : texto;
}

/**
 * Atribui no máximo um badge por unidade e nunca o mesmo duas vezes — mesma restrição que
 * o system prompt impõe ao agente, para que os dois caminhos rendam a mesma UI.
 */
function atribuirBadges(candidatas: CandidataEnriquecida[]): Map<string, Badge> {
  const badges = new Map<string, Badge>();
  const usados = new Set<Badge>();

  const premiar = (candidata: CandidataEnriquecida | undefined, badge: Badge) => {
    if (!candidata || usados.has(badge) || badges.has(candidata.unidadeId)) return;
    badges.set(candidata.unidadeId, badge);
    usados.add(badge);
  };

  const menorPor = (valor: (c: CandidataEnriquecida) => number | null) =>
    candidatas
      .filter((c) => valor(c) != null)
      .sort((a, b) => valor(a)! - valor(b)!)[0];

  premiar(menorPor((c) => c.distancias.moradiaKm), 'Mais perto de casa');
  premiar(menorPor((c) => c.distancias.trabalhoKm), 'Mais perto do trabalho');
  premiar(
    candidatas.find((c) => (c.distancias.desvioRotaCasaTrabalhoKm ?? Infinity) <= 1.5),
    'No caminho para o trabalho'
  );
  premiar(
    [...candidatas].sort((a, b) => b.chance.score - a.chance.score).find((c) => c.chance.classe === 'alta'),
    'Alta chance de vaga'
  );
  premiar(
    [...candidatas].sort((a, b) => b.disponibilidade.vagasDisponiveis - a.disponibilidade.vagasDisponiveis)[0],
    'Muitas vagas abertas'
  );
  premiar(menorPor((c) => c.distancias.alternativoKm), 'Perto do endereço alternativo');

  return badges;
}

/**
 * Ordena por uma nota composta em vez de só por distância: 60% proximidade (normalizada
 * pela candidata mais distante da lista) e 40% chance estimada. Sem isso, o fallback
 * devolveria as 5 mais próximas mesmo que todas fossem disputadíssimas — que é exatamente
 * a falha do processo atual que o produto ataca.
 */
function ordenarPorEquilibrio(candidatas: CandidataEnriquecida[]): CandidataEnriquecida[] {
  const maiorKm = Math.max(1, ...candidatas.map((c) => c.distancias.menorKm ?? 0));
  return [...candidatas].sort((a, b) => {
    const nota = (c: CandidataEnriquecida) =>
      0.6 * (1 - (c.distancias.menorKm ?? maiorKm) / maiorKm) + 0.4 * c.chance.score;
    return nota(b) - nota(a);
  });
}

export function recomendarSemIA(perfil: PerfilFamilia): RecomendacaoDeterministica {
  const candidatas = buscarCandidatas(perfil, { criterio: 'qualquer_endereco', raioKm: 8, limite: 12 });

  if (candidatas.length === 0) {
    return {
      resumo:
        'Não encontramos unidades com vaga aberta perto dos endereços cadastrados. Confira o endereço no cadastro ou fale com a CRE da sua região.',
      recomendacoes: [],
    };
  }

  const escolhidas = ordenarPorEquilibrio(candidatas).slice(0, 5);
  const badges = atribuirBadges(escolhidas);

  const comTrabalho = escolhidas.filter((c) => c.distancias.trabalhoKm != null).length > 0;
  const resumo = comTrabalho
    ? `Selecionamos ${escolhidas.length} unidades considerando a distância de casa, do trabalho e o seu trajeto entre os dois, equilibrando proximidade com a chance real de conseguir a vaga.`
    : `Selecionamos ${escolhidas.length} unidades equilibrando a distância dos seus endereços com a chance histórica de convocação de cada uma.`;

  return {
    resumo,
    recomendacoes: escolhidas.map((c) => {
      const badge = badges.get(c.unidadeId) ?? null;
      return {
        unidadeId: c.unidadeId,
        porque: explicar(c),
        ...(badge ? { badge } : {}),
      };
    }),
  };
}
