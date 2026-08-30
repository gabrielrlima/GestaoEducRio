import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/global-config';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

/**
 * Logo oficial "Prefeitura do Rio | Educação" (docs/desafio/ — branding do
 * desafio), servido de public/logo/logo-rio.png. Substitui o mark genérico
 * do Minimal UI Kit. É um lockup horizontal (~4.8:1), então tanto a variante
 * "single" (nav colapsado) quanto a "full" usam a mesma imagem, só com
 * tamanhos de container diferentes — não há uma versão só-ícone do brasão
 * separada do texto.
 */
export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  const logo = (
    <img
      alt="Prefeitura do Rio - Educação"
      src={`${CONFIG.assetsDir}/logo/logo-rio.png`}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: isSingle ? 130 : 190,
          height: isSingle ? 48 : 56,
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {logo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
