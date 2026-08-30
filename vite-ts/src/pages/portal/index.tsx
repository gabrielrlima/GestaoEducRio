import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControl from '@mui/material/FormControl';
import useMediaQuery from '@mui/material/useMediaQuery';
import Chip, { type ChipProps } from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { limparCep, buscarEnderecoPorCep } from 'src/lib/viacep';
import {
  getToken,
  type Turno,
  type Crianca,
  type Pergunta,
  getResponsavel,
  criarInscricao,
  listarPerguntas,
  salvarRespostas,
  listarRespostas,
  atualizarCrianca,
  cadastrarCrianca,
  getStatusCrianca,
  unidadesProximas,
  type Responsavel,
  type RecomendacaoIA,
  type UnidadeProxima,
  cadastrarResponsavel,
  atualizarResponsavel,
  recomendarUnidadesIA,
  type StatusConsolidado,
  type BadgeRecomendacao,
  solicitarCodigoResponsavel,
  verificarCodigoResponsavel,
} from 'src/lib/creche-api';

import { Logo } from 'src/components/logo';
import { Iconify } from 'src/components/iconify';
import { EnderecoMap, type EnderecoMapMarcador } from 'src/components/endereco-map/endereco-map';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();

type Etapa = 0 | 1 | 2 | 3 | 4 | 5;

const TABS: Array<{ value: Etapa; label: string }> = [
  { value: 0, label: 'Dados pessoais' },
  { value: 1, label: 'Endereço' },
  { value: 2, label: 'Cadastrar filho(a)' },
  { value: 3, label: 'Escolher unidades' },
  { value: 4, label: 'Documentos' },
  { value: 5, label: 'Status' },
];

export default function PortalPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [etapa, setEtapa] = useState<Etapa>(0);
  const [etapaMaxima, setEtapaMaxima] = useState<Etapa>(0);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [bairroResponsavel, setBairroResponsavel] = useState('');
  const [criancas, setCriancas] = useState<Crianca[]>([]);
  const [criancaAtivaId, setCriancaAtivaId] = useState<string | null>(null);
  const [inscricaoAtivaId, setInscricaoAtivaId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusConsolidado | null>(null);

  const criancaAtiva = criancas.find((c) => c.id === criancaAtivaId) ?? null;

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
      setCriancaAtivaId(idCrianca);
      const s = await getStatusCrianca(idCrianca);
      setStatus(s);
      setInscricaoAtivaId(s.inscricaoAtiva?.id ?? null);
      irParaEtapa(s.inscricaoAtiva ? 5 : 3);
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
              flexShrink: { md: 0 },
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

          <Box sx={{ p: { xs: 3, md: 4 }, flex: '1 1 auto', minWidth: 0 }}>
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
                onContinuar={(todas) => {
                  setCriancas(todas);
                  irParaEscolhaOuStatus(todas[0].id);
                }}
              />
            )}
            {etapa === 3 && criancaAtiva && (
              <>
                <SeletorCrianca criancas={criancas} ativaId={criancaAtivaId} onSelecionar={irParaEscolhaOuStatus} />
                <EtapaEscolhaUnidades
                  crianca={criancaAtiva}
                  responsavelId={responsavelId}
                  bairroResponsavel={bairroResponsavel}
                  onConcluida={(inscricaoId) => {
                    setInscricaoAtivaId(inscricaoId);
                    irParaEtapa(4);
                  }}
                />
              </>
            )}
            {etapa === 4 && criancaAtiva && inscricaoAtivaId && (
              <>
                <SeletorCrianca criancas={criancas} ativaId={criancaAtivaId} onSelecionar={irParaEscolhaOuStatus} />
                <EtapaElegibilidade
                  inscricaoId={inscricaoAtivaId}
                  anoProcesso={ANO_PROCESSO}
                  onConcluido={() => irParaEscolhaOuStatus(criancaAtiva.id)}
                />
              </>
            )}
            {etapa === 5 && status && (
              <>
                <SeletorCrianca criancas={criancas} ativaId={criancaAtivaId} onSelecionar={irParaEscolhaOuStatus} />
                <EtapaStatus status={status} />
              </>
            )}
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
      await solicitarCodigoResponsavel(cpf, dataNascimento);
      setInfoEnvio('Código enviado para o seu e-mail cadastrado.');
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

