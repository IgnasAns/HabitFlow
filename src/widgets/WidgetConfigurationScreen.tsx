/**
 * Widget Configuration Screen
 * Allows users to select which habit to display on a widget
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { WeeklyHabitWidget, MonthlyHabitWidget, GitHubHabitWidget, SmallHabitWidget } from './HabitWidgets';

const WIDGET_DATA_KEY = 'HABITFLOW_WIDGET_DATA';
const WIDGET_CONFIG_KEY = 'HABITFLOW_WIDGET_CONFIG_';

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

// Color palette
const HABIT_COLORS = [
    '#06B6D4', // Cyan
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#3B82F6', // Blue
    '#EC4899', // Pink
    '#F97316', // Orange
    '#8B5CF6', // Purple
    '#EF4444', // Red
];

export default function WidgetConfigurationScreen({
    widgetInfo,
    renderWidget,
    setResult,
}: WidgetConfigurationScreenProps) {
    const [habits, setHabits] = useState<WidgetHabitData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

    // Load habits from AsyncStorage
    useEffect(() => {
        async function loadHabits() {
            try {
                const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
                if (data) {
                    const parsed: WidgetSharedData = JSON.parse(data);
                    setHabits(parsed.habits || []);
                    if (parsed.habits && parsed.habits.length > 0) {
                        setSelectedHabitId(parsed.habits[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to load habits:', error);
            } finally {
                setLoading(false);
            }
        }
        loadHabits();
    }, []);

    // Convert stored grid data to widget format
    function convertGridData(storedData: WidgetHabitData['gridData']) {
        const _t = new Date(); const today = `${_t.getFullYear()}-${String(_t.getMonth() + 1).padStart(2, '0')}-${String(_t.getDate()).padStart(2, '0')}`;
        return storedData.map(day => ({
            isCompleted: day.isCompleted,
            isMissed: day.isMissed,
            isExplicitlyFailed: day.isExplicitlyFailed,
            isInactive: day.isInactive || false,
            progress: day.progress,
            dailyTarget: day.dailyTarget,
            isToday: day.key === today,
        }));
    }

    // Check if habit is completed today
    function isHabitCompletedToday(habit: WidgetHabitData): boolean {
        const _t = new Date(); const today = `${_t.getFullYear()}-${String(_t.getMonth() + 1).padStart(2, '0')}-${String(_t.getDate()).padStart(2, '0')}`;
        const todayData = habit.gridData.find(d => d.key === today);
        if (!todayData) return false;
        const effectiveTarget = habit.frequency === 'weekly' ? 1 : habit.dailyTarget;
        return todayData.progress >= effectiveTarget;
    }

    // Get today's progress
    function getTodayProgress(habit: WidgetHabitData): number {
        const _t = new Date(); const today = `${_t.getFullYear()}-${String(_t.getMonth() + 1).padStart(2, '0')}-${String(_t.getDate()).padStart(2, '0')}`;
        const todayData = habit.gridData.find(d => d.key === today);
        return todayData?.progress || 0;
    }

    // Handle habit selection
    async function handleSelectHabit(habitId: string) {
        setSelectedHabitId(habitId);

        // Save the selected habit for this widget
        const configKey = WIDGET_CONFIG_KEY + widgetInfo.widgetId;
        await AsyncStorage.setItem(configKey, habitId);

        // Find the habit
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        // Build the widget props
        const gridData = convertGridData(habit.gridData);
        const isCompletedToday = isHabitCompletedToday(habit);
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
            widgetId: widgetInfo.widgetId,
        };

        // Render the appropriate widget
        switch (widgetInfo.widgetName) {
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
        }

        // Mark configuration as complete
        setResult('ok');
    }

    // Cancel configuration
    function handleCancel() {
        setResult('cancel');
    }

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#06B6D4" />
            </View>
        );
    }

    if (habits.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📝</Text>
                    <Text style={styles.emptyTitle}>No Habits Yet</Text>
                    <Text style={styles.emptyText}>
                        Open HabitFlow and add some habits first, then add this widget.
                    </Text>
                    <Pressable style={styles.cancelButton} onPress={handleCancel}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Select a Habit</Text>
                <Text style={styles.subtitle}>Choose which habit to display on your widget</Text>
            </View>

            <FlatList
                data={habits}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                    const isSelected = item.id === selectedHabitId;
                    const habitColor = HABIT_COLORS[item.colorIndex % HABIT_COLORS.length];

                    return (
                        <Pressable
                            style={[
                                styles.habitItem,
                                isSelected && { borderColor: habitColor, borderWidth: 2 }
                            ]}
                            onPress={() => handleSelectHabit(item.id)}
                        >
                            <View style={[styles.iconBox, { backgroundColor: habitColor + '25' }]}>
                                <Text style={styles.icon}>{item.icon}</Text>
                            </View>
                            <View style={styles.habitInfo}>
                                <Text style={styles.habitName}>{item.name}</Text>
                                <Text style={styles.habitMeta}>
                                    {item.streak} day streak • {item.frequency}
                                </Text>
                            </View>
                            {isSelected && (
                                <View style={[styles.checkBadge, { backgroundColor: habitColor }]}>
                                    <Text style={styles.checkMark}>✓</Text>
                                </View>
                            )}
                        </Pressable>
                    );
                }}
            />

            <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={handleCancel}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#080C14',
    },
    header: {
        padding: 20,
        paddingTop: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
    },
    listContent: {
        padding: 16,
    },
    habitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#121926',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 22,
    },
    habitInfo: {
        flex: 1,
        marginLeft: 12,
    },
    habitName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    habitMeta: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    checkBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkMark: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        paddingBottom: 40,
    },
    cancelButton: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 24,
    },
});
