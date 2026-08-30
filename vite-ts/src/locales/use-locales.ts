import type { TFunction, Namespace } from 'i18next';
import type { LangCode } from './locales-config';

import dayjs from 'dayjs';
import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { toast } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';

import { fallbackLng, getCurrentLang } from './locales-config';

// ----------------------------------------------------------------------

// Ambiente observado tem o Translator do i18next com uma referência de store
// desalinhada da que recebe os bundles (t()/exists() retornam a key crua às
// vezes mesmo com o resource certo presente e confirmado via
// i18n.getResource — o gatilho exato não foi identificado a tempo, mas é
// intermitente por idioma/namespace, não só no primeiro carregamento). Toda
// chamada de tradução do app deve passar por makeSafeT, não usar o `t` cru
// do react-i18next direto — ver useTranslate abaixo.
function makeSafeT(
   
  t: (key: string, options?: any) => unknown,
  i18n: { resolvedLanguage?: string; getResource: (lng: string, ns: string, key: string) => unknown },
  namespaceKey: string
) {
  return (key: string, options?: Record<string, unknown>): string => {
    const primary = String(t(key, options as never));
    if (primary && primary !== key) return primary;

    const lng = i18n.resolvedLanguage || fallbackLng;
    const raw: unknown = i18n.getResource(lng, namespaceKey, key);
    if (typeof raw !== 'string') return primary;
    if (!options) return raw;
    return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, varName) =>
      varName in options ? String(options[varName]) : `{{${varName}}}`
    );
  };
}

export function useTranslate(namespace?: Namespace) {
  const settings = useSettingsContext();

  const { t, i18n } = useTranslation(namespace);
  const { t: tMessagesRaw } = useTranslation('messages');

  const currentLang = getCurrentLang(i18n.resolvedLanguage);

  const namespaceKey =
    typeof namespace === 'string' ? namespace : Array.isArray(namespace) ? namespace[0] : 'common';

  const safeT = useCallback(makeSafeT(t, i18n, namespaceKey), [t, i18n, namespaceKey]);
  const tMessages = useCallback(makeSafeT(tMessagesRaw, i18n, 'messages'), [tMessagesRaw, i18n]);

  const updateDirection = useCallback(
    (lang: LangCode) => {
      settings.setState({ direction: i18n.dir(lang) });
    },
    [i18n, settings]
  );

  const updateDayjsLocale = useCallback((lang: LangCode) => {
    const updatedLang = getCurrentLang(lang);
    dayjs.locale(updatedLang.adapterLocale);
  }, []);

  const handleChangeLang = useCallback(
    async (lang: LangCode) => {
      try {
        const changeLangPromise = i18n.changeLanguage(lang);

        toast.promise(changeLangPromise, {
          loading: tMessages('languageSwitch.loading'),
          success: () => tMessages('languageSwitch.success'),
          error: () => tMessages('languageSwitch.error'),
        });

        await changeLangPromise;

        updateDirection(lang);
        updateDayjsLocale(lang);
      } catch (error) {
        console.error(error);
      }
    },
    [i18n, tMessages, updateDayjsLocale, updateDirection]
  );

  const handleResetLang = useCallback(() => {
    handleChangeLang(fallbackLng);
  }, [handleChangeLang]);

  return {
    t: safeT as TFunction<any, any>,
    i18n,
    currentLang,
    onChangeLang: handleChangeLang,
    onResetLang: handleResetLang,
  };
}

// ----------------------------------------------------------------------

export function useLocaleDirectionSync() {
  const { i18n, currentLang } = useTranslate();
  const { state, setState } = useSettingsContext();

  const handleSync = useCallback(async () => {
    if (state.direction !== i18n.dir(currentLang.value)) {
      setState({ direction: i18n.dir(currentLang.value) });
    }

    if (i18n.resolvedLanguage !== currentLang.value) {
      await i18n.changeLanguage(currentLang.value);
    }
  }, [currentLang.value, i18n, setState, state.direction]);

  useEffect(() => {
    handleSync();
  }, [handleSync]);

  return null;
}
