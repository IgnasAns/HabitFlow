/**
 * Widget Data Types and Utilities
 * Handles data sharing between the main app and home screen widgets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';

// Widget configuration types
export type WidgetType = 'weekly' | 'monthly' | 'github';
export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetConfig {
    type: WidgetType;
    habitId: string;
    size: WidgetSize;
}

export interface WidgetHabitData {
    id: string;
    name: string;
    icon: string;
    colorIndex: number;
    streak: number;
    dailyTarget: number;
    frequency: 'daily' | 'weekly';
    // Grid data: array of { key: string, progress: number, dailyTarget: number }
    gridData: Array<{
        key: string;
        progress: number;
        dailyTarget: number;
        isCompleted: boolean;
        isMissed: boolean;
        isExplicitlyFailed: boolean;
        isInactive: boolean;
    }>;
}

export interface WidgetSharedData {
    habits: WidgetHabitData[];
    lastUpdated: string;
    theme: 'dark' | 'light';
    // Color palette for widget rendering
    colors: {
        bgDark: string;
        bgCard: string;
        textPrimary: string;
        textSecondary: string;
        habitColors: string[][];
    };
}

const WIDGET_DATA_KEY = 'HABITFLOW_WIDGET_DATA';

/**
 * Generate grid data for a habit (last N days)
 */
function generateWidgetGridData(habit: Habit, days: number): WidgetHabitData['gridData'] {
    const result: WidgetHabitData['gridData'] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Parse habit creation date for isMissed logic
    const createdDate = habit.createdAt ? new Date(habit.createdAt) : new Date(0);
    createdDate.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const progress = habit.completions[key] || 0;
        const dailyTarget = habit.frequency === 'weekly' ? 1 : habit.dailyTarget;
        const isCompleted = progress >= dailyTarget;
        const isExplicitlyFailed = (habit as any).explicitFailures?.[key] || false;
        // Match in-app logic: only mark missed for days AFTER habit was created
        const isMissed = !isCompleted && !isExplicitlyFailed && key !== todayKey && date < today && date >= createdDate && progress === 0;
        // Inactive if before creation date and no progress
        const isInactive = date < createdDate && progress === 0;

        result.push({
            key,
            progress,
            dailyTarget,
            isCompleted,
            isMissed,
            isExplicitlyFailed,
            isInactive,
        });
    }

    return result;
}

/**
 * Convert habits to widget-friendly format
 */
function habitsToWidgetData(habits: Habit[], gridDays: number = 365): WidgetHabitData[] {
    // Filter out archived habits - they shouldn't appear in widgets
    const activeHabits = habits.filter(h => !h.archived);
    return activeHabits.map(habit => ({
        id: habit.id,
        name: habit.name,
        icon: habit.icon,
        colorIndex: habit.colorIndex,
        streak: habit.streak,
        dailyTarget: habit.dailyTarget,
        frequency: habit.frequency as 'daily' | 'weekly',
        gridData: generateWidgetGridData(habit, gridDays),
    }));
}

/**
 * Save widget data to shared storage for native widgets to read
 */
