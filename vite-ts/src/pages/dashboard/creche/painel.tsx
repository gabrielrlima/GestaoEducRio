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

import { DashboardContent } from 'src/layouts/dashboard';
import { opcoesPendentes, inconsistencias } from 'src/lib/creche-api';

// ----------------------------------------------------------------------

export default function PainelPage() {
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
      <title>Painel de Pendências — GestaoEducRio</title>
      <DashboardContent>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Painel de Pendências
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Resposta direta ao gap documentado no problema oficial: hoje não existe um painel que sinalize vagas
          aguardando confirmação há muito tempo, nem inconsistências entre opções do mesmo cadastro.
        </Typography>

        {loading && <LinearProgress sx={{ mb: 3 }} />}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title="Vagas 'Selecionado' aguardando confirmação"
                subheader="Há mais de 3 dias sem resposta da família"
              />
              <TableContainer sx={{ p: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Criança</TableCell>
                      <TableCell>Unidade</TableCell>
                      <TableCell>Desde</TableCell>
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
                          Nenhuma pendência — tudo confirmado dentro do prazo.
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
                title="Inconsistências (fix de R8)"
                subheader="Mesma criança com mais de uma oferta ativa ao mesmo tempo"
              />
              <div style={{ padding: 20 }}>
                {!loading && inconsist.length === 0 && (
                  <Alert severity="success">
                    Nenhuma inconsistência encontrada — a trava de classificação (R8) está funcionando: nenhuma
                    criança tem duas ofertas de vaga ativas simultaneamente.
                  </Alert>
                )}
                {inconsist.length > 0 && (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Criança</TableCell>
                          <TableCell>Opções conflitantes</TableCell>
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
