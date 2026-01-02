// Theme - Addictive Color Palette & Design Tokens
import { Platform } from 'react-native';

export interface ColorGradient {
    readonly 0: string;
    readonly 1: string;
}

export const colors = {
    // Primary - Switched from Purple to Cyan/Teal for a cleaner "Tech" look
    primary: ['#06B6D4', '#0891B2'] as const, // Cyan
    primaryStart: '#06B6D4',
    primaryEnd: '#0891B2',

    // Success/Completion
    success: ['#10B981', '#059669'] as const, // Emerald
    successStart: '#10B981',
    successEnd: '#059669',

    // Streak Fire
    streak: ['#F59E0B', '#D97706'] as const, // Amber
    streakStart: '#F59E0B',
    streakEnd: '#D97706',

    // XP/Level Gold
    gold: ['#FBBF24', '#B45309'] as const,
    goldStart: '#FBBF24',
    goldEnd: '#B45309',

    // Danger/Warning - Harsh Red
    danger: ['#EF4444', '#B91C1C'] as const,
    dangerStart: '#EF4444',
    dangerEnd: '#B91C1C',

    // Background - Deep Midnight instead of Slate
    bgDark: '#080C14',
    bgCard: '#121926',
    bgLight: '#1E293B',

    // Glass effect
    glass: 'rgba(255, 255, 255, 0.03)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassHighlight: 'rgba(255, 255, 255, 0.12)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',

    // Habit colors palette
    habitColors: [
        ['#06B6D4', '#0891B2'], // Cyan (New Primary)
        ['#10B981', '#059669'], // Emerald
        ['#F59E0B', '#D97706'], // Amber
        ['#3B82F6', '#1D4ED8'], // Blue
        ['#EC4899', '#BE185D'], // Pink
        ['#F97316', '#C2410C'], // Orange
        ['#84CC16', '#4D7C0F'], // Lime
        ['#0EA5E9', '#0284C7'], // Sky
    ] as const,
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 28,
    xxl: 40,
} as const;

export const borderRadius = {
    sm: 6,
    md: 12,
    lg: 18,
    xl: 24,
    full: 999,
} as const;

export const typography = {
    h1: {
        fontSize: 28,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
    },
    h2: {
        fontSize: 22,
        fontWeight: '700' as const,
        letterSpacing: -0.3,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600' as const,
    },
    body: {
        fontSize: 15,
        fontWeight: '400' as const,
    },
    bodyBold: {
        fontSize: 15,
        fontWeight: '600' as const,
    },
    caption: {
        fontSize: 13,
        fontWeight: '400' as const,
    },
    small: {
        fontSize: 11,
        fontWeight: '500' as const,
    },
} as const;

export const shadows = {
    glow: (color: string) => Platform.select({
        ios: {
            shadowColor: color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
        },
        android: {
            elevation: 8,
        },
        web: {
            boxShadow: `0 4px 12px ${color}66`,
        }
    }),
    card: Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
        },
        android: {
            elevation: 6,
        },
        web: {
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
        }
    }),
    button: Platform.select({
        ios: {
            shadowColor: '#06B6D4',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
        },
        android: {
            elevation: 5,
        },
        web: {
            boxShadow: '0 4px 8px rgba(6, 182, 212, 0.3)',
        }
    }),
} as any;

// Animation configurations
export const springConfig = {
    bouncy: {
        damping: 15,
        stiffness: 120,
        mass: 1,
    },
    snappy: {
        damping: 20,
        stiffness: 200,
        mass: 1,
    },
    gentle: {
        damping: 30,
        stiffness: 100,
        mass: 1,
    },
} as const;

export const timingConfig = {
    fast: 100,
    normal: 200,
    slow: 400,
} as const;

// Icons for habits
export const habitIcons = [
    '💪', '📚', '🏃', '💧', '🧘', '💤', '🥗', '💊',
    '✍️', '🎨', '🎵', '💰', '🧹', '📱', '🌱', '❤️',
    '🧠', '☀️', '🌙', '🎯', '⏰', '🚶', '🍎', '🧘‍♀️',
] as const;

export type HabitIcon = typeof habitIcons[number];
export type HabitColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
    springConfig,
    timingConfig,
    habitIcons,
};
