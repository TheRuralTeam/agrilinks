import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import ptTranslations from './locales/pt.json'
import enTranslations from './locales/en.json'
import frTranslations from './locales/fr.json'
import esTranslations from './locales/es.json'
import lnTranslations from './locales/ln.json'
import kikTranslations from './locales/kik.json'
import kmbTranslations from './locales/kmb.json'
import umbTranslations from './locales/umb.json'
import zhTranslations from './locales/zh.json'
import ruTranslations from './locales/ru.json'
import itTranslations from './locales/it.json'
import arTranslations from './locales/ar.json'

export const languageCatalog = {
  pt: { flag: '🇦🇴', label: 'Português', nativeLabel: 'Português' },
  en: { flag: '🇬🇧', label: 'English', nativeLabel: 'English' },
  fr: { flag: '🇫🇷', label: 'Français', nativeLabel: 'Français' },
  es: { flag: '🇪🇸', label: 'Español', nativeLabel: 'Español' },
  ln: { flag: '🗣️', label: 'Lingala', nativeLabel: 'Lingala' },
  kik: { flag: '🗣️', label: 'Kikongo', nativeLabel: 'Kikongo' },
  kmb: { flag: '🗣️', label: 'Kimbundu', nativeLabel: 'Kimbundu' },
  umb: { flag: '🗣️', label: 'Umbundu', nativeLabel: 'Umbundu' },
  zh: { flag: '🇨🇳', label: '中文', nativeLabel: '中文' },
  ru: { flag: '🇷🇺', label: 'Русский', nativeLabel: 'Русский' },
  it: { flag: '🇮🇹', label: 'Italiano', nativeLabel: 'Italiano' },
  ar: { flag: '🇸🇦', label: 'العربية', nativeLabel: 'العربية' },
} as const

export const supportedLanguages = Object.keys(languageCatalog) as Array<keyof typeof languageCatalog>

export const supportedLanguageOptions = Object.entries(languageCatalog).map(([val, meta]) => ({
  val,
  flag: meta.flag,
  label: meta.label,
  nativeLabel: meta.nativeLabel,
}))

export const countryToLanguage: Record<string, string> = {
  AO: 'pt',
  MZ: 'pt',
  BR: 'pt',
  PT: 'pt',
  GB: 'en',
  US: 'en',
  ZA: 'en',
  FR: 'fr',
  CA: 'fr',
  CD: 'fr',
  ES: 'es',
  MX: 'es',
  AR: 'es',
  CL: 'es',
  CO: 'es',
  CG: 'ln',
  CM: 'fr',
  DZ: 'ar',
  MA: 'ar',
  SA: 'ar',
  RU: 'ru',
  CN: 'zh',
  IT: 'it',
}

const languageAliases: Record<string, string> = {
  portuguese: 'pt',
  portugal: 'pt',
  english: 'en',
  french: 'fr',
  français: 'fr',
  espanhol: 'es',
  spanish: 'es',
  lingala: 'ln',
  kikongo: 'kik',
  kimbundu: 'kmb',
  umbundu: 'umb',
  chinese: 'zh',
  mandarin: 'zh',
  russian: 'ru',
  italian: 'it',
  italiano: 'it',
  arabic: 'ar',
  arab: 'ar',
  arabe: 'ar',
}

export const normalizeLanguageCode = (value?: string | null): string => {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return 'pt'

  if (languageAliases[raw]) {
    return languageAliases[raw]
  }

  if (supportedLanguages.includes(raw as keyof typeof languageCatalog)) {
    return raw
  }

  if (raw.includes('-')) {
    const base = raw.split('-')[0]
    if (supportedLanguages.includes(base as keyof typeof languageCatalog)) {
      return base
    }
  }

  return 'pt'
}

export const resolveLanguageCode = (value?: string | null): string => {
  const raw = (value ?? '').trim()
  if (!raw) return 'pt'

  const prepared = raw.toLowerCase()
  const direct = normalizeLanguageCode(raw)
  if (direct !== 'pt' || prepared === 'pt' || prepared === 'en' || prepared === 'fr' || prepared === 'es' || prepared === 'ln' || prepared === 'kik' || prepared === 'kmb' || prepared === 'umb' || prepared === 'zh' || prepared === 'ru' || prepared === 'it' || prepared === 'ar') {
    return direct
  }

  const countryKey = raw.toUpperCase()
  if (countryToLanguage[countryKey]) {
    return countryToLanguage[countryKey]
  }

  return normalizeLanguageCode(raw.split('-')[0])
}

const detectBrowserLanguage = (): string => {
  try {
    const candidates = Array.from(new Set([navigator.language, ...(navigator.languages ?? [])]))

    for (const candidate of candidates) {
      const normalized = normalizeLanguageCode(candidate)
      const lowered = candidate.toLowerCase()
      if (
        normalized !== 'pt' ||
        lowered.startsWith('pt') ||
        lowered.startsWith('en') ||
        lowered.startsWith('fr') ||
        lowered.startsWith('es') ||
        lowered.startsWith('ln') ||
        lowered.startsWith('kik') ||
        lowered.startsWith('kmb') ||
        lowered.startsWith('umb') ||
        lowered.startsWith('zh') ||
        lowered.startsWith('ru') ||
        lowered.startsWith('it') ||
        lowered.startsWith('ar')
      ) {
        if (supportedLanguages.includes(normalized as keyof typeof languageCatalog)) {
          return normalized
        }
      }
    }

    return 'pt'
  } catch {
    return 'pt'
  }
}

const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem('orbislink_language')
    if (saved && supportedLanguages.includes(saved as keyof typeof languageCatalog)) {
      return saved
    }
    return detectBrowserLanguage()
  } catch {
    return 'pt'
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: ptTranslations },
      en: { translation: enTranslations },
      fr: { translation: frTranslations },
      es: { translation: esTranslations },
      ln: { translation: lnTranslations },
      kik: { translation: kikTranslations },
      kmb: { translation: kmbTranslations },
      umb: { translation: umbTranslations },
      zh: { translation: zhTranslations },
      ru: { translation: ruTranslations },
      it: { translation: itTranslations },
      ar: { translation: arTranslations },
    },
    lng: getSavedLanguage(),
    fallbackLng: ['pt', 'en'],
    supportedLngs: [...supportedLanguages],
    interpolation: {
      escapeValue: false,
    },
  })

export const changeLanguage = (countryCodeOrLanguage: string) => {
  const lang = resolveLanguageCode(countryCodeOrLanguage)
  i18n.changeLanguage(lang)
  localStorage.setItem('orbislink_language', lang)

  const countryCode = Object.entries(countryToLanguage).find(([, language]) => language === lang)?.[0] ?? 'AO'
  localStorage.setItem('orbislink_country', countryCode)
}

export const getSavedCountry = () => {
  try {
    return localStorage.getItem('orbislink_country') || 'AO'
  } catch {
    return 'AO'
  }
}

export default i18n
