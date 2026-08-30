import { useParams } from 'react-router';
import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { useTranslate } from 'src/locales';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  type Unidade,
  type VagaConfig,
  type InscricaoOpcao,
  getUnidade,
  filaDoProcesso,
  selecionarOpcao,
  confirmarOpcao,
  desistirOpcao,
} from 'src/lib/creche-api';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();

const SITUACAO_COR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  Ativo: 'default',
  Selecionado: 'warning',
  'Selecionado da lista': 'warning',
  Confirmado: 'success',
  'Lista de espera': 'info',
  Cancelado: 'error',
  'Cancelado na confirmacao': 'error',
  'Cancelado pelo sistema': 'error',
  Bloqueada: 'error',
};

export default function UnidadeDetailPage() {
  const { t } = useTranslate('creche');
  const { id = '' } = useParams();
  const [unidade, setUnidade] = useState<(Unidade & { vagas: VagaConfig[] }) | null>(null);
  const [fila, setFila] = useState<InscricaoOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([getUnidade(id), filaDoProcesso(ANO_PROCESSO, { unidadeId: id })])
      .then(([u, f]) => {
        setUnidade(u);
        setFila(f);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const executarAcao = async (acao: () => Promise<unknown>, opcaoId: string) => {
    setErro(null);
    setAcaoEmAndamento(opcaoId);
    try {
      await acao();
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAcaoEmAndamento(null);
    }
  };

  if (loading && !unidade) {
    return (
      <DashboardContent>
        <LinearProgress />
      </DashboardContent>
    );
  }

  if (!unidade) return null;

  return (
    <>
      <title>{unidade.nome} — GestaoEducRio</title>
      <DashboardContent>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          {unidade.nome}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {unidade.bairro} · {unidade.tipo_gestao}{' '}
          {unidade.cre ? `· ${t('unidadeDetail.cre', { cre: unidade.cre })}` : ''}
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardHeader title={t('unidadeDetail.vagasPorGrupamento')} />
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('unidadeDetail.tableVagas.grupamento')}</TableCell>
                      <TableCell>{t('unidadeDetail.tableVagas.turno')}</TableCell>
                      <TableCell align="right">{t('unidadeDetail.tableVagas.ocupadas')}</TableCell>
                      <TableCell align="right">{t('unidadeDetail.tableVagas.total')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unidade.vagas.map((v) => (
                      <TableRow key={`${v.grupamento}-${v.turno}`}>
                        <TableCell>{v.grupamento}</TableCell>
                        <TableCell>{v.turno}</TableCell>
                        <TableCell align="right">{v.vagas_ocupadas}</TableCell>
                        <TableCell align="right">{v.capacidade_total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardHeader
                title={t('unidadeDetail.criancasInscritas')}
                subheader={t('unidadeDetail.solicitacoesSubheader', { count: fila.length, ano: ANO_PROCESSO })}
              />
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('unidadeDetail.tableFila.crianca')}</TableCell>
                      <TableCell>{t('unidadeDetail.tableFila.turno')}</TableCell>
                      <TableCell>{t('unidadeDetail.tableFila.situacao')}</TableCell>
                      <TableCell align="right">{t('unidadeDetail.tableFila.acoes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fila.map((opcao) => (
                      <TableRow key={opcao.id}>
                        <TableCell>{opcao.crianca_nome}</TableCell>
                        <TableCell>{opcao.turno}</TableCell>
                        <TableCell>
                          <Chip size="small" label={opcao.situacao} color={SITUACAO_COR[opcao.situacao] ?? 'default'} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            {opcao.situacao === 'Ativo' && (
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={acaoEmAndamento === opcao.id}
                                onClick={() => executarAcao(() => selecionarOpcao(opcao.id), opcao.id)}
                              >
                                {t('unidadeDetail.acaoChamar')}
                              </Button>
                            )}
                            {(opcao.situacao === 'Selecionado' || opcao.situacao === 'Selecionado da lista') && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  disabled={acaoEmAndamento === opcao.id}
                                  onClick={() => executarAcao(() => confirmarOpcao(opcao.id), opcao.id)}
                                >
                                  {t('unidadeDetail.acaoConfirmar')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="text"
                                  color="error"
                                  disabled={acaoEmAndamento === opcao.id}
                                  onClick={() => executarAcao(() => desistirOpcao(opcao.id), opcao.id)}
                                >
                                  {t('unidadeDetail.acaoDesistir')}
                                </Button>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {fila.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          {t('unidadeDetail.semCriancas')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>
        </Grid>
      </DashboardContent>
    </>
  );
}
