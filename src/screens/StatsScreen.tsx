import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useHabits } from '../context/HabitContext';
import { colors, spacing, borderRadius, typography } from '../theme';
import LevelProgress from '../components/LevelProgress';
import ConfirmationModal from '../components/ConfirmationModal';
import { getDateKey } from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = (SCREEN_WIDTH - spacing.md * 2 - spacing.xs * 6) / 7;

export default function StatsScreen() {
    const { habits, levelInfo, userStats, resetApp } = useHabits();
    const [showResetModal, setShowResetModal] = React.useState(false);

    // Calculate weekly stats
    const weekData = useMemo(() => {
        const today = new Date();
        const days: { date: Date; key: string; dayName: string; completed: number; total: number }[] = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const key = getDateKey(date);

            const completed = habits.filter(h => (h.completions[key] || 0) >= (h.dailyTarget || 1)).length;

            days.push({
                date,
                key,
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                completed,
                total: habits.length,
            });
        }

        return days;
    }, [habits]);

    // Calculate best streak across all habits
    const bestStreak = useMemo(() => {
        return Math.max(...habits.map(h => h.streak), 0);
    }, [habits]);

    // Calculate total completions
    const totalCompletions = useMemo(() => {
        return habits.reduce((sum, h) => {
            const doneDays = Object.keys(h.completions).filter(k => h.completions[k] >= (h.dailyTarget || 1)).length;
            return sum + doneDays;
        }, 0);
    }, [habits]);

    // Calculate current week completion rate
    const weeklyRate = useMemo(() => {
        const totalPossible = weekData.reduce((sum, d) => sum + d.total, 0);
        const totalCompleted = weekData.reduce((sum, d) => sum + d.completed, 0);
        return totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    }, [weekData]);

    // Top habits by streak
    const topHabits = useMemo(() => {
        return [...habits]
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 5);
    }, [habits]);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <Animated.View
                entering={FadeInDown.delay(100)}
                style={styles.header}
            >
                <Text style={styles.title}>Statistics</Text>
                <Text style={styles.subtitle}>Track your progress over time</Text>
            </Animated.View>

            {/* Level Progress */}
            <Animated.View entering={FadeInDown.delay(200)}>
                <LevelProgress
                    level={levelInfo.level}
                    currentXp={levelInfo.currentXp}
                    xpNeeded={levelInfo.xpNeeded}
                    totalXp={userStats.totalXp}
                />
            </Animated.View>

            {/* Quick Stats */}
            <Animated.View
                entering={FadeInDown.delay(300)}
                style={styles.quickStats}
            >
                <View style={styles.statCard}>
                    <LinearGradient
                        colors={[...colors.streak]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>🔥</Text>
                        <Text style={styles.statValue}>{bestStreak}</Text>
                        <Text style={styles.statLabel}>Best Streak</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient
                        colors={[...colors.success]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>✓</Text>
                        <Text style={styles.statValue}>{totalCompletions}</Text>
                        <Text style={styles.statLabel}>Total Done</Text>
                    </LinearGradient>
                </View>

                <View style={styles.statCard}>
                    <LinearGradient
                        colors={[...colors.primary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.statGradient}
                    >
                        <Text style={styles.statIcon}>📊</Text>
                        <Text style={styles.statValue}>{weeklyRate}%</Text>
                        <Text style={styles.statLabel}>This Week</Text>
                    </LinearGradient>
                </View>
            </Animated.View>

            {/* Weekly Overview */}
            <Animated.View
                entering={FadeInDown.delay(400)}
                style={styles.section}
            >
                <Text style={styles.sectionTitle}>This Week</Text>
                <View style={styles.weekGrid}>
                    {weekData.map((day, index) => {
                        const rate = day.total > 0 ? day.completed / day.total : 0;
                        const isToday = index === 6;

                        return (
                            <View key={day.key} style={styles.dayColumn}>
                                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                                    {day.dayName}
                                </Text>
                                <View style={[styles.dayCell, isToday && styles.dayCellToday]}>
                                    {rate > 0 ? (
                                        <LinearGradient
                                            colors={rate === 1 ? [...colors.success] : [...colors.primary]}
                                            style={[styles.dayCellFill, { opacity: 0.3 + rate * 0.7 }]}
                                        />
                                    ) : null}
                                    <Text style={styles.dayCellText}>
                                        {day.completed}/{day.total}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </Animated.View>

            {/* Top Habits */}
            {topHabits.length > 0 && (
                <Animated.View
                    entering={FadeInDown.delay(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Top Streaks</Text>
                    <View style={styles.topHabitsList}>
                        {topHabits.map((habit, index) => (
                            <View key={habit.id} style={styles.topHabitRow}>
                                <View style={styles.topHabitRank}>
                                    <Text style={styles.topHabitRankText}>#{index + 1}</Text>
                                </View>
                                <View style={styles.topHabitIcon}>
                                    <LinearGradient
                                        colors={[...colors.habitColors[habit.colorIndex]]}
                                        style={styles.topHabitIconGradient}
                                    >
                                        <Text style={styles.topHabitIconText}>{habit.icon}</Text>
                                    </LinearGradient>
                                </View>
                                <View style={styles.topHabitInfo}>
                                    <Text style={styles.topHabitName} numberOfLines={1}>
                                        {habit.name}
                                    </Text>
                                    <Text style={styles.topHabitStats}>
                                        {Object.keys(habit.completions).filter(k => habit.completions[k] >= (habit.dailyTarget || 1)).length} completions
                                    </Text>
                                </View>
                                <View style={styles.topHabitStreak}>
                                    <Text style={styles.topHabitStreakIcon}>🔥</Text>
                                    <Text style={styles.topHabitStreakValue}>{habit.streak}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </Animated.View>
            )}

            {/* Empty state */}
            {habits.length === 0 && (
                <Animated.View
                    entering={FadeInDown.delay(400)}
                    style={styles.emptyState}
                >
                    <Text style={styles.emptyIcon}>📊</Text>
                    <Text style={styles.emptyTitle}>No data yet</Text>
                    <Text style={styles.emptyText}>
                        Start tracking habits to see your statistics
                    </Text>
                </Animated.View>
            )}

            {/* Danger Zone / Reset */}
            <Animated.View
                entering={FadeInDown.delay(700)}
                style={styles.dangerSection}
            >
                <Pressable
                    style={({ pressed }) => [
                        styles.resetButton,
                        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
                    ]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setShowResetModal(true);
                    }}
                >
                    <Ionicons name="trash-outline" size={18} color={colors.dangerStart} />
                    <Text style={styles.resetButtonText}>Reset App Data</Text>
                </Pressable>
            </Animated.View>

            <ConfirmationModal
                visible={showResetModal}
                title="Reset All Data?"
                message="This will permanently delete all your habits, progress, and XP. This action cannot be undone."
                confirmLabel="Yes, Reset Everything"
                cancelLabel="Cancel"
                type="danger"
                onConfirm={() => {
                    setShowResetModal(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    resetApp();
                }}
                onCancel={() => setShowResetModal(false)}
            />

            {/* Bottom spacing */}
            <View style={{ height: spacing.xxl }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: spacing.xl,
    },
    header: {
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h1,
        color: colors.textPrimary,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    quickStats: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    statCard: {
        flex: 1,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    statGradient: {
        padding: spacing.md,
        alignItems: 'center',
    },
    statIcon: {
        fontSize: 24,
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    statLabel: {
        ...typography.small,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    section: {
        marginTop: spacing.xl,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.md,
    },
    weekGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.xs,
    },
    dayColumn: {
        alignItems: 'center',
        flex: 1,
    },
    dayName: {
        ...typography.small,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    dayNameToday: {
        color: colors.primaryStart,
        fontWeight: '700',
    },
    dayCell: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    dayCellToday: {
        borderWidth: 2,
        borderColor: colors.primaryStart,
    },
    dayCellFill: {
        ...StyleSheet.absoluteFillObject,
    },
    dayCellText: {
        ...typography.small,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    topHabitsList: {
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: 'hidden',
    },
    topHabitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
    },
    topHabitRank: {
        width: 30,
    },
    topHabitRankText: {
        ...typography.bodyBold,
        color: colors.textMuted,
    },
    topHabitIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        marginRight: spacing.sm,
    },
    topHabitIconGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topHabitIconText: {
        fontSize: 20,
    },
    topHabitInfo: {
        flex: 1,
    },
    topHabitName: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    topHabitStats: {
        ...typography.small,
        color: colors.textMuted,
    },
    topHabitStreak: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    topHabitStreakIcon: {
        fontSize: 16,
    },
    topHabitStreakValue: {
        ...typography.bodyBold,
        color: colors.streakStart,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xxl,
        marginTop: spacing.xl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    resetText: {
        ...typography.small,
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },
    dangerSection: {
        marginTop: spacing.xxl,
        paddingTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    resetButtonText: {
        ...typography.bodyBold,
        color: colors.dangerStart,
        fontSize: 14,
    },
});
