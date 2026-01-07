// i18n - Internationalization module
import { en, TranslationKeys } from './translations/en';
import { es } from './translations/es';
import { de } from './translations/de';
import { fr } from './translations/fr';
import { pt } from './translations/pt';

export type SupportedLanguage = 'en' | 'es' | 'de' | 'fr' | 'pt';

export const translations: Record<SupportedLanguage, TranslationKeys> = {
    en,
    es: es as TranslationKeys,
    de: de as TranslationKeys,
    fr: fr as TranslationKeys,
    pt: pt as TranslationKeys,
};

export const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    es: 'Español',
    de: 'Deutsch',
    fr: 'Français',
    pt: 'Português',
};

export const languageFlags: Record<SupportedLanguage, string> = {
    en: '🇬🇧',
    es: '🇪🇸',
    de: '🇩🇪',
    fr: '🇫🇷',
    pt: '🇵🇹',
};

export { en, es, de, fr, pt };
export type { TranslationKeys };
