import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';
import { Habit } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { getDateKey } from '../utils/storage';
import * as Haptics from 'expo-haptics';

interface HabitCalendarProps {
    habit: Habit;
    onToggle: (dateKey: string) => void;
}

export default function HabitCalendar({ habit, onToggle }: HabitCalendarProps) {
    const [viewDate, setViewDate] = useState(new Date());

    // Theme color
    const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

    // Helper functions
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        // Adjust for Monday start (0 = Mon, 6 = Sun)
        return (day + 6) % 7;
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthName = viewDate.toLocaleString('default', { month: 'long' });

    const daysInCurrentMonth = getDaysInMonth(year, month);
    const startDayOffset = getFirstDayOfMonth(year, month);

    // Generate calendar grid
    const renderCalendarGrid = () => {
        const totalSlots = Math.ceil((daysInCurrentMonth + startDayOffset) / 7) * 7;
        const days = [];

        for (let i = 0; i < totalSlots; i++) {
            const dayNum = i - startDayOffset + 1;

            if (dayNum > 0 && dayNum <= daysInCurrentMonth) {
                const date = new Date(year, month, dayNum);
                const dateKey = getDateKey(date);

                const progress = habit.completions[dateKey] || 0;
                const isCompleted = progress >= habit.dailyTarget;
                const isExplicitlyFailed = habit.explicitFailures?.[dateKey];
                const isToday = dateKey === getDateKey(new Date());

                // Future check
                const isFuture = date > new Date();

                days.push(
                    <Pressable
                        key={i}
                        style={[
                            styles.dayCell,
                            isToday && styles.todayCell,
                            isCompleted && { backgroundColor: themeColor + '20' },
                            isExplicitlyFailed && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                        ]}
                        onPress={() => {
                            if (isFuture) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                return;
                            }
                            Haptics.selectionAsync();
                            onToggle(dateKey);
                        }}
                        disabled={isFuture}
                    >
                        <View style={[
                            styles.dayContent,
                            isCompleted && { backgroundColor: themeColor },
                            isExplicitlyFailed && { backgroundColor: colors.dangerStart || '#EF4444' },
                            isFuture && { opacity: 0.3 }
                        ]}>
                            {isCompleted ? (
                                <Text style={styles.checkMark}>✓</Text>
                            ) : isExplicitlyFailed ? (
                                <Text style={styles.checkMark}>✕</Text>
                            ) : (
                                <Text style={[styles.dayText, isToday && { color: themeColor, fontWeight: 'bold' }]}>
                                    {dayNum}
                                </Text>
                            )}
                        </View>
                        {isToday && <View style={[styles.todayDot, { backgroundColor: themeColor }]} />}
                    </Pressable>
                );
            } else {
                days.push(<View key={i} style={styles.dayCell} />);
            }
        }
        return days;
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
        Haptics.selectionAsync();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => changeMonth(-1)} style={styles.monthNavBtn} hitSlop={10}>
                    <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </Pressable>
                <View style={styles.monthLabelContainer}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.monthLabel}>{monthName} {year}</Text>
                </View>
                <Pressable onPress={() => changeMonth(1)} style={styles.monthNavBtn} hitSlop={10}>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekRow}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
            </View>

            {/* Days Grid */}
            <View style={styles.grid}>
                {renderCalendarGrid()}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg, // Matches screenshot rounded style
        padding: spacing.md,
        // Optional shadow
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    monthNavBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    monthLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    monthLabel: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        textTransform: 'capitalize',
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
        fontSize: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%', // 100% / 7
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
        borderRadius: 8,
    },
    dayContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    todayCell: {
        // Subtle highlight?
    },
    dayText: {
        ...typography.body,
        color: colors.textSecondary,
        fontSize: 14,
    },
    checkMark: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    todayDot: {
        position: 'absolute',
        bottom: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
    }
});
