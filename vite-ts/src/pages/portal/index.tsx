import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Step from '@mui/material/Step';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  getToken,
  type Turno,
  type Crianca,
  getResponsavel,
  criarInscricao,
  type Responsavel,
  cadastrarCrianca,
  getStatusCrianca,
  unidadesProximas,
  type RecomendacaoIA,
  type UnidadeProxima,
  cadastrarResponsavel,
  recomendarUnidadesIA,
  type StatusConsolidado,
  solicitarCodigoResponsavel,
  verificarCodigoResponsavel,
} from 'src/lib/creche-api';

import { Iconify } from 'src/components/iconify';
import { EnderecoMap, type EnderecoMapMarcador } from 'src/components/endereco-map/endereco-map';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();
const STEPS = ['Login', 'Cadastrar filho(a)', 'Escolher unidades', 'Status'];

type Etapa = 0 | 1 | 2 | 3;

export default function PortalPage() {
  const [etapa, setEtapa] = useState<Etapa>(0);
  const [responsavel, setResponsavel] = useState<Responsavel | null>(null);
  const [crianca, setCrianca] = useState<Crianca | null>(null);
  const [status, setStatus] = useState<StatusConsolidado | null>(null);

  useEffect(() => {
    if (getToken('responsavel')) {
      // sessão existente — usuário precisa re-buscar o próprio cadastro pra continuar
    }
  }, []);

  const irParaEscolhaOuStatus = useCallback(async (idCrianca: string) => {
    const s = await getStatusCrianca(idCrianca);
    setStatus(s);
    setEtapa(s.inscricaoAtiva ? 3 : 2);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.neutral', py: { xs: 3, md: 6 } }}>
      <title>Portal da Família — GestaoEducRio</title>
      <Container maxWidth="sm">
        <Typography variant="h4" sx={{ mb: 1 }}>
          Inscrição Creche
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Cadastre seu filho(a) e escolha as unidades mais próximas de você.
        </Typography>

        <Stepper activeStep={etapa} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Card sx={{ p: { xs: 3, md: 4 } }}>
          {etapa === 0 && (
            <EtapaLogin
              onLogado={(r) => {
                setResponsavel(r);
                setEtapa(1);
              }}
            />
          )}
          {etapa === 1 && responsavel && (
            <EtapaCadastroCrianca
              responsavelId={responsavel.id}
              onCriada={(c) => {
                setCrianca(c);
                irParaEscolhaOuStatus(c.id);
              }}
            />
          )}
          {etapa === 2 && crianca && responsavel && (
            <EtapaEscolhaUnidades
              crianca={crianca}
              responsavel={responsavel}
              onConcluida={() => irParaEscolhaOuStatus(crianca.id)}
            />
          )}
          {etapa === 3 && status && <EtapaStatus status={status} />}
        </Card>
      </Container>
    </Box>
  );
}

// ----------------------------------------------------------------------

function EtapaLogin({ onLogado }: { onLogado: (responsavel: Responsavel) => void }) {
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [bairro, setBairro] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [cep, setCep] = useState('');
  const [precisaCadastrar, setPrecisaCadastrar] = useState(false);
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [infoEnvio, setInfoEnvio] = useState<string | null>(null);

  // Fluxo automático: tenta o login com CPF + data de nascimento; se não
  // encontrar cadastro, revela os campos extras pra completar o cadastro na
  // mesma tela, sem a família precisar dizer se "já tem conta" ou não.
  const continuar = async () => {
    setErro(null);
    setLoading(true);
    try {
      if (precisaCadastrar) {
        await cadastrarResponsavel({
          cpf,
          nome,
          dataNascimento,
          email,
          bairro,
          logradouro: logradouro || undefined,
          numero: numero || undefined,
          cep: cep || undefined,
        });
      }
      const resultado = await solicitarCodigoResponsavel(cpf, dataNascimento);
      setInfoEnvio(
        resultado.modo === 'email'
          ? 'Código enviado para o seu e-mail cadastrado.'
          : `Modo de teste (sem SMTP configurado) — código: ver console do backend.`
      );
      setCodigoSolicitado(true);
    } catch (e) {
      const mensagem = (e as Error).message;
      if (!precisaCadastrar && /não conferem|não encontrado/i.test(mensagem)) {
        setPrecisaCadastrar(true);
        setErro(null);
      } else {
        setErro(mensagem);
      }
    } finally {
      setLoading(false);
    }
  };

  const verificar = async () => {
    setErro(null);
    setLoading(true);
    try {
      const { responsavelId } = await verificarCodigoResponsavel(cpf, codigo);
      const responsavel = await getResponsavel(responsavelId);
      onLogado(responsavel);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (codigoSolicitado) {
    return (
      <Stack spacing={2.5}>
        {infoEnvio && <Alert severity="info">{infoEnvio}</Alert>}
        {erro && <Alert severity="error">{erro}</Alert>}
        <TextField label="Código de verificação" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        <LoadingButton variant="contained" size="large" loading={loading} onClick={verificar}>
          Confirmar código
        </LoadingButton>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {erro && <Alert severity="error">{erro}</Alert>}
      {precisaCadastrar && (
        <Alert severity="info">Não encontramos seu cadastro — complete os dados abaixo pra continuar.</Alert>
      )}

      <TextField label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" />
      <TextField
        label="Data de nascimento"
        type="date"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      {precisaCadastrar && (
        <>
          <TextField label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Rua"
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              sx={{ flex: 2 }}
            />
            <TextField label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} sx={{ flex: 1 }} />
          </Stack>
          <TextField
            label="CEP"
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            helperText="Usado pra localizar sua casa no mapa e ordenar as creches mais próximas."
          />
        </>
      )}

      <LoadingButton variant="contained" size="large" loading={loading} onClick={continuar}>
        {precisaCadastrar ? 'Cadastrar e receber código' : 'Continuar'}
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function EtapaCadastroCrianca({
  responsavelId,
  onCriada,
}: {
  responsavelId: string;
  onCriada: (crianca: Crianca) => void;
}) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cadastrar = async () => {
    setErro(null);
    setLoading(true);
    try {
      const c = await cadastrarCrianca(responsavelId, {
        nomeCompleto,
        dataNascimento,
        sexo: sexo || undefined,
      });
      onCriada(c);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      {erro && <Alert severity="error">{erro}</Alert>}
      <TextField label="Nome completo da criança" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
      <TextField
        label="Data de nascimento"
        type="date"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <Stack direction="row" spacing={1}>
        <Chip label="Menino" color={sexo === 'M' ? 'primary' : 'default'} onClick={() => setSexo('M')} />
        <Chip label="Menina" color={sexo === 'F' ? 'primary' : 'default'} onClick={() => setSexo('F')} />
      </Stack>
      <LoadingButton variant="contained" size="large" loading={loading} onClick={cadastrar}>
        Continuar
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function EtapaEscolhaUnidades({
  crianca,
  responsavel,
  onConcluida,
}: {
  crianca: Crianca;
  responsavel: Responsavel;
  onConcluida: () => void;
}) {
  const [candidatas, setCandidatas] = useState<UnidadeProxima[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<string[]>([]);

  const [recomendacaoIA, setRecomendacaoIA] = useState<RecomendacaoIA | null>(null);
  const [pedindoRecomendacao, setPedindoRecomendacao] = useState(false);
  const [erroRecomendacao, setErroRecomendacao] = useState<string | null>(null);

  useEffect(() => {
    unidadesProximas({
      bairro: responsavel.bairro,
      lat: responsavel.latitude ?? undefined,
      lng: responsavel.longitude ?? undefined,
      anoProcesso: ANO_PROCESSO,
    })
      .then(setCandidatas)
      .finally(() => setLoading(false));
  }, [responsavel.bairro, responsavel.latitude, responsavel.longitude]);

  const pedirRecomendacaoIA = async () => {
    setErroRecomendacao(null);
    setPedindoRecomendacao(true);
    try {
      const resultado = await recomendarUnidadesIA({
        responsavelId: responsavel.id,
        criancaId: crianca.id,
        anoProcesso: ANO_PROCESSO,
      });
      setRecomendacaoIA(resultado);
    } catch (e) {
      setErroRecomendacao((e as Error).message);
    } finally {
      setPedindoRecomendacao(false);
    }
  };

  const alternarExpandida = (unidadeId: string) => {
    setExpandidas((atual) =>
      atual.includes(unidadeId) ? atual.filter((id) => id !== unidadeId) : [...atual, unidadeId]
    );
  };

  // Recomendadas pela IA sobem pro topo (mantendo a ordenação por proximidade
  // dentro de cada grupo) — todas as unidades continuam na lista, só reordena.
  const candidatasOrdenadas = [...candidatas].sort((a, b) => {
    const aRecomendada = recomendacaoIA?.recomendacoes.some((r) => r.unidadeId === a.unidadeId) ?? false;
    const bRecomendada = recomendacaoIA?.recomendacoes.some((r) => r.unidadeId === b.unidadeId) ?? false;
    if (aRecomendada !== bRecomendada) return aRecomendada ? -1 : 1;
    return 0;
  });

  const alternarSelecao = (unidadeId: string) => {
    setSelecionadas((atual) => {
      if (atual.includes(unidadeId)) return atual.filter((id) => id !== unidadeId);
      if (atual.length >= 5) return atual;
      return [...atual, unidadeId];
    });
  };

  const confirmarInscricao = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await criarInscricao({
        criancaId: crianca.id,
        anoProcesso: ANO_PROCESSO,
        opcoes: selecionadas.map((unidadeId) => ({ unidadeId, turno: 'Integral' as Turno })),
      });
      if (resultado.avisoTerritorial) {
        setAviso(
          'Nenhuma das unidades escolhidas fica perto do seu endereço — isso aumenta bastante a chance de a vaga não ser aproveitada. Você pode confirmar mesmo assim ou voltar e escolher outras.'
        );
      } else {
        onConcluida();
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <Typography>Buscando unidades perto de você…</Typography>;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Escolha até 5 unidades, em ordem de preferência. Ordenamos por proximidade do seu bairro ({responsavel.bairro}
        ) e disponibilidade de vaga.
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}
      {aviso && (
        <Alert severity="warning" action={<Button onClick={confirmarInscricao}>Confirmar mesmo assim</Button>}>
          {aviso}
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.neutral' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">Recomendação por IA</Typography>
            <LoadingButton size="small" loading={pedindoRecomendacao} onClick={pedirRecomendacaoIA}>
              {recomendacaoIA ? 'Pedir de novo' : 'Pedir recomendação'}
            </LoadingButton>
          </Stack>

          {pedindoRecomendacao && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              O agente está consultando o cadastro, calculando distâncias e conferindo as regras — leva uns 15-20s…
            </Typography>
          )}
          {erroRecomendacao && <Alert severity="error">{erroRecomendacao}</Alert>}
          {recomendacaoIA && (
            <>
              <Alert severity={recomendacaoIA.fonte === 'ia' ? 'success' : 'info'}>
                {recomendacaoIA.resumo}
                <Chip
                  size="small"
                  sx={{ ml: 1 }}
                  label={recomendacaoIA.fonte === 'ia' ? 'gerado pela IA' : 'fallback determinístico'}
                />
              </Alert>
              <Button
                size="small"
                onClick={() => setSelecionadas(recomendacaoIA.recomendacoes.slice(0, 5).map((r) => r.unidadeId))}
              >
                Selecionar as recomendadas
              </Button>
            </>
          )}
        </Stack>
      </Card>

      <Grid container spacing={1.5}>
        {candidatasOrdenadas.map((c) => {
          const selecionadaIndex = selecionadas.indexOf(c.unidadeId);
          const selecionada = selecionadaIndex >= 0;
          const recomendacao = recomendacaoIA?.recomendacoes.find((r) => r.unidadeId === c.unidadeId);
          const expandida = expandidas.includes(c.unidadeId);

          const marcadores: EnderecoMapMarcador[] = [];
          if (c.latitude != null && c.longitude != null) {
            marcadores.push({
              id: `unidade-${c.unidadeId}`,
              label: c.nome,
              latitude: c.latitude,
              longitude: c.longitude,
              tipo: 'unidade',
            });
          }
          if (responsavel.latitude != null && responsavel.longitude != null) {
            marcadores.push({
              id: `moradia-${responsavel.id}`,
              label: `Moradia — ${responsavel.logradouro ?? responsavel.bairro}`,
              latitude: responsavel.latitude,
              longitude: responsavel.longitude,
              tipo: 'moradia',
            });
          }

          return (
            <Grid size={12} key={c.unidadeId}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: selecionada ? 'primary.main' : undefined,
                  bgcolor: selecionada ? 'primary.lighter' : undefined,
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ p: 2, cursor: 'pointer' }}
                  onClick={() => alternarSelecao(c.unidadeId)}
                >
                  <Stack sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">
                        {selecionada ? `${selecionadaIndex + 1}º — ` : ''}
                        {c.nome}
                      </Typography>
                      {recomendacao && <Chip size="small" color="success" label="Recomendada pela IA" />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.bairro}
                      {c.distanciaKm != null ? ` · ${c.distanciaKm.toFixed(1)} km` : c.mesmoBairro ? ' · mesmo bairro' : ''}
                      {' · '}
                      {c.vagasDisponiveis} vaga(s) disponíveis
                    </Typography>
                    {recomendacao && (
                      <Typography variant="caption" sx={{ color: 'success.dark', mt: 0.5 }}>
                        {recomendacao.porque}
                      </Typography>
                    )}
                  </Stack>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      alternarExpandida(c.unidadeId);
                    }}
                  >
                    <Iconify
                      icon="eva:arrow-ios-downward-fill"
                      sx={{ transform: expandida ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </IconButton>
                </Stack>

                <Collapse in={expandida} unmountOnExit>
                  <Box sx={{ px: 2, pb: 2 }}>
                    <EnderecoMap marcadores={marcadores} />
                  </Box>
                </Collapse>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <LoadingButton
        variant="contained"
        size="large"
        disabled={selecionadas.length === 0}
        loading={enviando}
        onClick={confirmarInscricao}
      >
        Confirmar inscrição ({selecionadas.length}/5)
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

const SITUACAO_LABEL: Record<StatusConsolidado['situacaoConsolidada'], string> = {
  confirmada: 'Vaga confirmada! 🎉',
  aguardando_confirmacao: 'Vaga oferecida — confirme na unidade',
  em_fila: 'Inscrição na fila de espera',
  sem_oferta: 'Sem oferta de vaga no momento',
  sem_inscricao: 'Nenhuma inscrição encontrada',
};

function EtapaStatus({ status }: { status: StatusConsolidado }) {
  return (
    <Stack spacing={2.5}>
      <Alert severity={status.situacaoConsolidada === 'confirmada' ? 'success' : 'info'}>
        {SITUACAO_LABEL[status.situacaoConsolidada]}
      </Alert>

      <Typography variant="subtitle1">{status.crianca.nome_completo}</Typography>

      <Stack spacing={1}>
        {status.opcoes.map((o) => (
          <Card key={o.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">{o.unidade_nome ?? o.unidade_id}</Typography>
              <Chip size="small" label={o.situacao} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
