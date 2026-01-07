import React, { memo, useCallback, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Platform,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { triggerHaptic, ImpactStyle } from '../utils/feedback';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import { getTodayKey, generateGridData } from '../utils/storage';
import { Habit } from '../types';

interface HabitListItemProps {
    habit: Habit;
    onToggle: (id: string, dateKey?: string) => void;
    onPress: (id: string) => void;
    drag?: () => void;
    isActive?: boolean;
    daysToShow?: number;
}

const HabitListItem = ({ habit, onToggle, onPress, drag, isActive, daysToShow = 7 }: HabitListItemProps) => {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);
    const weekDaysShort = [t.calendar.monday.charAt(0), t.calendar.tuesday.charAt(0), t.calendar.wednesday.charAt(0), t.calendar.thursday.charAt(0), t.calendar.friday.charAt(0), t.calendar.saturday.charAt(0), t.calendar.sunday.charAt(0)];
    const weekDaysSun = [t.calendar.sunday.charAt(0), t.calendar.monday.charAt(0), t.calendar.tuesday.charAt(0), t.calendar.wednesday.charAt(0), t.calendar.thursday.charAt(0), t.calendar.friday.charAt(0), t.calendar.saturday.charAt(0)];
    const todayKey = getTodayKey();
    const progressToday = habit.completions[todayKey] || 0;
    const isCompletedToday = progressToday >= habit.dailyTarget;
    const isExplicitlyFailedToday = habit.explicitFailures?.[todayKey] === true;
    const habitThemeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

    const checkScale = useSharedValue(1);
    const [isProcessing, setIsProcessing] = useState(false);

    const isMonthly = daysToShow > 7;

    // Generate grid data
    // Weekly: Current Week (Mon -> Sun)
    // Monthly: Standard 30 days
    const gridData = useMemo(() => {
        if (!isMonthly) {
            const today = new Date();
            const day = today.getDay(); // 0-6
            const offset = day === 0 ? 6 : day - 1; // Mon=1->0, Sun=0->6

            // Get history (Mon to Today)
            // generateGridData returns [Oldest...Today]
            const history = generateGridData(habit, offset + 1);

            // Pad future days until Sunday (Total 7)
            const padded: any[] = [...history];
            for (let i = history.length; i < 7; i++) padded.push(null);
            return padded;
        }
        return generateGridData(habit, daysToShow);
    }, [habit, daysToShow, isMonthly]);

    const calendarOffset = useMemo(() => {
        if (!isMonthly || gridData.length === 0) return 0;
        return new Date(gridData[0].key).getDay();
    }, [gridData, isMonthly]);

    const handleAction = useCallback(async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        triggerHaptic(ImpactStyle.Light);
        checkScale.value = withSequence(
            withTiming(1.2, { duration: 80 }),
            withTiming(1, { duration: 120 })
        );

        try {
            await Promise.resolve(onToggle(habit.id, todayKey));
        } finally {
            setTimeout(() => setIsProcessing(false), 200);
        }
    }, [onToggle, habit.id, todayKey, isProcessing]);

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    return (
        <Pressable
            onPress={() => onPress(habit.id)}
            onLongPress={drag}
            style={({ pressed }) => [
                styles.container,
                isActive && styles.containerActive,
                pressed && { opacity: 0.8 },
            ]}
        >
            {/* Top Row: Icon, Info, Check Button */}
            <View style={styles.topRow}>
                {/* Icon */}
                <View style={[styles.iconBox, { backgroundColor: habitThemeColor + '20' }]}>
                    <Text style={styles.icon}>{habit.icon}</Text>
                </View>

                {/* Info */}
                <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
                    <Text style={styles.meta}>
                        {progressToday}/{habit.dailyTarget} • {habit.streak}🔥
                    </Text>
                </View>

                {/* Check Button */}
                <Animated.View style={checkStyle}>
                    <Pressable
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={[
                            styles.checkBtn,
                            isCompletedToday
                                ? { backgroundColor: habitThemeColor, borderColor: habitThemeColor }
                                : isExplicitlyFailedToday
                                    ? { backgroundColor: colors.dangerStart, borderColor: colors.dangerStart }
                                    : { borderColor: habitThemeColor + '50', backgroundColor: 'transparent' }
                        ]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleAction();
                        }}
                        delayLongPress={300}
                    >
                        {isCompletedToday ? (
                            <Text style={styles.checkMark}>✓</Text>
                        ) : isExplicitlyFailedToday ? (
                            <Text style={styles.checkMark}>×</Text>
                        ) : (
                            <Text style={[styles.plusIcon, { color: habitThemeColor }]}>+</Text>
                        )}
                    </Pressable>
                </Animated.View>
            </View>

            {/* Grid Container */}
            <View style={styles.gridContainer}>
                {isMonthly && (
                    <View style={styles.weekHeader}>
                        {weekDaysSun.map((d, i) => (
                            <Text key={i} style={styles.weekDayText}>{d}</Text>
                        ))}
                    </View>
                )}

                <View style={[
                    styles.miniGrid,
                    isMonthly && styles.monthlyGrid,
                    { gap: isMonthly ? 4 : 6 },
                    !isMonthly && { justifyContent: 'center', marginLeft: 0, width: '100%', marginTop: 12 }
                ]}>
                    {isMonthly && Array.from({ length: calendarOffset }).map((_, i) => (
                        <View key={`spacer-${i}`} style={styles.miniGridCell} />
                    ))}

                    {gridData.map((day, index) => {
                        if (!day && !isMonthly) {
                            const label = weekDaysShort[index];
                            return (
                                <View style={{ alignItems: 'center', gap: 2 }}>
                                    <View style={[styles.miniGridCell, { width: 26, height: 26, borderRadius: 6, backgroundColor: colors.emptyCell }]} />
                                    <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500' }}>{label}</Text>
                                </View>
                            );
                        }
                        if (!day) return null;

                        const isCompleted = day.progress >= day.dailyTarget;
                        const isFailed = day.isExplicitlyFailed;
                        const isMissed = day.isMissed;
                        const hasProgress = day.progress > 0;
                        const isToday = day.isToday;

                        let bgColor = colors.emptyCell;
                        if (isFailed) bgColor = colors.dangerStart;
                        else if (isCompleted) bgColor = habitThemeColor;
                        else if (isMissed) bgColor = 'rgba(239, 68, 68, 0.2)';
                        else if (hasProgress) bgColor = habitThemeColor;

                        const opacity = isCompleted ? 1 : hasProgress ? 0.4 + (day.progress / day.dailyTarget * 0.6) : 1;

                        const cellSize = isMonthly ? 22 : 26;
                        const borderRadius = isMonthly ? 4 : 6;

                        const dayLabel = !isMonthly ? weekDaysShort[index] : '';

                        return (
                            <View key={index} style={{ alignItems: 'center', gap: 2 }}>
                                <View
                                    style={[
                                        styles.miniGridCell,
                                        {
                                            backgroundColor: bgColor,
                                            opacity,
                                            width: cellSize,
                                            height: cellSize,
                                            borderRadius: borderRadius,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: isToday ? 2 : 0,
                                            borderColor: isToday ? colors.streakStart : 'transparent'
                                        }
                                    ]}
                                >
                                    {/* Icons */}
                                    {isFailed && <Ionicons name="close" size={cellSize * 0.7} color="#fff" />}
                                    {isCompleted && <Ionicons name="checkmark" size={cellSize * 0.7} color="#fff" />}
                                    {!isCompleted && !isFailed && hasProgress && (
                                        <Text style={{ fontSize: cellSize * 0.5, color: '#fff', fontWeight: 'bold' }}>{day.progress}</Text>
                                    )}
                                </View>
                                {!isMonthly && (
                                    <Text style={{
                                        fontSize: 10,
                                        color: colors.textSecondary,
                                        fontWeight: '500'
                                    }}>
                                        {dayLabel}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        </Pressable>
    );
};

export default memo(HabitListItem);


const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        backgroundColor: colors.bgCard,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: spacing.md,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 10,
    },
    containerActive: {
        zIndex: 1000,
        transform: [{ scale: 1.02 }],
        ...Platform.select({
            web: {
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 15,
            },
        }),
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 18,
    },
    info: {
        flex: 1,
    },
    name: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        fontSize: 14,
        letterSpacing: -0.2,
    },
    meta: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 11,
        marginTop: 1,
    },
    checkBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    checkMark: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    plusIcon: {
        fontSize: 18,
        fontWeight: '500',
    },
    miniGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        marginTop: 8,
        marginLeft: 46,
    },
    monthlyGrid: {
        width: 178,
        marginTop: 0,
        marginLeft: 0,
        alignSelf: 'center',
    },
    miniGridCell: {
        width: 22,
        height: 22,
        borderRadius: 4,
    },
    gridContainer: {
        flexDirection: 'column',
        width: '100%',
    },
    weekHeader: {
        flexDirection: 'row',
        gap: 4,
        alignSelf: 'center', // Centered like the grid
        marginBottom: 4,
        marginTop: 8,
    },
    weekDayText: {
        width: 22,
        fontSize: 10,
        textAlign: 'center',
        color: colors.textSecondary,
        fontWeight: '700',
    },
});
