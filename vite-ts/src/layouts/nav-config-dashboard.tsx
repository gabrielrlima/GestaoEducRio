import type { NavSectionProps } from 'src/components/nav-section';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const ICONS = {
  unidades: <Iconify width={24} icon="solar:home-angle-bold-duotone" />,
  painel: <Iconify width={24} icon="solar:file-text-bold" />,
};

// ----------------------------------------------------------------------

/**
 * Menu reduzido só para o produto do hackathon (Inscrição e Classificação de
 * creches) — os demais itens de exemplo do template Minimal UI Kit (Overview,
 * Management, Misc) foram removidos daqui. Para recuperá-los, ver histórico
 * do git deste arquivo.
 *
 * Ícones via Iconify (não os SVGs genéricos de navbar do template) — mesmos
 * ícones usados nos cards de estatística da tela de Unidades, pra manter a
 * iconografia consistente entre o menu e o conteúdo.
 */
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'Inscrição Creche',
    items: [
      { title: 'Unidades', path: '/dashboard/creche/unidades', icon: ICONS.unidades },
      { title: 'Painel de Pendências', path: '/dashboard/creche/painel', icon: ICONS.painel },
    ],
  },
];
