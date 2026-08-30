import { useState } from 'react';
import { useNavigate } from 'react-router';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { loginAdmin } from 'src/lib/creche-api';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('admin');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setErro(null);
    setLoading(true);
    try {
      await loginAdmin(usuario, senha);
      navigate('/dashboard/creche/unidades');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <title>Login Admin — GestaoEducRio</title>
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.neutral' }}>
        <Container maxWidth="xs">
          <Card sx={{ p: 5 }}>
            <Logo isSingle={false} sx={{ mb: 3, mx: 'auto' }} />

            <Typography variant="h4" sx={{ mb: 1 }}>
              Painel Admin
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Inscrição e Classificação — Creches
            </Typography>

            <Stack spacing={2.5}>
              {erro && <Alert severity="error">{erro}</Alert>}
              <TextField label="Usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
              <TextField
                label="Senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <LoadingButton fullWidth size="large" variant="contained" loading={loading} onClick={handleSubmit}>
                Entrar
              </LoadingButton>
            </Stack>
          </Card>
        </Container>
      </Box>
    </>
  );
}
