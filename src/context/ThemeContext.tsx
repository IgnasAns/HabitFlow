import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors } from '../theme';

type Theme = 'light' | 'dark';

// Define the shape of our colors object
// We use the shape of the imported defaultColors
type ColorsType = {
    [K in keyof typeof defaultColors]: typeof defaultColors[K];
};

// Define Light Theme colors
const lightColors: ColorsType = {
    ...defaultColors,
    // Backgrounds
    bgDark: '#F8FAFC',
    bgCard: '#FFFFFF',
    bgLight: '#E2E8F0',

    // Text
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',

    // Glass effect
    glass: 'rgba(0, 0, 0, 0.05)',
    glassBorder: 'rgba(0, 0, 0, 0.1)',
    glassHighlight: 'rgba(0, 0, 0, 0.05)',
    emptyCell: 'rgba(0, 0, 0, 0.08)',
};

interface ThemeContextType {
    theme: Theme;
    colors: ColorsType;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    const [colors, setColors] = useState<ColorsType>(defaultColors);

    useEffect(() => {
        // Load saved theme
        AsyncStorage.getItem('app_settings').then(settings => {
            if (settings) {
                const parsed = JSON.parse(settings);
                if (parsed.darkMode === false) {
                    setThemeState('light');
                    setColors(lightColors);
                }
            }
        });
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        setColors(newTheme === 'dark' ? defaultColors : lightColors);

        // We assume WidgetHub handles the actual saving to AsyncStorage 'app_settings'
        // But we should probably also save it here to be safe or keep it in sync?
        // Let's rely on WidgetHub calling setTheme via toggle?
        // Actually, WidgetHub manages its own state and saves to AsyncStorage.
        // We should probably listen to AsyncStorage changes or just save it here too.
        // For now, let's just update local state.
    };

    return (
        <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
