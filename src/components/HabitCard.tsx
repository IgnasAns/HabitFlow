import React, { useMemo, useEffect, memo, useCallback, useState, useRef } from 'react';
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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../context/I18nContext';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, typography, shadows, pickTextOn } from '../theme';
import { getTodayKey, generateGridData } from '../utils/storage';
import { Habit, GridDay } from '../types';
import { triggerHaptic, triggerSelectionHaptic } from '../utils/feedback';

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
    drag?: () => void;
    isActive?: boolean;
}

// Simple square component for all grid cells (including today)
const SimpleGridSquare = memo(({ day, size, themeColor, onAction, opacityMultiplier = 1, colors }: {
    day: GridDay;
    size: number;
    themeColor: string;
    onAction: (key: string) => void;
    opacityMultiplier?: number;
    colors: ThemeColors;
}) => {
    // Calculate background color directly
    const getBackgroundColor = () => {
        if (day.isExplicitlyFailed) return colors.dangerStart; // Explicit fail - solid red
        if (day.isInactive) return colors.emptyCellFaint;
        if (day.isMissed) return colors.dangerStart; // Missed - also solid red (unfilled styling handled by opacity)

        // If completed or has progress, use the theme color
        if (day.progress > 0) {
            return themeColor;
        }

        // Empty state
        return day.isToday ? 'transparent' : colors.emptyCell;
    };

    const getOpacity = () => {
        if (day.isInactive) return 1;
        if (day.isExplicitlyFailed) return 1; // Explicitly failed - full opacity
        if (day.isMissed) return 0.3; // Missed - lighter opacity (not filled look)

        if (day.progress > 0) {
            const ratio = Math.min(1, day.progress / day.dailyTarget);
            // Ensure checked squares are visible enough (0.5 to 1.0)
            return 0.5 + (ratio * 0.5);
        }

        // Empty state - apply temporal fading
        return opacityMultiplier;
    };

    // Handle press with event consumption to prevent card navigation
    const handlePress = useCallback((e?: any) => {
        // Stop the event from propagating to the parent card
        e?.stopPropagation?.();
        if (!day.isInactive) {
            onAction(day.key);
        }
    }, [day.isInactive, day.key, onAction]);

    // Determine if we should show a checkmark (completed habits)
    const isCompleted = day.progress >= day.dailyTarget && !day.isExplicitlyFailed && !day.isMissed;

    return (
        <Pressable
            onPress={handlePress}
            disabled={day.isInactive && !day.isExplicitlyFailed}
            style={({ pressed }) => [
                {
                    width: size,
                    height: size,
                    borderRadius: Math.max(2, size * 0.25),
                    backgroundColor: getBackgroundColor(),
                    opacity: getOpacity(),
                    borderWidth: (day.isToday || day.isExplicitlyFailed) ? 2 : 0,
                    borderColor: day.isExplicitlyFailed
                        ? colors.dangerStart
                        : day.isToday
                            ? themeColor // Highlight "today" in the habit's own colour (consistent app-wide)
                            : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                pressed && (!day.isInactive || day.isExplicitlyFailed) && { transform: [{ scale: 1.15 }] }
            ]}
            hitSlop={(!day.isInactive || day.isExplicitlyFailed) ? 4 : 0}
        >
            {day.isExplicitlyFailed && (
                <Ionicons
                    name="close"
                    size={Math.max(8, size * 0.55)}
                    color={pickTextOn(colors.dangerStart)}
                />
            )}
            {isCompleted && (
                <Ionicons
                    name="checkmark"
                    size={Math.max(6, size * 0.5)}
                    color={pickTextOn(themeColor)}
                />
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
        prev.themeColor === next.themeColor &&
        prev.opacityMultiplier === next.opacityMultiplier;
});

const HabitCard = ({ habit, onToggle, onIncrement, onPress, drag, isActive }: HabitCardProps) => {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]); // Dynamic styles
    const monthNames = [t.calendar.januaryShort, t.calendar.februaryShort, t.calendar.marchShort, t.calendar.aprilShort, t.calendar.mayShort, t.calendar.juneShort, t.calendar.julyShort, t.calendar.augustShort, t.calendar.septemberShort, t.calendar.octoberShort, t.calendar.novemberShort, t.calendar.decemberShort];
    const weekDaysSun = [t.calendar.sunday.charAt(0), t.calendar.monday.charAt(0), t.calendar.tuesday.charAt(0), t.calendar.wednesday.charAt(0), t.calendar.thursday.charAt(0), t.calendar.friday.charAt(0), t.calendar.saturday.charAt(0)];

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
    const isWeekly = habit.frequency === 'weekly';

    // Weekly Progress Calculation (Matches HabitListItem)
    const weeklyProgress = useMemo(() => {
        if (!isWeekly) return 0;
        const today = new Date();
        const day = today.getDay(); // 0-6 (Sun-Sat)
        const diffToMon = day === 0 ? 6 : day - 1; // Mon=0, Sun=6

        let sum = 0;
        for (let i = 0; i <= diffToMon; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const dStr = String(date.getDate()).padStart(2, '0');
            const dKey = `${y}-${m}-${dStr}`;

            if ((habit.completions[dKey] || 0) >= 1) {
                sum += 1;
            }
        }
        return sum;
    }, [habit.completions, isWeekly]);

    const checkScale = useSharedValue(1);
    const cardScale = useSharedValue(1);
    const progressValue = useSharedValue(progressToday / habit.dailyTarget);
    const [showIncrementOptions, setShowIncrementOptions] = useState(false);

    // Smart increment options - filter out options >= remaining (check button handles completion)
    const getSmartIncrements = useMemo(() => {
        const target = habit.dailyTarget;
        const remaining = target - progressToday;
        if (target <= 1 || remaining <= 0) return [];

        // Base options by target size
        let baseOptions: number[];
        if (target <= 5) baseOptions = [1];
        else if (target <= 10) baseOptions = [1, 5];
        else if (target <= 25) baseOptions = [1, 5, 10];
        else if (target <= 50) baseOptions = [1, 5, 10, 25];
        else if (target <= 100) baseOptions = [1, 5, 10, 25, 50];
        else if (target <= 500) baseOptions = [1, 10, 25, 50, 100];
        else baseOptions = [1, 10, 50, 100, 250];

        // Filter: must be less than remaining (not equal - check button does that)
        return baseOptions.filter(v => v < remaining);
    }, [habit.dailyTarget, progressToday]);

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

        // Immediate haptic feedback
        triggerHaptic();
        if (!dateKey || dateKey === todayKey) {
            checkScale.value = withSequence(
                withTiming(1.3, { duration: 100 }),
                withTiming(1, { duration: 150 })
            );
        }

        // Trigger action immediately (optimistic update in context)
        onToggle(habit.id, targetKey);
    }, [onToggle, habit.id, todayKey]);

    const handleIncrement = useCallback((amount: number = 1) => {
        // Immediate haptic feedback
        triggerHaptic();
        setShowIncrementOptions(false);
        // Trigger action immediately
        onIncrement(habit.id, amount);
    }, [onIncrement, habit.id]);

    const toggleIncrementOptions = useCallback(() => {
        triggerSelectionHaptic();
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
        // Note: shadows on web render as squares, not circles
        // Only apply glow shadow on native platforms
        ...(Platform.OS !== 'web' ? {
            shadowColor: habitThemeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: Math.min(0.6, progressValue.value * 0.6),
            shadowRadius: progressValue.value * 12,
            elevation: progressValue.value * 8,
        } : {}),
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
    }));

    // Generate aligned grid data (Starting Sunday, ending Next Saturday)
    const gridData = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, ... 6=Sat

        // Calculate how far back we need to go to find the Sunday of the first week
        // We show VISIBLE_WEEKS columns.
        // The last column is the current week.
        // Start date = Sunday of (VISIBLE_WEEKS - 1) weeks ago.
        const daysBack = (VISIBLE_WEEKS - 1) * 7 + dayOfWeek;

        // Get history ending Today
        const history = generateGridData(habit, daysBack + 1);

        // We typically have 13 * 7 = 91 cells total.
        // history length is daysBack + 1.
        // Remaining cells are future days in the current week.
        const totalCells = VISIBLE_WEEKS * GRID_ROWS;
        const futureCount = totalCells - history.length;

        const padded: (GridDay | null)[] = [...history];

        // Add placeholders for future
        for (let i = 0; i < futureCount; i++) {
            padded.push(null);
        }

        return padded;
    }, [habit]);

    // Handler for navigating to habit details - stops propagation from child elements
    const handleCardPress = useCallback(() => {
        onPress(habit.id);
    }, [onPress, habit.id]);

    return (
        <Animated.View
            style={[
                styles.container,
                cardStyle,
                isActive && {
                    zIndex: 1000,
                    transform: [{ scale: 1.05 }],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.5,
                    shadowRadius: 20,
                    elevation: 20,
                }
            ]}
        >
            <Pressable
                onPress={handleCardPress}
                onLongPress={drag}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={[
                    styles.card,
                    {
                        borderColor: isCompletedToday ? habitThemeColor + '20' : 'rgba(255,255,255,0.06)',
                        // Subtle shadow only, not glowing borders
                    }
                ]}>
                {/* Header Row - with actions inline */}
                <View style={styles.header}>
                    {/* Left side - info */}
                    <View style={styles.headerLeft}>
                        <View style={[styles.iconBox, { backgroundColor: colors.emptyCell }]}>
                            <Text style={styles.icon}>{habit.icon}</Text>
                        </View>

                        <View style={styles.info}>
                            <Text style={styles.name} numberOfLines={1}>
                                {habit.name}
                            </Text>
                            <View style={styles.descriptionRow}>
                                <Text style={styles.description} numberOfLines={1}>
                                    {isWeekly ? (
                                        `${weeklyProgress}/${habit.dailyTarget} ${t.common.week.toLowerCase()} • ${habit.streak}${habit.streak > 0 ? '🔥' : ''}`
                                    ) : (
                                        `${progressToday}/${habit.dailyTarget} today • ${habit.streak}${habit.streak > 0 ? '🔥' : ''}`
                                    )}
                                    {habit.timeSlot && ` • ⏰ ${habit.timeSlot.start}-${habit.timeSlot.end}`}
                                </Text>
                                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
                            </View>
                        </View>
                    </View>

                    {/* Right side - Actions (don't navigate) */}
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
                                    onPressIn={(e) => e.stopPropagation()}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        getSmartIncrements.length > 1 ? toggleIncrementOptions() : handleIncrement(1);
                                    }}
                                    onLongPress={(e) => {
                                        e.stopPropagation();
                                        getSmartIncrements.length > 1 && toggleIncrementOptions();
                                    }}
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
                                            ? { backgroundColor: colors.dangerStart, borderColor: colors.dangerStart }
                                            : { borderColor: habitThemeColor + '40', backgroundColor: 'transparent' }
                                ]}
                                onPressIn={(e) => e.stopPropagation()}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleAction();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={habit.name}
                                accessibilityState={{ checked: isCompletedToday }}
                            >
                                {!isCompletedToday && !isExplicitlyFailedToday && <Animated.View style={progressStyle} />}
                                {isCompletedToday ? (
                                    <Ionicons name="checkmark" size={20} color={pickTextOn(habitThemeColor)} style={{ backgroundColor: 'transparent', textShadowColor: 'transparent' }} />
                                ) : isExplicitlyFailedToday ? (
                                    <Ionicons name="close" size={20} color={pickTextOn(colors.dangerStart)} style={{ backgroundColor: 'transparent', textShadowColor: 'transparent' }} />
                                ) : habit.dailyTarget > 1 ? (
                                    <Text style={[styles.progressCount, { color: habitThemeColor }]}>
                                        {progressToday}
                                    </Text>
                                ) : (
                                    <Ionicons name="add" size={22} color={habitThemeColor} style={{ opacity: 0.6, backgroundColor: 'transparent' }} />
                                )}
                            </Pressable>
                        </Animated.View>
                    </View>
                </View>

                {/* Fixed Grid Section - No Scrolling, minimal top margin */}
                {/* Fixed Grid Section with Labels */}
                <View style={[styles.gridSection, { height: gridHeight + 30, paddingTop: 6 }]}>

                    {/* Month Labels - Use gap to match grid exactly */}
                    <View style={{ flexDirection: 'row', marginLeft: 32, marginBottom: 8, gap: responsiveGap, height: 14 }}>
                        {Array.from({ length: VISIBLE_WEEKS }).map((_, colIndex) => {
                            const dayIndex = colIndex * GRID_ROWS;
                            const day = gridData[dayIndex];

                            // Logic to show month label only when month changes
                            let showLabel = false;
                            let monthLabel = '';
                            let labelOpacity = 1;

                            if (day) {
                                const date = new Date(day.key);
                                const prevDay = colIndex > 0 ? gridData[(colIndex - 1) * GRID_ROWS] : null;
                                const prevDate = prevDay ? new Date(prevDay.key) : null;

                                if (!prevDate || date.getMonth() !== prevDate.getMonth()) {
                                    if (colIndex < VISIBLE_WEEKS - 2) {
                                        showLabel = true;
                                        monthLabel = monthNames[date.getMonth()];

                                        // Calculate opacity based on month recency
                                        const today = new Date();
                                        const monthDiff = (today.getFullYear() - date.getFullYear()) * 12 + (today.getMonth() - date.getMonth());
                                        // 0 -> 1, 1 -> 0.7, 2 -> 0.4, 3+ -> 0.3
                                        labelOpacity = Math.max(0.3, 1 - (monthDiff * 0.3));
                                    }
                                }
                            }

                            return (
                                <View key={colIndex} style={{ width: squareSize, height: 14, overflow: 'visible', alignItems: 'flex-start' }}>
                                    {showLabel && (
                                        <Text style={{ fontSize: 10, color: colors.textSecondary, opacity: labelOpacity, width: 30, position: 'absolute', top: 0, left: -6, textAlign: 'center' }} numberOfLines={1}>
                                            {monthLabel}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    <View style={{ flexDirection: 'row' }}>
                        {/* Day Labels (Left) - Nudge down slightly for visual center alignment */}
                        <View style={{ width: 24, marginRight: 8, gap: responsiveGap, paddingTop: 1 }}>
                            {weekDaysSun.map((d, i) => (
                                <View key={i} style={{ height: squareSize, justifyContent: 'center', alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 12 }}>{d}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Grid */}
                        <View style={[styles.grid, { gap: responsiveGap }]}>
                            {Array.from({ length: VISIBLE_WEEKS }).map((_, colIndex) => (
                                <View key={colIndex} style={[styles.gridColumn, { gap: responsiveGap }]}>
                                    {Array.from({ length: GRID_ROWS }).map((_, rowIndex) => {
                                        const dayIndex = colIndex * GRID_ROWS + rowIndex;
                                        const day = gridData[dayIndex];
                                        if (!day) {
                                            return <View key={`empty-${dayIndex}`} style={{ width: squareSize, height: squareSize }} />;
                                        }

                                        // Calculate opacity based on month recency
                                        const date = new Date(day.key);
                                        const today = new Date();
                                        const monthDiff = (today.getFullYear() - date.getFullYear()) * 12 + (today.getMonth() - date.getMonth());
                                        const opacity = Math.max(0.3, 1 - (monthDiff * 0.3));

                                        return (
                                            <SimpleGridSquare
                                                key={day.key}
                                                day={day}
                                                size={squareSize}
                                                themeColor={habitThemeColor}
                                                onAction={handleAction}
                                                opacityMultiplier={opacity}
                                                colors={colors}
                                            />
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
};

export default React.memo(HabitCard);


const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    descriptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
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
        marginTop: 10,
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
    progressCount: {
        fontSize: 14,
        fontWeight: '800',
    },
});

