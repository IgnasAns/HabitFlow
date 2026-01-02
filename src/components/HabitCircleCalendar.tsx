import React, { useMemo, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius } from '../theme';
import { getDateKey } from '../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAYS_TO_SHOW = 28; // 4 weeks
const CIRCLES_PER_ROW = 7;
const CIRCLE_MARGIN = 6;
const CONTAINER_PADDING = spacing.md;
const MAX_CIRCLE_SIZE = 44; // Cap the size so it doesn't get huge on web

const AVAILABLE_WIDTH = Math.min(SCREEN_WIDTH - CONTAINER_PADDING * 2, 500);
const CIRCLE_SIZE = Math.min(
    (AVAILABLE_WIDTH - CIRCLE_MARGIN * (CIRCLES_PER_ROW - 1)) / CIRCLES_PER_ROW,
    MAX_CIRCLE_SIZE
);

interface HabitCircleCalendarProps {
    completions: Record<string, number>;
    dailyTarget: number;
    gradientColors: readonly [string, string];
    daysToShow?: number;
}

interface DayData {
    date: Date;
    key: string;
    progress: number;
    dailyTarget: number;
    isCompleted: boolean;
    isToday: boolean;
    isFuture: boolean;
    dayOfMonth: number;
}

const CircleDay = memo(({
    day,
    index,
    gradientColors
}: {
    day: DayData;
    index: number;
    gradientColors: readonly [string, string];
}) => {
    const progressRatio = Math.min(1, day.progress / day.dailyTarget);
    const hasProgress = day.progress > 0;

    return (
        <View style={styles.circleContainer}>
            {hasProgress ? (
                <LinearGradient
                    colors={[...gradientColors]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.circle,
                        styles.circleCompleted,
                        { opacity: 0.2 + progressRatio * 0.8 },
                        day.isToday && styles.circleToday,
                    ]}
                >
                    {day.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                </LinearGradient>
            ) : (
                <View
                    style={[
                        styles.circle,
                        styles.circleEmpty,
                        day.isToday && styles.circleToday,
                        day.isFuture && styles.circleFuture,
                    ]}
                >
                    {day.isToday && (
                        <View style={[styles.todayDot, { backgroundColor: gradientColors[0] }]} />
                    )}
                </View>
            )}
        </View>
    );
});

const HabitCircleCalendar = memo(({
    completions,
    dailyTarget,
    gradientColors,
    daysToShow = DAYS_TO_SHOW,
}: HabitCircleCalendarProps) => {
    const days = useMemo(() => {
        const today = new Date();
        const todayKey = getDateKey(today);
        const result: DayData[] = [];

        for (let i = daysToShow - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const key = getDateKey(date);
            const progress = completions[key] || 0;

            result.push({
                date,
                key,
                progress,
                dailyTarget,
                isCompleted: progress >= dailyTarget,
                isToday: key === todayKey,
                isFuture: date > today,
                dayOfMonth: date.getDate(),
            });
        }

        return result;
    }, [completions, dailyTarget, daysToShow]);

    // Calculate completion stats
    const stats = useMemo(() => {
        const completed = days.filter(d => d.isCompleted && !d.isFuture).length;
        const total = days.filter(d => !d.isFuture).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { completed, total, rate };
    }, [days]);

    // Group days into weeks
    const weeks = useMemo(() => {
        const result: DayData[][] = [];
        for (let i = 0; i < days.length; i += CIRCLES_PER_ROW) {
            result.push(days.slice(i, i + CIRCLES_PER_ROW));
        }
        return result;
    }, [days]);

    // Get week day labels
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Last {daysToShow} Days</Text>
                <View style={styles.statsContainer}>
                    <Text style={styles.statsText}>{stats.completed}/{stats.total}</Text>
                    <View style={[styles.statsBadge, { backgroundColor: gradientColors[0] + '30' }]}>
                        <Text style={[styles.statsPercent, { color: gradientColors[0] }]}>
                            {stats.rate}%
                        </Text>
                    </View>
                </View>
            </View>

            {/* Day labels */}
            <View style={styles.dayLabelsRow}>
                {dayLabels.map((label, i) => (
                    <View key={i} style={styles.dayLabelContainer}>
                        <Text style={styles.dayLabel}>{label}</Text>
                    </View>
                ))}
            </View>

            {/* Circle grid */}
            <View style={styles.grid}>
                {weeks.map((week, weekIndex) => (
                    <View key={weekIndex} style={styles.row}>
                        {week.map((day, dayIndex) => (
                            <CircleDay
                                key={day.key}
                                day={day}
                                index={weekIndex * CIRCLES_PER_ROW + dayIndex}
                                gradientColors={gradientColors}
                            />
                        ))}
                        {/* Fill empty spaces if needed */}
                        {week.length < CIRCLES_PER_ROW &&
                            Array(CIRCLES_PER_ROW - week.length).fill(0).map((_, i) => (
                                <View key={`empty-${i}`} style={styles.circleContainer} />
                            ))
                        }
                    </View>
                ))}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, styles.circleEmpty]} />
                    <Text style={styles.legendText}>Missed</Text>
                </View>
                <View style={styles.legendItem}>
                    <LinearGradient
                        colors={[...gradientColors]}
                        style={[styles.legendCircle]}
                    />
                    <Text style={styles.legendText}>Done</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendCircle, styles.circleTodayLegend]}>
                        <View style={[styles.todayDotLegend, { backgroundColor: gradientColors[0] }]} />
                    </View>
                    <Text style={styles.legendText}>Today</Text>
                </View>
            </View>
        </View>
    );
});

export default HabitCircleCalendar;

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statsText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    statsBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    statsPercent: {
        fontSize: 12,
        fontWeight: '700',
    },
    dayLabelsRow: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
    },
    dayLabelContainer: {
        width: CIRCLE_SIZE,
        marginRight: CIRCLE_MARGIN,
        alignItems: 'center',
    },
    dayLabel: {
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: '600',
    },
    grid: {
        gap: CIRCLE_MARGIN,
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        gap: CIRCLE_MARGIN,
        justifyContent: 'center',
    },
    circleContainer: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
    },
    circle: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circleEmpty: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    circleCompleted: {
        elevation: 3,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            web: {
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }
        })
    },
    circleToday: {
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    circleFuture: {
        opacity: 0.3,
    },
    todayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    checkmark: {
        fontSize: CIRCLE_SIZE * 0.45,
        color: '#fff',
        fontWeight: '700',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.lg,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    legendCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    circleTodayLegend: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayDotLegend: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 12,
        color: colors.textMuted,
    },
});
