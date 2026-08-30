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
import Container from '@mui/material/Container';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import {
  type Turno,
  type Crianca,
  type StatusConsolidado,
  type UnidadeProxima,
  getToken,
  getResponsavel,
  criarInscricao,
  cadastrarCrianca,
  getStatusCrianca,
  unidadesProximas,
  cadastrarResponsavel,
  solicitarCodigoResponsavel,
  verificarCodigoResponsavel,
} from 'src/lib/creche-api';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();
const STEPS = ['Login', 'Cadastrar filho(a)', 'Escolher unidades', 'Status'];

type Etapa = 0 | 1 | 2 | 3;

export default function PortalPage() {
  const [etapa, setEtapa] = useState<Etapa>(0);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [bairroResponsavel, setBairroResponsavel] = useState('');
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
              onLogado={(id, bairro) => {
                setResponsavelId(id);
                setBairroResponsavel(bairro);
                setEtapa(1);
              }}
            />
          )}
          {etapa === 1 && responsavelId && (
            <EtapaCadastroCrianca
              responsavelId={responsavelId}
              onCriada={(c) => {
                setCrianca(c);
                irParaEscolhaOuStatus(c.id);
              }}
            />
          )}
          {etapa === 2 && crianca && (
            <EtapaEscolhaUnidades
              crianca={crianca}
              bairroResponsavel={bairroResponsavel}
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

function EtapaLogin({ onLogado }: { onLogado: (responsavelId: string, bairro: string) => void }) {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [bairro, setBairro] = useState('');
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [infoEnvio, setInfoEnvio] = useState<string | null>(null);

  const solicitarCodigo = async () => {
    setErro(null);
    setLoading(true);
    try {
      if (modo === 'cadastro') {
        await cadastrarResponsavel({ cpf, nome, dataNascimento, email, bairro });
      }
      const resultado = await solicitarCodigoResponsavel(cpf, dataNascimento);
      setInfoEnvio(
        resultado.modo === 'email'
          ? 'Código enviado para o seu e-mail cadastrado.'
          : `Modo de teste (sem SMTP configurado) — código: ver console do backend.`
      );
      setCodigoSolicitado(true);
    } catch (e) {
      setErro((e as Error).message);
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
      onLogado(responsavelId, responsavel.bairro);
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
      <Stack direction="row" spacing={1}>
        <Chip
          label="Já tenho cadastro"
          color={modo === 'login' ? 'primary' : 'default'}
          onClick={() => setModo('login')}
        />
        <Chip
          label="Primeira vez"
          color={modo === 'cadastro' ? 'primary' : 'default'}
          onClick={() => setModo('cadastro')}
        />
      </Stack>

      {erro && <Alert severity="error">{erro}</Alert>}

      <TextField label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" />
      <TextField
        label="Data de nascimento"
        type="date"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      {modo === 'cadastro' && (
        <>
          <TextField label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
        </>
      )}

      <LoadingButton variant="contained" size="large" loading={loading} onClick={solicitarCodigo}>
        {modo === 'cadastro' ? 'Cadastrar e receber código' : 'Enviar código de acesso'}
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
  bairroResponsavel,
  onConcluida,
}: {
  crianca: Crianca;
  bairroResponsavel: string;
  onConcluida: () => void;
}) {
  const [candidatas, setCandidatas] = useState<UnidadeProxima[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    unidadesProximas({ bairro: bairroResponsavel, anoProcesso: ANO_PROCESSO })
      .then(setCandidatas)
      .finally(() => setLoading(false));
  }, [bairroResponsavel]);

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
        Escolha até 5 unidades, em ordem de preferência. Ordenamos por proximidade do seu bairro ({bairroResponsavel}
        ) e disponibilidade de vaga.
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}
      {aviso && (
        <Alert severity="warning" action={<Button onClick={confirmarInscricao}>Confirmar mesmo assim</Button>}>
          {aviso}
        </Alert>
      )}

      <Grid container spacing={1.5}>
        {candidatas.map((c, index) => {
          const selecionadaIndex = selecionadas.indexOf(c.unidadeId);
          const selecionada = selecionadaIndex >= 0;
          return (
            <Grid size={12} key={c.unidadeId}>
              <Card
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderColor: selecionada ? 'primary.main' : undefined,
                  bgcolor: selecionada ? 'primary.lighter' : undefined,
                }}
                onClick={() => alternarSelecao(c.unidadeId)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack>
                    <Typography variant="subtitle2">
                      {selecionada ? `${selecionadaIndex + 1}º — ` : ''}
                      {c.nome}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.bairro}
                      {c.distanciaKm != null ? ` · ${c.distanciaKm.toFixed(1)} km` : c.mesmoBairro ? ' · mesmo bairro' : ''}
                      {' · '}
                      {c.vagasDisponiveis} vaga(s) disponíveis
                    </Typography>
                  </Stack>
                </Stack>
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
