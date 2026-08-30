import { useNavigate } from 'react-router';

import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ListItemText from '@mui/material/ListItemText';

import { type Unidade } from 'src/lib/creche-api';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------

type Props = {
  row: Unidade;
  totalSolicitacoes: number;
};

export function UnidadeTableRow({ row, totalSolicitacoes }: Props) {
  const navigate = useNavigate();

  return (
    <TableRow hover onClick={() => navigate(`/dashboard/creche/unidades/${row.id}`)} sx={{ cursor: 'pointer' }}>
      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <ListItemText
            primary={row.nome}
            secondary={row.esc_codigo ? `Código ${row.esc_codigo}` : undefined}
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

      <TableCell align="right">{totalSolicitacoes}</TableCell>
    </TableRow>
  );
}
