'use no memo';
/**
 * Widget Task Handler for HabitFlow
 * Handles widget rendering and click actions (including habit toggling)
 */

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeeklyHabitWidget, MonthlyHabitWidget, GitHubHabitWidget, SmallHabitWidget } from './HabitWidgets';

const WIDGET_DATA_KEY = 'HABITFLOW_WIDGET_DATA';
const WIDGET_CONFIG_KEY = 'HABITFLOW_WIDGET_CONFIG_';
const HABITS_STORAGE_KEY = '@habits';

interface WidgetHabitData {
    id: string;
    name: string;
    icon: string;
    colorIndex: number;
    streak: number;
    dailyTarget: number;
    frequency: 'daily' | 'weekly';
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

interface WidgetSharedData {
    habits: WidgetHabitData[];
    lastUpdated: string;
    theme: 'dark' | 'light';
}

/**
 * Get today's date key in YYYY-MM-DD format
 */
function getTodayKey(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Convert stored grid data to widget display format
 */
function convertGridData(storedData: WidgetHabitData['gridData']) {
    const todayKey = getTodayKey();

    return storedData.map(day => ({
        isCompleted: day.isCompleted,
        isMissed: day.isMissed,
        isExplicitlyFailed: day.isExplicitlyFailed,
        isInactive: day.isInactive || false,
        progress: day.progress,
        dailyTarget: day.dailyTarget,
        isToday: day.key === todayKey,
    }));
}

/**
 * Check if a habit is completed today
 */
function isHabitCompletedToday(habit: WidgetHabitData): boolean {
    const todayKey = getTodayKey();
    const todayData = habit.gridData.find(d => d.key === todayKey);
    if (!todayData) return false;

    const effectiveTarget = habit.frequency === 'weekly' ? 1 : habit.dailyTarget;
    return todayData.progress >= effectiveTarget;
}

/**
 * Check if today is explicitly failed
 */
function isHabitExplicitlyFailedToday(habit: WidgetHabitData): boolean {
    const todayKey = getTodayKey();
    const todayData = habit.gridData.find(d => d.key === todayKey);
    return todayData?.isExplicitlyFailed || false;
}

/**
 * Get today's progress for a habit
 */
function getTodayProgress(habit: WidgetHabitData): number {
    const todayKey = getTodayKey();
    const todayData = habit.gridData.find(d => d.key === todayKey);
    return todayData?.progress || 0;
}

/**
 * Load widget data from AsyncStorage
 */
async function loadWidgetData(): Promise<WidgetSharedData | null> {
    try {
        const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load widget data:', error);
    }
    return null;
}

/**
 * Get the configured habit ID for a specific widget instance
 */
async function getWidgetHabitId(widgetId: number): Promise<string | null> {
    try {
        const configKey = WIDGET_CONFIG_KEY + widgetId;
        const habitId = await AsyncStorage.getItem(configKey);
        return habitId;
    } catch (error) {
        return null;
    }
}

/**
 * Calculate streak using the same algorithm as storage.ts
 * This ensures widget and app streaks stay in sync
 */
function calculateStreak(completions: Record<string, number>, dailyTarget: number, frequency: string = 'daily'): number {
    if (!completions) return 0;

    const effectiveTarget = frequency === 'weekly' ? 1 : dailyTarget;

    // Get all completed dates, filter by target, sort in reverse chronological order
    const completedDates = Object.keys(completions)
        .filter(k => completions[k] >= effectiveTarget)
        .sort()
        .reverse();

    if (completedDates.length === 0) return 0;

    const todayKey = getTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    // Streak can only start from today or yesterday
    if (completedDates[0] !== todayKey && completedDates[0] !== yesterdayKey) {
        return 0;
    }

    let streak = 1;
    let currentDateParts = completedDates[0].split('-').map(Number);
    let currentDate = new Date(currentDateParts[0], currentDateParts[1] - 1, currentDateParts[2]);

    for (let i = 1; i < completedDates.length; i++) {
        const expectedPrevDate = new Date(currentDate);
        expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
        const expectedPrevKey = `${expectedPrevDate.getFullYear()}-${String(expectedPrevDate.getMonth() + 1).padStart(2, '0')}-${String(expectedPrevDate.getDate()).padStart(2, '0')}`;

        if (completedDates[i] === expectedPrevKey) {
            streak++;
            currentDate = expectedPrevDate;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Toggle habit completion for today
 * Uses the same three-state cycle as the main app:
 * empty → completed → explicitly failed → empty
 */
async function toggleHabitCompletion(habitId: string): Promise<boolean> {
    try {
        const todayKey = getTodayKey();

        // Single read → mutate → write for minimum latency
        const habitsJson = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
        if (!habitsJson) return false;

        const habits = JSON.parse(habitsJson);
        const habitIndex = habits.findIndex((h: any) => h.id === habitId);
        if (habitIndex === -1) return false;

        const habit = habits[habitIndex];
        const effectiveTarget = habit.frequency === 'weekly' ? 1 : (habit.dailyTarget || 1);
        if (!habit.completions) habit.completions = {};
        if (!habit.explicitFailures) habit.explicitFailures = {};

        const currentProgress = habit.completions[todayKey] || 0;
        const isExplicitlyFailed = habit.explicitFailures[todayKey] || false;
        const isCompleted = currentProgress >= effectiveTarget;

        // Three-state cycle: empty → completed → failed → empty
        if (!isCompleted && !isExplicitlyFailed) {
            habit.completions[todayKey] = effectiveTarget;
            delete habit.explicitFailures[todayKey];
        } else if (isCompleted && !isExplicitlyFailed) {
            habit.completions[todayKey] = 0;
            habit.explicitFailures[todayKey] = true;
        } else {
            habit.completions[todayKey] = 0;
            delete habit.explicitFailures[todayKey];
        }

        habit.streak = calculateStreak(habit.completions, habit.dailyTarget || 1, habit.frequency);
        habits[habitIndex] = habit;

        // Write habits + update widget cache (must await cache so re-render reads fresh data)
        await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
        await updateWidgetDataCache(habits);

        return (habit.completions[todayKey] || 0) >= effectiveTarget;
    } catch (e) {
        return false;
    }
}

/**
 * Update the widget data cache after habit modification
 */
async function updateWidgetDataCache(habits: any[]): Promise<void> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = getTodayKey();

        // Filter out archived habits
        const activeHabits = habits.filter((h: any) => !h.archived);

        const widgetHabits: WidgetHabitData[] = activeHabits.map(habit => {
            const gridData: WidgetHabitData['gridData'] = [];

            // Parse habit creation date for isMissed/isInactive logic
            const createdDate = habit.createdAt ? new Date(habit.createdAt) : new Date(0);
            createdDate.setHours(0, 0, 0, 0);

            // Generate last 365 days
            for (let i = 364; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                const progress = habit.completions?.[key] || 0;
                const dailyTarget = habit.frequency === 'weekly' ? 1 : (habit.dailyTarget || 1);
                const isCompleted = progress >= dailyTarget;
                const isExplicitlyFailed = habit.explicitFailures?.[key] || false;
                // Match in-app logic: only mark missed for days AFTER habit was created
                const isMissed = !isCompleted && !isExplicitlyFailed && key !== todayKey && date < today && date >= createdDate && progress === 0;
                // Inactive if before creation date and no progress
                const isInactive = date < createdDate && progress === 0;

                gridData.push({
                    key,
                    progress,
                    dailyTarget,
                    isCompleted,
                    isMissed,
                    isExplicitlyFailed,
                    isInactive,
                });
            }

            return {
                id: habit.id,
                name: habit.name,
                icon: habit.icon,
                colorIndex: habit.colorIndex,
                streak: habit.streak || 0,
                dailyTarget: habit.dailyTarget || 1,
                frequency: habit.frequency || 'daily',
                gridData,
            };
        });

        const widgetData: WidgetSharedData = {
            habits: widgetHabits,
            lastUpdated: new Date().toISOString(),
            theme: 'dark',
        };

        await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
    } catch (error) {
        console.error('Failed to update widget cache:', error);
    }
}

/**
 * Create default demo props when no habits exist
 */
function getDefaultProps(widgetId: number = 0) {
    const demoGrid = Array.from({ length: 100 }).map((_, i) => ({
        isCompleted: Math.random() > 0.4,
        isMissed: false,
        progress: 0,
        dailyTarget: 1,
        isToday: i === 99,
    }));

    return {
        habitName: 'Add a habit',
        habitIcon: '✨',
        habitColorIndex: 0,
        gridData: demoGrid,
        streak: 0,
        todayProgress: 0,
        dailyTarget: 1,
        isCompletedToday: false,
        widgetId,
    };
}

/**
 * Request all widgets to update — provides the required renderWidget callback
 * that loads fresh data and returns the correct JSX for each widget instance.
 */
async function requestAllWidgetsUpdate(): Promise<void> {
    try {
        const { requestWidgetUpdate } = require('react-native-android-widget');
        const widgetNames = ['WeeklyHabitWidget', 'MonthlyHabitWidget', 'GitHubHabitWidget', 'SmallHabitWidget'];

        for (const wName of widgetNames) {
            await requestWidgetUpdate({
                widgetName: wName,
                renderWidget: async (info: any) => {
                    const [storedData, configuredHabitId] = await Promise.all([
                        loadWidgetData(),
                        getWidgetHabitId(info.widgetId),
                    ]);

                    let habit: WidgetHabitData | null = null;
                    if (storedData?.habits?.length) {
                        habit = (configuredHabitId
                            ? storedData.habits.find(h => h.id === configuredHabitId)
                            : null) || storedData.habits[0];
                    }

                    if (!habit) {
                        const dp = getDefaultProps(info.widgetId);
                        switch (wName) {
                            case 'SmallHabitWidget': return <SmallHabitWidget {...dp} />;
                            case 'MonthlyHabitWidget': return <MonthlyHabitWidget {...dp} />;
                            case 'GitHubHabitWidget': return <GitHubHabitWidget {...dp} />;
                            default: return <WeeklyHabitWidget {...dp} />;
                        }
                    }

                    const gridData = convertGridData(habit.gridData);
                    const habitProps = {
                        habitName: habit.name,
                        habitIcon: habit.icon,
                        habitColorIndex: habit.colorIndex,
                        gridData,
                        streak: habit.streak,
                        todayProgress: getTodayProgress(habit),
                        dailyTarget: habit.dailyTarget,
                        isCompletedToday: isHabitCompletedToday(habit),
                        isExplicitlyFailedToday: isHabitExplicitlyFailedToday(habit),
                        widgetId: info.widgetId,
                        widgetWidth: info.width || 0,
                        widgetHeight: info.height || 0,
                    };

                    switch (wName) {
                        case 'SmallHabitWidget': return <SmallHabitWidget {...habitProps} />;
                        case 'MonthlyHabitWidget': return <MonthlyHabitWidget {...habitProps} />;
                        case 'GitHubHabitWidget': return <GitHubHabitWidget {...habitProps} />;
                        default: return <WeeklyHabitWidget {...habitProps} />;
                    }
                },
            }).catch(() => { });
        }
    } catch (e) {
        // Widget update not available
    }
}

/**
 * Render the appropriate widget with habit data
 */
function renderWidgetWithData(
    renderWidget: (component: React.JSX.Element) => void,
    widgetName: string,
    habit: WidgetHabitData,
    widgetId: number,
    widgetWidth: number = 0,
    widgetHeight: number = 0
) {
    const gridData = convertGridData(habit.gridData);
    const isCompletedToday = isHabitCompletedToday(habit);
    const isExplicitlyFailedToday = isHabitExplicitlyFailedToday(habit);
    const todayProgress = getTodayProgress(habit);

    const habitProps = {
        habitName: habit.name,
        habitIcon: habit.icon,
        habitColorIndex: habit.colorIndex,
        gridData,
        streak: habit.streak,
        todayProgress,
        dailyTarget: habit.dailyTarget,
        isCompletedToday,
        isExplicitlyFailedToday,
        widgetId,
        widgetWidth,
        widgetHeight,
    };

    switch (widgetName) {
        case 'SmallHabitWidget':
            renderWidget(<SmallHabitWidget {...habitProps} />);
            break;
        case 'WeeklyHabitWidget':
            renderWidget(<WeeklyHabitWidget {...habitProps} />);
            break;
        case 'MonthlyHabitWidget':
            renderWidget(<MonthlyHabitWidget {...habitProps} />);
            break;
        case 'GitHubHabitWidget':
            renderWidget(<GitHubHabitWidget {...habitProps} />);
            break;
        default:
            renderWidget(<WeeklyHabitWidget {...habitProps} />);
            break;
    }
}

/**
 * Main widget task handler
 */
async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
    const { widgetInfo, widgetAction, renderWidget, clickAction } = props;
    const wWidth = widgetInfo?.width ?? 0;
    const wHeight = widgetInfo?.height ?? 0;

    // Handle widget deletion
    if (widgetAction === 'WIDGET_DELETED') {
        if (widgetInfo?.widgetId) {
            try { await AsyncStorage.removeItem(WIDGET_CONFIG_KEY + widgetInfo.widgetId); } catch (e) { }
        }
        return;
    }

    const widgetName = widgetInfo?.widgetName || 'WeeklyHabitWidget';
    const widgetId = widgetInfo?.widgetId || 0;

    // Handle click — optimized for speed
    if (widgetAction === 'WIDGET_CLICK') {
        if (clickAction === 'TOGGLE_HABIT') {
            try {
                const [configuredHabitId, storedData] = await Promise.all([
                    getWidgetHabitId(widgetId),
                    loadWidgetData(),
                ]);

                const habitId = configuredHabitId || storedData?.habits?.[0]?.id;
                if (!habitId) return;

                await toggleHabitCompletion(habitId);

                // Re-render immediately with fresh data
                const updatedData = await loadWidgetData();
                const habit = updatedData?.habits?.find(h => h.id === habitId);
                if (habit) renderWidgetWithData(renderWidget, widgetName, habit, widgetId, wWidth, wHeight);

                // Update other widgets non-blocking
                requestAllWidgetsUpdate().catch(() => { });
            } catch (e) { }
        }
        return;
    }

    // Normal rendering (WIDGET_ADDED, WIDGET_UPDATE, WIDGET_RESIZED)
    try {
        const [storedData, configuredHabitId] = await Promise.all([
            loadWidgetData(),
            getWidgetHabitId(widgetId),
        ]);

        let habit: WidgetHabitData | null = null;
        if (storedData?.habits?.length) {
            habit = (configuredHabitId ? storedData.habits.find(h => h.id === configuredHabitId) : null) || storedData.habits[0];
        }

        if (habit) {
            renderWidgetWithData(renderWidget, widgetName, habit, widgetId, wWidth, wHeight);
        } else {
            const dp = getDefaultProps(widgetId);
            switch (widgetName) {
                case 'SmallHabitWidget': renderWidget(<SmallHabitWidget {...dp} />); break;
                case 'MonthlyHabitWidget': renderWidget(<MonthlyHabitWidget {...dp} />); break;
                case 'GitHubHabitWidget': renderWidget(<GitHubHabitWidget {...dp} />); break;
                default: renderWidget(<WeeklyHabitWidget {...dp} />); break;
            }
        }
    } catch (e) {
        renderWidget(<WeeklyHabitWidget {...getDefaultProps(widgetId)} />);
    }
}

export default widgetTaskHandler;
