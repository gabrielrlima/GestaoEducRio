import type { NavSectionProps } from 'src/components/nav-section';

import { useTranslate } from 'src/locales';
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
 *
 * Hook (não const estático) porque os títulos precisam reagir à troca de
 * idioma — ver useTranslate('creche').
 */
export function useNavData(): NavSectionProps['data'] {
  const { t } = useTranslate('creche');

  return [
    {
      subheader: t('nav.subheader'),
      items: [
        { title: t('nav.unidades'), path: '/dashboard/creche/unidades', icon: ICONS.unidades },
        { title: t('nav.painel'), path: '/dashboard/creche/painel', icon: ICONS.painel },
      ],
    },
  ];
}
