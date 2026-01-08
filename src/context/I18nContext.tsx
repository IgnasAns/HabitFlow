import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { translations, SupportedLanguage, TranslationKeys, languageNames, languageFlags } from '../i18n';

const LANGUAGE_KEY = '@language';

interface I18nContextType {
    language: SupportedLanguage;
    t: TranslationKeys;
    setLanguage: (lang: SupportedLanguage) => Promise<void>;
    languageNames: typeof languageNames;
    languageFlags: typeof languageFlags;
    supportedLanguages: SupportedLanguage[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Get device language
const getDeviceLanguage = (): SupportedLanguage => {
    let deviceLang = 'en';

    try {
        if (Platform.OS === 'ios') {
            deviceLang = NativeModules.SettingsManager?.settings?.AppleLocale ||
                NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
                'en';
        } else if (Platform.OS === 'android') {
            deviceLang = NativeModules.I18nManager?.localeIdentifier || 'en';
        }
    } catch (e) {
        deviceLang = 'en';
    }

    // Extract language code (e.g., "en_US" -> "en", "es-ES" -> "es")
    const langCode = deviceLang.split(/[-_]/)[0].toLowerCase();

    // Check if the language is supported
    const supportedLangs: SupportedLanguage[] = ['en', 'es', 'de', 'fr', 'pt'];
    return supportedLangs.includes(langCode as SupportedLanguage)
        ? (langCode as SupportedLanguage)
        : 'en';
};

interface I18nProviderProps {
    children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
    const [language, setLanguageState] = useState<SupportedLanguage>('en');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved language on mount
    useEffect(() => {
        const loadLanguage = async () => {
            try {
                const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
                if (savedLang && translations[savedLang as SupportedLanguage]) {
                    setLanguageState(savedLang as SupportedLanguage);
                } else {
                    // Use device language as default
                    const deviceLang = getDeviceLanguage();
                    setLanguageState(deviceLang);
                }
            } catch (error) {
                console.error('Error loading language:', error);
            } finally {
                setIsLoaded(true);
            }
        };
        loadLanguage();
    }, []);

    const setLanguage = useCallback(async (lang: SupportedLanguage) => {
        // Immediate state update for instant UI response
        setLanguageState(lang);

        // Persist to storage in background (don't block UI)
        AsyncStorage.setItem(LANGUAGE_KEY, lang).catch(error => {
            console.error('Error saving language:', error);
        });
    }, []);

    const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'de', 'fr', 'pt'];

    const value: I18nContextType = {
        language,
        t: translations[language],
        setLanguage,
        languageNames,
        languageFlags,
        supportedLanguages,
    };

    // Don't render until language is loaded to avoid flash
    if (!isLoaded) {
        return null;
    }

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n(): I18nContextType {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
}

// Helper function to interpolate variables in translation strings
// Usage: interpolate("Hello {{name}}", { name: "World" }) => "Hello World"
export function interpolate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return vars[key]?.toString() ?? `{{${key}}}`;
    });
}

export default I18nContext;
