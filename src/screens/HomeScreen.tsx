import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInUp,
} from 'react-native-reanimated';
import { triggerHaptic, triggerNotificationHaptic, FeedbackType } from '../utils/feedback';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import HabitCard from '../components/HabitCard';
import HabitListItem from '../components/HabitListItem';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { Habit } from '../types';

type ViewMode = 'card' | 'list' | 'monthly';
const VIEW_MODE_KEY = '@view_mode';

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
    } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');
    const [refreshing, setRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Load view mode preference on mount
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_KEY).then((saved) => {
            if (saved === 'card' || saved === 'list' || saved === 'monthly') {
                setViewMode(saved as ViewMode);
            }
        });
    }, []);

    // Toggle view mode
    const toggleViewMode = useCallback(() => {
        let newMode: ViewMode = 'list';
        if (viewMode === 'list') newMode = 'monthly';
        else if (viewMode === 'monthly') newMode = 'card';

        setViewMode(newMode);
        setViewMode(newMode);
        AsyncStorage.setItem(VIEW_MODE_KEY, newMode);
        triggerHaptic();
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

    // Handle last action (show confetti, etc.)
    useEffect(() => {
        if (lastAction?.type === 'TOGGLE_COMPLETE' && lastAction.xpGained && lastAction.xpGained > 0) {
            if (lastAction.leveledUp) {
                setConfettiType('levelUp');
                setShowConfetti(true);
                triggerNotificationHaptic(FeedbackType.Success);
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

    // Header spacer for list
    const headerComponent = useMemo(() => <View style={{ height: 10 }} />, []);

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

                {/* Top Navigation Bar - Fixed at top */}
                <View style={styles.topBar}>
                    <View>
                        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('WidgetHub')}>
                            <Ionicons name="settings-outline" size={24} color={colors.textPrimary} />
                        </Pressable>
                    </View>

                    <Text style={styles.brandTitle}>HabitFlow</Text>

                    <View style={styles.topRight}>
                        <View>
                            <Pressable style={styles.iconBtn} onPress={toggleViewMode}>
                                <Ionicons
                                    name={viewMode === 'list' ? 'calendar-outline' : viewMode === 'monthly' ? 'grid-outline' : 'list-outline'}
                                    size={22}
                                    color={colors.textPrimary}
                                />
                            </Pressable>
                        </View>
                        <View>
                            <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Share')}>
                                <Ionicons name="share-social-outline" size={24} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                        <View>
                            <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Stats')}>
                                <Ionicons name="stats-chart" size={22} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                        <View>
                            <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('AddHabit')}>
                                <Ionicons name="add" size={30} color={colors.textPrimary} />
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Draggable List */}
                <DraggableFlatList
                    containerStyle={{ flex: 1 }}
                    data={habits}
                    onDragEnd={({ data }) => reorderHabits(data)}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
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


const getStyles = (colors: any) => StyleSheet.create({
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
        paddingTop: 60,
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
