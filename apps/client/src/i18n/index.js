import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import en from './locales/en.json';
import vi from './locales/vi.json';

export const supportedLanguages = ['en', 'vi'];
export const deviceLocales = Localization.getLocales();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: supportedLanguages,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

const LANGUAGE_KEY = 'memory-chess-language';
const ERROR_KEYS = {
  NETWORK_ERROR: 'network',
  NOT_CONNECTED: 'notConnected', SERVER_TIMEOUT: 'serverTimeout',
  INVALID_LOGIN: 'invalidLogin', INVALID_INPUT: 'invalidInput', USERNAME_TAKEN: 'usernameTaken',
  INVALID_JSON: 'invalidJson', NOT_FOUND: 'notFound', SERVER_ERROR: 'serverError', UNAUTHORIZED: 'unauthorized',
  PEEK_DISABLED: 'peekDisabled', BOARD_VISIBLE: 'boardVisible', NO_PEEKS: 'noPeeks',
  GAME_NOT_ACTIVE: 'gameNotActive', TURN_EXPIRED: 'turnExpired', NOT_YOUR_TURN: 'notYourTurn',
  ILLEGAL_MOVE: 'illegalMove', SHUTTING_DOWN: 'shuttingDown', ALREADY_BUSY: 'alreadyBusy',
  ROOM_FULL: 'roomFull', SESSION_REPLACED: 'sessionReplaced', RATE_LIMIT: 'rateLimit',
  ACTION_PENDING: 'actionPending', ROOM_NOT_FOUND: 'roomNotFound', DISCONNECTED: 'disconnected',
  ALREADY_MATCHED: 'alreadyMatched', GAME_ACTIVE: 'gameActive', RESULT_PENDING: 'resultPending',
  BOTS_BUSY: 'botsBusy', ROOM_CLOSED: 'roomClosed', ROOM_FAILED: 'roomFailed',
};

export function translateError(error, t = i18n.t.bind(i18n)) {
  if (error?.name === 'AbortError' || error instanceof TypeError) return t('errors.network');
  const key = error?.code && ERROR_KEYS[error.code];
  return key ? t(`errors.${key}`) : t('errors.unknown');
}

async function getSavedLanguage() {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(LANGUAGE_KEY);
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

async function saveLanguage(language) {
  if (Platform.OS === 'web') {
    try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch { /* storage may be disabled */ }
    return;
  }
  try { await SecureStore.setItemAsync(LANGUAGE_KEY, language); } catch { /* locale still changes for this session */ }
}

export async function restoreLanguagePreference() {
  const saved = await getSavedLanguage();
  if (supportedLanguages.includes(saved)) await i18n.changeLanguage(saved);
}

/** Use this from a future language picker; English is the first-run default. */
export async function changeAppLanguage(language) {
  if (!supportedLanguages.includes(language)) throw new Error(`Unsupported language: ${language}`);
  await i18n.changeLanguage(language);
  await saveLanguage(language);
}

export function formatDate(date) {
  const language = i18n.resolvedLanguage || 'en';
  const systemLocale = deviceLocales[0]?.languageTag || 'en-US';
  const locale = language === 'vi' ? 'vi-VN' : language === 'en' ? 'en-US' : systemLocale;
  return new Intl.DateTimeFormat(locale).format(new Date(date));
}

export default i18n;
