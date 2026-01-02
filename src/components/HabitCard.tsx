import React, { useMemo, useEffect, memo, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    useWindowDimensions,
    Platform,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withSequence,
    withTiming,
    FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography, shadows } from '../theme';
import { getTodayKey, generateGridData } from '../utils/storage';
import { Habit, GridDay } from '../types';

// Grid configuration constants
const GRID_ROWS = 7;
const VISIBLE_WEEKS = 13; // Number of weeks to show (fits within card width)
const GRID_DAYS = VISIBLE_WEEKS * GRID_ROWS; // Only generate data for visible days
const GAP_RATIO = 0.18; // Gap is ~18% of square size for premium density
const CARD_INNER_PADDING = 20;

interface HabitCardProps {
    habit: Habit;
    onToggle: (id: string, dateKey?: string) => void;
    onIncrement: (id: string, amount: number, dateKey?: string) => void;
    onPress: (id: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Simple GridSquare for non-today cells (no animation overhead)
interface GridSquareProps {
    day: GridDay;
    size: number;
    themeColor: string;
    onAction: (key: string) => void;
    getHeatmapStyle: (day: GridDay) => any;
}

const GridSquare = memo(({ day, size, themeColor, onAction, getHeatmapStyle }: GridSquareProps) => {
    const heatmapStyle = getHeatmapStyle(day);

    return (
        <Pressable
            onPress={() => !day.isInactive && onAction(day.key)}
            disabled={day.isInactive}
            style={({ pressed }) => [
                styles.gridSquare,
                {
                    width: size,
                    height: size,
                    borderRadius: Math.max(2, size * 0.2)
                },
                heatmapStyle,
                pressed && !day.isInactive && { opacity: 0.6, transform: [{ scale: 1.1 }] }
            ]}
            hitSlop={day.isInactive ? 0 : 4}
        />
    );
    // Compare all relevant properties in GridSquare memo  
}, (prev, next) => {
    return prev.day.key === next.day.key &&
        prev.day.progress === next.day.progress &&
        prev.day.isCompleted === next.day.isCompleted &&
        prev.day.isMissed === next.day.isMissed &&
        prev.day.isInactive === next.day.isInactive &&
        prev.size === next.size &&
        prev.themeColor === next.themeColor;
});

// Simple square component for all grid cells (including today)
const SimpleGridSquare = memo(({ day, size, themeColor, onAction }: {
    day: GridDay;
    size: number;
    themeColor: string;
    onAction: (key: string) => void;
}) => {
    // Calculate background color directly
    const getBackgroundColor = () => {
        if (day.isInactive) return 'rgba(255,255,255,0.04)';
        if (day.isExplicitlyFailed) return 'rgba(239, 100, 68, 0.6)'; // Explicit fail - red-orange
        if (day.isMissed) return 'rgba(239, 68, 68, 0.15)'; // Missed - light red

        // If completed or has progress, use the theme color
        if (day.progress > 0) {
            return themeColor;
        }

        // Empty state
        return day.isToday ? 'transparent' : 'rgba(255,255,255,0.08)';
    };

    const getOpacity = () => {
        if (day.isInactive || day.isMissed || day.isExplicitlyFailed) return 1;

        if (day.progress > 0) {
            const ratio = Math.min(1, day.progress / day.dailyTarget);
            // Ensure checked squares are visible enough (0.5 to 1.0)
            return 0.5 + (ratio * 0.5);
        }

        return 1;
    };

    return (
        <Pressable
            onPress={() => !day.isInactive && onAction(day.key)}
            disabled={day.isInactive}
            style={({ pressed }) => [
                {
                    width: size,
                    height: size,
                    borderRadius: Math.max(2, size * 0.25),
                    backgroundColor: getBackgroundColor(),
                    opacity: getOpacity(),
                    borderWidth: (day.isToday || day.isExplicitlyFailed) ? 1.5 : 0,
                    borderColor: day.isExplicitlyFailed
                        ? 'rgba(239, 100, 68, 1)'
                        : day.isToday
                            ? themeColor
                            : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                pressed && !day.isInactive && { transform: [{ scale: 1.15 }] }
            ]}
            hitSlop={day.isInactive ? 0 : 4}
        >
            {day.isExplicitlyFailed && (
                <Text style={{
                    color: '#fff',
                    fontSize: Math.max(8, size * 0.6),
                    fontWeight: '900',
                    lineHeight: Math.max(8, size * 0.65),
                }}>×</Text>
            )}
        </Pressable>
    );
}, (prev, next) => {
    return prev.day.key === next.day.key &&
        prev.day.progress === next.day.progress &&
        prev.day.isCompleted === next.day.isCompleted &&
        prev.day.isMissed === next.day.isMissed &&
        prev.day.isExplicitlyFailed === next.day.isExplicitlyFailed &&
        prev.size === next.size &&
        prev.themeColor === next.themeColor;
});

const HabitCard = ({ habit, onToggle, onIncrement, onPress }: HabitCardProps) => {
    const { width: screenWidth } = useWindowDimensions();

    // Dynamic grid calculations - fit exactly VISIBLE_WEEKS within the card
    const cardWidth = screenWidth - (spacing.md * 4); // HomeScreen padding + container margin
    const availableWidth = cardWidth - (CARD_INNER_PADDING * 2);

    // Calculate square size to fit exactly VISIBLE_WEEKS columns
    // width = cols * squareSize + (cols - 1) * gap
    // width = cols * s + (cols - 1) * s * GAP_RATIO
    // width = s * (cols + (cols - 1) * GAP_RATIO)
    // s = width / (cols + (cols - 1) * GAP_RATIO)
    const effectiveCols = VISIBLE_WEEKS + (VISIBLE_WEEKS - 1) * GAP_RATIO;
    const squareSize = Math.floor(availableWidth / effectiveCols);
    const responsiveGap = Math.floor(squareSize * GAP_RATIO);

    const gridHeight = (squareSize * GRID_ROWS) + (responsiveGap * (GRID_ROWS - 1));

    const todayKey = getTodayKey();
    const progressToday = habit.completions[todayKey] || 0;
    const isCompletedToday = progressToday >= habit.dailyTarget;
    const isExplicitlyFailedToday = habit.explicitFailures?.[todayKey] === true;
    const habitThemeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

    const checkScale = useSharedValue(1);
    const cardScale = useSharedValue(1);
    const progressValue = useSharedValue(progressToday / habit.dailyTarget);
    const [showIncrementOptions, setShowIncrementOptions] = useState(false);

    // Smart increment options based on daily target
    const getSmartIncrements = useMemo(() => {
        const target = habit.dailyTarget;
        if (target <= 1) return [];
        if (target <= 5) return [1];
        if (target <= 10) return [1, 5];
        if (target <= 25) return [1, 5, 10];
        if (target <= 50) return [1, 5, 10, 25];
        if (target <= 100) return [1, 5, 10, 25, 50];
        if (target <= 500) return [1, 10, 25, 50, 100];
        return [1, 10, 50, 100, 250];
    }, [habit.dailyTarget]);

    useEffect(() => {
        progressValue.value = withTiming(Math.min(1, progressToday / habit.dailyTarget), { duration: 200 });
    }, [progressToday, habit.dailyTarget]);

    const progressStyle = useAnimatedStyle(() => ({
        height: `${progressValue.value * 100}%`,
        backgroundColor: habitThemeColor + (isCompletedToday ? '00' : '20'),
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    }));

    const handleAction = useCallback((dateKey?: string) => {
        const targetKey = dateKey || todayKey;

        // Provide haptic feedback and toggle - no confirmation modal
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!dateKey || dateKey === todayKey) {
            checkScale.value = withSequence(
                withTiming(1.3, { duration: 100 }),
                withTiming(1, { duration: 150 })
            );
        }
        onToggle(habit.id, targetKey);
    }, [onToggle, habit.id, todayKey]);

    const handleIncrement = useCallback((amount: number = 1) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onIncrement(habit.id, amount);
        setShowIncrementOptions(false);
    }, [onIncrement, habit.id]);

    const toggleIncrementOptions = useCallback(() => {
        Haptics.selectionAsync();
        setShowIncrementOptions(prev => !prev);
    }, []);

    const handlePressIn = () => {
        cardScale.value = withSpring(0.97);
    };

    const handlePressOut = () => {
        cardScale.value = withSpring(1);
    };

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
        shadowColor: habitThemeColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: Math.min(0.6, progressValue.value * 0.6),
        shadowRadius: progressValue.value * 12,
        elevation: progressValue.value * 8, // Gradient shadow for number habits
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
    }));

    // Generate grid data directly - no memoization to ensure fresh data
    const gridData = generateGridData(habit, GRID_DAYS);

    // Function to calculate opacity for heatmap squares - memoized to prevent stale closures
    const getHeatmapStyle = useCallback((day: any) => {
        if (day.isInactive) return styles.gridSquareInactive;
        if (day.isMissed) return styles.gridSquareMissed;

        const ratio = day.progress / day.dailyTarget;
        if (ratio === 0) return {};

        // Calculate opacity based on progress ratio
        // Min 0.2, Max 1.0
        const opacity = 0.2 + (Math.min(1, ratio) * 0.8);
        return {
            backgroundColor: habitThemeColor,
            opacity: opacity,
        };
    }, [habitThemeColor]);

    return (
        <AnimatedPressable
            onPress={() => onPress(habit.id)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[styles.container, cardStyle]}
        >
            <View style={[
                styles.card,
                {
                    borderColor: isCompletedToday ? habitThemeColor + '40' : 'rgba(255,255,255,0.06)',
                    shadowColor: isCompletedToday ? habitThemeColor : '#000',
                    shadowOpacity: isCompletedToday ? 0.35 : 0.25,
                    shadowRadius: isCompletedToday ? 20 : 12,
                    elevation: isCompletedToday ? 10 : 4
                }
            ]}>
                {/* Header Row */}
                <View style={styles.header}>
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                        <Text style={styles.icon}>{habit.icon}</Text>
                    </View>

                    <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1}>
                            {habit.name}
                        </Text>
                        <Text style={styles.description} numberOfLines={1}>
                            {progressToday}/{habit.dailyTarget} today • {habit.streak} day streak
                        </Text>
                    </View>

                    <View style={styles.actions}>
                        {habit.dailyTarget > 1 && (
                            <View style={styles.incrementContainer}>
                                {showIncrementOptions && getSmartIncrements.length > 1 && (
                                    <View style={styles.incrementPopupContainer}>
                                        <Animated.View
                                            entering={FadeIn.duration(150)}
                                            style={styles.incrementPopup}
                                        >
                                            {Platform.OS !== 'web' && (
                                                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                                            )}
                                            {getSmartIncrements.map((val) => (
                                                <Pressable
                                                    key={val}
                                                    style={({ pressed }) => [
                                                        styles.incrementOption,
                                                        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
                                                    ]}
                                                    onPress={() => handleIncrement(val)}
                                                >
                                                    <Text style={[styles.incrementOptionText, { color: habitThemeColor }]}>+{val}</Text>
                                                </Pressable>
                                            ))}
                                        </Animated.View>
                                    </View>
                                )}
                                <Pressable
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={({ pressed }) => [
                                        styles.incrementBtn,
                                        pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
                                    ]}
                                    onPress={() => getSmartIncrements.length > 1 ? toggleIncrementOptions() : handleIncrement(1)}
                                    onLongPress={() => getSmartIncrements.length > 1 && toggleIncrementOptions()}
                                >
                                    <Text style={[styles.incrementText, { color: habitThemeColor }]}>+{getSmartIncrements.length > 1 ? '' : '1'}</Text>
                                </Pressable>
                            </View>
                        )}

                        <Animated.View style={checkStyle}>
                            <Pressable
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={[
                                    styles.checkBtn,
                                    isCompletedToday
                                        ? { backgroundColor: habitThemeColor, borderColor: habitThemeColor }
                                        : isExplicitlyFailedToday
                                            ? { backgroundColor: 'rgba(239, 100, 68, 0.8)', borderColor: 'rgba(239, 100, 68, 0.8)' }
                                            : { borderColor: habitThemeColor + '40', backgroundColor: 'transparent' }
                                ]}
                                onPress={() => handleAction()}
                            >
                                {!isCompletedToday && !isExplicitlyFailedToday && <Animated.View style={progressStyle} />}
                                {isCompletedToday ? (
                                    <Text style={styles.checkMark}>✓</Text>
                                ) : isExplicitlyFailedToday ? (
                                    <Text style={styles.checkMark}>×</Text>
                                ) : habit.dailyTarget > 1 ? (
                                    <Text style={[styles.progressCount, { color: habitThemeColor }]}>
                                        {progressToday}
                                    </Text>
                                ) : (
                                    <Text style={[styles.plusIcon, { color: habitThemeColor, opacity: 0.6 }]}>+</Text>
                                )}
                            </Pressable>
                        </Animated.View>
                    </View>
                </View>

                {/* Fixed Grid Section - No Scrolling */}
                <View style={[styles.gridSection, { height: gridHeight }]}>
                    <View style={[styles.grid, { gap: responsiveGap }]}>
                        {Array.from({ length: VISIBLE_WEEKS }).map((_, colIndex) => (
                            <View key={colIndex} style={[styles.gridColumn, { gap: responsiveGap }]}>
                                {Array.from({ length: GRID_ROWS }).map((_, rowIndex) => {
                                    const dayIndex = colIndex * GRID_ROWS + rowIndex;
                                    const day = gridData[dayIndex];
                                    if (!day) return null;

                                    return (
                                        <SimpleGridSquare
                                            key={day.key}
                                            day={day}
                                            size={squareSize}
                                            themeColor={habitThemeColor}
                                            onAction={handleAction}
                                        />
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </AnimatedPressable>
    );
};

export default HabitCard;

const styles = StyleSheet.create({
    container: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: 28,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
        ...shadows.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    icon: {
        fontSize: 26,
    },
    info: {
        flex: 1,
    },
    name: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        fontSize: 18,
        letterSpacing: -0.4,
        marginBottom: 4,
    },
    description: {
        ...typography.caption,
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: -1,
    },
    checkBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    checkMark: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
    },
    plusIcon: {
        fontSize: 20,
        fontWeight: '400',
    },
    gridSection: {
        marginTop: 18,
        alignItems: 'center', // Center the grid horizontally
        justifyContent: 'center',
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    gridColumn: {
        flexDirection: 'column',
    },
    gridRow: {
        flexDirection: 'row',
    },
    gridSquare: {
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    gridSquareMissed: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
    },
    gridSquareInactive: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    incrementBtn: {
        width: 34,
        height: 34,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    incrementText: {
        fontSize: 20,
        fontWeight: '700',
    },
    incrementContainer: {
        position: 'relative',
    },
    incrementPopupContainer: {
        position: 'absolute',
        bottom: 44,
        right: -8,
        zIndex: 100,
        minWidth: 200,
    },
    incrementPopup: {
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.05)' : 'rgba(20, 20, 25, 0.98)',
        borderRadius: 14,
        padding: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
        maxWidth: 220,
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    incrementOption: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    incrementOptionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    progressRing: {
        position: 'relative',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ringText: {
        position: 'absolute',
        fontSize: 9,
        fontWeight: '800',
    },
    progressCount: {
        fontSize: 14,
        fontWeight: '800',
    },
    emptyCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
});
