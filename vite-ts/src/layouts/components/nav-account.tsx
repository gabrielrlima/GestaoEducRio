import type { BoxProps } from '@mui/material/Box';

import { useNavigate } from 'react-router';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { clearToken } from 'src/lib/creche-api';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

/**
 * Substitui o NavUpgrade genérico do template (avatar demo "Jaydon Frankie",
 * tag "Free", botão "Upgrade to Pro") — não temos plano pago nem perfil de
 * usuário completo, só o login admin único. Mostra isso honestamente: sessão
 * ativa + sair, sem dado fictício.
 */
export function NavAccount({ sx, ...other }: BoxProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken('admin');
    navigate('/admin-login');
  };

  return (
    <Box
      sx={[{ px: 2, py: 3, textAlign: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
          <Iconify icon="solar:shield-check-bold" width={22} />
        </Avatar>

        <Box sx={{ mb: 1.5, mt: 1, width: 1 }}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ color: 'var(--layout-nav-text-primary-color)' }}
          >
            Administrador
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--layout-nav-text-disabled-color)' }}>
            Sessão ativa
          </Typography>
        </Box>

        <Button fullWidth size="small" variant="outlined" color="inherit" onClick={handleLogout}>
          Sair
        </Button>
      </Box>
    </Box>
  );
}
