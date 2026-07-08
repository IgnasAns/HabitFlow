import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors } from '../theme';

type Theme = 'light' | 'dark';
export type ColorMode = 'vivid' | 'pastel';

// Define the shape of our colors object
// We use the shape of the imported defaultColors
type ColorsType = typeof defaultColors;

// Public alias for consumers (e.g. getStyles(colors: ThemeColors)).
export type ThemeColors = ColorsType;

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
    // #94A3B8 measured 2.56:1 on the white cards — unreadable captions.
    textMuted: '#64748B',
    // Darker cyan so accent-colored text stays legible on white (4.0:1 vs
    // 2.4:1 for the default #06B6D4).
    accentText: '#0891B2',

    // Glass effect
    glass: 'rgba(0, 0, 0, 0.05)',
    glassBorder: 'rgba(0, 0, 0, 0.1)',
    glassHighlight: 'rgba(0, 0, 0, 0.05)',
    // Heatmap cells need stronger contrast on the white card backgrounds.
    emptyCell: 'rgba(100, 116, 139, 0.24)',
    emptyCellFaint: 'rgba(100, 116, 139, 0.16)',
};

interface ThemeContextType {
    theme: Theme;
    colors: ColorsType;
    colorMode: ColorMode;
    toggleTheme: () => void;
    toggleColorMode: () => void;
    setTheme: (theme: Theme) => void;
    setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    const [colorMode, setColorModeState] = useState<ColorMode>('vivid');
    const [colors, setColors] = useState<ColorsType>(defaultColors);

    // Apply color mode transformations
    const getThemeColors = (t: Theme, m: ColorMode): ColorsType => {
        let baseColors = t === 'dark' ? defaultColors : lightColors;

        if (m === 'pastel') {
            return {
                ...baseColors,
                // Note: accentText deliberately NOT overridden — pastel softens
                // fills and gradients, but pastel-colored *text* is unreadable.
                primary: baseColors.pastelHabitColors[0],
                primaryStart: baseColors.pastelHabitColors[0][0],
                primaryEnd: baseColors.pastelHabitColors[0][1],
                success: baseColors.pastelHabitColors[1],
                successStart: baseColors.pastelHabitColors[1][0],
                successEnd: baseColors.pastelHabitColors[1][1],
                streak: baseColors.pastelHabitColors[2],
                streakStart: baseColors.pastelHabitColors[2][0],
                streakEnd: baseColors.pastelHabitColors[2][1],
                gold: baseColors.pastelHabitColors[2], // Gold matches Amber/Streak in pastel
                goldStart: baseColors.pastelHabitColors[2][0],
                goldEnd: baseColors.pastelHabitColors[2][1],
                danger: ['#FCA5A5', '#F87171'] as [string, string], // Pastel Red
                dangerStart: '#FCA5A5',
                dangerEnd: '#F87171',
                habitColors: baseColors.pastelHabitColors,
            };
        }

        return baseColors;
    };

    useEffect(() => {
        // Load saved theme and color mode
        AsyncStorage.getItem('app_settings').then(settings => {
            if (settings) {
                const parsed = JSON.parse(settings);
                const savedTheme = parsed.darkMode === false ? 'light' : 'dark';
                const savedMode = parsed.colorMode || 'vivid';

                setThemeState(savedTheme);
                setColorModeState(savedMode);
                setColors(getThemeColors(savedTheme, savedMode));
            }
        });
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    };

    const toggleColorMode = () => {
        const newMode = colorMode === 'vivid' ? 'pastel' : 'vivid';
        setColorMode(newMode);
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        setColors(getThemeColors(newTheme, colorMode));
    };

    const setColorMode = (newMode: ColorMode) => {
        setColorModeState(newMode);
        setColors(getThemeColors(theme, newMode));
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            colors,
            colorMode,
            toggleTheme,
            toggleColorMode,
            setTheme,
            setColorMode
        }}>
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
