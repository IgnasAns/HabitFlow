import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    RefreshControl,
    ActivityIndicator,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerHaptic, triggerNotificationHaptic, FeedbackType } from '../utils/feedback';
import { useHabits } from '../context/HabitContext';
import { useI18n, interpolate } from '../context/I18nContext';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, typography } from '../theme';
import { getTodayKey } from '../utils/calculations';
import HabitCard from '../components/HabitCard';
import HabitListItem from '../components/HabitListItem';
import ConfettiOverlay from '../components/ConfettiOverlay';
import CelebrationModal, { CelebrationType } from '../components/CelebrationModal';
import StyledModal from '../components/StyledModal';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { Habit } from '../types';

type ViewMode = 'card' | 'list' | 'monthly';
const VIEW_MODE_KEY = '@view_mode';
const PERFECT_DAY_CELEBRATED_KEY = '@perfect_day_celebrated';

const VIEW_MODES: { mode: ViewMode; icon: 'grid-outline' | 'list-outline' | 'calendar-outline' }[] = [
    { mode: 'card', icon: 'grid-outline' },
    { mode: 'list', icon: 'list-outline' },
    { mode: 'monthly', icon: 'calendar-outline' },
];

interface Celebration {
    type: CelebrationType;
    title: string;
    subtitle: string;
    badge?: string;
}

interface HomeScreenProps {
    navigation: NativeStackNavigationProp<any>;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
    const {
        habits,
        isLoading,
        toggleHabitCompletion,
        incrementHabitProgress,
        lastAction,
        clearLastAction,
        refreshData,
        reorderHabits,
        streakSaverNotice,
        clearStreakSaverNotice,
    } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [celebration, setCelebration] = useState<Celebration | null>(null);

    // Archived habits stay out of sight; only active ones are listed.
    const visibleHabits = useMemo(() => habits.filter(h => !h.archived), [habits]);

