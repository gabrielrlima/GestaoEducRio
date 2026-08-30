import type { LinearProgressProps } from '@mui/material/LinearProgress';

import { useNavigate } from 'react-router';

import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import LinearProgress from '@mui/material/LinearProgress';
import ListItemText from '@mui/material/ListItemText';

import { useTranslate } from 'src/locales';
import { type Unidade } from 'src/lib/creche-api';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------

type Props = {
  row: Unidade;
  totalSolicitacoes: number;
};

export function UnidadeTableRow({ row, totalSolicitacoes }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslate('creche');

  const capacidadeTotal = row.capacidade_total ?? 0;
  const vagasOcupadas = row.vagas_ocupadas ?? 0;
  const ocupacaoPct = capacidadeTotal > 0 ? (vagasOcupadas * 100) / capacidadeTotal : 0;

  const ocupacaoColor: LinearProgressProps['color'] =
    capacidadeTotal === 0
      ? 'inherit'
      : ocupacaoPct >= 100
        ? 'error'
        : ocupacaoPct >= 80
          ? 'warning'
          : 'success';

  return (
    <TableRow hover onClick={() => navigate(`/dashboard/creche/unidades/${row.id}`)} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <ListItemText
            primary={row.nome}
            secondary={row.esc_codigo ? t('unidadesList.codigo', { codigo: row.esc_codigo }) : undefined}
            slotProps={{
              primary: { noWrap: true, sx: { typography: 'body2' } },
              secondary: { sx: { color: 'text.disabled', typography: 'caption' } },
            }}
          />
        </Box>
      </TableCell>

      <TableCell>{row.bairro}</TableCell>

      <TableCell>{row.cre ?? '—'}</TableCell>

      <TableCell>
        <Label variant="soft" color={row.tipo_gestao === 'Parceria' ? 'info' : 'default'}>
          {row.tipo_gestao}
        </Label>
      </TableCell>

      <TableCell>
        <Box sx={{ width: 1, typography: 'caption', color: 'text.secondary' }}>
          <LinearProgress
            color={ocupacaoColor}
            variant="determinate"
            value={Math.min(ocupacaoPct, 100)}
            sx={{ mb: 1, width: 80, height: 6 }}
          />
          {capacidadeTotal > 0
            ? t('unidadesList.ocupacaoLegenda', { ocupadas: vagasOcupadas, total: capacidadeTotal })
            : t('unidadesList.semVagasConfiguradas')}
        </Box>
      </TableCell>

      <TableCell align="right">{totalSolicitacoes}</TableCell>
    </TableRow>
  );
}
