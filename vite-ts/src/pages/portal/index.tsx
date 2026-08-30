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
import Collapse from '@mui/material/Collapse';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import CircularProgress from '@mui/material/CircularProgress';

import { limparCep, buscarEnderecoPorCep } from 'src/lib/viacep';
import {
  getToken,
  type Turno,
  type Crianca,
  getResponsavel,
  criarInscricao,
  cadastrarCrianca,
  getStatusCrianca,
  unidadesProximas,
  type RecomendacaoIA,
  type UnidadeProxima,
  cadastrarResponsavel,
  atualizarResponsavel,
  recomendarUnidadesIA,
  type StatusConsolidado,
  solicitarCodigoResponsavel,
  verificarCodigoResponsavel,
} from 'src/lib/creche-api';

import { Logo } from 'src/components/logo';
import { Iconify } from 'src/components/iconify';
import { EnderecoMap, type EnderecoMapMarcador } from 'src/components/endereco-map/endereco-map';

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
              <Tab key={tab.value} value={tab.value} label={tab.label} disabled={tab.value > etapaMaxima} />
            ))}
          </Tabs>

          <Box sx={{ p: { xs: 3, md: 4 }, flex: '1 1 auto' }}>
            {etapa === 0 && <EtapaDadosPessoais responsavelId={responsavelId} onConcluido={() => irParaEtapa(1)} />}
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
                responsavelId={responsavelId}
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

function EtapaDadosPessoais({ responsavelId, onConcluido }: { responsavelId: string; onConcluido: () => void }) {
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

function EtapaEndereco({
  responsavelId,
  onConcluido,
}: {
  responsavelId: string;
  onConcluido: (bairro: string) => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getResponsavel(responsavelId)
      .then((r) => {
        setCep(r.cep ?? '');
        setLogradouro(r.logradouro ?? '');
        setNumero(r.numero ?? '');
        setComplemento(r.complemento ?? '');
        setBairro(r.bairro === 'Não informado' ? '' : r.bairro);
      })
      .finally(() => setCarregando(false));
  }, [responsavelId]);

  const handleCepChange = async (valor: string) => {
    setCep(valor);
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

  const confirmar = async () => {
    setErro(null);
    if (!bairro.trim()) {
      setErro('Informe ao menos o bairro pra continuar.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarResponsavel(responsavelId, {
        bairro,
        cep: limparCep(cep) || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
      });
      onConcluido(bairro);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Typography>Carregando seus dados…</Typography>;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Seu endereço define quais creches aparecem como mais próximas na próxima etapa — e é mostrado no mapa junto
        com as unidades escolhidas.
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}
      {cepNaoEncontrado && (
        <Alert severity="warning">CEP não encontrado — preencha o endereço manualmente abaixo.</Alert>
      )}

      <TextField
        label="CEP"
        value={cep}
        onChange={(e) => handleCepChange(e.target.value)}
        placeholder="Somente números"
        slotProps={{ input: { endAdornment: buscandoCep ? <CircularProgress size={18} /> : undefined } }}
      />
      <TextField label="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
      <Stack direction="row" spacing={2}>
        <TextField label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} sx={{ flex: 1 }} />
        <TextField
          label="Complemento"
          value={complemento}
          onChange={(e) => setComplemento(e.target.value)}
          sx={{ flex: 2 }}
        />
      </Stack>
      <TextField label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />

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
  responsavelId,
  bairroResponsavel,
  onConcluida,
}: {
  crianca: Crianca;
  responsavelId: string;
  bairroResponsavel: string;
  onConcluida: () => void;
}) {
  const [candidatas, setCandidatas] = useState<UnidadeProxima[]>([]);
  const [moradia, setMoradia] = useState<{ label: string; latitude: number | null; longitude: number | null }>({
    label: bairroResponsavel,
    latitude: null,
    longitude: null,
  });
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
    setLoading(true);
    getResponsavel(responsavelId)
      .then((r) => {
        setMoradia({ label: r.logradouro ?? r.bairro, latitude: r.latitude, longitude: r.longitude });
        return unidadesProximas({
          bairro: r.bairro,
          lat: r.latitude ?? undefined,
          lng: r.longitude ?? undefined,
          anoProcesso: ANO_PROCESSO,
        });
      })
      .then(setCandidatas)
      .finally(() => setLoading(false));
  }, [responsavelId]);

  const pedirRecomendacaoIA = async () => {
    setErroRecomendacao(null);
    setPedindoRecomendacao(true);
    try {
      const resultado = await recomendarUnidadesIA({
        responsavelId,
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

  const alternarSelecao = (unidadeId: string) => {
    setSelecionadas((atual) => {
      if (atual.includes(unidadeId)) return atual.filter((id) => id !== unidadeId);
      if (atual.length >= 5) return atual;
      return [...atual, unidadeId];
    });
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
          if (moradia.latitude != null && moradia.longitude != null) {
            marcadores.push({
              id: `moradia-${responsavelId}`,
              label: `Moradia — ${moradia.label}`,
              latitude: moradia.latitude,
              longitude: moradia.longitude,
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
