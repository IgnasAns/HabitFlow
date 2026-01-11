import React, { useMemo, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import { triggerSelectionHaptic } from '../utils/feedback';
import LevelProgress from '../components/LevelProgress';
import { getDateKey } from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = (SCREEN_WIDTH - spacing.md * 2 - spacing.xs * 6) / 7;

type TimePeriod = 'week' | 'month' | 'year';

export default function StatsScreen({ navigation }: any) {
    const { userStats, habits, levelInfo } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const { width: screenWidth } = useWindowDimensions();
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // Helper to get date range for period
    const getDateRange = useCallback((period: TimePeriod) => {
        let startDate: Date;
        let endDate = new Date(today);

        switch (period) {
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 6);
                return { start: startDate, end: today, days: 7 };
            case 'month':
                // Current calendar month
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                return { start: startDate, end: endDate, days: endDate.getDate() };
            case 'year':
                // Current calendar year
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return { start: startDate, end: endDate, days: diffDays };
        }
    }, [today]);

    // Calculate detailed stats for selected period
    const periodStats = useMemo(() => {
        const { start, end, days } = getDateRange(selectedPeriod);
        const dayNames = [t.calendar.sunday, t.calendar.monday, t.calendar.tuesday, t.calendar.wednesday, t.calendar.thursday, t.calendar.friday, t.calendar.saturday];
        const dayData: { date: Date; key: string; dayName: string; completed: number; total: number }[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(end);
            date.setDate(end.getDate() - i);
            const key = getDateKey(date);

            // Only consider habits that existed on this date OR have data (backfilled)
            const activeHabits = habits.filter(h => {
                const created = new Date(h.createdAt);
                created.setHours(0, 0, 0, 0);
                if (created <= date) return true;

                // Check for backfilled data
                return (h.completions[key] || 0) > 0;
            });

            const completed = activeHabits.filter(h => {
                const effectiveTarget = h.frequency === 'weekly' ? 1 : (h.dailyTarget || 1);
                return (h.completions[key] || 0) >= effectiveTarget;
            }).length;

            dayData.push({
                date,
                key,
                dayName: dayNames[date.getDay()],
                completed,
                total: activeHabits.length,
            });
        }

        const pastAndTodayData = dayData.filter(d => d.date <= today);
        const totalPossible = pastAndTodayData.reduce((sum, d) => sum + d.total, 0);
        const totalCompleted = dayData.reduce((sum, d) => sum + d.completed, 0);
        const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

        // Best day (most completions)
        const bestDay = dayData.reduce((best, d) =>
            d.completed > best.completed ? d : best,
            dayData[0] || { completed: 0, dayName: 'N/A' }
        );

        // Perfect days (all habits done)
        const perfectDays = dayData.filter(d => d.total > 0 && d.completed === d.total).length;

        // Active days (at least one completion)
        const activeDays = dayData.filter(d => d.completed > 0).length;

        // Daily average (only count days up to today)
        const elapsedDays = pastAndTodayData.length;
        const dailyAvg = elapsedDays > 0 ? Math.round(totalCompleted / elapsedDays * 10) / 10 : 0;

        const monthOffset = selectedPeriod === 'month' ? (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7 : 0;
        const yearOffset = selectedPeriod === 'year' ? (new Date(today.getFullYear(), 0, 1).getDay() + 6) % 7 : 0;

        return {
            dayData,
            totalCompleted,
            totalPossible,
            completionRate,
            bestDay,
            perfectDays,
            activeDays,
            dailyAvg,
            days,
            monthOffset,
            yearOffset
        };
    }, [habits, selectedPeriod, getDateRange, t, today]);

    // Weekly view data (for week period)
    const weekData = useMemo(() => {
        if (selectedPeriod !== 'week') return periodStats.dayData;
        return periodStats.dayData;
    }, [periodStats, selectedPeriod]);

    // Calculate best streak across all habits
    const bestStreak = useMemo(() => {
        return Math.max(...habits.map(h => h.streak), 0);
    }, [habits]);

    // Calculate total completions (all-time)
    const totalCompletions = useMemo(() => {
        return habits.reduce((sum, h) => {
            const effectiveTarget = h.frequency === 'weekly' ? 1 : (h.dailyTarget || 1);
            const doneDays = Object.keys(h.completions).filter(k => h.completions[k] >= effectiveTarget).length;
            return sum + doneDays;
        }, 0);
    }, [habits]);

    // Top habits by streak
    const topHabits = useMemo(() => {
        return [...habits]
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 5);
    }, [habits]);

    // Period labels for UI
    const periodLabels: Record<TimePeriod, string> = {
        week: t.common.week,
        month: t.common.month,
        year: t.common.year,
    };

    const monthNames = [
        t.calendar.januaryShort, t.calendar.februaryShort, t.calendar.marchShort,
        t.calendar.aprilShort, t.calendar.mayShort, t.calendar.juneShort,
        t.calendar.julyShort, t.calendar.augustShort, t.calendar.septemberShort,
        t.calendar.octoberShort, t.calendar.novemberShort, t.calendar.decemberShort
    ];
    const currentMonthLabel = monthNames[today.getMonth()];
    const currentYearLabel = today.getFullYear().toString();

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
                <View style={styles.headerMain}>
                    <Pressable
                        onPress={() => navigation.navigate('Home')}
                        style={styles.backButton}
                        hitSlop={20}
                    >
                        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                    </Pressable>
                    <View style={styles.headerTitles}>
                        <Text style={styles.title}>{t.stats.title}</Text>
                        <Text style={styles.subtitle}>{t.stats.overview}</Text>
                    </View>
                </View>
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

            {/* Period Selector Tabs */}
            <Animated.View
                entering={FadeInDown.delay(250)}
                style={styles.periodSelector}
            >
                {(['week', 'month', 'year'] as TimePeriod[]).map((period) => (
                    <Pressable
                        key={period}
                        style={[
                            styles.periodTab,
                            selectedPeriod === period && styles.periodTabActive
                        ]}
                        onPress={() => {
                            triggerSelectionHaptic();
                            setSelectedPeriod(period);
                        }}
                    >
                        <Text style={[
                            styles.periodTabText,
                            selectedPeriod === period && styles.periodTabTextActive
                        ]}>
                            {periodLabels[period]}
                        </Text>
                    </Pressable>
                ))}
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
                        <Text style={styles.statLabel}>{t.stats.bestStreak}</Text>
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
                        <Text style={styles.statLabel}>{t.stats.allTime}</Text>
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
                        <Text style={styles.statValue}>{periodStats.completionRate}%</Text>
                        <Text style={styles.statLabel}>{periodLabels[selectedPeriod]}</Text>
                    </LinearGradient>
                </View>
            </Animated.View>

            {/* Period Stats Detail */}
            <Animated.View
                entering={FadeInDown.delay(350)}
                style={styles.periodStatsCard}
            >
                <Text style={styles.sectionTitle}>{periodLabels[selectedPeriod]} {t.stats.overview}</Text>
                <View style={styles.periodStatsGrid}>
                    <View style={styles.periodStatItem}>
                        <Text style={styles.periodStatValue}>{periodStats.totalCompleted}</Text>
                        <Text style={styles.periodStatLabel}>{t.stats.completions}</Text>
                    </View>
                    <View style={styles.periodStatItem}>
                        <Text style={styles.periodStatValue}>{periodStats.perfectDays}</Text>
                        <Text style={styles.periodStatLabel}>{t.stats.perfectDays}</Text>
                    </View>
                    <View style={styles.periodStatItem}>
                        <Text style={styles.periodStatValue}>{periodStats.activeDays}</Text>
                        <Text style={styles.periodStatLabel}>{t.stats.activeDays}</Text>
                    </View>
                    <View style={styles.periodStatItem}>
                        <Text style={styles.periodStatValue}>{periodStats.dailyAvg}</Text>
                        <Text style={styles.periodStatLabel}>{t.stats.dailyAvg}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Weekly Overview (visible for week period) */}
            {selectedPeriod === 'week' && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.stats.dailyBreakdown}</Text>
                    <View style={styles.weekGrid}>
                        {weekData.map((day, index) => {
                            const rate = day.total > 0 ? day.completed / day.total : 0;
                            const isToday = index === weekData.length - 1;

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
            )}

            {/* Monthly Calendar View (visible for month period) */}
            {selectedPeriod === 'month' && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{currentMonthLabel} {t.stats.overview}</Text>
                    <View style={styles.monthGrid}>
                        {Array.from({ length: periodStats.monthOffset || 0 }).map((_, i) => (
                            <View key={`spacer-${i}`} style={[styles.monthCell, { backgroundColor: 'transparent' }]} />
                        ))}
                        {periodStats.dayData.map((day) => {
                            const rate = day.total > 0 ? day.completed / day.total : 0;
                            const isToday = day.key === getDateKey(today);
                            const isFuture = day.date > today;

                            return (
                                <View
                                    key={day.key}
                                    style={[
                                        styles.monthCell,
                                        rate > 0 && rate < 1 && {
                                            backgroundColor: colors.primaryStart,
                                            opacity: 0.3 + rate * 0.7
                                        },
                                        rate === 1 && { backgroundColor: colors.successStart },
                                        isToday && styles.monthCellToday,
                                        isFuture && { opacity: 0.15 },
                                    ]}
                                />
                            );
                        })}
                    </View>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                            <Text style={styles.legendText}>{t.stats.noProgress}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.primaryStart, opacity: 0.6 }]} />
                            <Text style={styles.legendText}>{t.stats.partial}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.successStart }]} />
                            <Text style={styles.legendText}>{t.stats.complete}</Text>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Yearly Calendar View (visible for year period) */}
            {selectedPeriod === 'year' && (
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{currentYearLabel} {t.stats.overview}</Text>
                    <View style={styles.yearGrid}>
                        {Array.from({ length: periodStats.yearOffset || 0 }).map((_, i) => (
                            <View key={`spacer-${i}`} style={[styles.yearCell, { backgroundColor: 'transparent' }]} />
                        ))}
                        {periodStats.dayData.map((day) => {
                            const rate = day.total > 0 ? day.completed / day.total : 0;
                            const isToday = day.key === getDateKey(today);
                            const isFuture = day.date > today;

                            return (
                                <View
                                    key={day.key}
                                    style={[
                                        styles.yearCell,
                                        rate > 0 && rate < 1 && {
                                            backgroundColor: colors.primaryStart,
                                            opacity: 0.3 + rate * 0.7
                                        },
                                        rate === 1 && { backgroundColor: colors.successStart },
                                        isToday && styles.yearCellToday,
                                        isFuture && { opacity: 0.15 },
                                    ]}
                                />
                            );
                        })}
                    </View>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                            <Text style={styles.legendText}>{t.stats.noProgress}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.primaryStart, opacity: 0.6 }]} />
                            <Text style={styles.legendText}>{t.stats.partial}</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.successStart }]} />
                            <Text style={styles.legendText}>{t.stats.complete}</Text>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* Top Habits */}
            {topHabits.length > 0 && (
                <Animated.View
                    entering={FadeInDown.delay(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.stats.topHabits}</Text>
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
                                        {Object.keys(habit.completions).filter(k => habit.completions[k] >= (habit.frequency === 'weekly' ? 1 : (habit.dailyTarget || 1))).length} {t.stats.completions.toLowerCase()}
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
                    <Text style={styles.emptyTitle}>{t.stats.noDataYet}</Text>
                    <Text style={styles.emptyText}>
                        {t.stats.keepTracking}
                    </Text>
                </Animated.View>
            )}

            {/* Bottom spacing */}
            <View style={{ height: spacing.xxl }} />
        </ScrollView>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: Math.max(insets.top, 20) + spacing.sm,
    },
    header: {
        marginBottom: spacing.lg,
    },
    headerMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitles: {
        flex: 1,
    },
    backButton: {
        marginLeft: -spacing.xs,
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
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        padding: 4,
        marginTop: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    periodTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: borderRadius.md,
    },
    periodTabActive: {
        backgroundColor: colors.primaryStart + '30',
    },
    periodTabText: {
        ...typography.bodyBold,
        color: colors.textMuted,
        fontSize: 13,
    },
    periodTabTextActive: {
        color: colors.textPrimary,
    },
    periodStatsCard: {
        marginTop: spacing.lg,
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    periodStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    periodStatItem: {
        width: '48%',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.sm,
        alignItems: 'center',
    },
    periodStatValue: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    periodStatLabel: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: 4,
    },
    monthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-start',
        padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: borderRadius.md,
    },
    monthCell: {
        width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2 - 6 * 7) / 7,
        aspectRatio: 1,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    monthCellToday: {
        borderWidth: 2,
        borderColor: colors.primaryStart,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.lg,
        marginTop: spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 3,
    },
    legendText: {
        ...typography.caption,
        color: colors.textMuted,
    },
    yearGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        justifyContent: 'flex-start',
        padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: borderRadius.md,
    },
    yearCell: {
        width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2 - 3 * 15) / 15,
        aspectRatio: 1,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    yearCellToday: {
        borderWidth: 1.5,
        borderColor: colors.primaryStart,
    },
});
