import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const metadata = { title: `Página não encontrada | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.neutral' }}>
        <Container maxWidth="xs" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Página não encontrada
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 5 }}>
            A página que você procura não existe ou foi movida.
          </Typography>
          <Button component={RouterLink} href="/" size="large" variant="contained">
            Voltar ao início
          </Button>
        </Container>
      </Box>
    </>
  );
}
