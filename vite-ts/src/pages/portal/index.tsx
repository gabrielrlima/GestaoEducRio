import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';

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
  atualizarResponsavel,
  solicitarCodigoResponsavel,
  verificarCodigoResponsavel,
} from 'src/lib/creche-api';
import { limparCep, buscarEnderecoPorCep } from 'src/lib/viacep';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();

type Etapa = 0 | 1 | 2 | 3 | 4;

const TABS: Array<{ value: Etapa; label: string }> = [
  { value: 0, label: 'Dados pessoais' },
  { value: 1, label: 'Endereço' },
  { value: 2, label: 'Cadastrar filho(a)' },
  { value: 3, label: 'Escolher unidades' },
  { value: 4, label: 'Status' },
];

export default function PortalPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [etapa, setEtapa] = useState<Etapa>(0);
  const [etapaMaxima, setEtapaMaxima] = useState<Etapa>(0);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [bairroResponsavel, setBairroResponsavel] = useState('');
  const [crianca, setCrianca] = useState<Crianca | null>(null);
  const [status, setStatus] = useState<StatusConsolidado | null>(null);

  useEffect(() => {
    if (getToken('responsavel')) {
      // sessão existente — usuário precisa re-buscar o próprio cadastro pra continuar
    }
  }, []);

  const irParaEtapa = useCallback((novaEtapa: Etapa) => {
    setEtapa(novaEtapa);
    setEtapaMaxima((atual) => (novaEtapa > atual ? novaEtapa : atual));
  }, []);

  const irParaEscolhaOuStatus = useCallback(
    async (idCrianca: string) => {
      const s = await getStatusCrianca(idCrianca);
      setStatus(s);
      irParaEtapa(s.inscricaoAtiva ? 4 : 3);
    },
    [irParaEtapa]
  );

  // Login é uma tela pura (igual ao login admin) — não é uma etapa da
  // "área logada". Só depois de autenticado (responsavelId setado) é que o
  // usuário entra no card com as etapas em tabs.
  if (!responsavelId) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.neutral' }}>
        <title>Portal da Família — GestaoEducRio</title>
        <Container maxWidth="xs">
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Logo isSingle={false} sx={{ width: 190, height: 56 }} />
          </Box>
          <Card sx={{ p: 5 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              Inscrição Creche
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Acesse com seu CPF pra cadastrar seu filho(a) e escolher unidades.
            </Typography>
            <EtapaLogin
              onAutenticado={(id, bairro) => {
                setResponsavelId(id);
                setBairroResponsavel(bairro);
              }}
            />
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.neutral', py: { xs: 3, md: 6 } }}>
      <title>Portal da Família — GestaoEducRio</title>
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Logo isSingle={false} sx={{ width: 190, height: 56 }} />
        </Box>

        <Typography variant="h4" sx={{ mb: 1, textAlign: 'center' }}>
          Inscrição Creche
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, textAlign: 'center' }}>
          Cadastre seu filho(a) e escolha as unidades mais próximas de você.
        </Typography>

        <Card sx={{ display: 'flex', minHeight: 480, flexDirection: { xs: 'column', md: 'row' } }}>
          <Tabs
            orientation={isMobile ? 'horizontal' : 'vertical'}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : undefined}
            allowScrollButtonsMobile={isMobile}
            value={etapa}
            onChange={(_event, newValue: Etapa) => {
              if (newValue <= etapaMaxima) setEtapa(newValue);
            }}
            sx={{
              p: isMobile ? 1 : 2,
              width: { md: 220 },
              bgcolor: 'background.neutral',
              borderRight: { md: `1px solid ${theme.vars.palette.divider}` },
              borderBottom: { xs: `1px solid ${theme.vars.palette.divider}`, md: 'none' },
              '& .MuiTab-root': {
                alignItems: isMobile ? 'center' : 'flex-start',
                textAlign: isMobile ? 'center' : 'left',
                minHeight: 48,
                mx: isMobile ? 0.5 : 1.5,
                my: isMobile ? 0 : 0.5,
                borderRadius: 1,
              },
              '& .Mui-selected': {
                bgcolor: 'background.paper',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                disabled={tab.value > etapaMaxima}
              />
            ))}
          </Tabs>

          <Box sx={{ p: { xs: 3, md: 4 }, flex: '1 1 auto' }}>
            {etapa === 0 && (
              <EtapaDadosPessoais responsavelId={responsavelId} onConcluido={() => irParaEtapa(1)} />
            )}
            {etapa === 1 && (
              <EtapaEndereco
                responsavelId={responsavelId}
                onConcluido={(bairro) => {
                  setBairroResponsavel(bairro);
                  irParaEtapa(2);
                }}
              />
            )}
            {etapa === 2 && (
              <EtapaCadastroCrianca
                responsavelId={responsavelId}
                onCriada={(c) => {
                  setCrianca(c);
                  irParaEscolhaOuStatus(c.id);
                }}
              />
            )}
            {etapa === 3 && crianca && (
              <EtapaEscolhaUnidades
                crianca={crianca}
                bairroResponsavel={bairroResponsavel}
                onConcluida={() => irParaEscolhaOuStatus(crianca.id)}
              />
            )}
            {etapa === 4 && status && <EtapaStatus status={status} />}
          </Box>
        </Card>
      </Container>
    </Box>
  );
}

