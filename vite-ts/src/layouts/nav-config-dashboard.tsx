import type { NavSectionProps } from 'src/components/nav-section';

import { CONFIG } from 'src/global-config';

import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
);

const ICONS = {
  folder: icon('ic-folder'),
  analytics: icon('ic-analytics'),
};

// ----------------------------------------------------------------------

/**
 * Menu reduzido só para o produto do hackathon (Inscrição e Classificação de
 * creches) — os demais itens de exemplo do template Minimal UI Kit (Overview,
 * Management, Misc) foram removidos daqui. Para recuperá-los, ver histórico
 * do git deste arquivo.
 */
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'Inscrição Creche',
    items: [
      { title: 'Unidades', path: '/dashboard/creche/unidades', icon: ICONS.folder },
      { title: 'Painel de Pendências', path: '/dashboard/creche/painel', icon: ICONS.analytics },
    ],
  },
];
