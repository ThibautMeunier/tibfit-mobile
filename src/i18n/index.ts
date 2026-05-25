import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import fr from './fr.json';
import en from './en.json';

export const LANGUAGE_KEY = 'app_language';
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type AppLanguage = typeof SUPPORTED_LANGUAGES[number];

const deviceLocale = getLocales()[0]?.languageCode ?? 'fr';
const defaultLng: AppLanguage = SUPPORTED_LANGUAGES.includes(deviceLocale as AppLanguage)
  ? (deviceLocale as AppLanguage)
  : 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: defaultLng,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

export async function initLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as AppLanguage) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Ignore — device locale already applied
  }
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
