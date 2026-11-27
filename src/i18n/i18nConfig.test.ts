import { describe, expect, it } from 'vitest'
import { resolveLanguageCode, supportedLanguages, supportedLanguageOptions } from './index'

describe('i18n configuration', () => {
  it('supports additional languages and keeps the selector options aligned', () => {
    expect(supportedLanguages).toEqual(expect.arrayContaining(['pt', 'en', 'fr', 'es', 'ln', 'kik', 'kmb', 'umb', 'zh', 'ru', 'it', 'ar']))
    expect(supportedLanguageOptions.map(option => option.val)).toEqual(expect.arrayContaining(['pt', 'en', 'fr', 'es', 'ln', 'kik', 'kmb', 'umb', 'zh', 'ru', 'it', 'ar']))
    expect(resolveLanguageCode('AO')).toBe('pt')
    expect(resolveLanguageCode('ES')).toBe('es')
    expect(resolveLanguageCode('DE')).toBe('pt')
    expect(resolveLanguageCode('lingala')).toBe('ln')
    expect(resolveLanguageCode('mandarin')).toBe('zh')
  })
})