export async function updateWidgetData(
    habits: Habit[],
    theme: 'dark' | 'light' = 'dark',
    colors?: WidgetSharedData['colors']
): Promise<void> {
    const defaultColors: WidgetSharedData['colors'] = {
        bgDark: '#0f0f1a',
        bgCard: '#161b22',
        textPrimary: '#ffffff',
        textSecondary: '#8b949e',
        habitColors: [
            ['#8B5CF6', '#A78BFA'], // Purple
            ['#06B6D4', '#22D3EE'], // Cyan
            ['#10B981', '#34D399'], // Emerald
            ['#F59E0B', '#FBBF24'], // Amber
        ],
    };

    try {
        const widgetData: WidgetSharedData = {
            habits: habitsToWidgetData(habits, 365), // Full year for GitHub grid
            lastUpdated: new Date().toISOString(),
            theme,
            colors: colors || defaultColors,
        };

        // Save to AsyncStorage (Android widgets can read via SharedPreferences bridge)
        await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));

        // Request widget update on Android — must provide renderWidget callback
        try {
            const { requestWidgetUpdate } = require('react-native-android-widget');
            const widgetNames = ['WeeklyHabitWidget', 'MonthlyHabitWidget', 'GitHubHabitWidget', 'SmallHabitWidget'];

            for (const wName of widgetNames) {
                await requestWidgetUpdate({
                    widgetName: wName,
                    renderWidget: async (info: any) => {
                        // Dynamically import to avoid circular deps
                        const { WeeklyHabitWidget, MonthlyHabitWidget, GitHubHabitWidget, SmallHabitWidget } = require('../widgets/HabitWidgets');
                        const React = require('react');

                        // Find the habit configured for this widget instance
                        const WIDGET_CONFIG_KEY = 'HABITFLOW_WIDGET_CONFIG_';
                        const configHabitId = await AsyncStorage.getItem(WIDGET_CONFIG_KEY + info.widgetId).catch(() => null);
                        const habit = (configHabitId
                            ? widgetData.habits.find((h: any) => h.id === configHabitId)
                            : null) || widgetData.habits[0];

                        if (!habit) return React.createElement(WeeklyHabitWidget, {});

                        // Convert grid data for widget display
                        const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                        const gridData = habit.gridData.map((day: any) => ({
                            isCompleted: day.isCompleted,
                            isMissed: day.isMissed,
                            isExplicitlyFailed: day.isExplicitlyFailed,
                            isInactive: day.isInactive,
                            progress: day.progress,
                            dailyTarget: day.dailyTarget,
                            isToday: day.key === todayKey,
                        }));

                        const todayData = habit.gridData.find((d: any) => d.key === todayKey);
                        const effectiveTarget = habit.frequency === 'weekly' ? 1 : habit.dailyTarget;

                        const habitProps = {
                            habitName: habit.name,
                            habitIcon: habit.icon,
                            habitColorIndex: habit.colorIndex,
                            gridData,
                            streak: habit.streak,
                            todayProgress: todayData?.progress || 0,
                            dailyTarget: effectiveTarget,
                            isCompletedToday: (todayData?.progress || 0) >= effectiveTarget,
                            isExplicitlyFailedToday: todayData?.isExplicitlyFailed || false,
                            widgetId: info.widgetId,
                            widgetWidth: info.width || 0,
                            widgetHeight: info.height || 0,
                        };

                        switch (wName) {
                            case 'SmallHabitWidget': return React.createElement(SmallHabitWidget, habitProps);
                            case 'MonthlyHabitWidget': return React.createElement(MonthlyHabitWidget, habitProps);
                            case 'GitHubHabitWidget': return React.createElement(GitHubHabitWidget, habitProps);
                            default: return React.createElement(WeeklyHabitWidget, habitProps);
                        }
                    },
                }).catch(() => { });
            }
        } catch (e) {
            // Widget update not available
        }

    } catch (error) {
        console.error('Failed to update widget data:', error);
    }
}

/**
 * Get widget data from storage
 */
export async function getWidgetData(): Promise<WidgetSharedData | null> {
    try {
        const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to get widget data:', error);
        return null;
    }
}

/**
 * Get habits ready for weekly widget display (7 days)
 */
export function getWeeklyWidgetData(habitData: WidgetHabitData): WidgetHabitData {
    return {
        ...habitData,
        gridData: habitData.gridData.slice(-7),
    };
}

/**
 * Get habits ready for monthly widget display (30 days)
 */
export function getMonthlyWidgetData(habitData: WidgetHabitData): WidgetHabitData {
    return {
        ...habitData,
        gridData: habitData.gridData.slice(-30),
    };
}

/**
 * Get habits ready for GitHub-style widget display (365 days)
 */
export function getGitHubWidgetData(habitData: WidgetHabitData): WidgetHabitData {
    // Already has 365 days
    return habitData;
}
