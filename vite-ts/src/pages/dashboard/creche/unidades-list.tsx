import { useNavigate } from 'react-router';
import { useMemo, useEffect, useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { DashboardContent } from 'src/layouts/dashboard';
import { type Unidade, listUnidades, solicitacoesPorUnidade } from 'src/lib/creche-api';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();

export default function UnidadesListPage() {
  const navigate = useNavigate();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Record<string, number>>({});
  const [filtroBairro, setFiltroBairro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listUnidades(), solicitacoesPorUnidade(ANO_PROCESSO)])
      .then(([lista, contagem]) => {
        setUnidades(lista);
        setSolicitacoes(Object.fromEntries(contagem.map((c) => [c.unidade_id, c.total_solicitacoes])));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(
    () =>
      unidades.filter((u) => u.bairro?.toLowerCase().includes(filtroBairro.toLowerCase())).slice(0, 200),
    [unidades, filtroBairro]
  );

  return (
    <>
      <title>Unidades — GestaoEducRio</title>
      <DashboardContent>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Unidades de Creche
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          {unidades.length} unidades cadastradas (dado real da rede municipal, processos 2021–2025)
        </Typography>

        <Card>
          <Stack sx={{ p: 2.5 }}>
            <TextField
              size="small"
              label="Filtrar por bairro"
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              sx={{ maxWidth: 320 }}
            />
          </Stack>

          {loading && <LinearProgress />}

          <TableContainer sx={{ maxHeight: 640 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Bairro</TableCell>
                  <TableCell>Gestão</TableCell>
                  <TableCell>CRE</TableCell>
                  <TableCell align="right">Solicitações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtradas.map((unidade) => (
                  <TableRow
                    key={unidade.id}
                    hover
                    onClick={() => navigate(`/dashboard/creche/unidades/${unidade.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ color: 'text.primary' }}>{unidade.nome}</TableCell>
                    <TableCell>{unidade.bairro}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={unidade.tipo_gestao}
                        color={unidade.tipo_gestao === 'Parceria' ? 'info' : 'default'}
                        variant="soft"
                      />
                    </TableCell>
                    <TableCell>{unidade.cre ?? '—'}</TableCell>
                    <TableCell align="right">{solicitacoes[unidade.id] ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </DashboardContent>
    </>
  );
}