    // Load view mode preference on mount
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_KEY).then((saved) => {
            if (saved === 'card' || saved === 'list' || saved === 'monthly') {
                setViewMode(saved as ViewMode);
            }
        });
    }, []);

    // Select view mode - haptic FIRST for immediate feedback
    const selectViewMode = useCallback((newMode: ViewMode) => {
        if (newMode === viewMode) return;
        triggerHaptic();

        // Immediate UI update - no animation for instant response
        setViewMode(newMode);

        // Defer storage to next frame to not block UI
        requestAnimationFrame(() => {
            AsyncStorage.setItem(VIEW_MODE_KEY, newMode);
        });
    }, [viewMode]);

    // Stable handlers for HabitCard performance
    const handleToggle = useCallback((id: string, dateKey?: string) => {
        toggleHabitCompletion(id, dateKey);
    }, [toggleHabitCompletion]);

    const handleIncrement = useCallback((id: string, amount: number, dateKey?: string) => {
        incrementHabitProgress(id, amount, dateKey);
    }, [incrementHabitProgress]);

    const handleEdit = useCallback((id: string) => {
        navigation.navigate('HabitDetail', { habitId: id });
    }, [navigation]);

    // Handle last action: confetti plus a full celebration (with share prompt)
    // for the moments that matter — milestones, level-ups, perfect days.
    useEffect(() => {
        if (lastAction?.type === 'TOGGLE_COMPLETE' && lastAction.xpGained && lastAction.xpGained > 0) {
            const habitName = lastAction.habit?.name ?? '';
            if (lastAction.milestone) {
                setConfettiType('streak');
                setShowConfetti(true);
                triggerNotificationHaptic(FeedbackType.Success);
                setCelebration({
                    type: 'milestone',
                    title: interpolate(t.engagement.milestoneTitle, { count: lastAction.milestone }),
                    subtitle: interpolate(t.engagement.milestoneSubtitle, { name: habitName }),
                    badge: lastAction.tokenEarned ? t.engagement.tokenEarned : undefined,
                });
            } else if (lastAction.leveledUp) {
                setConfettiType('levelUp');
                setShowConfetti(true);
                triggerNotificationHaptic(FeedbackType.Success);
                setCelebration({
                    type: 'levelUp',
                    title: interpolate(t.engagement.levelUpTitle, { level: lastAction.newLevel ?? 0 }),
                    subtitle: t.engagement.levelUpSubtitle,
                });
            } else if (lastAction.perfectDay) {
                // Celebrate a perfect day at most once per day
                AsyncStorage.getItem(PERFECT_DAY_CELEBRATED_KEY).then(celebrated => {
                    const today = getTodayKey();
                    if (celebrated !== today) {
                        AsyncStorage.setItem(PERFECT_DAY_CELEBRATED_KEY, today);
                        setConfettiType('completion');
                        setShowConfetti(true);
                        triggerNotificationHaptic(FeedbackType.Success);
                        setCelebration({
                            type: 'perfectDay',
                            title: t.engagement.perfectDayTitle,
                            subtitle: t.engagement.perfectDaySubtitle,
                        });
                    }
                });
            } else if (lastAction.habit?.streak && lastAction.habit.streak > 0 && lastAction.habit.streak % 7 === 0) {
                setConfettiType('streak');
                setShowConfetti(true);
            }
            clearLastAction();
        }
    }, [lastAction]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Habit>) => {
        if (viewMode === 'list' || viewMode === 'monthly') {
            return (
                <ScaleDecorator activeScale={1.02}>
                    <HabitListItem
                        habit={item}
                        onToggle={handleToggle}
                        onIncrement={handleIncrement}
                        onPress={handleEdit}
                        drag={drag}
                        isActive={isActive}
                        daysToShow={viewMode === 'monthly' ? 30 : 7}
                    />
                </ScaleDecorator>
            );
        }

        return (
            <ScaleDecorator activeScale={1.05}>
                <View style={{ marginBottom: 0 }}>
                    <HabitCard
                        habit={item}
                        onToggle={handleToggle}
                        onIncrement={handleIncrement}
                        onPress={handleEdit}
                        drag={drag}
                        isActive={isActive}
                    />
                </View>
            </ScaleDecorator>
        );
    }, [handleToggle, handleIncrement, handleEdit, viewMode]);

    // Header row: segmented view-mode control (replaces the old cycling icon,
    // which was impossible to discover).
    const headerComponent = useMemo(() => (
        <View style={styles.viewModeRow}>
            <View style={styles.segmented}>
                {VIEW_MODES.map(({ mode, icon }) => (
                    <Pressable
                        key={mode}
                        style={[styles.segment, viewMode === mode && styles.segmentActive]}
                        onPress={() => selectViewMode(mode)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: viewMode === mode }}
                        accessibilityLabel={`${mode} view`}
                    >
                        <Ionicons
                            name={icon}
                            size={16}
                            color={viewMode === mode ? colors.textPrimary : colors.textMuted}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    ), [viewMode, selectViewMode, styles, colors]);

    // Memoize empty state
    const emptyComponent = useMemo(() => (
        <Animated.View
            entering={FadeInUp.delay(600)}
            style={styles.emptyState}
        >
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>{t.home.noHabitsYet}</Text>
            <Text style={styles.emptyText}>
                {t.home.startBuilding}
            </Text>
            <Pressable
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AddHabit')}
            >
                <LinearGradient
                    colors={[colors.primaryStart, colors.primaryEnd]} // Use explicit colors from context
                    style={styles.emptyButtonGradient}
                >
                    <Text style={styles.emptyButtonText}>{t.home.addFirstHabit}</Text>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    ), [navigation, t]);

    // Memoize footer spacer - larger to account for safe area insets
    const footerComponent = useMemo(() => <View style={{ height: 100 }} />, []);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primaryStart} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.container}>
                <ConfettiOverlay
                    visible={showConfetti}
                    type={confettiType}
                    onComplete={() => setShowConfetti(false)}
                />

                <CelebrationModal
                    visible={!!celebration}
                    type={celebration?.type ?? 'milestone'}
                    title={celebration?.title ?? ''}
                    subtitle={celebration?.subtitle ?? ''}
                    badge={celebration?.badge}
                    shareLabel={t.engagement.shareIt}
                    dismissLabel={t.engagement.keepGoing}
                    onShare={() => {
                        setCelebration(null);
                        navigation.navigate('Share');
                    }}
                    onDismiss={() => setCelebration(null)}
                />

                <StyledModal
                    visible={!!streakSaverNotice}
                    emoji="🧊"
                    title={t.engagement.streakSaverUsedTitle}
                    message={(streakSaverNotice ?? [])
                        .map(s => interpolate(t.engagement.streakSaverUsedBody, { name: s.habitName, streak: s.streak }))
                        .join('\n')}
                    buttonText={t.common.okay}
                    onClose={clearStreakSaverNotice}
                />

                {/* Top Navigation Bar - Fixed at top */}
                <View style={styles.topBar}>
                    <View>
                        <Pressable
                            style={styles.iconBtn}
                            onPress={() => navigation.navigate('WidgetHub')}
                            accessibilityRole="button"
                            accessibilityLabel={t.nav.settings}
                        >
                            <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
                        </Pressable>
                    </View>

                    <Text style={styles.brandTitle}>HabitFlow</Text>

                    <View style={styles.topRight}>
                        <View>
                            <Pressable
                                style={styles.iconBtn}
                                onPress={() => navigation.navigate('Share')}
                                accessibilityRole="button"
                                accessibilityLabel={t.nav.share}
                            >
                                <Ionicons name="share-social-outline" size={24} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                        <View>
                            <Pressable
                                style={styles.iconBtn}
                                onPress={() => navigation.navigate('Stats')}
                                accessibilityRole="button"
                                accessibilityLabel={t.nav.stats}
                            >
                                <Ionicons name="stats-chart" size={22} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                        <View>
                            <Pressable
                                style={styles.iconBtn}
                                onPress={() => navigation.navigate('AddHabit')}
                                accessibilityRole="button"
                                accessibilityLabel={t.nav.addHabit}
                            >
                                <Ionicons name="add" size={30} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Draggable List */}
                <DraggableFlatList
                    containerStyle={{ flex: 1 }}
                    data={visibleHabits}
                    extraData={viewMode}
                    onDragEnd={({ data }) => {
                        // The list only shows active habits; keep archived ones
                        // (in their original order) at the end of the stored array.
                        const archived = habits.filter(h => h.archived);
                        reorderHabits([...data, ...archived]);
                    }}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={Platform.OS === 'android'}
                    initialNumToRender={5}
                    maxToRenderPerBatch={3}
                    updateCellsBatchingPeriod={50}
                    windowSize={5}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primaryStart}
                        />
                    }
                    ListHeaderComponent={headerComponent}
                    ListEmptyComponent={emptyComponent}
                    ListFooterComponent={footerComponent}
                />
            </View>
        </GestureHandlerRootView>
    );
}


const getStyles = (colors: ThemeColors, insets: EdgeInsets) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: 10,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: Math.max(insets.top, 20) + spacing.sm,
        paddingBottom: spacing.md,
    },
    brandTitle: {
        ...typography.h2,
        color: colors.textPrimary,
        fontWeight: '900',
        fontSize: 22,
    },
    topRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewModeRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: spacing.sm,
    },
    segmented: {
        flexDirection: 'row',
        backgroundColor: colors.glass,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: 3,
        gap: 2,
    },
    segment: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: borderRadius.md - 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: colors.glassHighlight,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 20,
        padding: spacing.xxl,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
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
        marginBottom: spacing.lg,
    },
    emptyButton: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    emptyButtonGradient: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    emptyButtonText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
});
