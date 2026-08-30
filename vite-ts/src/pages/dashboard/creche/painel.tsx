import { useEffect, useState } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
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
import { opcoesPendentes, inconsistencias } from 'src/lib/creche-api';

// ----------------------------------------------------------------------

export default function PainelPage() {
  const { t } = useTranslate('creche');
  const [pendentes, setPendentes] = useState<Awaited<ReturnType<typeof opcoesPendentes>>>([]);
  const [inconsist, setInconsist] = useState<Awaited<ReturnType<typeof inconsistencias>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([opcoesPendentes(3), inconsistencias()])
      .then(([p, i]) => {
        setPendentes(p);
        setInconsist(i);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <title>{t('painel.heading')} — GestaoEducRio</title>
      <DashboardContent>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('painel.heading')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {t('painel.descricao')}
        </Typography>

        {loading && <LinearProgress sx={{ mb: 3 }} />}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title={t('painel.pendentesTitulo')}
                subheader={t('painel.pendentesSubtitulo')}
              />
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('painel.tablePendentes.crianca')}</TableCell>
                      <TableCell>{t('painel.tablePendentes.unidade')}</TableCell>
                      <TableCell>{t('painel.tablePendentes.desde')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendentes.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.crianca_nome}</TableCell>
                        <TableCell>{p.unidade_nome}</TableCell>
                        <TableCell>{new Date(p.data_mudanca_status).toLocaleDateString('pt-BR')}</TableCell>
                      </TableRow>
                    ))}
                    {!loading && pendentes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                          {t('painel.semPendencias')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title={t('painel.inconsistenciasTitulo')}
                subheader={t('painel.inconsistenciasSubtitulo')}
              />
              <div style={{ padding: 20 }}>
                {!loading && inconsist.length === 0 && (
                  <Alert severity="success">{t('painel.semInconsistencias')}</Alert>
                )}
                {inconsist.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('painel.tableInconsistencias.crianca')}</TableCell>
                          <TableCell>{t('painel.tableInconsistencias.opcoes')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inconsist.map((i) => (
                          <TableRow key={i.inscricao_id}>
                            <TableCell>{i.crianca_nome}</TableCell>
                            <TableCell>{i.opcoes_conflitantes}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </div>
            </Card>
          </Grid>
        </Grid>
      </DashboardContent>
    </>
  );
}
