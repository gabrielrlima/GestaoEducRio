import type { InitOptions } from 'i18next';
import type { Theme, Components } from '@mui/material/styles';

import resourcesToBackend from 'i18next-resources-to-backend';

// MUI Core Locales
import { esES as esESCore, ptBR as ptBRCore } from '@mui/material/locale';
// MUI Date Pickers Locales
import { enUS as enUSDate, esES as esESDate, ptBR as ptBRDate } from '@mui/x-date-pickers/locales';
// MUI Data Grid Locales
import { enUS as enUSDataGrid, esES as esESDataGrid, ptBR as ptBRDataGrid } from '@mui/x-data-grid/locales';

import enCommon from './langs/en/common.json';
import enNavbar from './langs/en/navbar.json';
import enCreche from './langs/en/creche.json';
import esCommon from './langs/es/common.json';
import esNavbar from './langs/es/navbar.json';
import esCreche from './langs/es/creche.json';
import enMessages from './langs/en/messages.json';
import esMessages from './langs/es/messages.json';
// Recursos carregados estaticamente (não via backend assíncrono) — o backend
// (i18next-resources-to-backend + import() dinâmico) fica registrado abaixo
// só por compatibilidade, mas na prática nunca chega a popular o store nesta
// versão/config (bug de orquestração do backendConnector, não do loader em
// si — confirmado chamando backend.read() manualmente, que funciona). Import
// estático é síncrono e garante que os textos apareçam sempre, sem depender
// de timing de carregamento assíncrono.
import ptBrCommon from './langs/pt-br/common.json';
import ptBrNavbar from './langs/pt-br/navbar.json';
import ptBrCreche from './langs/pt-br/creche.json';
import ptBrMessages from './langs/pt-br/messages.json';

// ----------------------------------------------------------------------

// Idiomas suportados pelo produto: português (padrão), inglês e espanhol.
export const supportedLngs = ['en', 'es', 'pt-br'] as const;
export type LangCode = (typeof supportedLngs)[number];

// Fallback and default namespace
export const fallbackLng: LangCode = 'pt-br';
export const defaultNS = 'common';

// Todos os namespaces usados no app precisam estar listados aqui — o backend
// (i18next-resources-to-backend) só carrega sob demanda os namespaces que o
// i18next já conhece via `ns` na inicialização (ver i18nOptions abaixo). Um
// useTranslation('x') com 'x' fora desta lista fica preso em missingKey
// pra sempre, mesmo que o JSON exista e seja importável.
export const allNamespaces = ['common', 'messages', 'navbar', 'creche'] as const;

// Storage config
export const storageConfig = {
  cookie: { key: 'i18next', autoDetection: false },
  localStorage: { key: 'i18nextLng', autoDetection: false },
} as const;

// ----------------------------------------------------------------------

/**
 * @countryCode https://flagcdn.com/en/codes.json
 * @adapterLocale https://github.com/iamkun/dayjs/tree/master/src/locale
 * @numberFormat https://simplelocalize.io/data/locales/
 */

export type LangOption = {
  value: LangCode;
  label: string;
  countryCode: string;
  adapterLocale?: string;
  numberFormat: { code: string; currency: string };
  systemValue?: { components: Components<Theme> };
};

export const allLangs: LangOption[] = [
  {
    value: 'pt-br',
    label: 'Português (Brasil)',
    countryCode: 'BR',
    adapterLocale: 'pt-br',
    numberFormat: { code: 'pt-BR', currency: 'BRL' },
    systemValue: {
      components: { ...ptBRCore.components, ...ptBRDate.components, ...ptBRDataGrid.components },
    },
  },
  {
    value: 'en',
    label: 'English',
    countryCode: 'GB',
    adapterLocale: 'en',
    numberFormat: { code: 'en-US', currency: 'USD' },
    systemValue: {
      components: { ...enUSDate.components, ...enUSDataGrid.components },
    },
  },
  {
    value: 'es',
    label: 'Español',
    countryCode: 'ES',
    adapterLocale: 'es',
    numberFormat: { code: 'es-ES', currency: 'EUR' },
    systemValue: {
      components: { ...esESCore.components, ...esESDate.components, ...esESDataGrid.components },
    },
  },
];

// ----------------------------------------------------------------------

export const i18nResourceLoader = resourcesToBackend(
  (lang: LangCode, namespace: string) => import(`./langs/${lang}/${namespace}.json`)
);

const staticResources = {
  'pt-br': { common: ptBrCommon, messages: ptBrMessages, navbar: ptBrNavbar, creche: ptBrCreche },
  en: { common: enCommon, messages: enMessages, navbar: enNavbar, creche: enCreche },
  es: { common: esCommon, messages: esMessages, navbar: esNavbar, creche: esCreche },
};

export function i18nOptions(lang = fallbackLng, namespace = defaultNS): InitOptions {
  return {
    supportedLngs,
    fallbackLng,
    lng: lang,
    /********/
    fallbackNS: defaultNS,
    defaultNS: namespace,
    ns: allNamespaces,
    resources: staticResources,
  };
}

export function getCurrentLang(lang?: string): LangOption {
  const fallbackLang = allLangs.find((l) => l.value === fallbackLng) ?? allLangs[0];

  if (!lang) {
    return fallbackLang;
  }

  return allLangs.find((l) => l.value === lang) ?? fallbackLang;
}