interface DadosCrianca {
  nomeCompleto: string;
  cpfCrianca: string;
  dataNascimento: string;
  sexo: 'M' | 'F' | '';
}

const CRIANCA_VAZIA: DadosCrianca = { nomeCompleto: '', cpfCrianca: '', dataNascimento: '', sexo: '' };

function FormularioCrianca({
  dados,
  onChange,
}: {
  dados: DadosCrianca;
  onChange: (dados: DadosCrianca) => void;
}) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Nome completo da criança"
        value={dados.nomeCompleto}
        onChange={(e) => onChange({ ...dados, nomeCompleto: e.target.value })}
      />
      <TextField
        label="CPF da criança"
        value={dados.cpfCrianca}
        onChange={(e) => onChange({ ...dados, cpfCrianca: e.target.value })}
        placeholder="Somente números"
      />
      <TextField
        label="Data de nascimento"
        type="date"
        value={dados.dataNascimento}
        onChange={(e) => onChange({ ...dados, dataNascimento: e.target.value })}
        InputLabelProps={{ shrink: true }}
      />
      <FormControl>
        <RadioGroup
          row
          value={dados.sexo || ''}
          onChange={(e) => onChange({ ...dados, sexo: e.target.value as 'M' | 'F' })}
        >
          <FormControlLabel value="M" control={<Radio />} label="Menino" />
          <FormControlLabel value="F" control={<Radio />} label="Menina" />
        </RadioGroup>
      </FormControl>
    </Stack>
  );
}

