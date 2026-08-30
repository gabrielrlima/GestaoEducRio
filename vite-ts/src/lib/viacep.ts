// ----------------------------------------------------------------------
// Busca de endereço por CEP via ViaCEP (API pública, sem autenticação).
// Serviço externo ao backend GestaoEducRio — por isso fica separado de
// creche-api.ts, com fetch simples em vez do axios client autenticado.

export interface EnderecoPorCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export function limparCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/** Retorna `null` se o CEP for inválido, inexistente, ou a busca falhar (rede/timeout) — nunca lança, pra não travar o preenchimento manual como fallback. */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const cepLimpo = limparCep(cep);
  if (cepLimpo.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (dados.erro) return null;
    return {
      cep: dados.cep ?? cepLimpo,
      logradouro: dados.logradouro ?? '',
      bairro: dados.bairro ?? '',
      localidade: dados.localidade ?? '',
      uf: dados.uf ?? '',
    };
  } catch {
    return null;
  }
}