// ----------------------------------------------------------------------

function EtapaLogin({ onAutenticado }: { onAutenticado: (responsavelId: string, bairro: string) => void }) {
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [precisaCadastrar, setPrecisaCadastrar] = useState(false);
  const [codigoSolicitado, setCodigoSolicitado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [infoEnvio, setInfoEnvio] = useState<string | null>(null);

  // Fluxo automático: tenta o login com CPF + data de nascimento; se não
  // encontrar cadastro, revela e-mail (é o canal do código de verificação,
  // por isso mora aqui e não em "Dados pessoais") — ao confirmar, cria a
  // conta e já dispara o código. Nome, telefone e endereço são preenchidos
  // depois, já autenticado, nas primeiras etapas em tabs da área logada.
  const continuar = async () => {
    setErro(null);
    if (precisaCadastrar && !email.trim()) {
      setErro('Informe seu e-mail pra receber o código de acesso.');
      return;
    }

    setLoading(true);
    try {
      if (precisaCadastrar) {
        await cadastrarResponsavel({ cpf, dataNascimento, email });
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
      onAutenticado(responsavelId, responsavel.bairro);
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
        <LoadingButton fullWidth variant="contained" size="large" loading={loading} onClick={verificar}>
          Confirmar código
        </LoadingButton>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      {erro && <Alert severity="error">{erro}</Alert>}
      {precisaCadastrar && (
        <Alert severity="info">Não encontramos seu cadastro — informe seu e-mail pra receber o código de acesso.</Alert>
      )}

      <TextField label="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" />
      <TextField
        label="Data de nascimento"
        type="date"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      {precisaCadastrar && <TextField label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />}

      <LoadingButton fullWidth variant="contained" size="large" loading={loading} onClick={continuar}>
        Continuar
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function EtapaDadosPessoais({
  responsavelId,
  onConcluido,
}: {
  responsavelId: string;
  onConcluido: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getResponsavel(responsavelId)
      .then((r) => {
        setNome(r.nome === 'Não informado' ? '' : r.nome);
        setTelefone(r.telefone ?? '');
      })
      .finally(() => setCarregando(false));
  }, [responsavelId]);

  const confirmar = async () => {
    setErro(null);
    if (!nome.trim()) {
      setErro('Informe seu nome completo pra continuar.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarResponsavel(responsavelId, { nome, telefone: telefone || undefined });
      onConcluido();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Typography>Carregando seus dados…</Typography>;

  return (
    <Stack spacing={2.5}>
      {erro && <Alert severity="error">{erro}</Alert>}
      <TextField label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
      <TextField
        label="WhatsApp / telefone"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        placeholder="Somente números, com DDD"
      />
      <LoadingButton variant="contained" size="large" loading={salvando} onClick={confirmar}>
        Continuar
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

interface DadosEndereco {
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
}

/** Estado + lógica (autofill por CEP) de um bloco de endereço — reusado pro residencial, trabalho e alternativo. */
function useCamposEndereco() {
  const [cep, setCepRaw] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);

  const hidratar = (dados: DadosEndereco) => {
    setCepRaw(dados.cep ?? '');
    setLogradouro(dados.logradouro ?? '');
    setNumero(dados.numero ?? '');
    setComplemento(dados.complemento ?? '');
    setBairro(dados.bairro && dados.bairro !== 'Não informado' ? dados.bairro : '');
  };

  const setCep = async (valor: string) => {
    setCepRaw(valor);
    setCepNaoEncontrado(false);
    if (limparCep(valor).length !== 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarEnderecoPorCep(valor);
      if (endereco) {
        setLogradouro(endereco.logradouro);
        setBairro(endereco.bairro);
      } else {
        setCepNaoEncontrado(true);
      }
    } finally {
      setBuscandoCep(false);
    }
  };

  return {
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    buscandoCep,
    cepNaoEncontrado,
    setCep,
    setLogradouro,
    setNumero,
    setComplemento,
    setBairro,
    hidratar,
    preenchido: bairro.trim().length > 0,
    payload: () => ({
      cep: limparCep(cep) || undefined,
      logradouro: logradouro || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      bairro: bairro || undefined,
    }),
  };
}

type CamposEndereco = ReturnType<typeof useCamposEndereco>;

function BlocoEndereco({ campos, tituloBairro = 'Bairro' }: { campos: CamposEndereco; tituloBairro?: string }) {
  return (
    <Stack spacing={2}>
      {campos.cepNaoEncontrado && (
        <Alert severity="warning">CEP não encontrado — preencha o endereço manualmente abaixo.</Alert>
      )}
      <TextField
        label="CEP"
        value={campos.cep}
        onChange={(e) => campos.setCep(e.target.value)}
        placeholder="Somente números"
        slotProps={{ input: { endAdornment: campos.buscandoCep ? <CircularProgress size={18} /> : undefined } }}
      />
      <TextField label="Logradouro" value={campos.logradouro} onChange={(e) => campos.setLogradouro(e.target.value)} />
      <Stack direction="row" spacing={2}>
        <TextField label="Número" value={campos.numero} onChange={(e) => campos.setNumero(e.target.value)} sx={{ flex: 1 }} />
        <TextField
          label="Complemento"
          value={campos.complemento}
          onChange={(e) => campos.setComplemento(e.target.value)}
          sx={{ flex: 2 }}
        />
      </Stack>
      <TextField label={tituloBairro} value={campos.bairro} onChange={(e) => campos.setBairro(e.target.value)} />
    </Stack>
  );
}

function EtapaEndereco({
  responsavelId,
  onConcluido,
}: {
  responsavelId: string;
  onConcluido: (bairro: string) => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const residencial = useCamposEndereco();
  const trabalho = useCamposEndereco();
  const alternativo = useCamposEndereco();
  const [mostrarTrabalho, setMostrarTrabalho] = useState(false);
  const [mostrarAlternativo, setMostrarAlternativo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getResponsavel(responsavelId)
      .then((r) => {
        residencial.hidratar({ cep: r.cep, logradouro: r.logradouro, numero: r.numero, complemento: r.complemento, bairro: r.bairro });
        trabalho.hidratar({
          cep: r.trabalho_cep,
          logradouro: r.trabalho_logradouro,
          numero: r.trabalho_numero,
          complemento: r.trabalho_complemento,
          bairro: r.trabalho_bairro,
        });
        alternativo.hidratar({
          cep: r.alternativo_cep,
          logradouro: r.alternativo_logradouro,
          numero: r.alternativo_numero,
          complemento: r.alternativo_complemento,
          bairro: r.alternativo_bairro,
        });
        if (r.trabalho_bairro) setMostrarTrabalho(true);
        if (r.alternativo_bairro) setMostrarAlternativo(true);
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsavelId]);

  const confirmar = async () => {
    setErro(null);
    if (!residencial.bairro.trim()) {
      setErro('Informe ao menos o bairro do endereço residencial pra continuar.');
      return;
    }
    setSalvando(true);
    try {
      const residencialPayload = residencial.payload();
      const trabalhoPayload = mostrarTrabalho && trabalho.preenchido ? trabalho.payload() : null;
      const alternativoPayload = mostrarAlternativo && alternativo.preenchido ? alternativo.payload() : null;

      await atualizarResponsavel(responsavelId, {
        bairro: residencialPayload.bairro,
        cep: residencialPayload.cep,
        logradouro: residencialPayload.logradouro,
        numero: residencialPayload.numero,
        complemento: residencialPayload.complemento,
        ...(trabalhoPayload && {
          trabalhoBairro: trabalhoPayload.bairro,
          trabalhoCep: trabalhoPayload.cep,
          trabalhoLogradouro: trabalhoPayload.logradouro,
          trabalhoNumero: trabalhoPayload.numero,
          trabalhoComplemento: trabalhoPayload.complemento,
        }),
        ...(alternativoPayload && {
          alternativoBairro: alternativoPayload.bairro,
          alternativoCep: alternativoPayload.cep,
          alternativoLogradouro: alternativoPayload.logradouro,
          alternativoNumero: alternativoPayload.numero,
          alternativoComplemento: alternativoPayload.complemento,
        }),
      });
      onConcluido(residencial.bairro);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Typography>Carregando seus dados…</Typography>;

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Seu endereço residencial define quais creches aparecem como mais próximas. Trabalho e alternativo são
        opcionais — úteis se o dia a dia da criança acontece perto de outro endereço.
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}

      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Endereço residencial</Typography>
        <BlocoEndereco campos={residencial} />
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">Endereço de trabalho (opcional)</Typography>
          <Button size="small" onClick={() => setMostrarTrabalho((v) => !v)}>
            {mostrarTrabalho ? 'Remover' : 'Adicionar'}
          </Button>
        </Stack>
        {mostrarTrabalho && <BlocoEndereco campos={trabalho} />}
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">Endereço alternativo (opcional)</Typography>
          <Button size="small" onClick={() => setMostrarAlternativo((v) => !v)}>
            {mostrarAlternativo ? 'Remover' : 'Adicionar'}
          </Button>
        </Stack>
        {mostrarAlternativo && (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Ex.: casa de um familiar, se a criança passa parte da semana lá.
            </Typography>
            <BlocoEndereco campos={alternativo} />
          </>
        )}
      </Stack>

      <LoadingButton variant="contained" size="large" loading={salvando} onClick={confirmar}>
        Continuar
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