function CriancaCard({
  crianca,
  onSalva,
}: {
  crianca: Crianca;
  onSalva: (atualizada: Crianca) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState<DadosCrianca>({
    nomeCompleto: crianca.nome_completo,
    cpfCrianca: crianca.cpf_crianca,
    dataNascimento: crianca.data_nascimento,
    sexo: crianca.sexo ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setErro(null);
    if (!dados.nomeCompleto.trim() || !dados.cpfCrianca.trim() || !dados.dataNascimento) {
      setErro('Preencha nome, CPF e data de nascimento pra continuar.');
      return;
    }
    setSalvando(true);
    try {
      const atualizada = await atualizarCrianca(crianca.id, {
        nomeCompleto: dados.nomeCompleto,
        cpfCrianca: dados.cpfCrianca,
        dataNascimento: dados.dataNascimento,
        sexo: dados.sexo || undefined,
      });
      onSalva(atualizada);
      setEditando(false);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  if (editando) {
    return (
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          {erro && <Alert severity="error">{erro}</Alert>}
          <FormularioCrianca dados={dados} onChange={setDados} />
          <Stack direction="row" spacing={1}>
            <LoadingButton variant="contained" loading={salvando} onClick={salvar}>
              Salvar
            </LoadingButton>
            <Button
              disabled={salvando}
              onClick={() => {
                setDados({
                  nomeCompleto: crianca.nome_completo,
                  cpfCrianca: crianca.cpf_crianca,
                  dataNascimento: crianca.data_nascimento,
                  sexo: crianca.sexo ?? '',
                });
                setErro(null);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack>
          <Typography variant="subtitle2">{crianca.nome_completo}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Nascimento: {crianca.data_nascimento} · CPF: {crianca.cpf_crianca}
          </Typography>
        </Stack>
        <Button size="small" onClick={() => setEditando(true)}>
          Editar
        </Button>
      </Stack>
    </Card>
  );
}

function EtapaCadastroCrianca({
  responsavelId,
  onContinuar,
}: {
  responsavelId: string;
  onContinuar: (criancas: Crianca[]) => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [criancas, setCriancas] = useState<Crianca[]>([]);
  const [dadosNovo, setDadosNovo] = useState<DadosCrianca>(CRIANCA_VAZIA);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getResponsavel(responsavelId)
      .then((r) => setCriancas(r.criancas))
      .finally(() => setCarregando(false));
  }, [responsavelId]);

  const adicionar = async () => {
    setErro(null);
    if (!dadosNovo.nomeCompleto.trim() || !dadosNovo.cpfCrianca.trim() || !dadosNovo.dataNascimento) {
      setErro('Preencha nome, CPF e data de nascimento pra continuar.');
      return;
    }
    setLoading(true);
    try {
      const c = await cadastrarCrianca(responsavelId, {
        nomeCompleto: dadosNovo.nomeCompleto,
        cpfCrianca: dadosNovo.cpfCrianca,
        dataNascimento: dadosNovo.dataNascimento,
        sexo: dadosNovo.sexo || undefined,
      });
      setCriancas((atual) => [...atual, c]);
      setDadosNovo(CRIANCA_VAZIA);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (carregando) return <Typography>Carregando…</Typography>;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Cadastre um ou mais filhos(as) — cada um pode ser inscrito separadamente nas próximas etapas. Errou algum
        dado? Clique em &ldquo;Editar&rdquo; pra corrigir.
      </Typography>

      {criancas.length > 0 && (
        <Stack spacing={1}>
          {criancas.map((c) => (
            <CriancaCard
              key={c.id}
              crianca={c}
              onSalva={(atualizada) =>
                setCriancas((atual) => atual.map((item) => (item.id === atualizada.id ? atualizada : item)))
              }
            />
          ))}
        </Stack>
      )}

      {erro && <Alert severity="error">{erro}</Alert>}

      <Stack spacing={2}>
        <Typography variant="subtitle2">{criancas.length > 0 ? 'Adicionar outro(a) filho(a)' : 'Dados da criança'}</Typography>
        <FormularioCrianca dados={dadosNovo} onChange={setDadosNovo} />
        <LoadingButton variant="outlined" size="large" loading={loading} onClick={adicionar}>
          Adicionar filho(a)
        </LoadingButton>
      </Stack>

      <LoadingButton
        variant="contained"
        size="large"
        disabled={criancas.length === 0}
        onClick={() => onContinuar(criancas)}
      >
        Continuar
      </LoadingButton>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function SeletorCrianca({
  criancas,
  ativaId,
  onSelecionar,
}: {
  criancas: Crianca[];
  ativaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  if (criancas.length <= 1) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
      {criancas.map((c) => (
        <Chip
          key={c.id}
          label={c.nome_completo}
          color={c.id === ativaId ? 'primary' : 'default'}
          onClick={() => onSelecionar(c.id)}
        />
      ))}
    </Stack>
  );
}

// ----------------------------------------------------------------------

const COR_DO_BADGE: Record<BadgeRecomendacao, ChipProps['color']> = {
  'Alta chance de vaga': 'success',
  'Muitas vagas abertas': 'success',
  'Mais perto de casa': 'primary',
  'Mais perto do trabalho': 'info',
  'No caminho para o trabalho': 'info',
  'Perto do endereço alternativo': 'info',
  'Melhor equilíbrio': 'secondary',
};

/** O backend pode ganhar um badge novo antes do front — nesse caso cai na cor padrão. */
function corDoBadge(badge: string): ChipProps['color'] {
  return COR_DO_BADGE[badge as BadgeRecomendacao] ?? 'default';
}

/**
 * Pinos dos endereços da família a partir do cadastro do responsável (moradia, trabalho e
 * alternativo são colunas de `responsavel`). Só entra quem tem coordenada: sem lat/lng o
 * Leaflet não tem onde desenhar, e é a coordenada que também sustenta o traçado
 * casa→trabalho que o EnderecoMap monta sozinho.
 */
function marcadoresDoResponsavel(r: Responsavel): EnderecoMapMarcador[] {
  const enderecos = [
    {
      tipo: 'moradia' as const,
      rotulo: 'Moradia',
      detalhe: r.logradouro ?? r.bairro,
      latitude: r.latitude,
      longitude: r.longitude,
    },
    {
      tipo: 'trabalho' as const,
      rotulo: 'Trabalho',
      detalhe: r.trabalho_logradouro ?? r.trabalho_bairro,
      latitude: r.trabalho_latitude,
      longitude: r.trabalho_longitude,
    },
    {
      tipo: 'alternativo' as const,
      rotulo: 'Endereço alternativo',
      detalhe: r.alternativo_logradouro ?? r.alternativo_bairro,
      latitude: r.alternativo_latitude,
      longitude: r.alternativo_longitude,
    },
  ];

  return enderecos
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
      id: `endereco-${e.tipo}`,
      label: e.detalhe?.trim() ? `${e.rotulo} — ${e.detalhe}` : e.rotulo,
      latitude: e.latitude as number,
      longitude: e.longitude as number,
      tipo: e.tipo,
    }));
}

function EtapaEscolhaUnidades({
  crianca,
  responsavelId,
  bairroResponsavel,
  onConcluida,
}: {
  crianca: Crianca;
  responsavelId: string;
  bairroResponsavel: string;
  onConcluida: (inscricaoId: string) => void;
}) {
  const [candidatas, setCandidatas] = useState<UnidadeProxima[]>([]);
  const [responsavel, setResponsavel] = useState<Responsavel | null>(null);
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
    // Busca o cadastro pra ter as coordenadas (dos 3 endereços, pro mapa; da moradia, pra
    // ordenar por distância real em vez de só por bairro).
    getResponsavel(responsavelId)
      .then((r) => {
        setResponsavel(r);
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

  // Pinos dos endereços: iguais em todos os cards, então calcula uma vez só.
  const marcadoresEnderecos = useMemo<EnderecoMapMarcador[]>(
    () => (responsavel ? marcadoresDoResponsavel(responsavel) : []),
    [responsavel]
  );

  const pedirRecomendacaoIA = async () => {
    setErroRecomendacao(null);
    setPedindoRecomendacao(true);
    try {
      // Sem `grupamento`/`turno`: o backend deriva o grupamento pela idade da criança,
      // com a mesma régua que `criarInscricao` aplica depois.
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

  // Recomendadas pela IA sobem pro topo (mantendo a ordenação por proximidade dentro de
  // cada grupo) — todas as unidades continuam na lista, só reordena.
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
        onConcluida(resultado.id);
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
              O agente está lendo seus endereços, calculando distâncias e conferindo o histórico de cada unidade —
              leva uns 30s…
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

              {recomendacaoIA.alertas?.map((alerta, i) => (
                <Alert key={i} severity="warning">
                  {alerta}
                </Alert>
              ))}

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

          // A unidade vem primeiro: o EnderecoMap usa o primeiro marcador como centro
          // inicial, antes do fitBounds enquadrar tudo (pinos + traçado casa→trabalho).
          const marcadores: EnderecoMapMarcador[] = [
            ...(c.latitude != null && c.longitude != null
              ? [
                  {
                    id: `unidade-${c.unidadeId}`,
                    label: c.nome,
                    latitude: c.latitude,
                    longitude: c.longitude,
                    tipo: 'unidade' as const,
                  },
                ]
              : []),
            ...marcadoresEnderecos,
          ];

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
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle2">
                        {selecionada ? `${selecionadaIndex + 1}º — ` : ''}
                        {c.nome}
                      </Typography>
                      {/* O badge é o rótulo informativo (por que ESTA unidade se destaca);
                          o "Recomendada pela IA" fica em soft pra não competir com ele. */}
                      {recomendacao?.badge && (
                        <Chip size="small" color={corDoBadge(recomendacao.badge)} label={recomendacao.badge} />
                      )}
                      {recomendacao && <Chip size="small" variant="soft" color="success" label="Recomendada pela IA" />}
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {c.bairro}
                      {c.distanciaKm != null ? ` · ${c.distanciaKm.toFixed(1)} km` : c.mesmoBairro ? ' · mesmo bairro' : ''}
                      {' · '}
                      {c.vagasDisponiveis} vaga(s) disponíveis
                    </Typography>
                    {/* `porque` é um parágrafo de 2-3 frases, não uma linha — body2 em vez
                        de caption pra ficar legível. */}
                    {recomendacao && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
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

function lerArquivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface RespostaLocal {
  marcado: boolean;
  arquivo: File | null;
}

function EtapaElegibilidade({
  inscricaoId,
  anoProcesso,
  onConcluido,
}: {
  inscricaoId: string;
  anoProcesso: number;
  onConcluido: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, RespostaLocal>>({});
  const [jaEnviado, setJaEnviado] = useState<Record<string, string>>({}); // perguntaId -> arquivo_nome
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarPerguntas(anoProcesso), listarRespostas(inscricaoId)]).then(([todasPerguntas, existentes]) => {
      setPerguntas(todasPerguntas);
      const marcados: Record<string, RespostaLocal> = {};
      const enviados: Record<string, string> = {};
      for (const r of existentes) {
        marcados[r.pergunta_id] = { marcado: r.resposta === 'Sim', arquivo: null };
        if (r.arquivo_nome) enviados[r.pergunta_id] = r.arquivo_nome;
      }
      setRespostas(marcados);
      setJaEnviado(enviados);
      setCarregando(false);
    });
  }, [inscricaoId, anoProcesso]);

  const alternar = (perguntaId: string) => {
    setRespostas((atual) => ({
      ...atual,
      [perguntaId]: { marcado: !atual[perguntaId]?.marcado, arquivo: atual[perguntaId]?.arquivo ?? null },
    }));
  };

  const anexar = (perguntaId: string, arquivo: File | null) => {
    setRespostas((atual) => ({ ...atual, [perguntaId]: { marcado: atual[perguntaId]?.marcado ?? false, arquivo } }));
  };

  const pontuacaoEstimativa = perguntas.reduce(
    (soma, p) => (respostas[p.id]?.marcado && !p.criterio_desempate ? soma + p.pontuacao : soma),
    0
  );

  const enviar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const payload = await Promise.all(
        perguntas.map(async (p) => {
          const r = respostas[p.id];
          const arquivoBase64 = r?.arquivo ? await lerArquivoBase64(r.arquivo) : undefined;
          return {
            perguntaId: p.id,
            resposta: (r?.marcado ? 'Sim' : 'Nao') as 'Sim' | 'Nao',
            arquivoNome: r?.arquivo?.name,
            arquivoTipo: r?.arquivo?.type,
            arquivoBase64,
          };
        })
      );
      await salvarRespostas(inscricaoId, payload);
      onConcluido();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) return <Typography>Carregando critérios de elegibilidade…</Typography>;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Marque os critérios que se aplicam à sua família e, se tiver, anexe um comprovante — isso define sua
        pontuação na fila de classificação (regras oficiais da SME). Nenhum critério é obrigatório.
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}

      <Alert severity="info">
        Pontuação estimada com os critérios marcados: <strong>{pontuacaoEstimativa} pontos</strong>
      </Alert>

      <Stack spacing={1.5}>
        {perguntas.map((p) => {
          const r = respostas[p.id];
          const enviadoAnteriormente = jaEnviado[p.id];
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{
                p: 2,
                borderColor: r?.marcado ? 'primary.main' : undefined,
                bgcolor: r?.marcado ? 'primary.lighter' : undefined,
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                <Chip
                  label={r?.marcado ? 'Sim' : 'Não'}
                  color={r?.marcado ? 'primary' : 'default'}
                  onClick={() => alternar(p.id)}
                  sx={{ cursor: 'pointer', flexShrink: 0 }}
                />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Typography variant="body2">{p.texto}</Typography>
                  {!p.criterio_desempate && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {p.pontuacao} pontos
                    </Typography>
                  )}
                  {r?.marcado && (
                    <Stack spacing={0.5}>
                      <Button component="label" size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                        {r.arquivo ? r.arquivo.name : enviadoAnteriormente ? 'Trocar comprovante' : 'Anexar comprovante'}
                        <input
                          type="file"
                          hidden
                          onChange={(e) => anexar(p.id, e.target.files?.[0] ?? null)}
                        />
                      </Button>
                      {enviadoAnteriormente && !r.arquivo && (
                        <Typography variant="caption" sx={{ color: 'success.main' }}>
                          Comprovante já enviado: {enviadoAnteriormente}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Stack>

      <LoadingButton variant="contained" size="large" loading={enviando} onClick={enviar}>
        Enviar e continuar
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
